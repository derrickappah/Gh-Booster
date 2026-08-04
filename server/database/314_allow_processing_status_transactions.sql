-- ========================================================
-- GhBooster Migration 314: Add 'processing' to transactions status check
-- Fixes: Transaction status update failure during Moolre webhook atomic claim
-- ========================================================

DO $$
BEGIN
  ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
  ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'expired'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'transactions_status_check update skipped: %', SQLERRM;
END $$;
