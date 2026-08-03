-- ========================================================
-- GhBooster Migration 311: Schema Column Alignment & Safety
-- Ensures orders table charge column exists and migrates total_price data
-- ========================================================

DO $$
BEGIN
  -- 1. Ensure 'charge' column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'charge'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN charge NUMERIC(12, 4) DEFAULT 0.0000;
  END IF;

  -- 2. If 'total_price' exists, copy values into 'charge' then drop 'total_price'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_price'
  ) THEN
    UPDATE public.orders SET charge = total_price WHERE total_price IS NOT NULL AND total_price > 0;
    ALTER TABLE public.orders DROP COLUMN total_price;
  END IF;
END $$;
