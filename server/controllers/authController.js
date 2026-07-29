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
    res.json({
      success: true,
      user: req.user
    });
  }

  static async updatePassword(req, res, next) {
    try {
      const { newPassword } = req.body;
      const result = await AuthService.updatePassword(newPassword);
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
