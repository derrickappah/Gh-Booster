const TicketService = require('../services/ticketService');

class TicketController {
  static async getTickets(req, res, next) {
    try {
      const tickets = await TicketService.getUserTickets(req.user.id);
      res.json({ success: true, tickets });
    } catch (err) {
      next(err);
    }
  }

  static async createTicket(req, res, next) {
    try {
      const result = await TicketService.createTicket({
        userId: req.user.id,
        subject: req.body.subject,
        message: req.body.message
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getMessages(req, res, next) {
    try {
      const { id } = req.params;
      const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
      const messages = await TicketService.getTicketMessages(id, req.user.id, isAdmin);
      res.json({ success: true, messages });
    } catch (err) {
      next(err);
    }
  }

  static async addMessage(req, res, next) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
      const result = await TicketService.addTicketMessage({ ticketId: id, userId: req.user.id, message, isAdmin });
      res.json({ success: true, message: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = TicketController;
