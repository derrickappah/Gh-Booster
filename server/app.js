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

// Mount API Routes (Supports /api/... and direct serverless /... paths)
const registerAppRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/services`, serviceRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/deposits`, depositRoutes);
  app.use(`${prefix}/tickets`, ticketRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/v2`, apiV2Routes);
  app.use(`${prefix}/news`, newsRoutes);
  app.use(`${prefix}/referrals`, referralRoutes);
  app.use(`${prefix}/child-panels`, childPanelRoutes);
  app.use(`${prefix}/transactions`, transactionRoutes);
  app.use(`${prefix}/payments`, paymentRoutes);
};

registerAppRoutes('/api');
registerAppRoutes('');

// Health Check Endpoints
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    message: 'GhBooster Express Backend powered by Supabase PostgreSQL & Auth',
    timestamp: new Date().toISOString()
  });
});

// Serve robots.txt & sitemap.xml
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, '..', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, '..', 'sitemap.xml'));
});

// Middleware for defense-in-depth SEO protection on private dashboard routes
app.use(['/dashboard', '/dashboard/*'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Fallback to order-detail.html for order detail views
app.get(['/dashboard/orders/:id', '/order-detail.html', '/order-detail'], (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
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
