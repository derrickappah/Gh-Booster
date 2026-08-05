const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('./config/env');
const { authenticateToken, requireRole } = require('./middleware/authMiddleware');

// bcrypt used only for child panel password hashing
const bcrypt = require('bcryptjs');

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN || '7d' }
  );
}

function generateApiKey() {
  return 'ghb_live_' + crypto.randomBytes(24).toString('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateApiKey,
  authenticateToken,
  requireRole
};
