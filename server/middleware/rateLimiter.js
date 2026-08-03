const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit login/register attempts to 20 per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
  }
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit payment operations to 15 per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many payment requests. Please wait a few minutes before trying again.'
  }
});

module.exports = { globalLimiter, authLimiter, paymentLimiter };

