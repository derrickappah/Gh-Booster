const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const path = require('path');

const { globalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const orderRoutes = require('./routes/orderRoutes');
const depositRoutes = require('./routes/depositRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiV2Routes = require('./routes/apiV2Routes');
const newsRoutes = require('./routes/newsRoutes');
const referralRoutes = require('./routes/referralRoutes');
const childPanelRoutes = require('./routes/childPanelRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// Security Hardening & Compression
app.use(helmet({
  contentSecurityPolicy: false // Allow dynamic scripts/styles from inline templates
}));
app.use(cors());
app.use(compression());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Rate Limiting
app.use('/api', globalLimiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/v2', apiV2Routes);
app.use('/api/news', newsRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/child-panels', childPanelRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/payments', paymentRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    message: 'GhBooster Express Backend powered by Supabase PostgreSQL & Auth',
    timestamp: new Date().toISOString()
  });
});

// Fallback to order-detail.html for order detail views
app.get(['/dashboard/orders/:id', '/order-detail.html', '/order-detail'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'order-detail.html'));
});


// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Handling 404 & Errors
app.use(notFoundHandler);
app.use(errorHandler);


module.exports = app;
