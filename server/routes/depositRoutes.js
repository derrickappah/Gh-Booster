const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validator');
const { depositSchema } = require('../validators/schemas');

router.get('/', authenticateToken, WalletController.getWallet);
router.post('/momo', authenticateToken, validate(depositSchema), WalletController.depositMoMo);

module.exports = router;
