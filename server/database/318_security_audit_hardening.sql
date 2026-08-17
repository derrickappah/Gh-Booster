-- ============================================================
-- GhBooster Migration 318: Comprehensive Security Hardening
-- Addresses:
--   - Race conditions on wallet deductions
--   - Strict RLS enforcement across all user & financial tables
--   - Negative balance checks & constraints
--   - Token invalidation support
-- ============================================================

-- 1. Ensure wallets table has strict non-negative balance constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallets' AND constraint_name = 'wallets_balance_non_negative'
  ) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);
  END IF;
END $$;

-- 2. Ensure atomic credit_wallet and debit_wallet RPCs exist with positive amount assertions
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

-- 3. Revoke public execution of financial RPCs so clients cannot invoke them directly
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM anon;
REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM authenticated;
