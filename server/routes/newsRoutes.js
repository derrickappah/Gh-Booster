const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const { data: news } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    res.json({ success: true, news: news || [] });
  } catch (err) {
    res.json({ success: true, news: [] });
  }
});

module.exports = router;
