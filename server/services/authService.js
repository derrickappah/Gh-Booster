const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateToken, generateApiKey } = require('../auth');

class AuthService {
  static async register({ fullname, username, email, password, phone }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = (fullname || username || cleanEmail.split('@')[0]).trim();
    const cleanPhone = phone ? phone.trim() : null;

    // Check if email already exists in profiles
    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingEmail) {
      throw new Error('An account with this email address already exists. Please log in.');
    }

    // 1. Pure Supabase Auth Signup
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: { username: cleanFullName, full_name: cleanFullName, phone: cleanPhone }
      }
    });

    if (authErr) {
      if (authErr.message && authErr.message.toLowerCase().includes('already registered')) {
        throw new Error('An account with this email address already exists. Please log in.');
      }
      throw new Error(authErr.message);
    }

    const userId = authData?.user?.id;
    if (!userId) {
      throw new Error('User creation failed in Supabase Auth.');
    }

    const apiKey = generateApiKey();
    const referralCode = 'ref_' + Math.random().toString(36).substring(2, 8);

    // 2. Create or Upsert Profile in Supabase PostgreSQL
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: cleanEmail,
      full_name: cleanFullName,
      username: cleanFullName,
      phone: cleanPhone,
      role: 'user',
      api_key: apiKey,
      referral_code: referralCode,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (profileErr) {
      console.error('[AuthService] Profile creation error:', profileErr.message);
      throw new Error('Could not create user profile: ' + profileErr.message);
    }

    // 3. Create or Upsert Wallet in Supabase PostgreSQL with 0.00 initial balance
    const initialBalance = 0.0;
    const { error: walletErr } = await supabaseAdmin.from('wallets').upsert({
      user_id: userId,
      balance: initialBalance,
      currency: 'GHS',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (walletErr) {
      console.error('[AuthService] Wallet creation error:', walletErr.message);
    }

    const token = authData?.session?.access_token || generateToken({ id: userId, username: cleanFullName, role: 'user', email: cleanEmail });

    return {
      token,
      user: {
        id: userId,
        username: cleanFullName,
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
    const inputStr = (username || '').trim();
    let emailToUse = inputStr.toLowerCase();

    // Resolve username to email from Supabase profiles table if input is not an email
    if (!inputStr.includes('@')) {
      let { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .ilike('username', inputStr)
        .maybeSingle();

      if (!profile) {
        const { data: p2 } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .ilike('full_name', inputStr)
          .maybeSingle();
        profile = p2;
      }

      if (profile && profile.email) {
        emailToUse = profile.email.toLowerCase();
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

  static async forgotPassword(email) {
    if (!email) {
      throw new Error('Email is required for password reset.');
    }
    const baseUrl = process.env.APP_URL || 'https://ghbooster.com';
    const redirectUrl = `${baseUrl.replace(/\/$/, '')}/login.html`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUrl
    });
    if (error) {
      // Log internally but don't expose to client (prevents email enumeration)
      console.warn('[AuthService] Password reset request error:', error.message);
    }
    return { message: 'Password reset email sent if account exists.' };
  }

  static async updatePassword(userId, newPassword) {
    if (!userId) {
      throw new Error('User ID is required to update password.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw new Error(error.message);
    return { message: 'Password updated successfully!' };
  }

  static async generateApiKey(userId) {
    const newKey = generateApiKey();
    await supabaseAdmin.from('profiles').update({ api_key: newKey }).eq('id', userId);
    return newKey;
  }
}

module.exports = AuthService;
