const express = require('express');
const router = express.Router();
const ApiV2Controller = require('../controllers/apiV2Controller');

router.all('/', ApiV2Controller.handleV2Request);

module.exports = router;
