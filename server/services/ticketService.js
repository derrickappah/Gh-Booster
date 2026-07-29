const { supabase } = require('../config/supabase');

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

  static async getTicketMessages(ticketId) {
    const { data: messages, error } = await supabase
      .from('ticket_messages')
      .select('*, profiles(username)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return messages || [];
  }

  static async addTicketMessage({ ticketId, userId, message }) {
    const { data: msg, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: userId,
        sender_role: 'user',
        message
      })
      .select();

    if (error) throw new Error(error.message);

    await supabase.from('tickets').update({ status: 'Open', updated_at: new Date().toISOString() }).eq('id', ticketId);

    return msg[0];
  }
}

module.exports = TicketService;
