const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validator');
const { registerSchema, loginSchema } = require('../validators/schemas');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
router.get('/me', authenticateToken, AuthController.me);
router.post('/update-password', authenticateToken, AuthController.updatePassword);
router.post('/generate-api-key', authenticateToken, AuthController.generateApiKey);

module.exports = router;
