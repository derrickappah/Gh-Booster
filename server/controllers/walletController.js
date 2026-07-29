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

  static async depositMoMo(req, res, next) {
    try {
      const result = await WalletService.depositMoMo({
        userId: req.user.id,
        amountUsd: req.body.amount_usd
      });
      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = WalletController;
