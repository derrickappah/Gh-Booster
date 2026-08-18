-- ==============================================================================
-- Migration 320: Token Versioning & Audit Trail Immutability Hardening
-- Addresses: SEC-REVOKE (Instant Session Revocation), SEC-AUDIT (Immutable Audit Trail)
-- ==============================================================================

-- 1. Add token_version column to public.profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'token_version'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN token_version INT NOT NULL DEFAULT 1;
  END IF;
END $$;

-- 2. Function to increment token_version for instant cross-device session revocation
CREATE OR REPLACE FUNCTION public.increment_token_version(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_version INT;
BEGIN
  UPDATE public.profiles
  SET token_version = token_version + 1,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING token_version INTO v_new_version;

  RETURN v_new_version;
END;
$$;

-- Revoke public execution of token version increment
REVOKE EXECUTE ON FUNCTION public.increment_token_version FROM PUBLIC, anon, authenticated;

-- 3. Trigger to enforce append-only immutability on audit_logs table
CREATE OR REPLACE FUNCTION public.enforce_audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Access Denied: Audit log records are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_logs_immutable();
