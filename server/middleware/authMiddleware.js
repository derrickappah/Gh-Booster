const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { supabase, supabaseAdmin } = require('../config/supabase');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const isCookieAuth = !authHeader.startsWith('Bearer ');
  const token = !isCookieAuth
    ? authHeader.substring(7)
    : (req.cookies?.token || req.cookies?.jwt || req.cookies?.sb_access_token || null);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required. Please login.' });
  }

  // CSRF Defense: Require custom headers for cookie-authenticated state-changing requests
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (isCookieAuth && stateChangingMethods.includes(req.method.toUpperCase())) {
    const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'] || req.headers['sec-fetch-site'];
    if (!customHeader || customHeader === 'cross-site') {
      return res.status(403).json({ success: false, error: 'CSRF validation failed for cookie-based request.' });
    }
  }

  try {
    // 1. Try Custom JWT verification signed with JWT_SECRET
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded && decoded.id) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*, wallets(balance, currency)')
          .eq('id', decoded.id)
          .maybeSingle();

        if (!profile) {
          return res.status(401).json({ success: false, error: 'User profile not found. Account may have been deleted.' });
        }

        const wallet = Array.isArray(profile?.wallets) ? profile.wallets[0] : profile?.wallets;
        const userRole = profile?.role || 'user';
        const rawBalance = wallet ? parseFloat(wallet.balance) : 0.0;

        req.user = {
          id: decoded.id,
          email: profile?.email || decoded.email || '',
          username: profile?.username || decoded.username || 'User',
          role: userRole,
          is_admin: userRole === 'admin' || userRole === 'super_admin',
          balance: isNaN(rawBalance) ? 0.0 : rawBalance,
          currency: wallet?.currency || 'GHS',
          api_key: profile?.api_key || null
        };
        return next();
      }
    } catch (jwtErr) {
      // Custom JWT verification failed (e.g. invalid signature/expired); log for debugging and proceed to Supabase Auth check
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[AuthMiddleware] Custom JWT verification check failed:', jwtErr.message);
      }
    }

    // 2. Try Supabase Auth API verification
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (!error && supabaseUser) {
      // Fetch profile & wallet from Supabase DB using supabaseAdmin (bypasses RLS)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*, wallets(balance, currency)')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (!profile) {
        return res.status(401).json({ success: false, error: 'User profile not found. Account may have been deleted.' });
      }

      const wallet = Array.isArray(profile?.wallets) ? profile.wallets[0] : profile?.wallets;
      const userRole = profile?.role || 'user';
      const rawBalance = wallet ? parseFloat(wallet.balance) : 0.0;

      req.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        username: profile?.username || profile?.full_name || supabaseUser.email.split('@')[0],
        role: userRole,
        is_admin: userRole === 'admin' || userRole === 'super_admin',
        balance: isNaN(rawBalance) ? 0.0 : rawBalance,
        currency: wallet?.currency || 'GHS',
        api_key: profile?.api_key || null
      };
      return next();
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

