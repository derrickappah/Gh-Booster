-- ========================================================
-- GhBooster Migration 312: Security Hardening & Guards
-- Fixes: CRIT-05, HIGH-03, MED-06
-- ========================================================

-- =============================================
-- CRIT-05: Atomic wallet credit/debit amount guards
-- =============================================

CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_bal NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be strictly positive';
  END IF;

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

CREATE OR REPLACE FUNCTION public.debit_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_bal NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Debit amount must be strictly positive';
  END IF;

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
-- HIGH-03: Restrict settings table RLS policy to admins
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS settings_select_all ON public.settings;
    DROP POLICY IF EXISTS settings_select_admin ON public.settings;
    
    CREATE POLICY settings_select_admin ON public.settings FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;

-- =============================================
-- MED-06: Add super_admin to profiles role CHECK
-- =============================================

DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'admin', 'super_admin', 'staff', 'reseller'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profiles_role_check update skipped: %', SQLERRM;
END $$;
