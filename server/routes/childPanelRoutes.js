const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { supabase } = require('../config/supabase');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: panels } = await supabase.from('child_panels').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
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

    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', req.user.id).maybeSingle();
    const currentBalance = wallet ? parseFloat(wallet.balance) : 0;

    if (currentBalance < price) {
      return res.status(400).json({ success: false, error: `Insufficient wallet balance (GH₵${currentBalance.toFixed(2)}). Child panel costs $25.00.` });
    }

    const newBalance = currentBalance - price;
    await supabase.from('wallets').upsert({ user_id: req.user.id, balance: newBalance, updated_at: new Date().toISOString() });

    const { data: panel, error } = await supabase.from('child_panels').insert([{
      user_id: req.user.id,
      domain,
      admin_username,
      admin_password,
      price,
      status: 'Pending'
    }]).select();

    if (error) throw new Error(error.message);

    res.json({ success: true, message: 'Child panel order submitted successfully!', panel: panel[0], new_balance: newBalance });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
