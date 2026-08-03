const express = require('express');
const fs = require('fs');
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
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();
app.set('trust proxy', 1);

// Security Hardening & Compression
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://jdvzcmexrkkiutbwbxos.supabase.co", "https://api.moolre.com", "https://sandbox.moolre.com"],
      frameSrc: ["'self'", "https://checkout.moolre.com", "https://sandbox.moolre.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

const allowedOrigins = [
  'https://ghbooster.com',
  'https://www.ghbooster.com',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(compression());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Apply Rate Limiting to /api
app.use('/api', globalLimiter);

// Function to register API endpoints under a prefix
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
  app.use(`${prefix}/settings`, settingsRoutes);
};

// 1. Mount API Routes for /api and /api/v1 prefixes FIRST so API requests return JSON immediately
registerAppRoutes('/api');
registerAppRoutes('/api/v1');

// Health Check Endpoints
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    message: 'GhBooster Express Backend powered by Supabase PostgreSQL & Auth',
    timestamp: new Date().toISOString()
  });
});

// 2. 301 Permanent Redirect middleware for legacy .html URLs
app.use((req, res, next) => {
  if (req.path.endsWith('.html') && req.method === 'GET') {
    if (req.path === '/index.html') {
      const query = req.url.slice(req.path.length);
      return res.redirect(301, '/' + query);
    }
    if (req.path === '/api.html') {
      const query = req.url.slice(req.path.length);
      return res.redirect(301, '/api-docs' + query);
    }
    const cleanPath = req.path.slice(0, -5);
    const query = req.url.slice(req.path.length);
    return res.redirect(301, cleanPath + query);
  }
  next();
});

// 3. Clean Extensionless Page Routes Mapping (Serves HTML when requested by browser)
const pageRoutesMap = {
  '/': 'index.html',
  '/dashboard': 'dashboard.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/orders': 'orders.html',
  '/add-funds': 'add-funds.html',
  '/wallet': 'add-funds.html',
  '/account': 'account.html',
  '/profile': 'account.html',
  '/services': 'services.html',
  '/bulk-order': 'bulk-order.html',
  '/transactions': 'transactions.html',
  '/tickets': 'tickets.html',
  '/referrals': 'referrals.html',
  '/child-panel': 'child-panel.html',
  '/api-docs': 'api-docs.html',
  '/api': 'api.html',
  '/faq': 'faq.html',
  '/terms': 'terms.html',
  '/reviews': 'reviews.html',
  '/blog': 'blog.html',
  '/order-detail': 'order-detail.html',
  '/admin-dashboard': 'admin-dashboard.html',
  '/admin-users': 'admin-users.html',
  '/admin-orders': 'admin-orders.html',
  '/admin-services': 'admin-services.html',
  '/admin-providers': 'admin-providers.html',
  '/admin-deposits': 'admin-deposits.html',
  '/admin-transactions': 'admin-transactions.html',
  '/admin-payments': 'admin-payments.html',
  '/admin-tickets': 'admin-tickets.html',
  '/admin-referrals': 'admin-referrals.html',
  '/admin-child-panels': 'admin-child-panels.html',
  '/admin-bonuses': 'admin-bonuses.html',
  '/admin-promotions': 'admin-promotions.html',
  '/admin-news': 'admin-news.html',
  '/admin-logs': 'admin-logs.html',
  '/admin-settings': 'admin-settings.html',
  '/blog-instagram-followers': 'blog-instagram-followers.html',
  '/blog-telegram-members': 'blog-telegram-members.html',
  '/blog-tiktok-views': 'blog-tiktok-views.html',
  '/blog-youtube-subscribers': 'blog-youtube-subscribers.html',
  '/review-aba-ecommerce-case-study': 'review-aba-ecommerce-case-study.html',
  '/review-ghbooster-smm': 'review-ghbooster-smm.html'
};

Object.entries(pageRoutesMap).forEach(([routePath, htmlFileName]) => {
  app.get(routePath, (req, res) => {
    if (routePath.startsWith('/dashboard') || routePath.startsWith('/admin-')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    return res.sendFile(path.join(__dirname, '..', htmlFileName));
  });
});

// Middleware for defense-in-depth SEO protection on private dashboard routes
app.use(['/dashboard', '/dashboard/*'], (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Fallback to order-detail.html for order detail views
app.get(['/dashboard/orders/:id', '/order-detail'], (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(__dirname, '..', 'order-detail.html'));
});

// Block access to sensitive files/directories
app.use((req, res, next) => {
  const blockedPaths = ['/server/', '/node_modules/', '/.env', '/.git', '/package.json', '/package-lock.json', '/gulpfile.js', '/build.js', '/tailwind.config.js', '/scripts/'];
  const lowerPath = req.path.toLowerCase();
  if (blockedPaths.some(b => lowerPath.startsWith(b) || lowerPath === b)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  next();
});

// 4. Serve static assets (js, css, images, etc.)
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: 0,
  etag: true,
  dotfiles: 'deny',
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.html') || filepath.endsWith('.js') || filepath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filepath.match(/\.(css|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// 5. Root level API routes fallback
registerAppRoutes('');

// Serve robots.txt, sitemap.xml & llms.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, '..', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, '..', 'sitemap.xml'));
});

app.get(['/llms.txt', '/.well-known/llms.txt'], (req, res) => {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.sendFile(path.join(__dirname, '..', 'llms.txt'));
});

// Handling 404 & Errors
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
