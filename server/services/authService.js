const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateToken, generateApiKey } = require('../auth');

class AuthService {
  static async register({ fullname, username, email, password, phone }) {
    const cleanEmail = email.trim().toLowerCase();
    const baseName = (fullname || username || cleanEmail.split('@')[0]).trim();
    const cleanFullName = fullname ? fullname.trim() : baseName;
    const cleanPhone = phone ? phone.trim() : null;

    // Check if email already exists in profiles
    const { data: existingEmailProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingEmailProfile) {
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
      const msg = (authErr.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user_already_exists')) {
        throw new Error('An account with this email address already exists. Please log in.');
      }
      throw new Error(authErr.message);
    }

    // Check if Supabase returned an existing user (identities array is empty when user already exists)
    if (authData?.user?.identities && authData.user.identities.length === 0) {
      throw new Error('An account with this email address already exists. Please log in.');
    }

    const userId = authData?.user?.id;
    if (!userId) {
      throw new Error('User creation failed in Supabase Auth.');
    }

    // Ensure a unique username for profiles table
    let targetUsername = (username || cleanFullName || cleanEmail.split('@')[0]).trim().replace(/\s+/g, '_').toLowerCase();
    const { data: existingUserCheck } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', targetUsername)
      .neq('id', userId)
      .maybeSingle();

    if (existingUserCheck) {
      targetUsername = `${targetUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const apiKey = generateApiKey();
    const referralCode = 'ref_' + require('crypto').randomBytes(6).toString('hex');

    // 2. Create or Upsert Profile in Supabase PostgreSQL
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: cleanEmail,
      full_name: cleanFullName,
      username: targetUsername,
      phone: cleanPhone,
      role: 'user',
      api_key: apiKey,
      referral_code: referralCode,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (profileErr) {
      console.error('[AuthService] Profile creation error:', profileErr.message);
      const pMsg = (profileErr.message || '').toLowerCase();
      if (pMsg.includes('profiles_pkey') || pMsg.includes('profiles_email_key') || pMsg.includes('duplicate key')) {
        throw new Error('An account with this email address already exists. Please log in.');
      }
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

    const token = generateToken({ id: userId, username: targetUsername, role: 'user', email: cleanEmail });

    return {
      token,
      user: {
        id: userId,
        username: targetUsername,
        full_name: cleanFullName,
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
    // Rate-limited at route level (authLimiter), additional account-level protection:
    // Log failed login attempt for audit trail
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
      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: null,
          action: 'FAILED_LOGIN',
          details: `Failed login attempt for ${emailToUse}`
        });
      } catch (_) {}
      throw new Error(authErr ? authErr.message : 'Invalid credentials. Please check your username/email and password.');
    }

    const userId = authData.user.id;

    // Fetch Profile & Wallet directly from Supabase PostgreSQL tables
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle();
    const { data: wallet } = await supabaseAdmin.from('wallets').select('balance, currency').eq('user_id', userId).maybeSingle();

    const userRole = profile?.role || 'user';

    const user = {
      id: userId,
      username: profile?.username || profile?.full_name || emailToUse.split('@')[0],
      email: emailToUse,
      phone: profile?.phone || null,
      balance: wallet ? parseFloat(wallet.balance) : 0.0,
      currency: wallet?.currency || 'GHS',
      role: userRole,
      is_admin: userRole === 'admin' || userRole === 'super_admin',
      api_key: profile?.api_key || null
    };

    const token = generateToken(user);

    // Log successful login
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        action: userRole === 'admin' || userRole === 'super_admin' ? 'ADMIN_LOGIN' : 'USER_LOGIN',
        details: `User ${emailToUse} logged in successfully`
      });
    } catch (_) {}

    return {
      token,
      user
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
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new Error('New password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new Error('New password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new Error('New password must contain at least one number.');
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
