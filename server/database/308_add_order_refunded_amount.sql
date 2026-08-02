-- ==============================================================================
-- Migration 308: Add refunded_amount column to public.orders
-- ==============================================================================

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 4) DEFAULT 0.0000 CHECK (refunded_amount >= 0);
