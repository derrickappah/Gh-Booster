const express = require('express');
const router = express.Router();
const ServiceController = require('../controllers/serviceController');

router.get('/', ServiceController.getServices);

module.exports = router;
