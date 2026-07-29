const MoolreService = require('../services/moolreService');

class PaymentController {
  /**
   * GET /api/payments/gateways
   * Returns all gateway configurations for the admin panel.
   */
  static async getGatewayConfigs(req, res, next) {
    try {
      const configs = await MoolreService.getGatewayConfigs();
      res.json({ success: true, gateways: configs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/payments/moolre/configure
   * Admin: Save Moolre API credentials and settings.
   */
  static async configureMoolre(req, res, next) {
    try {
      const { apiUser, apiKey, apiPubkey, accountNumber, environment, enabled, minDeposit } = req.body;
      const result = await MoolreService.saveCredentials({
        apiUser, apiKey, apiPubkey, accountNumber, environment, enabled, minDeposit
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/payments/moolre/initiate
   * Authenticated user: Generate a Moolre hosted payment link.
   */
  static async initiatePayment(req, res, next) {
    try {
      const { amount, email, description } = req.body;

      if (!amount) {
        return res.status(400).json({ success: false, error: 'Amount is required.' });
      }

      const result = await MoolreService.generatePaymentLink({
        userId: req.user.id,
        amount,
        email: email || req.user.email,
        description: description || 'GhBooster wallet top-up'
      });

      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/payments/moolre/verify/:reference
   * Check the status of a Moolre payment by reference.
   */
  static async verifyPayment(req, res, next) {
    try {
      const { reference } = req.params;
      const result = await MoolreService.verifyPayment({ reference });
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/payments/moolre/webhook
   * Public webhook endpoint for Moolre payment callbacks.
   * Called by Moolre when payment status changes.
   */
  static async handleWebhook(req, res, next) {
    try {
      const result = await MoolreService.handleWebhook(req.body);
      res.json({ received: true, ...result });
    } catch (err) {
      // Always respond 200 to webhook to avoid retries
      console.error('[Moolre Webhook Error]', err.message);
      res.json({ received: true, error: err.message });
    }
  }

  /**
   * POST /api/payments/moolre/complete
   * Authenticated user: Called on return from Moolre hosted page to credit wallet.
   */
  static async completePayment(req, res, next) {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: 'Reference is required.' });
      const result = await MoolreService.completePaymentFromRedirect({
        reference,
        userId: req.user.id
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/payments/moolre/approve
   * Admin: Manually approve/credit a pending transaction.
   */
  static async adminApproveTransaction(req, res, next) {
    try {
      const { reference } = req.body;
      if (!reference) {
        return res.status(400).json({ success: false, error: 'Reference is required.' });
      }
      const result = await MoolreService.adminApproveTransaction({
        reference,
        adminId: req.user.id
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = PaymentController;
