const { supabaseAdmin } = require('../config/supabase');
const SmmgenService = require('./smmgenService');

function roundMoney(val) {
  return Math.round((parseFloat(val) || 0) * 10000) / 10000;
}

// Helper for chunked async execution with controlled concurrency
async function processInChunks(items, concurrencyLimit, fn) {
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const chunk = items.slice(i, i + concurrencyLimit);
    await Promise.all(chunk.map(fn));
  }
}

class OrderService {
  static async getUserOrders(userId) {
    const { data: rawOrders, error } = await supabaseAdmin
      .from('orders')
      .select('*, services(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OrderService] Error fetching user orders:', error.message);
      return [];
    }

    return (rawOrders || []).map(o => ({
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

  static async syncUserOrdersStatus(userId) {
    const nonFinalizedStatuses = ['processing', 'pending', 'in progress', 'in-progress'];

    // Fetch user orders from database
    const { data: rawOrders, error } = await supabaseAdmin
      .from('orders')
      .select('*, services(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OrderService] Error fetching user orders for sync:', error.message);
      return [];
    }

    const ordersToSync = (rawOrders || []).filter(o => {
      const st = (o.status || '').toLowerCase();
      return nonFinalizedStatuses.includes(st) && o.provider_order_id;
    });

    if (ordersToSync.length > 0) {
      await processInChunks(ordersToSync, 10, async (order) => {
        try {
          const providerStatusRes = await SmmgenService.getOrderStatus(order.provider_order_id);
          if (!providerStatusRes || providerStatusRes.error) return;

          let newStatus = OrderService.normalizeProviderStatus(providerStatusRes.status || order.status);

          const newStartCount = providerStatusRes.start_count !== undefined && providerStatusRes.start_count !== null
            ? parseInt(providerStatusRes.start_count, 10)
            : order.start_count;
          const newRemains = providerStatusRes.remains !== undefined && providerStatusRes.remains !== null
            ? parseInt(providerStatusRes.remains, 10)
            : order.remains;

          const hasChanged = newStatus !== order.status || newStartCount !== order.start_count || newRemains !== order.remains;
          const isRefundableStatus = ['Canceled', 'Refunded', 'Partial'].includes(newStatus);

          if (hasChanged) {
            const updatePayload = {
              status: newStatus,
              start_count: newStartCount,
              remains: newRemains,
              updated_at: new Date().toISOString()
            };

            await supabaseAdmin
              .from('orders')
              .update(updatePayload)
              .eq('id', order.id);

            // Update in-memory reference for return value
            order.status = newStatus;
            order.start_count = newStartCount;
            order.remains = newRemains;

            if (isRefundableStatus) {
              await OrderService.processOrderRefund({
                order: { ...order, status: newStatus, start_count: newStartCount, remains: newRemains },
                newStatus,
                remains: newRemains,
                startCount: newStartCount
              });
            }
          }
        } catch (err) {
          console.error(`[OrderService] Error syncing provider order #${order.provider_order_id}:`, err.message);
        }
      });
    }

    return (rawOrders || []).map(o => ({
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

  static async syncAllNonFinalizedOrders() {
    const nonFinalizedStatuses = ['processing', 'pending', 'in progress', 'in-progress'];

    const { data: rawOrders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .not('provider_order_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !rawOrders) {
      if (error) console.error('[OrderCron] Error fetching active orders for background sync:', error.message);
      return 0;
    }

    const ordersToSync = rawOrders.filter(o => {
      const st = (o.status || '').toLowerCase();
      return nonFinalizedStatuses.includes(st) && o.provider_order_id;
    });

    let updatedCount = 0;
    if (ordersToSync.length > 0) {
      await processInChunks(ordersToSync, 10, async (order) => {
        try {
          const providerStatusRes = await SmmgenService.getOrderStatus(order.provider_order_id);
          if (!providerStatusRes || providerStatusRes.error) return;

          let newStatus = providerStatusRes.status || order.status;
          const statusLower = (newStatus || '').toLowerCase();
          if (statusLower === 'completed') newStatus = 'Completed';
          else if (statusLower === 'processing') newStatus = 'Processing';
          else if (statusLower === 'pending') newStatus = 'Pending';
          else if (statusLower === 'in progress' || statusLower === 'in-progress') newStatus = 'In Progress';
          else if (statusLower === 'canceled' || statusLower === 'cancelled') newStatus = 'Canceled';
          else if (statusLower === 'partial') newStatus = 'Partial';
          else if (statusLower === 'refunded') newStatus = 'Refunded';

          const newStartCount = providerStatusRes.start_count !== undefined && providerStatusRes.start_count !== null
            ? parseInt(providerStatusRes.start_count, 10)
            : order.start_count;
          const newRemains = providerStatusRes.remains !== undefined && providerStatusRes.remains !== null
            ? parseInt(providerStatusRes.remains, 10)
            : order.remains;

          const hasChanged = newStatus !== order.status || newStartCount !== order.start_count || newRemains !== order.remains;
          const isRefundableStatus = ['Canceled', 'Refunded', 'Partial'].includes(newStatus);

          if (hasChanged) {
            await supabaseAdmin
              .from('orders')
              .update({
                status: newStatus,
                start_count: newStartCount,
                remains: newRemains,
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id);
            updatedCount++;

            if (isRefundableStatus) {
              await OrderService.processOrderRefund({
                order: { ...order, status: newStatus, start_count: newStartCount, remains: newRemains },
                newStatus,
                remains: newRemains,
                startCount: newStartCount
              });
            }
          }
        } catch (err) {
          console.error(`[OrderCron] Error syncing provider order #${order.provider_order_id}:`, err.message);
        }
      });
    }

    // Safety sweep: Also process any Canceled / Refunded / Partial orders whose refunds have not been fully issued yet
    const unrefundedOrders = (rawOrders || []).filter(o => {
      const st = (o.status || '').toLowerCase();
      const isRefStatus = st === 'canceled' || st === 'cancelled' || st === 'refunded' || st === 'partial';
      if (!isRefStatus) return false;
      const charge = parseFloat(o.total_price || o.charge || 0);
      const refunded = parseFloat(o.refunded_amount || 0);
      return charge > 0 && refunded < charge;
    });

    if (unrefundedOrders.length > 0) {
      await Promise.all(unrefundedOrders.map(async (order) => {
        try {
          await OrderService.processOrderRefund({
            order,
            newStatus: order.status,
            remains: order.remains
          });
        } catch (e) {
          console.error(`[OrderCron] Error sweeping refund for order #${order.id}:`, e.message);
        }
      }));
    }

    return updatedCount;
  }

  static async createOrder({ userId, serviceId, link, quantity, batchId, skipWalletDeduction = false }) {
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
    const totalCharge = roundMoney((qty / 1000) * ratePer1k);

    let newBalance = null;

    // Step 1: Debit wallet balance upfront (unless part of a bulk order that already deducted balance)
    if (!skipWalletDeduction) {
      try {
        const { data: rpcBal, error: rpcErr } = await supabaseAdmin.rpc('debit_wallet', {
          p_user_id: userId,
          p_amount: totalCharge
        });
        if (rpcErr) throw rpcErr;
        newBalance = parseFloat(rpcBal);
      } catch (debitErr) {
        throw new Error(`Insufficient wallet balance. Total charge is GH₵${totalCharge.toFixed(2)}. ${debitErr.message || ''}`);
      }
    }

    // Step 2: Insert initial order into database FIRST before calling external provider
    let newOrder;
    const initialStatus = service.provider_service_id ? 'Processing' : 'Pending';
    try {
      const { data: orderData, error: oErr } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: userId,
          service_id: serviceId,
          batch_id: batchId || null,
          link: link,
          quantity: qty,
          charge: totalCharge,
          status: initialStatus,
          start_count: 0,
          remains: qty,
          provider_order_id: null
        })
        .select()
        .single();

      if (oErr || !orderData) {
        throw oErr || new Error('Database insertion failed');
      }
      newOrder = orderData;
    } catch (insertErr) {
      // Rollback wallet deduction if order database insertion failed
      console.error('Error inserting order into database, rolling back wallet deduction:', insertErr.message || insertErr);
      if (!skipWalletDeduction) {
        try {
          await supabaseAdmin.rpc('credit_wallet', { p_user_id: userId, p_amount: totalCharge });
        } catch (rollbackErr) {
          console.error('CRITICAL: Wallet rollback failed after DB insert error:', rollbackErr.message);
        }
      }
      throw new Error(`Failed to save order in database: ${insertErr.message || insertErr}`);
    }

    // Step 3: Call external SMM Provider if configured
    let providerOrderId = null;
    if (service.provider_service_id) {
      try {
        const smmRes = await SmmgenService.placeOrder({
          providerServiceId: service.provider_service_id,
          link: link,
          quantity: qty
        });

        if (smmRes && smmRes.order) {
          providerOrderId = String(smmRes.order);
          // Attach provider_order_id to local order row
          await supabaseAdmin
            .from('orders')
            .update({ provider_order_id: providerOrderId, updated_at: new Date().toISOString() })
            .eq('id', newOrder.id);
        } else {
          const providerErrMsg = smmRes?.error || 'Unknown provider error';
          console.error(`SMMGen order error for order #${newOrder.id}:`, providerErrMsg);
          
          // Mark order as Canceled in DB
          await supabaseAdmin
            .from('orders')
            .update({ status: 'Canceled', updated_at: new Date().toISOString() })
            .eq('id', newOrder.id);

          // Refund wallet ONLY if skipWalletDeduction is false (bulk orders handle individual refunds in bulk loop)
          if (!skipWalletDeduction) {
            try {
              await supabaseAdmin.rpc('credit_wallet', { p_user_id: userId, p_amount: totalCharge });
            } catch (refundErr) {
              console.error('CRITICAL: Provider error refund failed:', refundErr.message);
            }
          }
          throw new Error(`SMMGen Provider Error: ${providerErrMsg}`);
        }
      } catch (providerErr) {
        // Mark order as Canceled in DB on unexpected network/provider error
        try {
          await supabaseAdmin
            .from('orders')
            .update({ status: 'Canceled', updated_at: new Date().toISOString() })
            .eq('id', newOrder.id);
        } catch (cancelErr) {}

        if (!skipWalletDeduction) {
          try {
            await supabaseAdmin.rpc('credit_wallet', { p_user_id: userId, p_amount: totalCharge });
          } catch (refundErr) {
            console.error('CRITICAL: Unexpected provider error refund failed:', refundErr.message);
          }
        }
        throw providerErr;
      }
    }

    // Step 4: Record transaction entry
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
      status: initialStatus
    };
  }

  static normalizeProviderStatus(status) {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'completed') return 'Completed';
    if (statusLower === 'processing') return 'Processing';
    if (statusLower === 'pending') return 'Pending';
    if (statusLower === 'in progress' || statusLower === 'in-progress') return 'In Progress';
    if (statusLower === 'canceled' || statusLower === 'cancelled') return 'Canceled';
    if (statusLower === 'partial') return 'Partial';
    if (statusLower === 'refunded') return 'Refunded';
    return status || 'Processing';
  }

  static async createBulkOrders({ userId, bulkText, defaultServiceId }) {
    if (!bulkText || typeof bulkText !== 'string') {
      throw new Error('Bulk order text is required');
    }
    const MAX_BULK_LINES = 100;
    const MAX_LINK_LENGTH = 2048;
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > MAX_BULK_LINES) {
      throw new Error(`Bulk orders limited to ${MAX_BULK_LINES} lines per request. You submitted ${lines.length}.`);
    }
    if (lines.length === 0) {
      throw new Error('No valid order lines found in bulk text.');
    }
    lines.forEach((l, idx) => {
      const isPipe = l.includes('|');
      const parts = isPipe ? l.split('|').map(p => p.trim()) : l.split(/\s+/);
      const link = (parts.length >= 3 ? parts[1] : (parts.length === 2 ? parts[0] : '')) || '';
      if (link.trim().length > MAX_LINK_LENGTH) {
        throw new Error(`Line ${idx + 1} link exceeds maximum allowable length of ${MAX_LINK_LENGTH} characters.`);
      }
    });
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
      const isPipe = line.includes('|');
      const parts = isPipe ? line.split('|').map(p => p.trim()) : line.split(/\s+/);
      let serviceId = null;
      let link = null;
      let quantityStr = null;

      if (parts.length >= 3) {
        serviceId = parts[0];
        link = parts[1];
        quantityStr = parts[2];
      } else if (parts.length === 2 && defaultServiceId) {
        serviceId = defaultServiceId;
        link = parts[0];
        quantityStr = parts[1];
      } else {
        results.push({ line, success: false, error: 'Invalid format. Use "link quantity" or "serviceId link quantity"' });
        continue;
      }

      const qty = parseInt(quantityStr, 10);
      if (isNaN(qty) || qty <= 0) {
        results.push({ line, success: false, error: 'Invalid quantity' });
        continue;
      }

      // Validate link format
      if (!link || link.length < 5 || (!link.startsWith('http://') && !link.startsWith('https://'))) {
        results.push({ line, success: false, error: 'Link must be a valid URL starting with http:// or https://' });
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
        const charge = roundMoney((qty / 1000) * ratePer1k);

        validOrdersToPlace.push({
          serviceId,
          link,
          quantity: qty,
          charge,
          line
        });
        totalChargeOfValid = roundMoney(totalChargeOfValid + charge);
        totalQuantityOfValid += qty;
      } catch (err) {
        results.push({ line, success: false, error: err.message });
      }
    }

    if (validOrdersToPlace.length === 0) {
      return results;
    }

    // Atomically deduct total charge upfront
    try {
      const { data: rpcBal, error: rpcErr } = await supabaseAdmin.rpc('debit_wallet', {
        p_user_id: userId,
        p_amount: totalChargeOfValid
      });
      if (rpcErr) throw rpcErr;
    } catch (debitErr) {
      throw new Error(`Insufficient wallet balance. Total charge for all valid orders is GH₵${totalChargeOfValid.toFixed(2)}. ${debitErr.message || ''}`);
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
      // Refund upfront deduction if batch creation failed
      try {
        await supabaseAdmin.rpc('credit_wallet', { p_user_id: userId, p_amount: totalChargeOfValid });
      } catch (refundErr) {}
      console.error('Error creating batch:', bErr?.message);
      throw new Error(`Failed to create batch record: ${bErr?.message || 'Unknown error'}`);
    }

    // Record batch transaction entry for auditing
    try {
      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        amount: -totalChargeOfValid,
        currency: 'GHS',
        gateway: 'Wallet Balance',
        reference: 'batch_' + newBatch.id,
        type: 'order_charge',
        status: 'completed',
        description: `Bulk order batch #${newBatch.id} (${validOrdersToPlace.length} orders)`
      });
    } catch (txErr) {
      console.error('[BulkOrders] Batch charge transaction insert error:', txErr.message);
    }

    // Now insert each valid order referencing the batch ID with skipWalletDeduction=true
    for (const item of validOrdersToPlace) {
      try {
        const res = await OrderService.createOrder({
          userId,
          serviceId: item.serviceId,
          link: item.link,
          quantity: item.quantity,
          batchId: newBatch.id,
          skipWalletDeduction: true
        });
        results.push({ line: item.line, success: true, order_id: res.order_id });
      } catch (err) {
        // Refund individual failed order amount
        try {
          await supabaseAdmin.rpc('credit_wallet', { p_user_id: userId, p_amount: item.charge });
          try {
            await supabaseAdmin.from('transactions').insert({
              user_id: userId,
              amount: item.charge,
              currency: 'GHS',
              gateway: 'Wallet Balance',
              reference: 'refund_bulk_' + newBatch.id + '_' + Date.now().toString(36),
              type: 'refund',
              status: 'completed',
              description: `Bulk order item refund for Batch #${newBatch.id}`
            });
          } catch (txErr) {}
        } catch (rErr) {
          console.error('[BulkOrders] Failed to refund failed order item:', rErr.message);
        }
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

    // Live provider sync for active non-finalized orders
    const nonFinalized = ['processing', 'pending', 'in progress', 'in-progress'];
    if (dbOrder.provider_order_id && nonFinalized.includes((dbOrder.status || '').toLowerCase())) {
      try {
        const providerStatusRes = await SmmgenService.getOrderStatus(dbOrder.provider_order_id);
        if (providerStatusRes && !providerStatusRes.error && providerStatusRes.status) {
          let newStatus = providerStatusRes.status;
          const statusLower = (newStatus || '').toLowerCase();
          if (statusLower === 'completed') newStatus = 'Completed';
          else if (statusLower === 'processing') newStatus = 'Processing';
          else if (statusLower === 'pending') newStatus = 'Pending';
          else if (statusLower === 'in progress' || statusLower === 'in-progress') newStatus = 'In Progress';
          else if (statusLower === 'canceled' || statusLower === 'cancelled') newStatus = 'Canceled';
          else if (statusLower === 'partial') newStatus = 'Partial';
          else if (statusLower === 'refunded') newStatus = 'Refunded';

          const newStartCount = providerStatusRes.start_count !== undefined && providerStatusRes.start_count !== null
            ? parseInt(providerStatusRes.start_count, 10)
            : dbOrder.start_count;
          const newRemains = providerStatusRes.remains !== undefined && providerStatusRes.remains !== null
            ? parseInt(providerStatusRes.remains, 10)
            : dbOrder.remains;

          const hasChanged = newStatus !== dbOrder.status || newStartCount !== dbOrder.start_count || newRemains !== dbOrder.remains;

          if (hasChanged) {
            await supabaseAdmin
              .from('orders')
              .update({
                status: newStatus,
                start_count: newStartCount,
                remains: newRemains,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbOrder.id);

            dbOrder.status = newStatus;
            dbOrder.start_count = newStartCount;
            dbOrder.remains = newRemains;

            if (['Canceled', 'Refunded', 'Partial'].includes(newStatus)) {
              await OrderService.processOrderRefund({
                order: dbOrder,
                newStatus,
                remains: newRemains,
                startCount: newStartCount
              });
            }
          }
        }
      } catch (err) {
        console.error('[getOrderById] Live provider sync error:', err.message);
      }
    }

      const formatDate = (d) => {
        if (!d) return new Date().toISOString().replace('T', ' ').substring(0, 19);
        try {
          const parsed = new Date(d);
          if (isNaN(parsed.getTime())) return String(d).substring(0, 19);
          return parsed.toISOString().replace('T', ' ').substring(0, 19);
        } catch (e) {
          return String(d).substring(0, 19);
        }
      };

      return {
        id: dbOrder.id,
        user_id: dbOrder.user_id,
        service_id: dbOrder.service_id,
        service_name: dbOrder.services?.name || 'Social Media Service',
        service_description: dbOrder.services?.description || 'High quality social media boosting service.',
        category_name: dbOrder.services?.categories?.name || 'General Services',
        category_icon: dbOrder.services?.categories?.icon || '/src/img/platforms/instagram.png',
        rate_per_1k: parseFloat(dbOrder.services?.rate_per_1k || dbOrder.services?.rate_per_1000 || 0),
        link: dbOrder.link,
        quantity: dbOrder.quantity,
        charge: parseFloat(dbOrder.total_price || dbOrder.charge || 0),
        currency: 'GHS',
        status: dbOrder.status || 'Processing',
        start_count: dbOrder.start_count || 0,
        remains: dbOrder.remains || 0,
        refill_guarantee: dbOrder.services?.refill_guarantee !== undefined && dbOrder.services?.refill_guarantee !== null ? Boolean(dbOrder.services.refill_guarantee) : false,
        refill_period_days: dbOrder.services?.refill_period_days || 30,
        provider_order_id: dbOrder.provider_order_id || null,
        created_at: formatDate(dbOrder.created_at),
        updated_at: formatDate(dbOrder.updated_at || dbOrder.created_at)
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

  static async cancelOrder(orderId, userId, isAdmin = false) {
    if (!isAdmin) {
      throw new Error('Users are not permitted to cancel their own orders. Please contact support via tickets.');
    }
    // Fetch the order first to validate ownership and status
    const order = await OrderService.getOrderById(orderId, userId, isAdmin);
    const refundUserId = order.user_id || userId; // Always refund to order owner, not admin

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

    // Refund the charge to the order owner's wallet
    const chargeAmount = roundMoney(order.charge || 0);
    let newBalance = null;
    if (chargeAmount > 0 && refundUserId) {
      try {
        const { data: rpcBalance, error: rpcErr } = await supabaseAdmin.rpc('credit_wallet', {
          p_user_id: refundUserId,
          p_amount: chargeAmount
        });
        if (rpcErr) throw rpcErr;
        newBalance = parseFloat(rpcBalance);
      } catch (rpcError) {
        console.error('[cancelOrder] credit_wallet RPC failed:', rpcError.message);
        // Log failed refund for manual resolution (F-09)
        try {
          await supabaseAdmin.from('failed_refunds').insert({
            order_id: orderId,
            user_id: refundUserId,
            amount: chargeAmount,
            error: rpcError.message || 'Wallet credit RPC failed during cancel'
          });
        } catch (logErr) {
          console.error('[cancelOrder] Failed to log failed refund:', logErr.message);
        }
        throw new Error('Failed to credit refund to user wallet. Order status updated to Canceled.');
      }

      // Record refund transaction for order owner
      const { error: txErr } = await supabaseAdmin.from('transactions').insert({
        user_id: refundUserId,
        amount: chargeAmount,
        currency: 'GHS',
        gateway: 'Wallet Balance',
        payment_ref: 'refund_' + orderId,
        reference: 'refund_' + orderId + '_' + Date.now(),
        type: 'refund',
        status: 'completed'
      });

      if (txErr) {
        console.error('[OrderService] Transaction insert error for order refund:', txErr.message);
      }
    }

    const updatedOrder = await OrderService.getOrderById(orderId, refundUserId, true);

    return {
      success: true,
      message: chargeAmount > 0 ? `Order canceled and GH₵${chargeAmount.toFixed(2)} has been refunded to customer wallet.` : 'Order has been canceled successfully.',
      new_balance: newBalance,
      order: updatedOrder
    };
  }

  /**
   * Automatically process wallet refunds when an order status is updated to Canceled, Refunded, or Partial.
   */
  static async processOrderRefund({ order, newStatus, remains }) {
    if (!order || !order.id || !order.user_id) return null;

    const st = (newStatus || order.status || '').toLowerCase();
    const isCancelOrRefund = st === 'canceled' || st === 'cancelled' || st === 'refunded';
    const isPartial = st === 'partial';

    if (!isCancelOrRefund && !isPartial) return null;

    const totalCharge = parseFloat(order.total_price || order.charge || order.price || 0);
    const totalQty = parseInt(order.quantity || 0, 10);
    const userId = order.user_id;

    if (totalCharge <= 0 || !userId) return null;

    // Check existing refunds for this order in transactions table to guarantee idempotency
    const { data: existingRefundTxs } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'refund')
      .or(`reference.like.%refund_${order.id}%,reference.like.%partial_refund_${order.id}%`);

    const alreadyRefundedFromTxs = (existingRefundTxs || []).reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const existingRefundedOnOrder = parseFloat(order.refunded_amount || 0);
    const alreadyRefunded = Math.max(alreadyRefundedFromTxs, existingRefundedOnOrder);

    let targetRefundTotal = 0;

    if (isCancelOrRefund) {
      targetRefundTotal = totalCharge;
    } else if (isPartial) {
      const rem = remains !== undefined && remains !== null ? parseInt(remains, 10) : parseInt(order.remains || 0, 10);
      const unfulfilledQty = Math.max(0, Math.min(rem, totalQty));
      if (totalQty > 0) {
        targetRefundTotal = (unfulfilledQty / totalQty) * totalCharge;
      }
    }

    const refundableAmount = Math.max(0, targetRefundTotal - alreadyRefunded);

    // If no additional refund is owed, return existing status
    if (refundableAmount < 0.0001) {
      return { refunded: false, refundAmount: 0 };
    }

    // Atomic claim: mark the refund amount on the order first to prevent concurrent refunds
    const { data: claimedOrder, error: claimErr } = await supabaseAdmin
      .from('orders')
      .update({
        refunded_amount: alreadyRefunded + refundableAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .or(`refunded_amount.is.null,refunded_amount.lte.${alreadyRefunded}`)
      .select('refunded_amount')
      .maybeSingle();

    if (claimErr || !claimedOrder) {
      // Another process already claimed this refund
      return { refunded: false, refundAmount: 0 };
    }

    // Atomically credit user's wallet balance via PostgreSQL function
    let rpcBalance;
    try {
      const { data: rpcBal, error: rpcErr } = await supabaseAdmin.rpc('credit_wallet', {
        p_user_id: userId,
        p_amount: refundableAmount
      });
      if (rpcErr) throw rpcErr;
      rpcBalance = rpcBal;
    } catch (rpcErr) {
      console.error('[processOrderRefund] credit_wallet RPC failed, reverting claimed refund:', rpcErr.message);
      await supabaseAdmin.from('orders').update({ refunded_amount: alreadyRefunded }).eq('id', order.id);
      
      // Log failed refund for manual resolution (F-09)
      try {
        await supabaseAdmin.from('failed_refunds').insert({
          order_id: order.id,
          user_id: userId,
          amount: refundableAmount,
          error: rpcErr.message || 'Wallet credit RPC failed'
        });
      } catch (logErr) {
        console.error('[processOrderRefund] Failed to log failed refund:', logErr.message);
      }
      
      throw new Error('Wallet credit operation failed during refund processing');
    }
    const newBalance = parseFloat(rpcBalance);

    const refPrefix = isPartial ? 'partial_refund_' : 'refund_';
    const txRef = `${refPrefix}${order.id}_${Date.now().toString(36)}`;

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: refundableAmount,
      currency: 'GHS',
      gateway: 'Wallet Balance',
      payment_ref: txRef,
      reference: txRef,
      type: 'refund',
      status: 'completed',
      description: isPartial
        ? `Partial order refund for Order #${String(order.id).substring(0, 8)}`
        : `Order ${newStatus} refund for Order #${String(order.id).substring(0, 8)}`
    });

    const newTotalRefunded = alreadyRefunded + refundableAmount;

    console.log(`[OrderRefund] Successfully refunded GH₵${refundableAmount.toFixed(2)} to user ${userId} for Order #${order.id} (${newStatus})`);

    return {
      refunded: true,
      refundAmount: refundableAmount,
      newTotalRefunded,
      newBalance
    };
  }
}

module.exports = OrderService;
