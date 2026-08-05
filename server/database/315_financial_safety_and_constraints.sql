-- ============================================================
-- Migration: Financial Safety & Data Integrity Constraints
-- Fixes: F-10 (negative balance guard), F-31 (order status CHECK),
--        F-32 (idempotency), F-38 (API key index)
-- ============================================================

-- F-10: Prevent negative wallet balances at the database level
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);

-- F-31: Constrain order statuses to known values
ALTER TABLE public.orders
  ADD CONSTRAINT chk_order_status CHECK (
    status IN (
      'Pending', 'Processing', 'In Progress',
      'Completed', 'Partial', 'Canceled',
      'Cancelled', 'Refunded', 'refund_failed'
    )
  );

-- F-38: Index on API key for faster lookups (used heavily in API V2)
CREATE INDEX IF NOT EXISTS idx_profiles_api_key
  ON public.profiles(api_key)
  WHERE api_key IS NOT NULL;

-- F-32: Add idempotency support to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency
  ON public.transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for faster order status lookups during sync
CREATE INDEX IF NOT EXISTS idx_orders_status_provider
  ON public.orders(status, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

-- Index for faster transaction reference lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_type
  ON public.transactions(user_id, type);

-- Revoke public access to financial RPC functions
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM anon;
REVOKE EXECUTE ON FUNCTION public.debit_wallet FROM authenticated;
