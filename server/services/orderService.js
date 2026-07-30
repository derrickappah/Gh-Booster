const { supabaseAdmin } = require('../config/supabase');
const SmmgenService = require('./smmgenService');

class OrderService {
  static async getUserOrders(userId) {
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*, services(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user orders:', error.message);
      return [];
    }

    return (orders || []).map(o => ({
      id: o.id,
      service_id: o.service_id,
      service_name: o.services?.name || 'SMM Service',
      link: o.link,
      quantity: o.quantity,
      charge: parseFloat(o.total_price || o.charge || 0),
      status: o.status || 'Processing',
      start_count: o.start_count || 0,
      remains: o.remains || 0,
      provider_order_id: o.provider_order_id || null,
      created_at: new Date(o.created_at).toISOString().replace('T', ' ').substring(0, 19)
    }));
  }

  static async createOrder({ userId, serviceId, link, quantity, batchId }) {
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      throw new Error('Valid quantity greater than 0 is required');
    }

    const { data: service, error: sErr } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .maybeSingle();

    if (sErr || !service) {
      throw new Error('Selected service not found or unavailable');
    }

    const ratePer1k = parseFloat(service.rate_per_1k || service.rate_per_1000 || service.our_price_per_1000 || service.rate || 0);
    const serviceName = service.name;
    const totalCharge = (qty / 1000) * ratePer1k;

    // Check user balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const currentBalance = wallet ? parseFloat(wallet.balance) : 0.0;

    if (currentBalance < totalCharge) {
      throw new Error(`Insufficient wallet balance (GH₵${currentBalance.toFixed(2)}). Total charge is GH₵${totalCharge.toFixed(2)}. Please add funds.`);
    }

    // Send order to SMMGen API provider if provider_service_id is configured
    let providerOrderId = null;
    if (service.provider_service_id) {
      const smmRes = await SmmgenService.placeOrder({
        providerServiceId: service.provider_service_id,
        link: link,
        quantity: qty
      });

      if (smmRes && smmRes.order) {
        providerOrderId = String(smmRes.order);
      } else if (smmRes && smmRes.error) {
        console.error('SMMGen order error:', smmRes.error);
        throw new Error(`SMMGen Provider Error: ${smmRes.error}`);
      }
    }

    // ATOMIC balance deduction: Use conditional update to prevent double-spend race condition.
    const newBalance = currentBalance - totalCharge;
    if (wallet && wallet.id) {
      const { data: updatedWallet, error: wErr } = await supabaseAdmin
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .gte('balance', totalCharge)
        .select('balance')
        .maybeSingle();

      if (wErr || !updatedWallet) {
        throw new Error('Insufficient balance. Your balance may have changed due to another transaction. Please try again.');
      }
    } else {
      throw new Error('Wallet not found. Please contact support.');
    }

    // Save order in database with correct 'charge' column (matches schema.sql)
    const { data: newOrder, error: oErr } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        service_id: serviceId,
        batch_id: batchId || null,
        link: link,
        quantity: qty,
        charge: totalCharge,
        status: 'Processing',
        start_count: 0,
        remains: qty,
        provider_order_id: providerOrderId
      })
      .select()
      .single();

    if (oErr) {
      console.error('Error inserting order into database:', oErr.message);
      throw new Error(`Failed to save order in database: ${oErr.message}`);
    }

    // Record transaction entry
    const { error: txErr } = await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: -totalCharge,
      currency: 'GHS',
      gateway: 'Wallet Balance',
      reference: 'ord_' + newOrder.id,
      type: 'order_charge',
      status: 'completed'
    });

    if (txErr) {
      console.error('[OrderService] Transaction insert error for order charge:', txErr.message);
    }

    return {
      order_id: newOrder.id,
      provider_order_id: providerOrderId,
      service_name: serviceName,
      quantity: qty,
      charge: totalCharge,
      new_balance: newBalance,
      status: 'Processing'
    };
  }

  static async createBulkOrders({ userId, bulkText, defaultServiceId }) {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const results = [];
    const validOrdersToPlace = [];
    let totalChargeOfValid = 0;
    let totalQuantityOfValid = 0;

    // Fetch user wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    const currentBalance = wallet ? parseFloat(wallet.balance) : 0.0;

    for (const line of lines) {
      const parts = line.split('|');
      let serviceId = null;
      let link = null;
      let quantityStr = null;

      if (parts.length >= 3) {
        serviceId = parts[0].trim();
        link = parts[1].trim();
        quantityStr = parts[2].trim();
      } else if (parts.length === 2 && defaultServiceId) {
        serviceId = defaultServiceId;
        link = parts[0].trim();
        quantityStr = parts[1].trim();
      } else {
        results.push({ line, success: false, error: 'Invalid format. Use "link | quantity" or "serviceId | link | quantity"' });
        continue;
      }

      const qty = parseInt(quantityStr, 10);
      if (isNaN(qty) || qty <= 0) {
        results.push({ line, success: false, error: 'Invalid quantity' });
        continue;
      }

      if (!link) {
        results.push({ line, success: false, error: 'Link is required' });
        continue;
      }

      // Fetch service details for rate and validation
      try {
        const { data: service, error: sErr } = await supabaseAdmin
          .from('services')
          .select('*')
          .eq('id', serviceId)
          .maybeSingle();

        if (sErr || !service) {
          throw new Error('Selected service not found or unavailable');
        }

        if (qty < (service.min_quantity || 10)) {
          throw new Error(`Quantity is below minimum limit (${service.min_quantity})`);
        }
        if (qty > (service.max_quantity || 1000000)) {
          throw new Error(`Quantity exceeds maximum limit (${service.max_quantity})`);
        }

        const ratePer1k = parseFloat(service.rate_per_1k || service.rate_per_1000 || service.our_price_per_1000 || service.rate || 0);
        const charge = (qty / 1000) * ratePer1k;

        validOrdersToPlace.push({
          serviceId,
          link,
          quantity: qty,
          charge,
          line
        });
        totalChargeOfValid += charge;
        totalQuantityOfValid += qty;
      } catch (err) {
        results.push({ line, success: false, error: err.message });
      }
    }

    if (validOrdersToPlace.length === 0) {
      return results;
    }

    // Check if total charge exceeds balance
    if (currentBalance < totalChargeOfValid) {
      throw new Error(`Insufficient wallet balance. Total charge for all valid orders is GH₵${totalChargeOfValid.toFixed(2)}, but your balance is GH₵${currentBalance.toFixed(2)}.`);
    }

    // Create the batch record in database
    const { data: newBatch, error: bErr } = await supabaseAdmin
      .from('batches')
      .insert({
        user_id: userId,
        service_id: defaultServiceId || null,
        total_orders: validOrdersToPlace.length,
        total_quantity: totalQuantityOfValid,
        total_charge: totalChargeOfValid,
        status: 'Processing'
      })
      .select()
      .single();

    if (bErr || !newBatch) {
      console.error('Error creating batch:', bErr?.message);
      throw new Error(`Failed to create batch record: ${bErr?.message || 'Unknown error'}`);
    }

    // Now insert each valid order referencing the batch ID
    for (const item of validOrdersToPlace) {
      try {
        const res = await OrderService.createOrder({
          userId,
          serviceId: item.serviceId,
          link: item.link,
          quantity: item.quantity,
          batchId: newBatch.id
        });
        results.push({ line: item.line, success: true, order_id: res.order_id });
      } catch (err) {
        results.push({ line: item.line, success: false, error: err.message });
      }
    }

    // Check if some orders failed
    const successCount = results.filter(r => r.success).length;
    let finalStatus = 'Processing';
    if (successCount === 0) {
      finalStatus = 'Canceled';
    } else if (successCount < validOrdersToPlace.length) {
      finalStatus = 'Partial';
    } else {
      finalStatus = 'Completed';
    }

    // Update batch status
    await supabaseAdmin
      .from('batches')
      .update({ status: finalStatus, updated_at: new Date().toISOString() })
      .eq('id', newBatch.id);

    return results;
  }

  static async getUserBulkBatches(userId) {
    const { data: batches, error } = await supabaseAdmin
      .from('batches')
      .select('*, services(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user bulk batches:', error.message);
      return [];
    }

    return (batches || []).map(b => ({
      id: b.id,
      service_id: b.service_id,
      service_name: b.services?.name || 'Multiple Services',
      total_orders: b.total_orders,
      total_quantity: b.total_quantity,
      charge: parseFloat(b.total_charge || b.charge || 0),
      status: b.status || 'Processing',
      created_at: new Date(b.created_at).toISOString().replace('T', ' ').substring(0, 19)
    }));
  }

  static async getOrderById(orderId, userId, isAdmin = false) {
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(orderId);
    if (!isUuid) {
      throw new Error('Order not found');
    }

    const { data: dbOrder, error } = await supabaseAdmin
      .from('orders')
      .select('*, services(id, name, description, rate_per_1k, rate_per_1000, refill_guarantee, refill_period_days, category_id, categories(name, icon))')
      .eq('id', orderId)
      .maybeSingle();

    if (error || !dbOrder) {
      throw new Error('Order not found');
    }

    if (!isAdmin && dbOrder.user_id !== userId) {
      throw new Error('Access denied: You do not have permission to view this order');
    }

    return {
      id: dbOrder.id,
      user_id: dbOrder.user_id,
      service_id: dbOrder.service_id,
      service_name: dbOrder.services?.name || 'Social Media Service',
      service_description: dbOrder.services?.description || 'High quality social media boosting service.',
      category_name: dbOrder.services?.categories?.name || 'General Services',
      category_icon: dbOrder.services?.categories?.icon || 'src/img/platforms/instagram.png',
      rate_per_1k: parseFloat(dbOrder.services?.rate_per_1k || dbOrder.services?.rate_per_1000 || 0),
      link: dbOrder.link,
      quantity: dbOrder.quantity,
      charge: parseFloat(dbOrder.total_price || dbOrder.charge || 0),
      currency: 'GHS',
      status: dbOrder.status || 'Processing',
      start_count: dbOrder.start_count || 0,
      remains: dbOrder.remains || 0,
      refill_guarantee: dbOrder.services?.refill_guarantee !== undefined && dbOrder.services?.refill_guarantee !== null ? Boolean(dbOrder.services.refill_guarantee) : true,
      refill_period_days: dbOrder.services?.refill_period_days || 30,
      provider_order_id: dbOrder.provider_order_id || null,
      created_at: new Date(dbOrder.created_at).toISOString().replace('T', ' ').substring(0, 19),
      updated_at: new Date(dbOrder.updated_at || dbOrder.created_at).toISOString().replace('T', ' ').substring(0, 19)
    };
  }

  static async refillOrder(orderId, userId) {
    const order = await OrderService.getOrderById(orderId, userId);
    if (!order.refill_guarantee) {
      throw new Error('This order does not have an active refill guarantee');
    }
    if (order.status !== 'Completed') {
      throw new Error(`Automated refill is only available for completed orders. Current status: ${order.status}`);
    }
    if (!order.provider_order_id) {
      throw new Error('This order does not support automated refill via provider');
    }
    const res = await SmmgenService.refillOrder(order.provider_order_id);
    if (res && res.error) {
      throw new Error(res.error);
    }
    const updatedOrder = await OrderService.getOrderById(orderId, userId);
    return { success: true, message: 'Refill requested successfully', refill_id: res ? res.refill : null, order: updatedOrder };
  }

  static async cancelOrder(orderId, userId) {
    // Fetch the order first to validate ownership and status
    const order = await OrderService.getOrderById(orderId, userId);

    const nonCancellableStatuses = ['Completed', 'Canceled', 'Refunded', 'Partial'];
    if (nonCancellableStatuses.includes(order.status)) {
      throw new Error(`Order cannot be canceled. Current status: ${order.status}`);
    }

    // Update order status to Canceled
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({ status: 'Canceled', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateErr) {
      console.error('Failed to cancel order:', updateErr.message);
      throw new Error('Failed to cancel order. Please contact support.');
    }

    // Refund the charge to the user's wallet
    const chargeAmount = parseFloat(order.charge || 0);
    let newBalance = null;
    if (chargeAmount > 0 && userId) {
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      const currentBalance = wallet ? parseFloat(wallet.balance) : 0;
      newBalance = currentBalance + chargeAmount;

      await supabaseAdmin
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      // Record refund transaction
      const { error: txErr } = await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        amount: chargeAmount,
        currency: 'GHS',
        gateway: 'Wallet Balance',
        reference: 'refund_' + orderId,
        type: 'refund',
        status: 'completed'
      });

      if (txErr) {
        console.error('[OrderService] Transaction insert error for order refund:', txErr.message);
      }
    }

    const updatedOrder = await OrderService.getOrderById(orderId, userId);

    return {
      success: true,
      message: chargeAmount > 0 ? `Order canceled and GH₵${chargeAmount.toFixed(2)} has been refunded to your wallet.` : 'Order has been canceled successfully.',
      new_balance: newBalance,
      order: updatedOrder
    };
  }
}

module.exports = OrderService;
