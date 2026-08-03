-- ========================================================
-- GhBooster Migration 311: Schema Column Alignment & Safety
-- Ensures orders table charge column consistency and updates
-- ========================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_price'
  ) THEN
    -- Copy any non-zero total_price data to charge if charge is 0
    UPDATE public.orders SET charge = total_price WHERE (charge IS NULL OR charge = 0) AND total_price > 0;
    -- Drop total_price column to maintain single canonical column name
    ALTER TABLE public.orders DROP COLUMN total_price;
  END IF;
END $$;
