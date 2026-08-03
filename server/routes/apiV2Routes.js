const express = require('express');
const router = express.Router();
const ApiV2Controller = require('../controllers/apiV2Controller');
const { apiKeyLimiter } = require('../middleware/rateLimiter');

router.all('/', apiKeyLimiter, ApiV2Controller.handleV2Request);

module.exports = router;
