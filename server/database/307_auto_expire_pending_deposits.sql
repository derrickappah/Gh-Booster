-- ==============================================================================
-- Migration 307: Automatic Expiration for Pending Deposits (> 30 Minutes)
-- ==============================================================================

-- 1. Update check constraint on public.transactions to include 'expired' status
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check 
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'expired'));

-- 2. Create Stored Procedure to expire pending deposits older than 30 minutes
CREATE OR REPLACE FUNCTION public.expire_old_pending_deposits()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  expired_count INT;
BEGIN
  UPDATE public.transactions
  SET status = 'expired'
  WHERE type = 'deposit'
    AND status = 'pending'
    AND created_at < (NOW() - INTERVAL '30 minutes');
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- 3. Optional pg_cron scheduling instructions (for Supabase Pro/Enterprise with pg_cron enabled)
-- SELECT cron.schedule(
--   'expire-pending-deposits-every-5-minutes',
--   '*/5 * * * *',
--   $$
--     SELECT public.expire_old_pending_deposits();
--   $$
-- );
