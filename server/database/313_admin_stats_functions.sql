-- ========================================================
-- GhBooster Migration 313: Admin Stats SQL Aggregations
-- Fixes: HIGH-09
-- ========================================================

CREATE OR REPLACE FUNCTION public.get_order_stats()
RETURNS TABLE(
  total_orders BIGINT,
  total_revenue NUMERIC,
  pending_orders BIGINT,
  completed_orders BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
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
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT 
    COUNT(*)::BIGINT AS total_wallets,
    COALESCE(SUM(balance), 0) AS total_balance
  FROM public.wallets;
$$;
