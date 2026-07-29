const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { supabase } = require('../config/supabase');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    res.json({ success: true, transactions: txs || [] });
  } catch (err) {
    res.json({ success: true, transactions: [] });
  }
});

module.exports = router;
