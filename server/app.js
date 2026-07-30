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

// Security Hardening & Compression
const allowedOrigins = [
  'https://ghbooster.com',
  'https://www.ghbooster.com',
  // Allow localhost for development
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5000', 'http://localhost:3000', 'http://127.0.0.1:5000'] : [])
];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://jdvzcmexrkkiutbwbxos.supabase.co"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false  // Needed for external images
}));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like server-to-server or mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow any localhost origin
    if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(compression());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Rate Limiting
app.use('/api', globalLimiter);

// Serve static frontend files with optimal Cache-Control headers
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filepath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
  }
}));

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
  app.use(`${prefix}/settings`, settingsRoutes);
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
  res.send(`# GhBooster SMM Panel

> GhBooster is the premier Social Media Marketing (SMM) Panel providing automated, fast, and affordable growth services for Instagram, TikTok, YouTube, Telegram, Facebook, and Twitter.

## Core Pages

- [Home](https://www.ghbooster.com/index.html): Main landing page highlighting GhBooster features, supported platforms, instant 24/7 automated delivery, and pricing overviews.
- [Services](https://www.ghbooster.com/services.html): Complete catalog of social media marketing services with live real-time pricing per 1,000 units, minimum/maximum order bounds, and service descriptions.
- [API Documentation](https://www.ghbooster.com/api.html): Comprehensive API v2 reference for resellers, developers, and panel owners to automate orders, service lists, and balance checks via HTTP POST requests.
- [FAQ](https://www.ghbooster.com/faq.html): Frequently asked questions regarding order processing, automated delivery timelines, refill guarantees, and accepted payment methods.
- [Terms of Service](https://www.ghbooster.com/terms.html): Terms and conditions, privacy policies, refund policies, and usage guidelines for GhBooster services.

## User Account & Dashboard

- [Login](https://www.ghbooster.com/login.html): Secure user portal login page.
- [Register](https://www.ghbooster.com/register.html): User account registration form to create a new GhBooster account.
- [Dashboard](https://www.ghbooster.com/dashboard.html): Main user dashboard for placing new single orders, tracking active order status, and reviewing account metrics.
- [Bulk Order](https://www.ghbooster.com/bulk-order.html): Bulk order interface for submitting multiple service requests simultaneously line-by-line.
- [Orders History](https://www.ghbooster.com/orders.html): Order management page displaying order history, status (Pending, Processing, Completed, Partial, Canceled), and start/remains counts.
- [Add Funds](https://www.ghbooster.com/add-funds.html): Payment gateway portal supporting automated deposit methods including Mobile Money (MTN, Telecel, AT), Cryptocurrencies, Paystack, Flutterwave, and credit cards.
- [Transactions](https://www.ghbooster.com/transactions.html): Financial history listing all deposits, balance adjustments, and order debits.
- [Support Tickets](https://www.ghbooster.com/tickets.html): Customer support portal for opening and tracking support tickets.
- [Affiliates & Referrals](https://www.ghbooster.com/referrals.html): Referral program dashboard allowing users to earn commission by inviting new clients.
- [Child Panel](https://www.ghbooster.com/child-panel.html): Rental platform for users to launch their own branded SMM reseller panel connected to GhBooster API.
- [Account Settings](https://www.ghbooster.com/account.html): Profile management, API key generation, and password update page.

## Key Features & Capabilities

- **Instant Automated Delivery**: 24/7 automated order processing connected directly to high-capacity provider nodes.
- **API v2 Integration**: Full compatibility with standard SMM panel API format (actions: \`services\`, \`add\`, \`status\`, \`balance\`).
- **Multi-Platform Support**: SMM services covering Instagram, TikTok, YouTube, Telegram, Facebook, X (Twitter), Spotify, and Twitch.
- **Reseller Friendly**: High throughput endpoints, bulk order execution, and automated child panel setup.
`);
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
