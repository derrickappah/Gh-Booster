const WalletService = require('../services/walletService');

class WalletController {
  static async getWallet(req, res, next) {
    try {
      const data = await WalletService.getWalletDetails(req.user.id);
      res.json({
        success: true,
        ...data
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WalletController;
