-- ==============================================================================
-- Migration 319: Comprehensive Database Security & Integrity Remediation
-- Fixes: SEC-01 (Role Escalation Guard), SEC-02 (RPC Permission Hardening),
--        SEC-03 (search_path Hardening), SEC-04 (Promotion Scraping RLS)
-- ==============================================================================

-- 1. SEC-01 Fix: Protect sensitive profile columns from client-side manipulation
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the request is executing from a client-authenticated session
  IF (COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'authenticated' 
      OR auth.role() = 'authenticated') THEN
    
    -- Prevent modification of administrative role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify your own user role.';
    END IF;
    
    -- Prevent modification of user ID
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify your user ID.';
    END IF;

    -- Prevent modification of API key directly (must use generate-api-key endpoint)
    IF NEW.api_key IS DISTINCT FROM OLD.api_key THEN
      RAISE EXCEPTION 'Access Denied: API keys must be generated through the official API endpoint.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();


-- 2. SEC-02 Fix: Revoke public execution permissions on administrative stats RPCs
REVOKE EXECUTE ON FUNCTION public.get_order_stats FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_order_stats FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_order_stats FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_wallet_stats FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_wallet_stats FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_wallet_stats FROM authenticated;

-- Ensure financial functions remain strictly revoked
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM PUBLIC, anon, authenticated;


-- 3. SEC-03 Fix: Recreate stored procedures with explicit search_path enforcement
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.expire_old_pending_deposits()
RETURNS INT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  expired_count INT;
BEGIN
  UPDATE public.transactions
  SET status = 'expired',
      updated_at = NOW()
  WHERE type = 'deposit'
    AND status = 'pending'
    AND created_at < (NOW() - INTERVAL '30 minutes');
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_stats()
RETURNS TABLE(
  total_orders BIGINT,
  total_revenue NUMERIC,
  pending_orders BIGINT,
  completed_orders BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
  SELECT 
    COUNT(*)::BIGINT AS total_orders,
    COALESCE(SUM(charge), 0) AS total_revenue,
    COUNT(*) FILTER (WHERE LOWER(status) IN ('pending', 'processing', 'in progress', 'in-progress'))::BIGINT AS pending_orders,
    COUNT(*) FILTER (WHERE LOWER(status) = 'completed')::BIGINT AS completed_orders
  FROM public.orders;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_stats()
RETURNS TABLE(
  total_wallets BIGINT,
  total_balance NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
  SELECT 
    COUNT(*)::BIGINT AS total_wallets,
    COALESCE(SUM(balance), 0) AS total_balance
  FROM public.wallets;
$$;


-- 4. SEC-04 Fix: Restrict promotions table RLS to admins
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotions') THEN
    DROP POLICY IF EXISTS promotions_select_active ON public.promotions;
    DROP POLICY IF EXISTS promotions_select_admin ON public.promotions;
    
    CREATE POLICY promotions_select_admin ON public.promotions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;
