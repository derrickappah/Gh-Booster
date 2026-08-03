const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const env = require('./config/env');
const { authenticateToken, requireRole } = require('./middleware/authMiddleware');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: '24h' }
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
