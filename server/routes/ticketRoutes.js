const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/ticketController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, TicketController.getTickets);
router.post('/', authenticateToken, TicketController.createTicket);
router.get('/:id/messages', authenticateToken, TicketController.getMessages);
router.post('/:id/messages', authenticateToken, TicketController.addMessage);

module.exports = router;
