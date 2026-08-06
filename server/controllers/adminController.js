const AdminService = require('../services/adminService');

class AdminController {
  static async getStats(req, res, next) {
    try {
      const stats = await AdminService.getStats();
      res.json({
        success: true,
        stats,
        recent_orders: stats.recent_orders,
        audit_logs: stats.audit_logs,
        chart_data: stats.chart_data
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUsers(req, res, next) {
    try {
      const users = await AdminService.getAllUsers();
      res.json({ success: true, users });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserPhone(req, res, next) {
    try {
      const { userId } = req.params;
      const { phone } = req.body;
      const result = await AdminService.updateUserPhone({ userId, phone });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateUserBalance(req, res, next) {
    try {
      const userId = req.params.userId || req.body.userId;
      const { amount, action, newBalance, reason } = req.body;
      const { supabaseAdmin } = require('../config/supabase');
      let finalBalance;

      if ((newBalance === undefined || newBalance === null) && amount !== undefined) {
        const numAmount = Math.abs(parseFloat(amount));
        if (numAmount <= 0) {
          return res.status(400).json({ success: false, error: 'Amount must be greater than zero.' });
        }

        if (action === 'deduct') {
          const { data: rpcBal, error: rpcErr } = await supabaseAdmin.rpc('debit_wallet', {
            p_user_id: userId,
            p_amount: numAmount
          });
          if (rpcErr) throw new Error(rpcErr.message || 'Failed to deduct balance');
          finalBalance = parseFloat(rpcBal);
        } else {
          const { data: rpcBal, error: rpcErr } = await supabaseAdmin.rpc('credit_wallet', {
            p_user_id: userId,
            p_amount: numAmount
          });
          if (rpcErr) throw new Error(rpcErr.message || 'Failed to credit balance');
          finalBalance = parseFloat(rpcBal);
        }

        // Record audit transaction
        try {
          const txRef = `adm_adj_${Date.now().toString(36)}`;
          const { error: txErr } = await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            amount: action === 'deduct' ? -numAmount : numAmount,
            currency: 'GHS',
            gateway: 'Admin Manual Adjustment',
            reference: txRef,
            payment_ref: txRef,
            type: action === 'deduct' ? 'withdrawal' : 'bonus',
            status: 'completed',
            description: reason || `Admin manual balance ${action}`
          });
          if (txErr) {
            console.error('[AdminController] Failed to record transaction audit for balance adjustment:', txErr.message);
          }
        } catch (txErr) {
          console.error('[AdminController] Failed to record transaction audit for balance adjustment:', txErr.message);
        }

        return res.json({ success: true, new_balance: finalBalance, message: 'User balance updated successfully.' });
      }

      let targetBalance = parseFloat(newBalance);
      if (isNaN(targetBalance) || targetBalance < 0) {
        return res.status(400).json({ success: false, error: 'User balance cannot be reduced below zero.' });
      }

      const result = await AdminService.updateUserBalance({ userId, newBalance: targetBalance, reason });
      res.json({ success: true, new_balance: targetBalance, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getOrders(req, res, next) {
    try {
      const orders = await AdminService.getAllOrders();
      res.json({ success: true, orders });
    } catch (err) {
      next(err);
    }
  }

  static async updateOrderStatus(req, res, next) {
    try {
      const orderId = req.params.orderId || req.body.orderId;
      const status = req.body.status;
      const result = await AdminService.updateOrderStatus({ orderId, status });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async batchRefillOrders(req, res, next) {
    try {
      const result = await AdminService.batchRefillOrders();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getServices(req, res, next) {
    try {
      const services = await AdminService.getAllServices();
      const categories = await AdminService.getAllCategories();
      res.json({ success: true, services, categories });
    } catch (err) {
      next(err);
    }
  }

  static async createService(req, res, next) {
    try {
      const service = await AdminService.createService(req.body);
      res.json({ success: true, service });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateService(req, res, next) {
    try {
      const { id } = req.params;
      const service = await AdminService.updateService(id, req.body);
      res.json({ success: true, service });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteService(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminService.deleteService(id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async createCategory(req, res, next) {
    try {
      const category = await AdminService.createCategory(req.body);
      res.json({ success: true, category });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getProviders(req, res, next) {
    try {
      const providers = await AdminService.getAllProviders();
      res.json({ success: true, providers });
    } catch (err) {
      next(err);
    }
  }

  static async createProvider(req, res, next) {
    try {
      const provider = await AdminService.createProvider(req.body);
      res.json({ success: true, provider });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateProvider(req, res, next) {
    try {
      const { id } = req.params;
      const provider = await AdminService.updateProvider(id, req.body);
      res.json({ success: true, provider });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async syncProvider(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminService.syncProvider(id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async syncAllProviders(req, res, next) {
    try {
      const result = await AdminService.syncAllProviders();
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getDeposits(req, res, next) {
    try {
      const deposits = await AdminService.getAllDeposits();
      res.json({ success: true, deposits });
    } catch (err) {
      next(err);
    }
  }

  static async getTransactions(req, res, next) {
    try {
      const transactions = await AdminService.getAllTransactions();
      res.json({ success: true, transactions });
    } catch (err) {
      next(err);
    }
  }


  static async updateDepositStatus(req, res, next) {
    try {
      const { id, status } = req.body;
      const allowedStatuses = ['pending', 'completed', 'failed', 'expired', 'refunded'];
      if (!id || !status || !allowedStatuses.includes(String(status).toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Valid transaction ID and allowed status required.' });
      }
      const targetStatus = String(status).toLowerCase();
      const deposit = await AdminService.updateDepositStatus({ id, status: targetStatus });
      const { supabaseAdmin } = require('../config/supabase');
      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: req.user.id,
          action: 'ADMIN_UPDATE_DEPOSIT_STATUS',
          details: `Admin ${req.user.email || req.user.id} updated deposit #${id} status to ${status}`
        });
      } catch (auditErr) {}
      res.json({ success: true, deposit });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getTickets(req, res, next) {
    try {
      const tickets = await AdminService.getAllTickets();
      res.json({ success: true, tickets });
    } catch (err) {
      next(err);
    }
  }

  static async replyTicket(req, res, next) {
    try {
      const { ticketId, message } = req.body;
      const reply = await AdminService.replyTicket({ ticketId, senderId: req.user.id, message });
      res.json({ success: true, reply });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getReferrals(req, res, next) {
    try {
      const referrals = await AdminService.getReferrals();
      res.json({ success: true, referrals });
    } catch (err) {
      next(err);
    }
  }

  static async getChildPanels(req, res, next) {
    try {
      const childPanels = await AdminService.getChildPanels();
      res.json({ success: true, childPanels });
    } catch (err) {
      next(err);
    }
  }

  static async updateChildPanelStatus(req, res, next) {
    try {
      const { id, status } = req.body;
      const childPanel = await AdminService.updateChildPanelStatus({ id, status });
      res.json({ success: true, childPanel });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getBonuses(req, res, next) {
    try {
      const bonuses = await AdminService.getBonuses();
      res.json({ success: true, bonuses });
    } catch (err) {
      next(err);
    }
  }

  static async createBonus(req, res, next) {
    try {
      const bonus = await AdminService.createBonus(req.body);
      res.json({ success: true, bonus });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getPromotions(req, res, next) {
    try {
      const promotions = await AdminService.getPromotions();
      res.json({ success: true, promotions });
    } catch (err) {
      next(err);
    }
  }

  static async createPromotion(req, res, next) {
    try {
      const promotion = await AdminService.createPromotion(req.body);
      res.json({ success: true, promotion });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getNews(req, res, next) {
    try {
      const news = await AdminService.getNews();
      res.json({ success: true, news });
    } catch (err) {
      next(err);
    }
  }

  static async createNews(req, res, next) {
    try {
      const news = await AdminService.createNews(req.body);
      res.json({ success: true, news });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateNews(req, res, next) {
    try {
      const { id } = req.params;
      const news = await AdminService.updateNews(id, req.body);
      res.json({ success: true, news });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteNews(req, res, next) {
    try {
      const { id } = req.params;
      await AdminService.deleteNews(id);
      res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getLogs(req, res, next) {
    try {
      const logs = await AdminService.getLogs();
      res.json({ success: true, logs });
    } catch (err) {
      next(err);
    }
  }

  static async getSettings(req, res, next) {
    try {
      const settings = await AdminService.getSettings();
      res.json({ success: true, settings });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req, res, next) {
    try {
      const result = await AdminService.updateSettings(req.body);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = AdminController;
