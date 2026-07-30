const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, WalletController.getWallet);

module.exports = router;
