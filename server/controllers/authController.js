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
    const { generateToken } = require('../auth');
    const freshToken = generateToken(req.user);
    res.json({
      success: true,
      token: freshToken,
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
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
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
