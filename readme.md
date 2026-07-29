# GhBooster SMM Panel — Full Stack Node.js + Express + Supabase Application

A high-performance SMM Panel application built with a Vanilla HTML/CSS/JS frontend and a Node.js + Express backend powered by Supabase PostgreSQL and Supabase Auth.

---

## 🏗 Architecture Overview

### Frontend
- **Tech Stack**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (built with Gulp/PostCSS).
- **Design Policy**: 100% pixel-perfect preservation of original UI/UX.
- **API Client**: `src/js/api-client.js` handles dynamic UI rendering, token management, fetch requests, and state management.

### Backend (`/server`)
- **Tech Stack**: Node.js, Express.js (v5+), Supabase JS SDK.
- **Security**: `helmet`, `cors`, `express-rate-limit`, `zod` input validation, Supabase JWT verification.
- **Database**: Supabase PostgreSQL cloud instance.
- **Authentication**: Supabase Auth (Email & Password, JWT sessions, Role-Based Access Control).

```
server/
├── config/
│   ├── env.js           # Validates environment configuration
│   └── supabase.js      # Supabase Client & Admin Client exports
├── middleware/
│   ├── authMiddleware.js # Supabase JWT validation & RBAC (Roles: user, admin, reseller, staff)
│   ├── errorHandler.js   # Centralized error handler
│   ├── rateLimiter.js    # Express rate limiters
│   └── validator.js      # Zod request payload validator
├── controllers/
│   ├── authController.js
│   ├── serviceController.js
│   ├── orderController.js
│   ├── walletController.js
│   ├── ticketController.js
│   ├── adminController.js
│   └── apiV2Controller.js
├── services/
│   ├── authService.js    # Supabase Auth integration
│   ├── serviceService.js # Service catalog & categories manager
│   ├── orderService.js  # Order creation, wallet deduction & tracking
│   ├── walletService.js # Balance management & MoMo deposits
│   ├── ticketService.js # Customer support tickets
│   └── adminService.js  # Platform KPIs, user management & balance overrides
├── routes/
│   ├── authRoutes.js
│   ├── serviceRoutes.js
│   ├── orderRoutes.js
│   ├── depositRoutes.js
│   ├── ticketRoutes.js
│   ├── adminRoutes.js
│   └── apiV2Routes.js
├── validators/
│   └── schemas.js       # Zod schemas for payload validation
├── database/
│   └── schema.sql       # Full Supabase PostgreSQL DDL script
├── app.js               # Express application initialization
└── server.js            # Node HTTP server entry point
```

---

## 🔑 Environment Variables (`.env`)

Create a `.env` file in the root directory:

```env
PORT=5000
SUPABASE_URL=https://<your-supabase-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
JWT_SECRET=<your-custom-jwt-secret>
NODE_ENV=production
```

---

## 🛢 Database Schema (`schema.sql`)

The database is built on Supabase PostgreSQL with full foreign key constraints and indexes:

- `profiles` — Stores user profiles linked to `auth.users(id)`.
- `wallets` — User balance accounts in USD.
- `transactions` — Financial audit log (deposits, order charges, refunds).
- `categories` — Service category list.
- `providers` — SMM API provider integrations.
- `services` — Service catalog (linked to categories & providers).
- `orders` — User orders with link, quantity, charge, and live status.
- `tickets` & `ticket_messages` — Support ticketing system.

---

## 📡 REST API Documentation

### Auth & User Management
- `POST /api/auth/register` — Register a new account.
- `POST /api/auth/login` — Authenticate and return JWT token.
- `GET /api/auth/me` — Return current authenticated user & wallet balance.
- `POST /api/auth/update-password` — Change account password.
- `POST /api/auth/generate-api-key` — Generate custom SMM API Key.

### Services & Orders
- `GET /api/services` — List service categories and services catalog.
- `GET /api/orders` — List user's placed orders.
- `POST /api/orders` — Place a new order (deducts wallet balance).

### Wallet & Deposits
- `GET /api/deposits` — Get current wallet balance & transaction history.
- `POST /api/deposits/momo` — Deposit funds via Mobile Money.

### Support Tickets
- `GET /api/tickets` — List user support tickets.
- `POST /api/tickets` — Open a new support ticket.

### Admin Endpoints (Requires Admin Role)
- `GET /api/admin/stats` — Live platform KPIs (Revenue, Orders, Users).
- `GET /api/admin/users` — List registered users and wallet balances.
- `POST /api/admin/users/balance` — Adjust user balance manually.

### Standard SMM API V2 (`/api/v2`)
Supports `action=services`, `action=add`, `action=status`, `action=balance` via API key parameter.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start Express Server
node server/index.js

# Server will run on http://localhost:5000
```

---

## 🌐 Deployment Instructions

### Backend Deployment (Railway / Render)
1. Push codebase to GitHub.
2. Connect repository to **Railway** or **Render**.
3. Set start command to `node server/index.js`.
4. Add environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, `PORT`).

### Frontend Deployment (Vercel / Netlify)
1. Connect repository to **Vercel** or **Netlify**.
2. Deploy as static web app (build directory root `./`).
3. Set API rewrite rule in `vercel.json` or `_redirects` if hosting frontend separately.
