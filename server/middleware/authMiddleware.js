const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { supabase } = require('../config/supabase');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required. Please login.' });
  }

  try {
    // 1. Try Supabase Auth API verification
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (!error && supabaseUser) {
      // Fetch profile & wallet from Supabase DB
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', supabaseUser.id).maybeSingle();
      const { data: wallet } = await supabase.from('wallets').select('balance, currency').eq('user_id', supabaseUser.id).maybeSingle();

      req.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        username: profile?.username || profile?.full_name || supabaseUser.email.split('@')[0],
        role: profile?.role || 'user',
        balance: wallet ? parseFloat(wallet.balance) : 0.0,
        currency: wallet?.currency || 'GHS',
        api_key: profile?.api_key || null
      };
      return next();
    }

    // 2. Fallback JWT custom verification
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (decoded && decoded.id) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', decoded.id).maybeSingle();
      const { data: wallet } = await supabase.from('wallets').select('balance, currency').eq('user_id', decoded.id).maybeSingle();

      req.user = {
        id: decoded.id,
        email: decoded.email || profile?.email || '',
        username: decoded.username || profile?.username || 'User',
        role: decoded.role || profile?.role || 'user',
        balance: wallet ? parseFloat(wallet.balance) : 0.0,
        currency: wallet?.currency || 'GHS',
        api_key: profile?.api_key || null
      };
      return next();
    }

    return res.status(403).json({ success: false, error: 'Invalid or expired session. Please login again.' });
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Session expired or invalid token.' });
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
