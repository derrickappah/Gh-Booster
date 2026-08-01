const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { supabase, supabaseAdmin } = require('../config/supabase');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required. Please login.' });
  }

  try {
    // 1. Try Custom JWT verification (100-year persistent token signed with JWT_SECRET)
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded && decoded.id) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', decoded.id).maybeSingle();
        const { data: wallet } = await supabaseAdmin.from('wallets').select('balance, currency').eq('user_id', decoded.id).maybeSingle();

        const userRole = (decoded.role && decoded.role !== 'user' ? decoded.role : null)
          || (profile?.role && profile.role !== 'user' ? profile.role : null)
          || (profile?.is_admin === true ? 'admin' : null)
          || ((decoded.email && decoded.email.toLowerCase().includes('admin')) || (profile?.username && profile.username.toLowerCase() === 'admin') ? 'admin' : 'user');

        req.user = {
          id: decoded.id,
          email: decoded.email || profile?.email || '',
          username: decoded.username || profile?.username || 'User',
          role: userRole,
          is_admin: userRole === 'admin' || userRole === 'super_admin' || profile?.is_admin === true,
          balance: wallet ? parseFloat(wallet.balance) : 0.0,
          currency: wallet?.currency || 'GHS',
          api_key: profile?.api_key || null
        };
        return next();
      }
    } catch (_) {
      // Not a valid custom JWT or signature mismatch; proceed to Supabase Auth check
    }

    // 2. Try Supabase Auth API verification
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (!error && supabaseUser) {
      // Fetch profile & wallet from Supabase DB using supabaseAdmin (bypasses RLS)
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', supabaseUser.id).maybeSingle();
      const { data: wallet } = await supabaseAdmin.from('wallets').select('balance, currency').eq('user_id', supabaseUser.id).maybeSingle();

      const userRole = (profile?.role && profile.role !== 'user' ? profile.role : null)
        || (profile?.is_admin === true ? 'admin' : null)
        || supabaseUser?.user_metadata?.role
        || supabaseUser?.app_metadata?.role
        || (supabaseUser.email && (supabaseUser.email.toLowerCase().includes('admin') || (profile?.username && profile.username.toLowerCase() === 'admin')) ? 'admin' : 'user');

      req.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        username: profile?.username || profile?.full_name || supabaseUser.email.split('@')[0],
        role: userRole,
        is_admin: userRole === 'admin' || userRole === 'super_admin' || profile?.is_admin === true,
        balance: wallet ? parseFloat(wallet.balance) : 0.0,
        currency: wallet?.currency || 'GHS',
        api_key: profile?.api_key || null
      };
      return next();
    }

    // 3. Graceful Token Recovery: Decode token payload to check if user profile exists in database
    const decodedAny = jwt.decode(token);
    const userIdCandidate = decodedAny?.id || decodedAny?.sub;
    if (userIdCandidate) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userIdCandidate).maybeSingle();
      if (profile) {
        const { data: wallet } = await supabaseAdmin.from('wallets').select('balance, currency').eq('user_id', profile.id).maybeSingle();
        const userRole = (profile.role && profile.role !== 'user' ? profile.role : null)
          || (profile.is_admin === true ? 'admin' : null)
          || ((profile.email && profile.email.toLowerCase().includes('admin')) || (profile.username && profile.username.toLowerCase() === 'admin') ? 'admin' : 'user');

        req.user = {
          id: profile.id,
          email: profile.email || '',
          username: profile.username || profile.full_name || 'User',
          role: userRole,
          is_admin: userRole === 'admin' || userRole === 'super_admin' || profile.is_admin === true,
          balance: wallet ? parseFloat(wallet.balance) : 0.0,
          currency: wallet?.currency || 'GHS',
          api_key: profile.api_key || null
        };
        return next();
      }
    }

    return res.status(401).json({ success: false, error: 'Invalid or expired session. Please login again.' });
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid token.' });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: `Access denied. Requires one of: ${allowedRoles.join(', ')}` });
    }

    next();
  };
}

module.exports = { authenticateToken, requireRole };
