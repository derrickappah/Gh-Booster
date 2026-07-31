-- ==============================================================================
-- Migration 306: Direct Supabase Order Status Sync Function & pg_cron Schedule
-- ==============================================================================

-- 1. Helper function to identify non-finalized orders needing provider sync
CREATE OR REPLACE FUNCTION public.get_non_finalized_orders()
RETURNS TABLE (
  order_id UUID,
  provider_order_id TEXT,
  current_status TEXT,
  start_count INT,
  remains INT
) LANGUAGE sql STABLE AS $$
  SELECT id, provider_order_id, status, start_count, remains
  FROM public.orders
  WHERE provider_order_id IS NOT NULL
    AND LOWER(status) IN ('processing', 'pending', 'in progress', 'in-progress');
$$;

-- 2. Optional pg_cron scheduling instructions (for Supabase Pro/Enterprise with pg_cron enabled)
-- SELECT cron.schedule(
--   'sync-smm-order-statuses-every-minute',
--   '* * * * *',
--   $$
--     -- Invokes backend sync API endpoint or pg_net HTTP trigger if configured
--     SELECT net.http_get(
--       url := 'https://api.ghbooster.com/api/orders/sync-status',
--       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_TOKEN"}'::jsonb
--     );
--   $$
-- );
