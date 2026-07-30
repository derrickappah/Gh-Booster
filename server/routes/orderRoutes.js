const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validator');
const { createOrderSchema } = require('../validators/schemas');

router.get('/', authenticateToken, OrderController.getOrders);
router.get('/:id', authenticateToken, OrderController.getOrderById);
router.post('/', authenticateToken, validate(createOrderSchema), OrderController.createOrder);
router.post('/bulk', authenticateToken, OrderController.createBulkOrders);
router.post('/:id/refill', authenticateToken, OrderController.refillOrder);
router.post('/:id/cancel', authenticateToken, OrderController.cancelOrder);

module.exports = router;

