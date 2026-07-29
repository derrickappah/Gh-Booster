const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
    { id: user.id, username: user.username, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function generateApiKey() {
  return 'ghb_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateApiKey,
  authenticateToken,
  requireRole
};
