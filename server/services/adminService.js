const { supabase, supabaseAdmin } = require('../config/supabase');

class AdminService {
  static async getStats() {
    const { data: users, count: userCount } = await supabaseAdmin.from('profiles').select('created_at', { count: 'exact' }).limit(10000);
    const { data: orders, count: orderCount } = await supabaseAdmin.from('orders').select('charge, total_price, price, amount, cost, status, created_at', { count: 'exact' }).limit(10000);
    const { data: services, count: serviceCount } = await supabaseAdmin.from('services').select('status, mode', { count: 'exact' });
    const { data: providers, count: providerCount } = await supabaseAdmin.from('providers').select('id', { count: 'exact' });
    const { data: wallets } = await supabaseAdmin.from('wallets').select('balance').limit(10000);
    const { data: tickets } = await supabaseAdmin.from('tickets').select('status');
    const { data: transactions } = await supabaseAdmin.from('transactions').select('amount, charge, value, status, type, created_at').limit(10000);
    const { data: logs } = await supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10);

    let referrals = [];
    try {
      const { data: refData } = await supabaseAdmin.from('referral_payouts').select('*');
      referrals = refData || [];
    } catch (_) {}

    let paymentMethods = [];
    try {
      const { data: pmData } = await supabaseAdmin.from('payment_methods').select('*');
      paymentMethods = pmData || [];
    } catch (_) {}

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalOrdersCount = orderCount || (orders ? orders.length : 0);
    const totalUsersCount = userCount || (users ? users.length : 0);
    const totalServicesCount = serviceCount || (services ? services.length : 0);
    const totalProvidersCount = providerCount || (providers ? providers.length : 0);
    const totalTransactionsCount = (transactions || []).length;

    const totalRevenue = (orders || []).reduce((acc, o) => {
      const chargeVal = parseFloat(o.charge || o.total_price || o.price || o.amount || o.cost || 0);
      return acc + (isNaN(chargeVal) ? 0 : Math.abs(chargeVal));
    }, 0);
    const totalWalletBalance = (wallets || []).reduce((acc, w) => acc + (parseFloat(w.balance) || 0), 0);

    // Today calculations
    const usersToday = (users || []).filter(u => u.created_at && new Date(u.created_at) >= todayStart).length;
    const ordersToday = (orders || []).filter(o => o.created_at && new Date(o.created_at) >= todayStart).length;
    const depositsToday = (transactions || [])
      .filter(t => {
        const amt = parseFloat(t.amount || t.charge || t.value || 0);
        const st = String(t.status || 'completed').toLowerCase();
        const tp = String(t.type || 'deposit').toLowerCase();
        const isFailed = st === 'failed' || st === 'expired' || st === 'rejected' || st === 'cancelled' || st === 'canceled';
        if (isFailed) return false;
        const isToday = t.created_at && new Date(t.created_at) >= todayStart;
        return isToday && amt > 0 && !tp.includes('order');
      })
      .reduce((acc, t) => acc + (parseFloat(t.amount || t.charge || t.value || 0) || 0), 0);

    // Status breakdowns
    const completedOrders = (orders || []).filter(o => String(o.status || '').toLowerCase() === 'completed').length;
    const processingOrders = (orders || []).filter(o => String(o.status || '').toLowerCase() === 'processing' || String(o.status || '').toLowerCase() === 'in progress').length;
    const pendingOrders = (orders || []).filter(o => String(o.status || '').toLowerCase() === 'pending').length;
    const confirmedOrders = (orders || []).filter(o => String(o.status || '').toLowerCase() === 'confirmed' || String(o.status || '').toLowerCase() === 'completed').length;
    const canceledOrders = (orders || []).filter(o => String(o.status || '').toLowerCase() === 'canceled' || String(o.status || '').toLowerCase() === 'cancelled' || String(o.status || '').toLowerCase() === 'refunded').length;

    const activeOrders = pendingOrders + processingOrders;
    const completionRate = totalOrdersCount > 0 ? Math.round((completedOrders / totalOrdersCount) * 100) : 0;
    const avgOrderValue = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount) : 0;

    const totalDeposits = (transactions || [])
      .filter(t => {
        const amt = parseFloat(t.amount || t.charge || t.value || 0);
        const st = String(t.status || 'completed').toLowerCase();
        const tp = String(t.type || 'deposit').toLowerCase();
        const isFailed = st === 'failed' || st === 'expired' || st === 'rejected' || st === 'cancelled' || st === 'canceled';
        if (isFailed) return false;
        return amt > 0 && !tp.includes('order');
      })
      .reduce((acc, t) => acc + (parseFloat(t.amount || t.charge || t.value || 0) || 0), 0);

    const openTickets = (tickets || []).filter(t => t.status === 'Open').length;
    const ticketsInProgress = (tickets || []).filter(t => t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Answered').length;

    const pendingReferrals = (referrals || []).filter(r => String(r.status || '').toLowerCase() === 'pending').length;
    const activePaymentMethods = (paymentMethods || []).filter(p => String(p.status || '').toLowerCase() === 'active' || p.is_active || true).length;
    const activeServicesCount = (services || []).filter(s => String(s.status || '').toLowerCase() === 'active' || s.status === 1 || s.status === true || s.mode !== 'disabled').length;

    // Exceptions
    const expiredDeposits = (transactions || []).filter(t => String(t.status || '').toLowerCase() === 'expired' || String(t.status || '').toLowerCase() === 'rejected' || String(t.status || '').toLowerCase() === 'declined').length;
    const refundedCount = (transactions || []).filter(t => t.type === 'refund' || String(t.status || '').toLowerCase() === 'refunded').length + (orders || []).filter(o => String(o.status || '').toLowerCase() === 'refunded').length;
    const failedCount = (transactions || []).filter(t => String(t.status || '').toLowerCase() === 'failed').length;

    // Calculate 7-day actual breakdown (Mon -> Sun) for current week
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const curr = new Date();
    const dayOfWeek = curr.getDay(); // 0 is Sun, 1 is Mon... 6 is Sat
    const distanceToMon = (dayOfWeek + 6) % 7; // distance back to Mon
    const monday = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() - distanceToMon);

    const dailyChartData = days.map((dayName, idx) => {
      const dayStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx, 0, 0, 0, 0);
      const dayEnd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx, 23, 59, 59, 999);

      const dayOrders = (orders || []).filter(o => {
        if (!o.created_at) return false;
        const d = new Date(o.created_at);
        return d >= dayStart && d <= dayEnd;
      });

      const dayTxs = (transactions || []).filter(t => {
        if (!t.created_at) return false;
        const d = new Date(t.created_at);
        const amt = parseFloat(t.amount || t.charge || t.value || 0);
        const st = String(t.status || 'completed').toLowerCase();
        const tp = String(t.type || 'deposit').toLowerCase();
        const isFailed = st === 'failed' || st === 'expired' || st === 'rejected' || st === 'cancelled' || st === 'canceled';
        return d >= dayStart && d <= dayEnd && !isFailed && amt > 0 && !tp.includes('order');
      });

      const dayDeposits = dayTxs.reduce((sum, t) => sum + (parseFloat(t.amount || t.charge || t.value || 0) || 0), 0);
      const dayRevenue = dayOrders.reduce((sum, o) => {
        const val = parseFloat(o.charge || o.total_price || o.price || o.amount || o.cost || 0);
        return sum + (isNaN(val) ? 0 : Math.abs(val));
      }, 0);

      return {
        day: dayName,
        deposits: parseFloat(dayDeposits.toFixed(2)),
        revenue: parseFloat(dayRevenue.toFixed(2)),
        orders: dayOrders.length
      };
    });

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
      users_today: usersToday,
      total_users: totalUsersCount,
      deposits_today: depositsToday,
      total_deposits: totalDeposits,
      orders_today: ordersToday,
      total_orders: totalOrdersCount,
      completed_orders: completedOrders,
      processing_orders: processingOrders,
      pending_orders: pendingOrders,
      confirmed_orders: confirmedOrders,
      canceled_orders: canceledOrders,
      open_tickets: openTickets,
      tickets_in_progress: ticketsInProgress,
      pending_referrals: pendingReferrals,
      active_services: activeServicesCount > 0 ? activeServicesCount : totalServicesCount,
      total_transactions: totalTransactionsCount,
      avg_order_value: avgOrderValue,
      expired_deposits: expiredDeposits,
      rejected_deposits: expiredDeposits,
      refunded_count: refundedCount,
      failed_count: failedCount,
      active_payment_methods: activePaymentMethods > 0 ? activePaymentMethods : 4,
      total_revenue: totalRevenue,
      active_providers: totalProvidersCount,
      total_wallet_balance: totalWalletBalance,
      active_orders: activeOrders,
      completion_rate: completionRate,
      status_breakdown: {
        completed: completedOrders,
        processing: processingOrders,
        pending: pendingOrders,
        canceled: canceledOrders
      },
      recent_orders: recentOrdersWithDetails || [],
      audit_logs: logs || [],
      chart_data: dailyChartData
    };
  }

  static async getAllUsers() {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, phone, phone_number, role, created_at, wallets(balance, currency)')
      .order('created_at', { ascending: false })
      .limit(500);

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

  static async updateUserBalance({ userId, newBalance, reason }) {
    const balance = parseFloat(newBalance);
    if (isNaN(balance)) throw new Error('Valid numeric balance is required');
    if (balance < 0) throw new Error('Balance cannot be set to a negative value');

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const oldBal = wallet ? parseFloat(wallet.balance || 0) : 0.0;

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

    const note = reason ? ` (Note: ${reason})` : '';
    // Write Audit Log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        action: 'UPDATE_BALANCE',
        details: `Admin changed user balance from GH₵${oldBal.toFixed(2)} to GH₵${balance.toFixed(2)}${note}`
      });
    } catch (_) {}

    // Record audit entry in transactions ledger
    try {
      const diff = balance - oldBal;
      if (diff !== 0) {
        const txRef = `adm_adj_${Date.now().toString(36)}`;
        await supabaseAdmin.from('transactions').insert({
          user_id: userId,
          amount: diff,
          currency: 'GHS',
          gateway: 'Admin Manual Adjustment',
          reference: txRef,
          payment_ref: txRef,
          type: diff < 0 ? 'withdrawal' : 'bonus',
          status: 'completed',
          description: reason || `Admin manual balance adjustment from GH₵${oldBal.toFixed(2)} to GH₵${balance.toFixed(2)}`
        });
      }
    } catch (txErr) {
      console.error('[AdminService] Failed to record transaction audit for balance adjustment:', txErr.message);
    }

    return { success: true, new_balance: balance, message: `User balance updated to GH₵${balance.toFixed(2)}` };
  }

  static async getAllOrders() {
    let { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*, profiles(username, email), services(name)')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error || !orders || orders.length === 0) {
      const fallback = await supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
      orders = fallback.data || [];
    }
    return orders || [];
  }

  static async updateOrderStatus({ orderId, status }) {
    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    const oldStatus = currentOrder ? currentOrder.status : null;

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select();

    if (error) throw new Error(error.message);

    // Automatically process wallet refund for Partial, Canceled, or Refunded status
    const isRefundable = ['Canceled', 'Refunded', 'Partial', 'canceled', 'refunded', 'partial'].includes(status);
    if (isRefundable && currentOrder) {
      const OrderService = require('./orderService');
      await OrderService.processOrderRefund({
        order: { ...currentOrder, status },
        newStatus: status,
        remains: currentOrder.remains
      });
    }

    return { success: true, message: `Order status updated to ${status}`, order: data ? data[0] : null };
  }

  static async batchRefillOrders() {
    const SmmgenService = require('./smmgenService');
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'Completed')
      .not('provider_order_id', 'is', null);

    let count = 0;
    if (orders && orders.length > 0) {
      for (const order of orders) {
        try {
          if (order.provider_order_id) {
            await SmmgenService.refillOrder(order.provider_order_id);
            count++;
          }
        } catch (e) {
          console.error(`[AdminService] Batch refill skipped order ${order.id}:`, e.message);
        }
      }
    }
    return { success: true, refilled_count: count, message: count > 0 ? `Batch refill requested for ${count} active orders.` : 'No active orders requiring refill.' };
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

    if (!cleanData.name || typeof cleanData.name !== 'string' || cleanData.name.trim().length === 0) {
      throw new Error('Service name is required');
    }
    if (rateVal < 0) {
      throw new Error('Service rate cannot be negative');
    }

    const { data, error } = await supabaseAdmin.from('services').insert([cleanData]).select();
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

    let retryCount = 0; while (retryCount < 5 && error && error.message && error.message.includes("Could not find the '")) { retryCount++;
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
      // Validate URL to prevent SSRF attacks via DNS resolution & private IP validation
      try {
        const parsedUrl = new URL(provider.api_url);
        const dns = require('dns').promises;
        const net = require('net');

        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          throw new Error('Only HTTP/HTTPS protocols are allowed for provider API endpoints');
        }

        const addresses = await dns.resolve4(parsedUrl.hostname).catch(() => []);
        for (const addr of addresses) {
          if (net.isIP(addr)) {
            const parts = addr.split('.').map(Number);
            if (
              parts[0] === 10 ||
              parts[0] === 127 ||
              parts[0] === 0 ||
              (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
              (parts[0] === 192 && parts[1] === 168) ||
              (parts[0] === 169 && parts[1] === 254)
            ) {
              throw new Error('Internal/private URLs are not allowed for provider API endpoints');
            }
          }
        }
      } catch (urlErr) {
        if (urlErr.message.includes('not allowed') || urlErr.message.includes('protocols are allowed')) throw urlErr;
        throw new Error('Invalid provider API URL format');
      }
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
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getAllTransactions() {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false })
      .limit(1000);

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
    const ALLOWED_SETTINGS = [
      'site_name', 'site_url', 'site_description', 'site_logo',
      'whatsapp_number', 'whatsapp_enabled',
      'moolre_api_user', 'moolre_api_key', 'moolre_api_pubkey',
      'moolre_account_number', 'moolre_environment', 'moolre_enabled',
      'moolre_min_deposit',
      'referral_commission_rate', 'referral_enabled',
      'maintenance_mode', 'registration_enabled',
      'default_currency', 'min_order_amount'
    ];

    for (const [key, value] of Object.entries(settingsData)) {
      if (!ALLOWED_SETTINGS.includes(key)) {
        console.warn(`[AdminService] Blocked attempt to set unknown setting key: ${key}`);
        continue;
      }
      await supabaseAdmin.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    return { success: true, message: 'Settings saved successfully' };
  }
}

module.exports = AdminService;
