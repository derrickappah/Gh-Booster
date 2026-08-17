const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { supabaseAdmin } = require('../config/supabase');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: panels } = await supabaseAdmin.from('child_panels').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    res.json({ success: true, panels: panels || [] });
  } catch (err) {
    res.json({ success: true, panels: [] });
  }
});

router.post('/order', authenticateToken, async (req, res) => {
  try {
    const { domain, admin_username, admin_password } = req.body;
    if (!domain || !admin_username || !admin_password) {
      return res.status(400).json({ success: false, error: 'Domain, Admin Username, and Admin Password are required' });
    }

    const price = 25.00;

    let newBalance;
    try {
      const { data: rpcBal, error: rpcErr } = await supabaseAdmin.rpc('debit_wallet', {
        p_user_id: req.user.id,
        p_amount: price
      });
      if (rpcErr) throw rpcErr;
      newBalance = parseFloat(rpcBal);
    } catch (debitErr) {
      return res.status(400).json({
        success: false,
        error: `Insufficient wallet balance. Child panel costs GH₵${price.toFixed(2)}.`
      });
    }

    const { hashPassword } = require('../auth');
    const hashedPassword = await hashPassword(admin_password);

    const { data: panel, error } = await supabaseAdmin.from('child_panels').insert([{
      user_id: req.user.id,
      domain,
      admin_username,
      admin_password: hashedPassword,
      price,
      status: 'Pending'
    }]).select();

    if (error) {
      // Refund the deducted amount atomically if insertion fails
      try {
        await supabaseAdmin.rpc('credit_wallet', { p_user_id: req.user.id, p_amount: price });
      } catch (refundErr) {}
      throw new Error(error.message);
    }

    // Record transaction entry for auditing
    const { error: txErr } = await supabaseAdmin.from('transactions').insert({
      user_id: req.user.id,
      amount: -price,
      currency: 'GHS',
      gateway: 'Wallet Balance',
      reference: 'cp_' + panel[0].id,
      type: 'order_charge',
      status: 'completed'
    });

    if (txErr) {
      console.error('[ChildPanelRoutes] Transaction insert error:', txErr.message);
    }

    res.json({ success: true, message: 'Child panel order submitted successfully!', panel: panel[0], new_balance: newBalance });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
