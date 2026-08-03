const express = require('express');
const router = express.Router();
const ApiV2Controller = require('../controllers/apiV2Controller');
const { paymentLimiter } = require('../middleware/rateLimiter');

router.all('/', paymentLimiter, ApiV2Controller.handleV2Request);

module.exports = router;
