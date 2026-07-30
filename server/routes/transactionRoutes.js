const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { supabaseAdmin } = require('../config/supabase');

router.get('/', authenticateToken, async (req, res) => {
  try {
    // 1. Fetch transactions table entries (Deposits, Refunds, Manual Adjustments)
    const { data: txs, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (txErr) console.error('Error fetching transactions:', txErr.message);

    let allTxs = (txs || []).map(t => {
      let typeDisplay = 'Deposit';
      const rawType = String(t.type || '').toLowerCase();
      if (rawType === 'order_charge') typeDisplay = 'Order Charge';
      else if (rawType === 'refund' || rawType === 'order_refund') typeDisplay = 'Order Refund';
      else if (rawType === 'withdrawal') typeDisplay = 'Withdrawal';
      else if (rawType === 'bonus') typeDisplay = 'Bonus';

      return {
        ...t,
        type: typeDisplay
      };
    });

    // 2. Fetch orders to ensure every order is accounted for as a transaction
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (orders && orders.length > 0) {
      const existingRefs = new Set(allTxs.map(t => String(t.reference || t.id).toLowerCase()));

      orders.forEach(o => {
        const orderRef = `ord_${o.id}`.toLowerCase();
        const displayRef = `ORD-${o.id}`;
        
        // If order charge is not explicitly in transactions table, synthesize entry
        if (!existingRefs.has(orderRef) && !existingRefs.has(displayRef.toLowerCase()) && !existingRefs.has(String(o.id).toLowerCase())) {
          allTxs.push({
            id: o.id,
            user_id: o.user_id,
            amount: -Math.abs(parseFloat(o.total_price || o.charge || o.price || 0)),
            currency: 'GHS',
            gateway: 'Wallet Balance',
            reference: displayRef,
            type: 'Order Charge',
            status: String(o.status || 'completed').toLowerCase() === 'canceled' ? 'failed' : 'completed',
            created_at: o.created_at
          });
        }
      });

      // Sort combined transactions chronologically descending
      allTxs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    res.json({ success: true, transactions: allTxs });
  } catch (err) {
    console.error('Error in /api/transactions route:', err);
    res.json({ success: true, transactions: [] });
  }
});

module.exports = router;
