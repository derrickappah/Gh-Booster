const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin']));

const { validate } = require('../middleware/validator');
const {
  adminCreateServiceSchema,
  adminCreateProviderSchema,
  adminUpdateDepositStatusSchema,
  adminUpdateBalanceSchema,
  adminUpdateOrderStatusSchema,
  adminReplyTicketSchema,
  adminCreateBonusSchema,
  adminCreatePromotionSchema,
  adminCreateNewsSchema,
  adminUpdateServiceSchema,
  adminUpdateChildPanelStatusSchema
} = require('../validators/schemas');

// Stats & Users
router.get('/stats', AdminController.getStats);
router.get('/users', AdminController.getUsers);
router.post('/users/balance', validate(adminUpdateBalanceSchema), AdminController.updateUserBalance);
router.post('/users/:userId/fund', validate(adminUpdateBalanceSchema), AdminController.updateUserBalance);
router.put('/users/:userId/phone', AdminController.updateUserPhone);
router.put('/users/:userId/role', AdminController.updateUserRole);

// Orders
router.get('/orders', AdminController.getOrders);
router.post('/orders/status', validate(adminUpdateOrderStatusSchema), AdminController.updateOrderStatus);
router.put('/orders/:orderId/status', validate(adminUpdateOrderStatusSchema), AdminController.updateOrderStatus);
router.post('/orders/batch-refill', AdminController.batchRefillOrders);
router.post('/orders/sync', AdminController.syncOrders);
router.post('/orders/:orderId/sync', AdminController.syncOrders);

// Services & Categories
router.get('/services', AdminController.getServices);
router.post('/services', validate(adminCreateServiceSchema), AdminController.createService);
router.put('/services/:id', validate(adminUpdateServiceSchema), AdminController.updateService);
router.delete('/services/:id', AdminController.deleteService);
router.post('/categories', AdminController.createCategory);

// Providers
router.get('/providers', AdminController.getProviders);
router.post('/providers', validate(adminCreateProviderSchema), AdminController.createProvider);
router.put('/providers/:id', AdminController.updateProvider);
router.post('/providers/sync-all', AdminController.syncAllProviders);
router.post('/providers/:id/sync', AdminController.syncProvider);

// Deposits & Transactions
router.get('/deposits', AdminController.getDeposits);
router.post('/deposits/status', validate(adminUpdateDepositStatusSchema), AdminController.updateDepositStatus);
router.get('/transactions', AdminController.getTransactions);

// Support Tickets
router.get('/tickets', AdminController.getTickets);
router.post('/tickets/reply', validate(adminReplyTicketSchema), AdminController.replyTicket);

// Referrals & Child Panels
router.get('/referrals', AdminController.getReferrals);
router.get('/child-panels', AdminController.getChildPanels);
router.post('/child-panels/status', validate(adminUpdateChildPanelStatusSchema), AdminController.updateChildPanelStatus);

// Bonuses & Promotions & News
router.get('/bonuses', AdminController.getBonuses);
router.post('/bonuses', validate(adminCreateBonusSchema), AdminController.createBonus);
router.get('/promotions', AdminController.getPromotions);
router.post('/promotions', validate(adminCreatePromotionSchema), AdminController.createPromotion);
router.get('/news', AdminController.getNews);
router.post('/news', validate(adminCreateNewsSchema), AdminController.createNews);
router.put('/news/:id', AdminController.updateNews);
router.delete('/news/:id', AdminController.deleteNews);

// Audit Logs & Settings
router.get('/logs', AdminController.getLogs);
router.get('/settings', AdminController.getSettings);
router.post('/settings', AdminController.updateSettings);

module.exports = router;
