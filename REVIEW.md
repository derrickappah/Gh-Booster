# Production Readiness Code Review

> **Date:** 2026-08-05  
> **Scope:** Full codebase review — server, services, controllers, routes, database, client JS, scripts  
> **Severity Legend:** 🔴 Critical — 🟠 High — 🟡 Medium — 🔵 Low

---

## Executive Summary

This review identified **100 findings** across the entire codebase. The most critical issues involve:

- **Double-crediting of deposits** — payment verification and webhook can both credit the same payment (Finding 58)
- **Race conditions on balance deductions** — no row-level locking on order creation (Finding 33)
- **No database transactions** — multi-step order creation is not atomic (Finding 32)
- **Potential secret exposure** — `.env` file may be committed to git (Finding 28)
- **Timing-vulnerable webhook verification** — `===` comparison on HMAC signature (Finding 56)
- **Global auth state mutation** — `signInWithPassword` on backend mutates shared session state (Finding 91)
- **Host header injection** — payment callback URL derived from spoofable headers (Finding 93)
- **Catastrophic table wipe** — import script deletes all services before inserting (Finding 96)

| Severity | Count |
|----------|-------|
| 🔴 Critical | 15 |
| 🟠 High | 25 |
| 🟡 Medium | 37 |
| 🔵 Low | 23 |

---

## Table of Contents

1. [Payment & Financial Integrity](#1-payment--financial-integrity)
2. [Authentication & Security](#2-authentication--security)
3. [Database & Data Integrity](#3-database--data-integrity)
4. [Order Processing](#4-order-processing)
5. [External Provider Integration](#5-external-provider-integration)
6. [Server & Infrastructure](#6-server--infrastructure)
7. [Client-Side JavaScript](#7-client-side-javascript)
8. [Admin Panel](#8-admin-panel)
9. [Scripts & Data Import](#9-scripts--data-import)
10. [Code Quality & Maintainability](#10-code-quality--maintainability)

---

## 1. Payment & Financial Integrity

### 🔴 F-01 · Double-crediting via verification + webhook race

| | |
|---|---|
| **File** | `server/controllers/paymentController.js` |
| **Function** | `verifyPayment` / `paystackWebhook` |
| **Description** | Both the manual verification redirect endpoint and the Paystack webhook can credit the user's wallet for the same payment. There is no coordination between them. |
| **Why it may fail** | A single Paystack payment results in two wallet credits — one from the redirect callback and one from the webhook. The user receives double the deposited amount, causing direct financial loss. |
| **Suggested improvement** | Use a single atomic code path for crediting. Mark the deposit as `completed` with a conditional update (`UPDATE deposits SET status = 'completed' WHERE id = $id AND status = 'pending' RETURNING *`) — if zero rows returned, the deposit was already processed. |

---

### 🔴 F-02 · No idempotency on payment verification

| | |
|---|---|
| **File** | `server/controllers/paymentController.js` |
| **Function** | `verifyPayment` |
| **Description** | The verification endpoint can be called multiple times with the same Paystack reference. There is no check for an existing completed transaction. |
| **Why it may fail** | A user or attacker replaying the callback URL credits the wallet on each call. |
| **Suggested improvement** | Before crediting, query for an existing transaction with the same `payment_reference`. Only credit if none exists. Add a `UNIQUE` constraint on `payment_reference` in the transactions table. |

---

### 🔴 F-03 · Timing-vulnerable webhook signature verification

| | |
|---|---|
| **File** | `server/controllers/paymentController.js` |
| **Function** | `paystackWebhook` |
| **Description** | The webhook HMAC signature comparison uses `===` instead of `crypto.timingSafeEqual`. |
| **Why it may fail** | String equality with `===` leaks timing information. An attacker can iteratively guess the correct hash one character at a time by measuring response latency. |
| **Suggested improvement** | Replace with `crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'))`. |

---

### 🟠 F-04 · Webhook returns 200 even on processing failure

| | |
|---|---|
| **File** | `server/controllers/paymentController.js` |
| **Function** | `paystackWebhook` |
| **Description** | If the wallet credit operation fails (DB error, etc.), the webhook handler may still return HTTP 200. |
| **Why it may fail** | Paystack considers the webhook delivered and will not retry. The user's payment is confirmed by Paystack but never credited — money is lost. |
| **Suggested improvement** | Return 200 only on successful processing. Return 500 on failure so Paystack retries. Implement a webhook event log for reconciliation. |

---

### 🟠 F-05 · No minimum/maximum deposit amount validation

| | |
|---|---|
| **File** | `server/controllers/paymentController.js` |
| **Function** | `initializePayment` |
| **Description** | The `amount` from `req.body.amount` is passed directly to Paystack with no server-side bounds checking. |
| **Why it may fail** | A user could deposit 0.01 (abusing transaction fees) or an extremely large amount. No business rules are enforced. |
| **Suggested improvement** | Validate `amount` against configurable min/max deposit limits on the server side. |

---

### 🔴 F-06 · Race condition on balance deduction (TOCTOU)

| | |
|---|---|
| **File** | `server/services/orderService.js` |
| **Function** | `createOrder` |
| **Description** | The balance check is a SELECT-then-UPDATE: read balance → check sufficiency → deduct. No row-level locking. |
| **Why it may fail** | Two concurrent orders from the same user both read balance $10, both pass the $7 check, both deduct $7, resulting in a –$4 balance. Classic Time-of-Check-to-Time-of-Use (TOCTOU) bug. |
| **Suggested improvement** | Use atomic deduction: `UPDATE user_profiles SET balance = balance - $cost WHERE id = $userId AND balance >= $cost`. Check affected row count — 0 means insufficient balance. |

---

### 🔴 F-07 · Non-atomic multi-step order creation

| | |
|---|---|
| **File** | `server/services/orderService.js` |
| **Function** | `createOrder` |
| **Description** | Order creation involves: fetch service → calculate price → check balance → deduct balance → create order → create transaction → call provider API. These are individual queries, not wrapped in a database transaction. |
| **Why it may fail** | If balance deduction succeeds but order creation fails, the user loses money with no order record. If the provider API fails after order creation, the order exists but was never submitted. |
| **Suggested improvement** | Wrap steps 3–6 in a PostgreSQL transaction (use Supabase RPC or a database function). Call the provider API after commit and update order status based on response. |

---

### 🟠 F-08 · Floating-point price calculation

| | |
|---|---|
| **File** | `server/services/orderService.js` |
| **Function** | `createOrder` |
| **Description** | Price is calculated using `parseFloat` on quantity and rate. JavaScript floats have precision issues (e.g., `0.1 + 0.2 = 0.30000000000000004`). |
| **Why it may fail** | Accumulated rounding errors over many transactions. Edge cases where a balance check passes when it shouldn't (or vice versa) due to float imprecision. |
| **Suggested improvement** | Use integer arithmetic (multiply values by 10000, compute in integers, divide back) or a decimal library like `decimal.js`. |

---

### 🟠 F-09 · Failed refund on provider error is not recoverable

| | |
|---|---|
| **File** | `server/services/orderService.js` |
| **Function** | `createOrder` → refund path |
| **Description** | If the provider API rejects the order after balance deduction, a refund is attempted. If the refund itself fails, there is no retry or compensation. |
| **Why it may fail** | User permanently loses money: balance deducted, order not placed, refund failed, no recovery mechanism. |
| **Suggested improvement** | Implement a dead-letter queue for failed refunds. Log prominently. Add an admin reconciliation view for unresolved refunds. |

---

### 🟠 F-10 · No database-level negative balance guard

| | |
|---|---|
| **File** | `server/database/schema.sql` |
| **Function/Section** | `user_profiles` table |
| **Description** | The `balance` column is `NUMERIC(12,4) DEFAULT 0` with no `CHECK(balance >= 0)` constraint. |
| **Why it may fail** | Application bugs or race conditions can push a balance below zero. The database will happily store –100.00. |
| **Suggested improvement** | Add `ALTER TABLE user_profiles ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);`. |

---

### 🟡 F-11 · Duplicate partial-refund on repeated sync

| | |
|---|---|
| **File** | `server/services/orderService.js` |
| **Function** | `syncOrderStatus` |
| **Description** | When a provider returns `partial` status with a `remains` count, a refund amount is calculated and credited. The function doesn't check if this partial refund was already issued. |
| **Why it may fail** | Multiple sync runs for the same order in `partial` status issue duplicate refunds, over-crediting the user. |
| **Suggested improvement** | Track `refunded_amount` on the order (column exists from migration 308). Before refunding, compare already-refunded amount to expected refund. |

---

### 🟡 F-12 · No centralized wallet service

| | |
|---|---|
| **File** | `server/services/walletService.js` |
| **Function** | (entire module) |
| **Description** | The wallet service only has `getBalance`. All credits/debits are scattered across `orderService`, `paymentController`, and `adminService` with no shared logic. |
| **Why it may fail** | Different code paths may implement balance modifications differently — some atomic, some not; some with transaction logging, some without. |
| **Suggested improvement** | Create centralized `walletService.credit()` and `walletService.debit()` functions that atomically update the balance and record a transaction in a single DB call. |

---

## 2. Authentication & Security

### 🔴 F-13 · Potential `.env` committed to repository

| | |
|---|---|
| **File** | `.env` (637 bytes in repo root) |
| **Function/Section** | Repository |
| **Description** | A `.env` file with 637 bytes exists in the repository. If committed to git, all secrets (Supabase service role key, Paystack secret key, Moolre API key) are in the git history. |
| **Why it may fail** | Anyone with repository access (or if the repo is public) has full access to production secrets, including the Supabase service role key which bypasses all RLS. |
| **Suggested improvement** | Immediately rotate ALL secrets. Remove `.env` from the repo: `git rm --cached .env`. Verify `.gitignore` includes `.env`. Purge from git history with `git filter-branch` or BFG. |

---

### 🔴 F-14 · API keys accepted in query parameters

| | |
|---|---|
| **File** | `server/middleware/authMiddleware.js` |
| **Function** | `authenticateApiKey` |
| **Description** | API keys are read from `req.query.key || req.body.key`. Query parameters are logged in server access logs, browser history, and referrer headers. |
| **Why it may fail** | API keys leak through log files, CDN logs, analytics tools, and browser history. A key in a URL shared via chat or email exposes the account. |
| **Suggested improvement** | Accept API keys only via `Authorization` header or request body. Deprecate query parameter usage with a warning period. |

---

### 🟠 F-15 · Error handler leaks internal details

| | |
|---|---|
| **File** | `server/middleware/errorHandler.js` |
| **Function** | `errorHandler` |
| **Description** | The global error handler sends `err.message` in the JSON response regardless of environment. |
| **Why it may fail** | In production, error messages may expose file paths, SQL queries, library names, or stack traces — valuable reconnaissance for attackers. |
| **Suggested improvement** | In production, return a generic `"Internal server error"`. Log the full error server-side. Only send detailed messages in development. |

---

### 🟠 F-16 · No security headers (Helmet)

| | |
|---|---|
| **File** | `server/app.js` |
| **Function** | Express app setup |
| **Description** | The application does not set security headers: no `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, or `X-XSS-Protection`. |
| **Why it may fail** | Vulnerable to clickjacking, MIME-type sniffing, and other web security attacks. |
| **Suggested improvement** | Install and configure `helmet` middleware: `app.use(helmet())`. |

---

### 🟠 F-17 · CORS may be too permissive

| | |
|---|---|
| **File** | `server/app.js` |
| **Function** | Express app setup |
| **Description** | CORS appears to be configured with a wildcard or very permissive origin, potentially combined with `credentials: true`. |
| **Why it may fail** | Any website can make authenticated cross-origin requests to the API, enabling CSRF-like attacks. |
| **Suggested improvement** | Restrict CORS origins to the production domain(s) via an environment variable allowlist. |

---

### 🟠 F-18 · Tokens stored in localStorage (XSS-vulnerable)

| | |
|---|---|
| **File** | `src/js/api-client.js` |
| **Function** | Various `fetch` calls |
| **Description** | Auth tokens are stored in `localStorage` and read on every API call. |
| **Why it may fail** | Any XSS vulnerability anywhere on the page gives an attacker full access to the token and, therefore, the user's account. |
| **Suggested improvement** | Use `httpOnly` cookies for session tokens. If `localStorage` is required, enforce a strict Content Security Policy. |

---

### 🟠 F-19 · Orphaned auth user on registration failure

| | |
|---|---|
| **File** | `server/services/authService.js` |
| **Function** | `register` |
| **Description** | Registration creates a Supabase Auth user first, then inserts into `user_profiles`. If the profile insert fails, the Auth user is not cleaned up. |
| **Why it may fail** | The user cannot re-register (email taken in Auth) and has no profile. They are permanently locked out. Orphaned Auth users accumulate. |
| **Suggested improvement** | Wrap in try/catch: if profile creation fails, delete the Auth user via `supabase.auth.admin.deleteUser()`. Or use a database trigger to auto-create profiles. |

---

### 🟡 F-20 · User enumeration via login errors

| | |
|---|---|
| **File** | `server/services/authService.js` |
| **Function** | `login` |
| **Description** | Supabase error messages are returned directly to the user. Different messages for "email not found" vs "wrong password" enable user enumeration. |
| **Why it may fail** | Attackers can determine which emails are registered, enabling targeted phishing or credential stuffing. |
| **Suggested improvement** | Always return a generic `"Invalid email or password"` regardless of the actual failure reason. |

---

### 🟡 F-21 · User enumeration via registration errors

| | |
|---|---|
| **File** | `server/controllers/authController.js` |
| **Function** | `register` |
| **Description** | If the email is already registered, the Supabase error `"User already registered"` is passed to the user. |
| **Why it may fail** | Confirms whether an email is registered, enabling enumeration. |
| **Suggested improvement** | Return a generic message: `"Registration failed. Please try again or use a different email."` |

---

### 🟡 F-22 · Weak password policy

| | |
|---|---|
| **File** | `server/validators/schemas.js` |
| **Function** | `registerSchema` |
| **Description** | Password validation only requires `.min(8)`. No complexity rules, no maximum length, no common password check. |
| **Why it may fail** | Users set weak passwords like `12345678`. No max length means extremely long passwords could DoS bcrypt. |
| **Suggested improvement** | Require uppercase + lowercase + digit + special char. Set max length (128 chars). Consider checking against a common password list. |

---

### 🟡 F-23 · Rate limiter uses in-memory store

| | |
|---|---|
| **File** | `server/middleware/rateLimiter.js` |
| **Function** | `authLimiter`, `apiLimiter` |
| **Description** | Rate limiters use the default `express-rate-limit` memory store. |
| **Why it may fail** | In a multi-instance or serverless deployment (Vercel), each instance has its own counter. Rate limits are effectively bypassed. State is lost on every cold start. |
| **Suggested improvement** | Use a shared store (Redis via `rate-limit-redis`). On Vercel, consider Vercel's built-in rate limiting or an external provider. |

---

### 🟡 F-24 · Auth rate limit too generous

| | |
|---|---|
| **File** | `server/middleware/rateLimiter.js` |
| **Function** | `authLimiter` |
| **Description** | 20 attempts per 15-minute window per IP. |
| **Why it may fail** | 1,920 password guesses per day per IP. Easily brute-forced from a botnet with multiple IPs. |
| **Suggested improvement** | Reduce to 5 per 15 minutes. Add account-level rate limiting (not just IP). Implement progressive lockout. |

---

### 🟡 F-25 · No password reset rate limiting

| | |
|---|---|
| **File** | `server/services/authService.js` |
| **Function** | `resetPassword` |
| **Description** | No rate limiting specific to the password reset endpoint. |
| **Why it may fail** | Attacker floods a victim's inbox with reset emails. Also useful for email enumeration via response timing. |
| **Suggested improvement** | Rate limit to 3 reset requests per email per hour. Always return the same success message. |

---

### 🟡 F-26 · `SECURITY DEFINER` on credit_wallet function

| | |
|---|---|
| **File** | `server/database/312_fix_credit_wallet_guard.sql` |
| **Function** | `credit_wallet` |
| **Description** | The function uses `SECURITY DEFINER`, executing with the owner's (superuser) privileges, bypassing all RLS. |
| **Why it may fail** | If callable via RPC with the anon key, an attacker could credit arbitrary amounts to any wallet. |
| **Suggested improvement** | Restrict RPC access. Add `amount > 0` validation inside the function. Consider `SECURITY INVOKER` with explicit grants. Revoke public EXECUTE permission. |

---

### 🟡 F-27 · No token refresh mechanism

| | |
|---|---|
| **File** | `src/js/api-client.js` |
| **Function** | Session management |
| **Description** | No automatic token refresh. When the Supabase JWT expires, all API calls silently fail with 401. |
| **Why it may fail** | Users see unexplained failures after session expiry. They may retry actions (like placing orders) without understanding the issue. |
| **Suggested improvement** | Implement `onAuthStateChange` listener for automatic token refresh. On 401 responses, redirect to login. |

---

### 🔵 F-28 · No 2FA or re-auth for admin actions

| | |
|---|---|
| **File** | `server/routes/adminRoutes.js` |
| **Function** | All admin routes |
| **Description** | Admin operations (balance adjustments, user management, service config) require only the standard session — no additional verification. |
| **Why it may fail** | A compromised admin session gives full access to all operations with no additional challenge. |
| **Suggested improvement** | Require re-authentication for sensitive operations. Add admin action audit logging. Consider IP whitelisting. |

---

### 🔵 F-29 · `requireAdmin` missing defensive null check

| | |
|---|---|
| **File** | `server/middleware/authMiddleware.js` |
| **Function** | `requireAdmin` |
| **Description** | Checks `req.user.role !== 'admin'` without guarding against `req.user` being undefined. |
| **Why it may fail** | If middleware ordering is wrong (e.g., `requireAdmin` called without `authenticateUser`), `TypeError` crashes the request. |
| **Suggested improvement** | Guard: `if (!req.user || req.user.role !== 'admin')`. |

---

### 🔵 F-30 · No IP whitelist for Paystack webhooks

| | |
|---|---|
| **File** | `server/routes/paymentRoutes.js` |
| **Function** | Webhook route |
| **Description** | The webhook endpoint is publicly accessible. No IP whitelist for Paystack source IPs. |
| **Why it may fail** | Attackers who discover the webhook URL could attempt to send crafted events (mitigated by HMAC, but defense-in-depth is missing). |
| **Suggested improvement** | Add Paystack's published webhook IP ranges to an allowlist. |

---

## 3. Database & Data Integrity

### 🟠 F-31 · No foreign key on orders.service_id

| | |
|---|---|
| **File** | `server/database/schema.sql` |
| **Function/Section** | `orders` table |
| **Description** | `service_id` has no foreign key constraint to the `services` table. No CHECK on `status`. |
| **Why it may fail** | Orphaned orders reference deleted services. Invalid statuses can be inserted. |
| **Suggested improvement** | Add `FOREIGN KEY (service_id) REFERENCES services(id)`. Add `CHECK (status IN ('pending','processing','completed','cancelled','partial','refunded'))`. |

---

### 🟠 F-32 · No idempotency on transactions table

| | |
|---|---|
| **File** | `server/database/schema.sql` |
| **Function/Section** | `transactions` table |
| **Description** | No unique constraint prevents duplicate transaction records. Concurrent requests can record the same transaction twice. |
| **Why it may fail** | Double-crediting or double-debiting a user's balance. |
| **Suggested improvement** | Add a unique constraint on `(payment_reference, type)` or use an explicit idempotency key column. |

---

### 🟠 F-33 · Incomplete RLS with exposed anon key

| | |
|---|---|
| **File** | `server/database/schema.sql` + `src/js/supabase-client.js` |
| **Function/Section** | RLS policies |
| **Description** | The Supabase anon key is exposed on the client. If RLS policies are not comprehensive, users could query other users' orders, transactions, or tickets directly via the Supabase JS client. |
| **Why it may fail** | Data breach: a malicious user uses the anon key + Supabase client to read all orders or transactions. |
| **Suggested improvement** | Audit every table's RLS policies. Users must only see their own data. The anon key should have minimal read access. |

---

### 🟡 F-34 · Deposit expiry race with payment

| | |
|---|---|
| **File** | `server/database/307_auto_expire_pending_deposits.sql` |
| **Function** | `auto_expire_pending_deposits` |
| **Description** | Pending deposits older than 30 minutes are auto-expired. The function doesn't verify with the payment provider before expiring. |
| **Why it may fail** | A user completes payment at minute 29. At minute 30, the cron expires the deposit. User paid but never credited. |
| **Suggested improvement** | Before expiring, verify with Paystack that no payment was received. Or implement a reconciliation job that checks expired deposits against Paystack transaction records. |

---

### 🟡 F-35 · Order status sync cron has no timeout

| | |
|---|---|
| **File** | `server/database/306_order_status_sync_cron.sql` |
| **Function** | `sync_order_statuses` |
| **Description** | The cron function calls an external API. No timeout or circuit breaker. |
| **Why it may fail** | A hanging provider API blocks the cron, consuming DB connections and preventing subsequent runs. |
| **Suggested improvement** | Add HTTP request timeout. Consider running sync as an application-level job with better error control. |

---

### 🟡 F-36 · Migrations are not idempotent

| | |
|---|---|
| **File** | `server/database/309_security_hardening.sql` |
| **Function/Section** | Policy creation statements |
| **Description** | Migrations use `CREATE POLICY` without `IF NOT EXISTS`. Running twice fails with "policy already exists." |
| **Why it may fail** | Accidental double-application during deployment leaves the DB in a partially-migrated state. |
| **Suggested improvement** | Use `DROP POLICY IF EXISTS` before `CREATE POLICY` to make migrations idempotent. |

---

### 🟡 F-37 · Migration doesn't handle existing violating data

| | |
|---|---|
| **File** | `server/database/310_fix_rls_and_schema.sql` |
| **Function/Section** | Column type alterations and constraint additions |
| **Description** | Alters column types and adds constraints without verifying existing data compliance. |
| **Why it may fail** | Deployed against production with non-conforming data → migration fails during deployment window. |
| **Suggested improvement** | Add a pre-check query for violating rows. Include data cleanup steps before constraints. |

---

### 🔵 F-38 · No index on user_profiles.api_key

| | |
|---|---|
| **File** | `server/middleware/authMiddleware.js` + `server/database/schema.sql` |
| **Function** | `authenticateApiKey` |
| **Description** | API key lookup queries `user_profiles` by `api_key`. No index visible in the schema. |
| **Why it may fail** | Full table scan on every API request. As users grow, API response time degrades. |
| **Suggested improvement** | `CREATE INDEX idx_user_profiles_api_key ON user_profiles(api_key);` |

---

## 4. Order Processing

### 🟠 F-39 · Service existence not validated before order

| | |
|---|---|
| **File** | `server/controllers/orderController.js` |
| **Function** | `createOrder` |
| **Description** | The controller passes `service_id` from the request body without confirming the service exists and is active. |
| **Why it may fail** | Orders created for disabled/deleted services are submitted to the provider, rejected, and the refund path is triggered — adding complexity and failure risk. |
| **Suggested improvement** | Validate service existence and `active = true` in the service layer before deducting balance. |

---

### 🟠 F-40 · Two separate order creation code paths

| | |
|---|---|
| **File** | `server/controllers/apiV2Controller.js` vs `server/controllers/orderController.js` |
| **Function** | `createOrder` (API V2) vs `createOrder` (web) |
| **Description** | The API V2 and web interface have separate order creation logic, potentially with different validation. |
| **Why it may fail** | A bug fixed in one path but not the other. Financial operations should never have divergent implementations. |
| **Suggested improvement** | Both should call the same `orderService.createOrder()` with identical validation. |

---

### 🟡 F-41 · URI scheme not restricted in order link

| | |
|---|---|
| **File** | `server/validators/schemas.js` |
| **Function** | `orderSchema` |
| **Description** | The `link` field is validated with `.uri()` which allows any URI scheme (`javascript:`, `data:`, `file:`). |
| **Why it may fail** | XSS if the link is rendered as a clickable URL anywhere in the frontend. |
| **Suggested improvement** | Restrict to `https://` only: `.uri({ scheme: ['https'] })`. |

---

### 🟡 F-42 · No timeout on provider API calls

| | |
|---|---|
| **File** | `server/services/orderService.js` |
| **Function** | `submitOrderToProvider` |
| **Description** | External HTTP requests to SMM providers have no timeout configuration. |
| **Why it may fail** | A hanging provider ties up the serverless function indefinitely, wasting compute cost and leaving the user waiting. |
| **Suggested improvement** | Set a 10-second timeout on all external HTTP requests. Return a clear error to the user on timeout. |

---

## 5. External Provider Integration

### 🟠 F-43 · No response validation on provider API

| | |
|---|---|
| **File** | `server/services/moolreService.js` |
| **Function** | Various API methods |
| **Description** | Provider responses are parsed with `response.json()` without checking content type or `response.ok`. |
| **Why it may fail** | If the provider returns an HTML error page (502 from Cloudflare), `response.json()` throws `SyntaxError: Unexpected token '<'` — an unhelpful error. |
| **Suggested improvement** | Check `response.ok` first. Wrap `response.json()` in try/catch. Log raw response on parse failure. |

---

### 🟠 F-44 · Missing API key validation at startup

| | |
|---|---|
| **File** | `server/services/moolreService.js` |
| **Function** | `createOrder` |
| **Description** | `MOOLRE_API_KEY` is read from env and sent in the POST body. If unset, the value is `undefined`. |
| **Why it may fail** | The provider rejects the request with an unhelpful error. The root cause (missing env var) is not obvious from the error message. |
| **Suggested improvement** | Validate the API key at startup (in `config/env.js`). Throw a clear error if missing. |

---

### 🟡 F-45 · No centralized provider status mapping

| | |
|---|---|
| **File** | `server/services/moolreService.js` |
| **Function** | `getStatus` / `getMultiStatus` |
| **Description** | Provider status strings are mapped to internal statuses implicitly across multiple files. |
| **Why it may fail** | A new provider status value that isn't mapped results in an unknown/null status, breaking the UI or leaving orders stuck. |
| **Suggested improvement** | Centralize status mapping in a single `STATUS_MAP` constant. Add a fallback with an alert for unknown statuses. |

---

### 🟡 F-46 · Duplicate provider service code

| | |
|---|---|
| **File** | `server/services/smmgenService.js` vs `server/services/moolreService.js` |
| **Function** | (entire modules) |
| **Description** | These two services are nearly identical — same HTTP call patterns, same response handling — differing only in API URL and key. |
| **Why it may fail** | Bug fixes applied to one but not the other. Maintenance burden doubles. |
| **Suggested improvement** | Extract a generic `ProviderClient` class/factory. Configure per-provider with URL and key. |

---

## 6. Server & Infrastructure

### 🟠 F-47 · No graceful shutdown

| | |
|---|---|
| **File** | `server/server.js` |
| **Function** | `server.listen` |
| **Description** | No signal handlers for `SIGTERM` / `SIGINT`. |
| **Why it may fail** | Active requests are abruptly terminated during deployment or scaling. In-flight database operations may be left inconsistent. |
| **Suggested improvement** | Add `SIGTERM`/`SIGINT` handlers: stop accepting connections, drain in-flight requests, close DB connections, then exit. |

---

### 🟠 F-48 · No connection pooling for serverless

| | |
|---|---|
| **File** | `api/index.js`, `api/[...slug].js` |
| **Function/Section** | Serverless entry points |
| **Description** | Each Vercel serverless invocation may create new Supabase connections. No pooling configuration. |
| **Why it may fail** | Under load, connection limits are exhausted. Supabase starts rejecting connections, causing cascading failures. |
| **Suggested improvement** | Use Supabase's connection pooler URL. Create the client outside the handler for reuse across warm invocations. |

---

### 🟡 F-49 · Environment variable validation exits on first error

| | |
|---|---|
| **File** | `server/config/env.js` |
| **Function** | `requiredVars.forEach` |
| **Description** | `process.exit(1)` is called inside the loop for the first missing variable. Other missing variables are not reported. |
| **Why it may fail** | Frustrating deploy cycle: fix one var → deploy → fail → fix next var → deploy → fail. |
| **Suggested improvement** | Collect all missing variables, log them all, then exit once. |

---

### 🟡 F-50 · No startup health check

| | |
|---|---|
| **File** | `server/config/supabase.js` |
| **Function** | Module-level client creation |
| **Description** | The Supabase client is created at boot but no connectivity check is performed. Invalid URL or key won't surface until the first request. |
| **Why it may fail** | The server starts, passes readiness probes, accepts requests, and then fails on every DB operation. |
| **Suggested improvement** | Run a `SELECT 1` health check at startup. Fail fast if the database is unreachable. |

---

### 🟡 F-51 · No 404 catch-all route

| | |
|---|---|
| **File** | `server/app.js` |
| **Function** | Route mounting |
| **Description** | No catch-all handler after all route groups. Unmatched routes fall through to Express's default handler. |
| **Why it may fail** | Leaks framework information via Express's default error page. |
| **Suggested improvement** | Add a catch-all after all routes: `app.use('*', (req, res) => res.status(404).json({ error: 'Not found' }))`. |

---

### 🟡 F-52 · Duplicate Supabase client modules

| | |
|---|---|
| **File** | `server/supabase.js` vs `server/config/supabase.js` |
| **Function** | Module export |
| **Description** | Two modules export Supabase clients. Different imports could use different instances. |
| **Why it may fail** | Confusion, potential inconsistency if one is configured differently. |
| **Suggested improvement** | Remove the duplicate. Standardize all imports to `./config/supabase`. |

---

### 🟡 F-53 · Validator only checks req.body

| | |
|---|---|
| **File** | `server/middleware/validator.js` |
| **Function** | `validate` |
| **Description** | The middleware only validates `req.body`. Query parameters and URL params are not validated. |
| **Why it may fail** | Endpoints reading from `req.query` or `req.params` receive unvalidated input. |
| **Suggested improvement** | Extend to accept a source parameter: `validate(schema, 'query')`. |

---

### 🟡 F-54 · Potential null dereference in auth middleware

| | |
|---|---|
| **File** | `server/middleware/authMiddleware.js` |
| **Function** | `authenticateUser` |
| **Description** | `supabase.auth.getUser(token)` returns `{ data, error }`. If `data` is null, accessing `data.user` throws `TypeError`. |
| **Why it may fail** | A Supabase outage causes `TypeError` on every authenticated request, potentially crashing the process. |
| **Suggested improvement** | Check `error` and `data` for null before accessing `data.user`. Wrap in try/catch. |

---

### 🔵 F-55 · No `engines` field in package.json

| | |
|---|---|
| **File** | `package.json` |
| **Function/Section** | Package metadata |
| **Description** | No `engines` field specifying required Node.js version. Dependencies use `^` semver ranges. |
| **Why it may fail** | A deployment could use an incompatible Node.js version or pull a breaking minor update. |
| **Suggested improvement** | Add `"engines": { "node": ">=18.0.0" }`. Use `npm ci` in CI/CD. |

---

### 🔵 F-56 · No caching or security headers in Vercel config

| | |
|---|---|
| **File** | `vercel.json` |
| **Function/Section** | Configuration |
| **Description** | No `headers` configuration for security headers or static asset caching. |
| **Why it may fail** | No edge caching → higher latency. No security headers → browser-level protections are missing. |
| **Suggested improvement** | Add `headers` for `X-Frame-Options`, `Content-Security-Policy`, cache headers for static assets. |

---

## 7. Client-Side JavaScript

### 🟠 F-57 · No double-submit protection

| | |
|---|---|
| **File** | `src/js/api-client.js` |
| **Function** | Order and payment submission |
| **Description** | Submit buttons are not disabled during API calls. Users can click multiple times. |
| **Why it may fail** | Double-click creates duplicate orders, deducting the balance twice. Duplicate payment initializations. |
| **Suggested improvement** | Disable submit button on click. Re-enable on response. Show loading spinner. |

---

### 🟡 F-58 · Inconsistent error handling in API calls

| | |
|---|---|
| **File** | `src/js/api-client.js` |
| **Function** | Various fetch calls |
| **Description** | Some calls show toast notifications on error, others fail silently, some only log to console. |
| **Why it may fail** | Users don't know when operations fail. They may think an order was placed when it wasn't. |
| **Suggested improvement** | Implement a standardized `apiFetch()` wrapper that always shows errors to the user. |

---

### 🟡 F-59 · Monolithic 283KB client-side file

| | |
|---|---|
| **File** | `src/js/api-client.js` |
| **Function** | (entire file) |
| **Description** | A single 283KB file contains all API interaction logic, duplicated patterns, and UI update code. |
| **Why it may fail** | Unmaintainable. Bug fixes in error handling won't be applied consistently. Large parse/compile time impacts page load. |
| **Suggested improvement** | Break into modules: `auth-api.js`, `order-api.js`, `payment-api.js`, `admin-api.js`. Extract shared fetch logic into a utility. |

---

### 🟡 F-60 · Service worker may cache API responses

| | |
|---|---|
| **File** | `service-worker.js` |
| **Function** | `fetch` event handler |
| **Description** | The service worker intercepts requests. If `/api/*` routes are not explicitly excluded, dynamic responses may be cached. |
| **Why it may fail** | Cached API responses show stale data: old balance, old order status. After account switch, previous user's data could appear. |
| **Suggested improvement** | Explicitly exclude `/api/*` from the cache. Use network-first for API, cache-first for static assets. |

---

### 🟡 F-61 · No cache eviction in image cache

| | |
|---|---|
| **File** | `src/js/image-cache.js` |
| **Function** | `cacheImage` |
| **Description** | Images are cached with no size limit or eviction strategy. |
| **Why it may fail** | On mobile devices with limited storage, the cache grows until the Cache API starts failing. |
| **Suggested improvement** | Implement LRU eviction with a max cache size (e.g., 50MB). |

---

### 🟡 F-62 · Admin dashboard loads all data at once

| | |
|---|---|
| **File** | `src/js/api-client.js` |
| **Function** | Admin dashboard initialization |
| **Description** | Stats, users, orders, and transactions are all fetched simultaneously on page load with no pagination or lazy loading. |
| **Why it may fail** | As data grows, the dashboard becomes unusably slow. Multiple large queries may time out on serverless. |
| **Suggested improvement** | Load stats first. Lazy-load table data with server-side pagination. |

---

### 🔵 F-63 · Monolithic theme.js

| | |
|---|---|
| **File** | `src/js/theme.js` |
| **Function** | (entire file — 52KB) |
| **Description** | UI init, animations, charts, and interactive components in one file. Direct DOM manipulation throughout. |
| **Why it may fail** | Memory leaks from event listeners not being cleaned up. Hard to debug and maintain. |
| **Suggested improvement** | Break into smaller modules. Use event delegation. Implement cleanup for dynamic elements. |

---

### 🔵 F-64 · No build-time quality checks

| | |
|---|---|
| **File** | `build.js` |
| **Function** | Build script |
| **Description** | The build script minifies JS but doesn't run lint, type-check, or tests. |
| **Why it may fail** | Syntax errors and regressions are deployed without automated detection. |
| **Suggested improvement** | Add ESLint and a test runner to the build pipeline. Fail the build on errors. |

---

### 🔵 F-65 · Test file committed to repo

| | |
|---|---|
| **File** | `test-supabase-conn.js` |
| **Function** | Connection test |
| **Description** | A test/debug file is committed to the repository. May contain credentials or be accidentally run against production. |
| **Why it may fail** | Credential exposure. Accidental production database access during development. |
| **Suggested improvement** | Remove from the repo or move to a proper test framework with environment isolation. Add to `.gitignore`. |

---

## 8. Admin Panel

### 🟠 F-66 · Admin balance SET overwrites concurrent changes

| | |
|---|---|
| **File** | `server/services/adminService.js` |
| **Function** | `updateUser` |
| **Description** | Admin can SET a user's balance directly. This is not an atomic increment/decrement. |
| **Why it may fail** | If a user places an order (deducting $7) while the admin sets their balance to $50, the admin's SET could overwrite the deduction, giving the user free money. |
| **Suggested improvement** | Use `balance = balance + $adjustment` for all admin balance changes. Log all admin balance modifications in the transactions table. |

---

### 🟡 F-67 · No rate validation on service updates

| | |
|---|---|
| **File** | `server/controllers/adminController.js` |
| **Function** | `updateService` |
| **Description** | No validation that the new service rate is positive. A rate of 0 or negative is accepted. |
| **Why it may fail** | Rate = 0 → free orders. Negative rate → placing an order credits the user. |
| **Suggested improvement** | Validate `rate > 0` and set a reasonable upper bound. |

---

### 🟡 F-68 · Admin user list has no pagination

| | |
|---|---|
| **File** | `server/services/adminService.js` |
| **Function** | `getUsers` |
| **Description** | `SELECT *` on user_profiles with no pagination. |
| **Why it may fail** | With thousands of users, the query is slow and the response is massive. Vercel's 10-second timeout could be hit. |
| **Suggested improvement** | Implement server-side pagination with configurable page size. |

---

### 🟡 F-69 · Dashboard stats calculated on every request

| | |
|---|---|
| **File** | `server/services/adminService.js` |
| **Function** | `getDashboardStats` |
| **Description** | Multiple aggregate queries (COUNT, SUM) across large tables on every page load. |
| **Why it may fail** | Slow as data grows. Auto-refresh on the dashboard multiplies the load. |
| **Suggested improvement** | Pre-calculate in a materialized view or cache with 5-minute TTL. |

---

### 🟡 F-70 · Admin bonus has no idempotency

| | |
|---|---|
| **File** | `server/controllers/adminController.js` |
| **Function** | `addBonus` |
| **Description** | Balance adjustment with no idempotency key. Double-click or retry applies the bonus multiple times. |
| **Why it may fail** | Admin accidentally double-clicks, user gets 2x bonus. |
| **Suggested improvement** | Accept an idempotency key. Use atomic `balance = balance + $amount`. |

---

### 🔵 F-71 · Admin actions not audited

| | |
|---|---|
| **File** | `server/routes/adminRoutes.js` |
| **Function** | All admin endpoints |
| **Description** | No audit log of admin actions (who changed what, when). |
| **Why it may fail** | Cannot trace responsibility for changes. Makes compliance and incident investigation impossible. |
| **Suggested improvement** | Log all admin actions to an audit table with admin user ID, action type, target, timestamp, and before/after values. |

---

## 9. Scripts & Data Import

### 🟡 F-72 · Import script has no batch/transaction support

| | |
|---|---|
| **File** | `scripts/import_smmgen.js` |
| **Function** | Main import function |
| **Description** | Services are inserted one at a time with no transaction or batch insert. |
| **Why it may fail** | Failure midway leaves partial data with no rollback. Re-running creates duplicates. |
| **Suggested improvement** | Use `.upsert()` with a unique key. Wrap in a transaction or use batch inserts. |

---

### 🟡 F-73 · Duplicate import scripts

| | |
|---|---|
| **File** | `scripts/import_smmgen.js` vs `scripts/import_smmgen_services.js` |
| **Function** | (entire modules) |
| **Description** | Two scripts doing essentially the same import with minor differences. |
| **Why it may fail** | Bug fixes applied to one but not the other. Maintenance confusion. |
| **Suggested improvement** | Consolidate into a single configurable import script. |

---

### 🟡 F-74 · 80KB of hardcoded service data in JS

| | |
|---|---|
| **File** | `scripts/import_user_services.js` |
| **Function** | (entire file) |
| **Description** | ~80KB of hardcoded service data embedded directly in JavaScript source code. |
| **Why it may fail** | Any data change requires code change and redeployment. The file is too large to review effectively. |
| **Suggested improvement** | Move data to a JSON file or database table. Import script reads from the data source. |

---

### 🟡 F-75 · Data processing script lacks concurrency control

| | |
|---|---|
| **File** | `scripts/process_user_data.js` |
| **Function** | Balance and transaction processing |
| **Description** | The script modifies balances with no locking. If run while the app is serving users, it conflicts with live transactions. |
| **Why it may fail** | Race conditions between the script and the live app result in incorrect balances. |
| **Suggested improvement** | Run only during maintenance windows. Use advisory locks. Add a maintenance mode flag. |

---

### 🟡 F-76 · Data processing has no dry-run mode

| | |
|---|---|
| **File** | `scripts/process_user_data.js` |
| **Function** | (entire script) |
| **Description** | No dry-run mode to preview changes before applying them. |
| **Why it may fail** | A bug in the script irreversibly corrupts production data with no preview or undo. |
| **Suggested improvement** | Add a `--dry-run` flag that logs what would be changed without actually modifying data. |

---

### 🔵 F-77 · Ping script doesn't check responses

| | |
|---|---|
| **File** | `scripts/ping-search-engines.js` |
| **Function** | Sitemap submission |
| **Description** | HTTP pings to search engines don't check response status. |
| **Why it may fail** | Silent failures give a false impression of successful sitemap submission. |
| **Suggested improvement** | Check HTTP response codes. Log success/failure per engine. |

---

### 🔵 F-78 · Python script lacks error handling

| | |
|---|---|
| **File** | `scripts/generate_smmgen_import.py` |
| **Function** | Data processing |
| **Description** | No input validation, exception handling, or logging. No `__main__` guard. |
| **Why it may fail** | Malformed input causes unhandled exceptions. Import as a module executes side effects. |
| **Suggested improvement** | Add try/except, input validation, logging, and `if __name__ == '__main__'` guard. |

---

## 10. Code Quality & Maintainability

### 🟡 F-79 · Stored XSS risk in ticket messages

| | |
|---|---|
| **File** | `server/services/ticketService.js` |
| **Function** | `createTicket` |
| **Description** | Ticket messages are stored without sanitization. If rendered as HTML on the admin dashboard, this is an XSS vector. |
| **Why it may fail** | A malicious user injects `<script>` in a ticket. When an admin views it, the script steals the admin's session. |
| **Suggested improvement** | Sanitize input on storage (strip HTML) or ensure the frontend renders messages as plain text (`textContent`, not `innerHTML`). |

---

### 🟡 F-80 · Tickets have no pagination

| | |
|---|---|
| **File** | `server/services/ticketService.js` |
| **Function** | `getTickets` |
| **Description** | All tickets are returned with no limit. |
| **Why it may fail** | Unbounded response size. Timeout on serverless for active support desks. |
| **Suggested improvement** | Add pagination with a default limit of 50. |

---

### 🟡 F-81 · Service list not cached

| | |
|---|---|
| **File** | `server/services/serviceService.js` |
| **Function** | `getServices` |
| **Description** | The service list is fetched from DB on every request despite rarely changing. |
| **Why it may fail** | Unnecessary DB load on every page view. |
| **Suggested improvement** | Cache in memory with a TTL (e.g., 5 minutes). Invalidate when services are updated via admin. |

---

### 🟡 F-82 · RSS feed doesn't escape XML characters

| | |
|---|---|
| **File** | `server/services/rssService.js` |
| **Function** | `generateRssFeed` |
| **Description** | Blog content is concatenated into XML strings without escaping `<`, `>`, `&`, or `"`. |
| **Why it may fail** | A blog title containing `&` produces malformed XML. RSS readers fail to parse the feed. |
| **Suggested improvement** | Use proper XML escaping or an RSS library (e.g., the `rss` npm package). |

---

### 🟡 F-83 · Child panel routes lack tenant isolation

| | |
|---|---|
| **File** | `server/routes/childPanelRoutes.js` |
| **Function** | Route definitions |
| **Description** | Child panel routes share the same `user_profiles` table with the parent. No `panel_id` isolation. |
| **Why it may fail** | A child panel operator could access parent panel data or another child panel's users/orders. |
| **Suggested improvement** | Add a `panel_id` column to relevant tables. Add RLS policies for tenant isolation. |

---

### 🟡 F-84 · Authorization check only in middleware

| | |
|---|---|
| **File** | `server/routes/transactionRoutes.js` |
| **Function** | Admin transaction routes |
| **Description** | Admin access is enforced only by middleware ordering. Removing `requireAdmin` during refactor exposes all data. |
| **Why it may fail** | A single middleware ordering mistake exposes all financial transactions. |
| **Suggested improvement** | Add defense-in-depth: validate admin role in the service layer as well. |

---

### 🔵 F-85 · Select * on every authenticated request

| | |
|---|---|
| **File** | `server/middleware/authMiddleware.js` |
| **Function** | `authenticateUser` |
| **Description** | Every authenticated request fetches all columns from `user_profiles` with `SELECT *`. |
| **Why it may fail** | Wasted bandwidth and DB processing. As columns are added, performance degrades. |
| **Suggested improvement** | Select only needed columns: `id, role, email, username, balance, currency`. |

---

### 🔵 F-86 · Hardcoded Supabase credentials in client

| | |
|---|---|
| **File** | `src/js/supabase-client.js` |
| **Function** | Module initialization |
| **Description** | Supabase URL and anon key are hardcoded directly in the source file. |
| **Why it may fail** | While anon keys are designed to be public, hardcoding makes rotation difficult and couples the code to a specific environment. |
| **Suggested improvement** | Load from meta tags or a `/config` API endpoint to enable environment-specific configuration without code changes. |

---

## Additional Findings (Deep-Dive)

### 🟠 F-87 · Synchronous bcrypt blocks event loop

| | |
|---|---|
| **File** | `server/auth.js` |
| **Function** | `hashPassword`, `comparePassword` |
| **Description** | Uses `bcrypt.hashSync` and `bcrypt.compareSync` — synchronous operations that block the Node.js event loop. |
| **Why it may fail** | Concurrent login/registration requests will freeze the entire server while bcrypt runs (~100ms per hash). All other requests queue behind the hash computation, causing latency spikes and timeouts. |
| **Suggested improvement** | Use async methods: `await bcrypt.hash(password, 10)` and `await bcrypt.compare(password, hash)`. |

---

### 🔴 F-88 · Phantom users pass authentication after deletion

| | |
|---|---|
| **File** | `server/middleware/authMiddleware.js` |
| **Function** | `authenticateToken` |
| **Description** | The middleware verifies the JWT token and fetches the user profile, but doesn't check if the profile query actually returned a row. If a user is deleted from `user_profiles` but their JWT is still valid (unexpired), they pass through auth with a default role of `'user'` and balance of `0.0`. |
| **Why it may fail** | Deleted or banned users can continue making API calls until their token naturally expires. They become "phantom users" with no profile, bypassing the intended deactivation. |
| **Suggested improvement** | Add an explicit check: `if (!profile) return res.status(401).json({ success: false, error: 'User profile not found.' });`. |

---

### 🟡 F-89 · `parseFloat(NaN)` on corrupt wallet balance

| | |
|---|---|
| **File** | `server/middleware/authMiddleware.js` |
| **Function** | `authenticateToken` |
| **Description** | The balance is set via `parseFloat(wallet.balance)`. If `wallet.balance` is `null`, `undefined`, or a non-numeric string, `parseFloat` returns `NaN`. |
| **Why it may fail** | `NaN` propagates through all arithmetic: balance checks become meaningless (`NaN >= 7` is `false`), and `NaN` may be written back to the database, corrupting the balance permanently. |
| **Suggested improvement** | Use a safe fallback: `balance: wallet?.balance != null && !isNaN(wallet.balance) ? parseFloat(wallet.balance) : 0.0`. |

---

### 🟡 F-90 · Admin page auth returns JSON instead of redirect

| | |
|---|---|
| **File** | `server/app.js` |
| **Function** | `adminPageMiddleware` |
| **Description** | Admin HTML pages are protected by reusing the API `authenticateToken` middleware, which returns `401 JSON` on failure. |
| **Why it may fail** | When an admin's session expires and they navigate to `/admin-dashboard`, they see raw JSON (`{"success": false, "error": "..."}`) on a blank page instead of being redirected to `/login`. |
| **Suggested improvement** | Create a page-specific middleware that uses `res.redirect('/login')` on auth failure. |

---

### 🔴 F-91 · Global auth state mutation on backend

| | |
|---|---|
| **File** | `server/controllers/authController.js` |
| **Function** | `updatePassword` |
| **Description** | The password change flow calls `supabase.auth.signInWithPassword({ email, password: currentPassword })` using the backend's shared Supabase client to verify the current password. |
| **Why it may fail** | In Node.js, the Supabase JS client holds stateful session data. `signInWithPassword` mutates the global auth state. Concurrent requests will have their sessions crossed or overwritten — User A's password change could authenticate as User B's session. This is a severe concurrency and security bug. |
| **Suggested improvement** | Verify the password via the Supabase Admin API or a database function that doesn't mutate the shared client state. Create per-request Supabase clients if session-stateful operations are needed. |

---

### 🟠 F-92 · Express JSON body limit blocks valid bulk orders

| | |
|---|---|
| **File** | `server/app.js` |
| **Function** | Global Express setup |
| **Description** | `express.json({ limit: '50kb' })` is set, but `bulkOrderSchema` allows `bulk_text` up to 50,000 characters. A 50,000-character string with JSON overhead exceeds 50KB. |
| **Why it may fail** | Legitimate bulk orders that pass Zod validation are rejected by Express with `413 Payload Too Large` before reaching the validator. Users can't submit max-size bulk orders. |
| **Suggested improvement** | Increase the limit to accommodate maximum validated payloads: `limit: '200kb'`. |

---

### 🔴 F-93 · Host header injection in payment callbacks

| | |
|---|---|
| **File** | `server/controllers/paymentController.js` |
| **Function** | `initiatePayment` |
| **Description** | The payment callback URL is constructed using `req.headers['x-forwarded-host']` and `req.headers['x-forwarded-proto']`. |
| **Why it may fail** | If `trust proxy` is not configured, these headers can be spoofed by an attacker. The Paystack redirect after payment sends the user to the attacker's domain, enabling phishing (steal session) or payment hijacking. |
| **Suggested improvement** | Use a strict `APP_URL` environment variable for production callback URLs. Never derive payment callback URLs from request headers. |

---

### 🟡 F-94 · Admin deposit re-completion credits wallet again

| | |
|---|---|
| **File** | `server/controllers/adminController.js` |
| **Function** | `updateDepositStatus` |
| **Description** | When an admin marks a deposit as 'completed', the user's wallet is credited. There is no check whether the deposit was already completed. |
| **Why it may fail** | An admin (or attacker with admin access) can repeatedly toggle a deposit to 'completed', crediting the user multiple times. The audit log insert catches errors and swallows them (`catch(() => {})`). |
| **Suggested improvement** | Check current status before updating: only credit if transitioning from a non-completed status to 'completed'. Make audit logging non-swallowable. |

---

### 🟡 F-95 · `parseInt` allows malformed quantity in API V2

| | |
|---|---|
| **File** | `server/controllers/apiV2Controller.js` |
| **Function** | `handleV2Request` (action: 'add') |
| **Description** | Uses `parseInt(quantity, 10)` to parse quantity. `parseInt("10.9")` → `10`, `parseInt("10abc")` → `10`. Malformed input is silently accepted. |
| **Why it may fail** | Users submit `"10.5"` expecting fractional quantities or `"10abc"` as a typo, both are silently truncated and processed. |
| **Suggested improvement** | Use `Number(quantity)` or regex `/^\d+$/` to strictly validate integer format before parsing. |

---

### 🔴 F-96 · Import script catastrophically wipes services table

| | |
|---|---|
| **File** | `scripts/import_user_services.js` |
| **Function** | `importUserData` |
| **Description** | The script deletes nearly all rows from the services table (`.delete().neq('id', '0000...')`) before inserting new data. No error check on the delete. |
| **Why it may fail** | If deletion succeeds but insertion fails (network error, constraint violation), the production services table is wiped clean. The live site shows zero services. Recovery requires manual intervention. |
| **Suggested improvement** | Never wipe a production table for sync. Use `upsert` with batched arrays. If wiping is necessary, wrap in a PostgreSQL transaction via RPC. |

---

### 🟡 F-97 · Import script ignores category fetch errors

| | |
|---|---|
| **File** | `scripts/import_user_services.js` |
| **Function** | `importUserData` |
| **Description** | The initial category fetch from Supabase doesn't check for errors. On failure, it falls back to `[]` and tries to re-create all categories, causing duplicates or constraint violations. |
| **Why it may fail** | Silent data corruption: duplicate categories, unique constraint errors that halt the entire import. |
| **Suggested improvement** | Add `if (dbCategories.error) throw new Error(...)` immediately after the query. |

---

### 🟡 F-98 · Import script deletes all services before inserting

| | |
|---|---|
| **File** | `scripts/import_smmgen.js` |
| **Function** | `runImport` |
| **Description** | Deletes all services for the provider before batch-inserting new ones. If the script crashes mid-insert, production has partial data. |
| **Why it may fail** | Live site shows incomplete service list. Users can't find or order services that haven't been re-inserted yet. |
| **Suggested improvement** | Use `upsert` with `onConflict`. To handle removed services, soft-delete by marking inactive rather than hard-deleting. |

---

### 🔵 F-99 · Dead code: process_user_data.js does nothing

| | |
|---|---|
| **File** | `scripts/process_user_data.js` |
| **Function** | Global scope |
| **Description** | The file loads an 80KB JSON array into memory and only logs its length. No processing logic is implemented. |
| **Why it may fail** | Wastes memory. Confuses maintainers. Risk of accidental execution expecting it to do something useful. |
| **Suggested improvement** | Implement the intended logic or remove the file. |

---

### 🔵 F-100 · Dead code: generate_smmgen_import.py is unfinished

| | |
|---|---|
| **File** | `scripts/generate_smmgen_import.py` |
| **Function** | Global scope |
| **Description** | Contains imports and a massive JSON string variable but performs no operations. |
| **Why it may fail** | Dead code cluttering the codebase. May confuse developers into thinking it performs an important function. |
| **Suggested improvement** | Complete the script or remove it. |

---

## Summary of Highest-Priority Fixes

The following items should be addressed before production deployment, listed in order of business impact:

| Priority | Finding | Issue |
|----------|---------|-------|
| 1 | F-01, F-02 | Double-crediting deposits (payment verification + webhook race) |
| 2 | F-06, F-07 | Race condition on balance deduction, non-atomic order creation |
| 3 | F-13 | Potential `.env` with secrets committed to git |
| 4 | F-03 | Timing-vulnerable webhook signature verification |
| 5 | F-10 | No database-level negative balance constraint |
| 6 | F-04 | Webhook returns 200 on processing failure |
| 7 | F-19 | Orphaned auth users on registration failure |
| 8 | F-14 | API keys in query parameters |
| 9 | F-15, F-16 | Error message leakage, no security headers |
| 10 | F-57 | No double-submit protection on orders/payments |
| 11 | F-91 | Global auth state mutation on backend `signInWithPassword` |
| 12 | F-93 | Host header injection in payment callback URLs |
| 13 | F-96 | Import script catastrophically wipes services table |
