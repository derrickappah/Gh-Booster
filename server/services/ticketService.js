const { supabase, supabaseAdmin } = require('../config/supabase');

class TicketService {
  static async getUserTickets(userId) {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*, ticket_messages(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error.message);
      return [];
    }

    return tickets || [];
  }

  static async createTicket({ userId, subject, message }) {
    if (!subject || !message) {
      throw new Error('Subject and message content are required');
    }

    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .insert({ user_id: userId, subject, status: 'Open' })
      .select()
      .single();

    if (tErr) throw new Error(tErr.message);

    await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: userId,
      sender_role: 'user',
      message
    });

    return {
      ticket_id: ticket.id,
      subject,
      status: 'Open',
      message: 'Support ticket submitted successfully!'
    };
  }

  static async getTicketMessages(ticketId, userId, isAdmin = false) {
    if (!ticketId) throw new Error('Ticket ID is required');

    if (!isAdmin) {
      const { data: ticket, error: tErr } = await supabaseAdmin
        .from('tickets')
        .select('user_id')
        .eq('id', ticketId)
        .maybeSingle();

      if (tErr || !ticket) {
        throw new Error('Ticket not found');
      }

      if (ticket.user_id !== userId) {
        throw new Error('Access denied: You do not have permission to view this ticket');
      }
    }

    const { data: messages, error } = await supabaseAdmin
      .from('ticket_messages')
      .select('*, profiles(username)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return messages || [];
  }

  static async addTicketMessage({ ticketId, userId, message, isAdmin = false }) {
    if (!ticketId) throw new Error('Ticket ID is required');
    if (!message || message.trim() === '') throw new Error('Message content cannot be empty');

    if (!isAdmin) {
      const { data: ticket, error: tErr } = await supabaseAdmin
        .from('tickets')
        .select('user_id, status')
        .eq('id', ticketId)
        .maybeSingle();

      if (tErr || !ticket) {
        throw new Error('Ticket not found');
      }

      if (ticket.user_id !== userId) {
        throw new Error('Access denied: You do not have permission to reply to this ticket');
      }

      if (ticket.status === 'Closed') {
        throw new Error('This ticket is closed. Please open a new ticket.');
      }
    }

    const { data: msg, error } = await supabaseAdmin
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: userId,
        sender_role: isAdmin ? 'admin' : 'user',
        message: message.trim()
      })
      .select();

    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from('tickets')
      .update({ status: isAdmin ? 'Answered' : 'Open', updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    return msg[0];
  }
}

module.exports = TicketService;
