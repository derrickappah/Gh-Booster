const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateToken, generateApiKey } = require('../auth');

class AuthService {
  static async register({ username, email, password, phone }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();
    const cleanPhone = phone ? phone.trim() : null;

    // 1. Pure Supabase Auth Signup
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: { username: cleanUsername, full_name: cleanUsername, phone: cleanPhone }
      }
    });

    if (authErr && !authErr.message.includes('User already registered')) {
      throw new Error(authErr.message);
    }

    let userId = authData?.user?.id;

    if (!userId) {
      const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
      if (existingProfile) {
        userId = existingProfile.id;
      } else {
        throw new Error(authErr ? authErr.message : 'User creation failed in Supabase');
      }
    }

    const apiKey = generateApiKey();
    const referralCode = 'ref_' + Math.random().toString(36).substring(2, 8);

    // 2. Create Profile in Supabase PostgreSQL
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: cleanEmail,
      full_name: cleanUsername,
      username: cleanUsername,
      phone: cleanPhone,
      role: 'user',
      api_key: apiKey,
      referral_code: referralCode,
      updated_at: new Date().toISOString()
    });

    // 3. Create Wallet in Supabase PostgreSQL with 0.00 initial balance
    const initialBalance = 0.0;
    await supabaseAdmin.from('wallets').upsert({
      user_id: userId,
      balance: initialBalance,
      currency: 'GHS',
      updated_at: new Date().toISOString()
    });

    const token = authData?.session?.access_token || generateToken({ id: userId, username: cleanUsername, role: 'user', email: cleanEmail });

    return {
      token,
      user: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        phone: cleanPhone,
        balance: initialBalance,
        currency: 'GHS',
        role: 'user',
        api_key: apiKey
      }
    };
  }

  static async login({ username, password }) {
    const inputStr = username.trim();
    let emailToUse = inputStr;

    // Resolve username to email from Supabase profiles table if input is not an email
    if (!inputStr.includes('@')) {
      let { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('username', inputStr)
        .maybeSingle();

      if (!profile) {
        const { data: p2 } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('full_name', inputStr)
          .maybeSingle();
        profile = p2;
      }

      if (profile && profile.email) {
        emailToUse = profile.email;
      }
    }

    // Authenticate exclusively via Supabase Auth API
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password
    });

    if (authErr || !authData?.session || !authData?.user) {
      throw new Error(authErr ? authErr.message : 'Invalid credentials. Please check your username/email and password.');
    }

    const token = authData.session.access_token;
    const userId = authData.user.id;

    // Fetch Profile & Wallet directly from Supabase PostgreSQL tables
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle();
    const { data: wallet } = await supabaseAdmin.from('wallets').select('balance, currency').eq('user_id', userId).maybeSingle();

    return {
      token,
      user: {
        id: userId,
        username: profile?.username || profile?.full_name || emailToUse.split('@')[0],
        email: emailToUse,
        phone: profile?.phone || null,
        balance: wallet ? parseFloat(wallet.balance) : 0.0,
        currency: wallet?.currency || 'GHS',
        role: profile?.role || 'user',
        api_key: profile?.api_key || null
      }
    };
  }

  static async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { message: 'Password updated successfully in Supabase!' };
  }

  static async generateApiKey(userId) {
    const newKey = generateApiKey();
    await supabaseAdmin.from('profiles').update({ api_key: newKey }).eq('id', userId);
    return newKey;
  }
}

module.exports = AuthService;
