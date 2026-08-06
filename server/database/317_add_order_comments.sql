-- 317_add_order_comments.sql
-- Add comments column to public.orders table for custom comment services

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS comments TEXT;
