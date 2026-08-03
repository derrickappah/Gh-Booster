const express = require('express');
const router = express.Router();
const rssController = require('../controllers/rssController');

// Serve RSS feed on multiple common endpoint paths
router.get(['/', '/rss.xml', '/feed.xml', '/rss', '/feed'], rssController.getFeed);

module.exports = router;
