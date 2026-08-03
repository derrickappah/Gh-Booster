-- ========================================================
-- GhBooster Security Hardening Migration
-- MED-09: Enable RLS policies on all tables
-- CRIT-04: Add atomic wallet credit/debit functions
-- ========================================================

-- =============================================
-- 1. ATOMIC WALLET OPERATIONS (CRIT-04 fix)
-- =============================================

-- Atomic wallet credit function (prevents race conditions)
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_bal NUMERIC;
BEGIN
  UPDATE public.wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO new_bal;

  -- If wallet doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance, currency, updated_at)
    VALUES (p_user_id, p_amount, 'GHS', NOW())
    RETURNING balance INTO new_bal;
  END IF;

  RETURN new_bal;
END;
$$;

-- Atomic wallet debit function with balance check
CREATE OR REPLACE FUNCTION public.debit_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_bal NUMERIC;
BEGIN
  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND balance >= p_amount
  RETURNING balance INTO new_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance or wallet not found';
  END IF;

  RETURN new_bal;
END;
$$;

-- =============================================
-- 2. ENABLE ROW LEVEL SECURITY (MED-09 fix)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: categories, services, providers, settings, announcements,
-- promotions, deposit_bonuses, payment_methods are public-readable
-- so we enable RLS with permissive read policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. RLS POLICIES — User-owned tables
-- =============================================

-- PROFILES: Users can read their own profile
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- WALLETS: Users can read their own wallet
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

-- TRANSACTIONS: Users can read their own transactions
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ORDERS: Users can read their own orders
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- BATCHES: Users can read their own batches
CREATE POLICY batches_select_own ON public.batches
  FOR SELECT USING (auth.uid() = user_id);

-- TICKETS: Users can read and create their own tickets
CREATE POLICY tickets_select_own ON public.tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY tickets_insert_own ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- TICKET MESSAGES: Users can read messages for their own tickets
CREATE POLICY ticket_messages_select_own ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY ticket_messages_insert_own ON public.ticket_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- NOTIFICATIONS: Users can read their own notifications
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- CHILD PANELS: Users can read their own child panels
CREATE POLICY child_panels_select_own ON public.child_panels
  FOR SELECT USING (auth.uid() = user_id);

-- REFERRAL PAYOUTS: Users can read their own referral payouts
CREATE POLICY referral_payouts_select_own ON public.referral_payouts
  FOR SELECT USING (auth.uid() = user_id);

-- AUDIT LOGS: Users can read their own audit logs
CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- 4. RLS POLICIES — Public-readable tables
-- =============================================

-- CATEGORIES: Anyone can read categories
CREATE POLICY categories_select_all ON public.categories
  FOR SELECT USING (true);

-- SERVICES: Anyone can read active services
CREATE POLICY services_select_active ON public.services
  FOR SELECT USING (status = 'active');

-- ANNOUNCEMENTS: Anyone can read announcements
CREATE POLICY announcements_select_all ON public.announcements
  FOR SELECT USING (true);

-- PROMOTIONS: Anyone can read active promotions
CREATE POLICY promotions_select_active ON public.promotions
  FOR SELECT USING (status = 'active');

-- DEPOSIT BONUSES: Anyone can read active bonuses
CREATE POLICY deposit_bonuses_select_active ON public.deposit_bonuses
  FOR SELECT USING (status = 'active');

-- PAYMENT METHODS: Anyone can read active payment methods
CREATE POLICY payment_methods_select_active ON public.payment_methods
  FOR SELECT USING (status = 'active');

-- SETTINGS: Public read access (filtered by app logic)
CREATE POLICY settings_select_all ON public.settings
  FOR SELECT USING (true);

-- PROVIDERS: No public access (admin only via service role)
-- No anon policy needed as providers are only accessed via supabaseAdmin

-- =============================================
-- 5. Additional indexes for security queries
-- =============================================

-- Index for faster refund idempotency checks
CREATE INDEX IF NOT EXISTS idx_transactions_type_reference
  ON public.transactions(type, reference);

-- Index for faster wallet lookups
CREATE INDEX IF NOT EXISTS idx_wallets_user_id_balance
  ON public.wallets(user_id, balance);

-- Index for transaction status checks
CREATE INDEX IF NOT EXISTS idx_transactions_user_status
  ON public.transactions(user_id, status);
