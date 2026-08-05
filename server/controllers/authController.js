const AuthService = require('../services/authService');

class AuthController {
  static async register(req, res, next) {
    try {
      const result = await AuthService.register(req.body);
      res.json({
        success: true,
        message: 'Account created successfully! Welcome to GhBooster.',
        ...result
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async login(req, res, next) {
    try {
      const result = await AuthService.login(req.body);
      res.json({
        success: true,
        message: 'Login successful',
        ...result
      });
    } catch (err) {
      res.status(401).json({ success: false, error: err.message });
    }
  }

  static async me(req, res) {
    // Return current user data without issuing a fresh token (MED-03 fix)
    res.json({
      success: true,
      user: req.user
    });
  }

  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        // Always return success to prevent email enumeration
        return res.json({ success: true, message: 'If an account exists with this email, a password reset link has been sent.' });
      }
      await AuthService.forgotPassword(email.trim().toLowerCase());
      res.json({ success: true, message: 'If an account exists with this email, a password reset link has been sent.' });
    } catch (err) {
      // Always return success to prevent email enumeration
      res.json({ success: true, message: 'If an account exists with this email, a password reset link has been sent.' });
    }
  }

  static async updatePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword) {
        return res.status(400).json({ success: false, error: 'Current password is required to set a new password.' });
      }
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'New password must be at least 8 characters and contain uppercase, lowercase, and a number.' });
      }
      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ success: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.' });
      }

      // Verify current password with Supabase Auth
      // Use a dedicated per-request client to avoid polluting the shared backend auth state (F-91)
      const { createClient } = require('@supabase/supabase-js');
      const env = require('../config/env');
      const tempClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { error: authErr } = await tempClient.auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword
      });
      if (authErr) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
      }

      const result = await AuthService.updatePassword(req.user.id, newPassword);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async generateApiKey(req, res, next) {
    try {
      const apiKey = await AuthService.generateApiKey(req.user.id);
      res.json({
        success: true,
        api_key: apiKey,
        message: 'New API key generated successfully'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
