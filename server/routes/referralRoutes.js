const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { supabase } = require('../config/supabase');

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { data: payouts } = await supabase.from('referral_payouts').select('*').eq('user_id', req.user.id);
    const totalEarned = (payouts || []).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    res.json({
      success: true,
      referral_link: `https://ghbooster.com/ref/${req.user.username || 'user'}`,
      total_referrals: (payouts || []).length,
      total_earned: totalEarned,
      commission_rate: '5%',
      payouts: payouts || []
    });
  } catch (err) {
    res.json({
      success: true,
      referral_link: `https://ghbooster.com/ref/${req.user.username || 'user'}`,
      total_referrals: 0,
      total_earned: 0,
      commission_rate: '5%',
      payouts: []
    });
  }
});

module.exports = router;
