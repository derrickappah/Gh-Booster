const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { paymentLimiter } = require('../middleware/rateLimiter');

// ─── Public Routes ────────────────────────────────────────────────────────────
// Moolre webhook — must be public (called by Moolre servers)
router.post('/moolre/webhook', paymentLimiter, PaymentController.handleWebhook);

// ─── Authenticated User Routes ────────────────────────────────────────────────
router.use(authenticateToken);

// Initiate a Moolre mobile money or card payment
router.post('/moolre/initiate', paymentLimiter, PaymentController.initiatePayment);

// Verify / check status of a payment by reference
router.get('/moolre/verify/:reference', paymentLimiter, PaymentController.verifyPayment);

// Complete payment on return from Moolre hosted page (credits wallet)
router.post('/moolre/complete', paymentLimiter, PaymentController.completePayment);

// ─── Admin-Only Routes ────────────────────────────────────────────────────────
// Get all gateway configs (for admin-payments.html)
router.get('/gateways', requireRole(['admin', 'super_admin']), PaymentController.getGatewayConfigs);

// Configure Moolre gateway API credentials
router.post('/moolre/configure', requireRole(['admin', 'super_admin']), PaymentController.configureMoolre);

// Admin: manually approve a pending transaction
router.post('/moolre/approve', requireRole(['admin', 'super_admin']), PaymentController.adminApproveTransaction);

module.exports = router;
