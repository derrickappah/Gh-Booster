const express = require('express');
const router = express.Router();
const AdminService = require('../services/adminService');

// Public route to get safe configurations
router.get('/public', async (req, res, next) => {
  try {
    const settings = await AdminService.getSettings();
    const publicSettings = {
      site_name: settings.site_name || 'GhBooster',
      site_url: settings.site_url || 'https://ghbooster.com',
      whatsapp_number: settings.whatsapp_number || '',
      whatsapp_enabled: settings.whatsapp_enabled === 'true' || settings.whatsapp_enabled === true
    };
    res.json({ success: true, settings: publicSettings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
