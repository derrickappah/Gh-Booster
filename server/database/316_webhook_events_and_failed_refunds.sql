-- ============================================================
-- Migration: Webhook Events & Failed Refunds tables
-- Fixes: F-04 (webhook reconciliation), F-09 (failed refund tracking)
-- ============================================================

-- Table to log all incoming webhook events for reconciliation
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'payment',
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only service_role can access webhook events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Table to track failed refunds that need manual resolution
CREATE TABLE IF NOT EXISTS public.failed_refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id),
  user_id UUID REFERENCES public.profiles(id),
  amount NUMERIC(12,4) NOT NULL,
  error TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.failed_refunds ENABLE ROW LEVEL SECURITY;
