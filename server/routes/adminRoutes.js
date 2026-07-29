const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin']));

// Stats & Users
router.get('/stats', AdminController.getStats);
router.get('/users', AdminController.getUsers);
router.post('/users/balance', AdminController.updateUserBalance);
router.put('/users/:userId/phone', AdminController.updateUserPhone);

// Orders
router.get('/orders', AdminController.getOrders);
router.post('/orders/status', AdminController.updateOrderStatus);

// Services & Categories
router.get('/services', AdminController.getServices);
router.post('/services', AdminController.createService);
router.put('/services/:id', AdminController.updateService);
router.delete('/services/:id', AdminController.deleteService);
router.post('/categories', AdminController.createCategory);

// Providers
router.get('/providers', AdminController.getProviders);
router.post('/providers', AdminController.createProvider);
router.put('/providers/:id', AdminController.updateProvider);
router.post('/providers/sync-all', AdminController.syncAllProviders);
router.post('/providers/:id/sync', AdminController.syncProvider);

// Deposits & Transactions
router.get('/deposits', AdminController.getDeposits);
router.post('/deposits/status', AdminController.updateDepositStatus);

// Support Tickets
router.get('/tickets', AdminController.getTickets);
router.post('/tickets/reply', AdminController.replyTicket);

// Referrals & Child Panels
router.get('/referrals', AdminController.getReferrals);
router.get('/child-panels', AdminController.getChildPanels);
router.post('/child-panels/status', AdminController.updateChildPanelStatus);

// Bonuses & Promotions & News
router.get('/bonuses', AdminController.getBonuses);
router.post('/bonuses', AdminController.createBonus);
router.get('/promotions', AdminController.getPromotions);
router.post('/promotions', AdminController.createPromotion);
router.get('/news', AdminController.getNews);
router.post('/news', AdminController.createNews);

// Audit Logs & Settings
router.get('/logs', AdminController.getLogs);
router.get('/settings', AdminController.getSettings);
router.post('/settings', AdminController.updateSettings);

module.exports = router;
