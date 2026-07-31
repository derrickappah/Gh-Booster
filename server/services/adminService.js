const { supabase, supabaseAdmin } = require('../config/supabase');

class AdminService {
  static async getStats() {
    const { data: users, count: userCount } = await supabaseAdmin.from('profiles').select('*', { count: 'exact' });
    const { data: orders, count: orderCount } = await supabaseAdmin.from('orders').select('*', { count: 'exact' });
    const { data: services, count: serviceCount } = await supabaseAdmin.from('services').select('*', { count: 'exact' });
    const { data: wallets } = await supabaseAdmin.from('wallets').select('balance');
    const { data: tickets } = await supabaseAdmin.from('tickets').select('*');
    const { data: logs } = await supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10);

    const totalRevenue = (orders || []).reduce((acc, o) => acc + (parseFloat(o.charge) || 0), 0);
    const totalWalletBalance = (wallets || []).reduce((acc, w) => acc + (parseFloat(w.balance) || 0), 0);
    const pendingOrders = (orders || []).filter(o => o.status === 'Pending' || o.status === 'Processing').length;
    const completedOrders = (orders || []).filter(o => o.status === 'Completed').length;
    const openTickets = (tickets || []).filter(t => t.status === 'Open').length;

    // Daily chart data
    const dailyChartData = [
      { day: 'Mon', revenue: totalRevenue * 0.1, orders: Math.round((orderCount || 0) * 0.1) },
      { day: 'Tue', revenue: totalRevenue * 0.15, orders: Math.round((orderCount || 0) * 0.15) },
      { day: 'Wed', revenue: totalRevenue * 0.2, orders: Math.round((orderCount || 0) * 0.2) },
      { day: 'Thu', revenue: totalRevenue * 0.18, orders: Math.round((orderCount || 0) * 0.18) },
      { day: 'Fri', revenue: totalRevenue * 0.22, orders: Math.round((orderCount || 0) * 0.22) },
      { day: 'Sat', revenue: totalRevenue * 0.08, orders: Math.round((orderCount || 0) * 0.08) },
      { day: 'Sun', revenue: totalRevenue * 0.07, orders: Math.round((orderCount || 0) * 0.07) }
    ];

    let recentOrdersWithDetails = null;
    try {
      const { data } = await supabaseAdmin
        .from('orders')
        .select('*, profiles(username, full_name, wallets(balance)), services(name)')
        .order('created_at', { ascending: false })
        .limit(10);
      recentOrdersWithDetails = data;
    } catch (_) {}

    if (!recentOrdersWithDetails || recentOrdersWithDetails.length === 0) {
      recentOrdersWithDetails = (orders || []).slice(0, 10);
    }

    return {
      total_revenue: totalRevenue,
      total_orders: orderCount || (orders ? orders.length : 0),
      total_users: userCount || (users ? users.length : 0),
      active_services: serviceCount || (services ? services.length : 0),
      total_wallet_balance: totalWalletBalance,
      pending_orders: pendingOrders,
      completed_orders: completedOrders,
      open_tickets: openTickets,
      recent_orders: recentOrdersWithDetails || [],
      audit_logs: logs || [],
      chart_data: dailyChartData
    };
  }

  static async getAllUsers() {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, phone, phone_number, role, created_at, wallets(balance, currency)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('user_id, charge');

    const spentMap = {};
    (orders || []).forEach(o => {
      spentMap[o.user_id] = (spentMap[o.user_id] || 0) + (parseFloat(o.charge) || 0);
    });

    return (profiles || []).map(p => {
      const walletObj = Array.isArray(p.wallets) ? p.wallets[0] : p.wallets;
      return {
        id: p.id,
        username: p.username || p.email,
        email: p.email,
        phone: p.phone || p.phone_number || null,
        role: p.role || 'user',
        balance: walletObj ? parseFloat(walletObj.balance) : 0.0,
        currency: walletObj?.currency || 'GHS',
        total_spent: spentMap[p.id] || 0.0,
        created_at: new Date(p.created_at || Date.now()).toISOString().substring(0, 10)
      };
    });
  }

  static async updateUserPhone({ userId, phone }) {
    const cleanPhone = phone ? phone.trim() : null;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ phone: cleanPhone, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Phone number updated successfully', profile: data };
  }

  static async updateUserBalance({ userId, newBalance }) {
    const balance = parseFloat(newBalance);
    if (isNaN(balance)) throw new Error('Valid numeric balance is required');

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (wallet && wallet.id) {
      const { error } = await supabaseAdmin
        .from('wallets')
        .update({ balance, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: userId, balance, currency: 'GHS', updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }

    // Write Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action: 'UPDATE_BALANCE',
      details: `Admin set user balance to GH₵${balance.toFixed(2)}`
    });

    return { success: true, message: `User balance updated to GH₵${balance.toFixed(2)}` };
  }

  static async getAllOrders() {
    let { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*, profiles(username, email), services(name)')
      .order('created_at', { ascending: false });

    if (error || !orders || orders.length === 0) {
      const fallback = await supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false });
      orders = fallback.data || [];
    }
    return orders || [];
  }

  static async updateOrderStatus({ orderId, status }) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();

    if (error) throw new Error(error.message);
    return { success: true, message: `Order #${orderId} status updated to ${status}`, order: data[0] };
  }

  static async getAllServices() {
    const { data: services, error } = await supabaseAdmin
      .from('services')
      .select('*, categories(name), providers(name)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return services || [];
  }

  static async createService(serviceData) {
    const rateVal = parseFloat(serviceData.rate_per_1k || serviceData.rate_per_1000 || serviceData.our_price_per_1000 || serviceData.rate || 0);
    const cleanData = {
      rate_per_1k: rateVal,
      rate_per_1000: rateVal,
      our_price_per_1000: rateVal,
      original_price_per_1000: rateVal,
      ...serviceData
    };

    let { data, error } = await supabaseAdmin.from('services').insert([cleanData]).select();
    
    while (error && error.message && error.message.includes("Could not find the '")) {
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (match && match[1]) {
        delete cleanData[match[1]];
        const retry = await supabaseAdmin.from('services').insert([cleanData]).select();
        data = retry.data;
        error = retry.error;
      } else {
        break;
      }
    }
    if (error) throw new Error(error.message);
    return data ? data[0] : null;
  }

  static async updateService(id, serviceData) {
    const rateVal = parseFloat(serviceData.rate_per_1k || serviceData.rate_per_1000 || serviceData.our_price_per_1000 || serviceData.rate || 0);
    const cleanData = {
      rate_per_1k: rateVal,
      rate_per_1000: rateVal,
      our_price_per_1000: rateVal,
      original_price_per_1000: rateVal,
      ...serviceData
    };

    let { data, error } = await supabaseAdmin.from('services').update(cleanData).eq('id', id).select();

    while (error && error.message && error.message.includes("Could not find the '")) {
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (match && match[1]) {
        delete cleanData[match[1]];
        const retry = await supabaseAdmin.from('services').update(cleanData).eq('id', id).select();
        data = retry.data;
        error = retry.error;
      } else {
        break;
      }
    }
    if (error) throw new Error(error.message);
    return data ? data[0] : null;
  }

  static async deleteService(id) {
    const { error } = await supabaseAdmin.from('services').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async getAllCategories() {
    const { data, error } = await supabaseAdmin.from('categories').select('*').order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  static async createCategory(categoryData) {
    const { data, error } = await supabaseAdmin.from('categories').insert([categoryData]).select();
    if (error) throw new Error(error.message);
    return data[0];
  }

  static async getAllProviders() {
    const { data, error } = await supabaseAdmin.from('providers').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  static async createProvider(providerData) {
    const { data, error } = await supabaseAdmin.from('providers').insert([providerData]).select();
    if (error) throw new Error(error.message);
    return data[0];
  }

  static async updateProvider(id, providerData) {
    const { data, error } = await supabaseAdmin.from('providers').update(providerData).eq('id', id).select();
    if (error) throw new Error(error.message);
    return data[0];
  }

  static async syncProvider(id) {
    const { data: provider, error: getErr } = await supabaseAdmin.from('providers').select('*').eq('id', id).single();
    if (getErr || !provider) throw new Error('Provider not found');

    let newBalance = parseFloat(provider.balance || 0);
    let newStatus = provider.status || 'Active';
    let syncDetails = '';

    if (provider.api_url && provider.api_key) {
      try {
        const httpFetch = globalThis.fetch || require('node-fetch');
        const res = await httpFetch(provider.api_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: provider.api_key, action: 'balance' })
        });
        const data = await res.json();
        if (data && data.balance !== undefined) {
          newBalance = parseFloat(data.balance || 0);
          newStatus = 'Active';
          syncDetails = `Live balance synced: ${data.currency || ''} ${newBalance}`;
        } else if (data && data.error) {
          newStatus = 'Degraded';
          syncDetails = `Provider response: ${data.error}`;
        } else {
          syncDetails = 'Synced with provider endpoint.';
        }
      } catch (err) {
        newStatus = 'Offline';
        syncDetails = `Connection check failed: ${err.message}`;
      }
    } else {
      syncDetails = 'Synced locally (No API key set).';
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('providers')
      .update({ balance: newBalance, status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (upErr) throw new Error(upErr.message);
    return { success: true, provider: updated, message: syncDetails };
  }

  static async syncAllProviders() {
    const providers = await AdminService.getAllProviders();
    const results = [];
    for (const p of providers) {
      try {
        const res = await AdminService.syncProvider(p.id);
        results.push(res);
      } catch (err) {
        results.push({ success: false, provider_id: p.id, error: err.message });
      }
    }
    return { success: true, count: results.length, results };
  }

  static async getAllDeposits() {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async updateDepositStatus({ id, status }) {
    const { data: txn, error: getErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (getErr || !txn) throw new Error('Transaction record not found.');

    const newStatus = (status || '').toLowerCase();
    const oldStatus = (txn.status || '').toLowerCase();

    // If approving a transaction that wasn't already completed/approved, credit user wallet
    if ((newStatus === 'completed' || newStatus === 'approved') && oldStatus !== 'completed' && oldStatus !== 'approved') {
      const MoolreService = require('./moolreService');
      await MoolreService._creditUserWallet(txn.user_id, txn.amount, txn.reference || txn.payment_ref);
    } else {
      const { error } = await supabaseAdmin.from('transactions').update({ status: newStatus }).eq('id', id);
      if (error) throw new Error(error.message);
    }

    const { data: updated } = await supabaseAdmin.from('transactions').select('*').eq('id', id).single();
    return updated;
  }

  static async getAllTickets() {
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async replyTicket({ ticketId, senderId, message }) {
    const { data: msg, error: msgErr } = await supabaseAdmin.from('ticket_messages').insert([{
      ticket_id: ticketId,
      sender_id: senderId,
      sender_role: 'admin',
      message
    }]).select();

    if (msgErr) throw new Error(msgErr.message);

    await supabaseAdmin.from('tickets').update({ status: 'Answered', updated_at: new Date().toISOString() }).eq('id', ticketId);

    return msg[0];
  }

  static async getReferrals() {
    const { data, error } = await supabaseAdmin
      .from('referral_payouts')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }

  static async getChildPanels() {
    const { data, error } = await supabaseAdmin
      .from('child_panels')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }

  static async updateChildPanelStatus({ id, status }) {
    const { data, error } = await supabaseAdmin.from('child_panels').update({ status }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return data[0];
  }

  static async getBonuses() {
    const { data } = await supabaseAdmin.from('deposit_bonuses').select('*');
    return data || [];
  }

  static async createBonus(bonusData) {
    const { data, error } = await supabaseAdmin.from('deposit_bonuses').insert([bonusData]).select();
    if (error) throw new Error(error.message);
    return data[0];
  }

  static async getPromotions() {
    const { data } = await supabaseAdmin.from('promotions').select('*');
    return data || [];
  }

  static async createPromotion(promoData) {
    const { data, error } = await supabaseAdmin.from('promotions').insert([promoData]).select();
    if (error) throw new Error(error.message);
    return data[0];
  }

  static async getNews() {
    const { data } = await supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  static async createNews(newsData) {
    const { data, error } = await supabaseAdmin.from('announcements').insert([newsData]).select();
    if (error) throw new Error(error.message);
    return data[0];
  }

  static async getLogs() {
    const { data } = await supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  static async getSettings() {
    const { data } = await supabaseAdmin.from('settings').select('*');
    const settingsObj = {};
    (data || []).forEach(s => {
      settingsObj[s.key] = s.value;
    });
    return settingsObj;
  }

  static async updateSettings(settingsData) {
    for (const [key, value] of Object.entries(settingsData)) {
      await supabaseAdmin.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    return { success: true, message: 'Settings saved successfully' };
  }
}

module.exports = AdminService;
