-- ========================================================
-- GhBooster Security Hardening Migration (Safe Execution)
-- MED-09: Enable RLS policies on existing tables safely
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

-- Helper block to safely enable RLS and create policies if tables exist
DO $$ 
DECLARE
  t TEXT;
BEGIN
  -- List of user tables to enable RLS on if they exist
  FOR t IN SELECT unnest(ARRAY[
    'profiles', 'wallets', 'transactions', 'orders', 'batches', 
    'tickets', 'ticket_messages', 'notifications', 'child_panels', 
    'referral_payouts', 'audit_logs', 'categories', 'services', 
    'providers', 'settings', 'announcements', 'promotions', 
    'deposit_bonuses', 'payment_methods'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END $$;

-- Helper macro function to safely recreate policy
CREATE OR REPLACE FUNCTION public.create_policy_if_table_exists(
  p_policy_name TEXT,
  p_table_name TEXT,
  p_cmd TEXT,
  p_using TEXT DEFAULT NULL,
  p_with_check TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', p_policy_name, p_table_name);
    IF p_cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s);', p_policy_name, p_table_name, COALESCE(p_with_check, p_using));
    ELSIF p_with_check IS NOT NULL THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s USING (%s) WITH CHECK (%s);', p_policy_name, p_table_name, p_cmd, p_using, p_with_check);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s USING (%s);', p_policy_name, p_table_name, p_cmd, p_using);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply user policies safely
SELECT public.create_policy_if_table_exists('profiles_select_own', 'profiles', 'SELECT', 'auth.uid() = id');
SELECT public.create_policy_if_table_exists('profiles_update_own', 'profiles', 'UPDATE', 'auth.uid() = id');
SELECT public.create_policy_if_table_exists('wallets_select_own', 'wallets', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('transactions_select_own', 'transactions', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('orders_select_own', 'orders', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('batches_select_own', 'batches', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('tickets_select_own', 'tickets', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('tickets_insert_own', 'tickets', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('ticket_messages_select_own', 'ticket_messages', 'SELECT', 'EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())');
SELECT public.create_policy_if_table_exists('ticket_messages_insert_own', 'ticket_messages', 'INSERT', NULL, 'EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())');
SELECT public.create_policy_if_table_exists('notifications_select_own', 'notifications', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('child_panels_select_own', 'child_panels', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('referral_payouts_select_own', 'referral_payouts', 'SELECT', 'auth.uid() = user_id');
SELECT public.create_policy_if_table_exists('audit_logs_select_own', 'audit_logs', 'SELECT', 'auth.uid() = user_id');

-- Apply public policies safely
SELECT public.create_policy_if_table_exists('categories_select_all', 'categories', 'SELECT', 'true');
SELECT public.create_policy_if_table_exists('services_select_active', 'services', 'SELECT', 'status = ''active''');
SELECT public.create_policy_if_table_exists('announcements_select_all', 'announcements', 'SELECT', 'true');
SELECT public.create_policy_if_table_exists('promotions_select_active', 'promotions', 'SELECT', 'status = ''active''');
SELECT public.create_policy_if_table_exists('deposit_bonuses_select_active', 'deposit_bonuses', 'SELECT', 'status = ''active''');
SELECT public.create_policy_if_table_exists('payment_methods_select_active', 'payment_methods', 'SELECT', 'status = ''active''');
SELECT public.create_policy_if_table_exists('settings_select_all', 'settings', 'SELECT', 'true');

-- Clean up helper function
DROP FUNCTION IF EXISTS public.create_policy_if_table_exists(TEXT, TEXT, TEXT, TEXT, TEXT);

-- =============================================
-- 5. Additional indexes for security queries
-- =============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_type_reference ON public.transactions(type, reference);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallets') THEN
    CREATE INDEX IF NOT EXISTS idx_wallets_user_id_balance ON public.wallets(user_id, balance);
  END IF;
END $$;
