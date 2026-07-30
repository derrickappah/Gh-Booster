const OrderService = require('../services/orderService');

class OrderController {
  static async getOrders(req, res, next) {
    try {
      const orders = await OrderService.getUserOrders(req.user.id);
      res.json({ success: true, orders });
    } catch (err) {
      next(err);
    }
  }

  static async createOrder(req, res, next) {
    try {
      const result = await OrderService.createOrder({
        userId: req.user.id,
        serviceId: req.body.service_id,
        link: req.body.link,
        quantity: req.body.quantity
      });
      res.json({ success: true, message: 'Order placed successfully!', ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async createBulkOrders(req, res, next) {
    try {
      const results = await OrderService.createBulkOrders({
        userId: req.user.id,
        bulkText: req.body.bulk_text || '',
        defaultServiceId: req.body.service_id
      });
      res.json({ success: true, message: 'Bulk orders processed!', results });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getBulkBatches(req, res, next) {
    try {
      const batches = await OrderService.getUserBulkBatches(req.user.id);
      res.json({ success: true, batches });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getOrderById(req, res, next) {
    try {
      const orderId = req.params.id;
      const userId = req.user ? req.user.id : null;
      const isAdmin = req.user ? req.user.role === 'admin' : false;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required to view orders.' });
      }
      const order = await OrderService.getOrderById(orderId, userId, isAdmin);
      res.json({ success: true, order });
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      const status = msg.includes('not found') ? 404 : (msg.includes('access denied') || msg.includes('permission')) ? 403 : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  static async refillOrder(req, res, next) {
    try {
      const orderId = req.params.id;
      const userId = req.user.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const result = await OrderService.refillOrder(orderId, userId);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async cancelOrder(req, res, next) {
    try {
      const orderId = req.params.id;
      const userId = req.user.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const result = await OrderService.cancelOrder(orderId, userId);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = OrderController;

