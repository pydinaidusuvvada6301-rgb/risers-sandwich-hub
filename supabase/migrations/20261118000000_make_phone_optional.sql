-- ==============================================================
-- RISERS Sandwich Hub - Migration: Make Customer Phone Optional
-- ==============================================================

-- 1. Relax NOT NULL constraint on orders.customer_phone
ALTER TABLE IF EXISTS public.orders 
  ALTER COLUMN customer_phone DROP NOT NULL,
  ALTER COLUMN customer_phone SET DEFAULT '';

-- 2. Relax NOT NULL constraint on customers.phone
ALTER TABLE IF EXISTS public.customers 
  ALTER COLUMN phone DROP NOT NULL;
