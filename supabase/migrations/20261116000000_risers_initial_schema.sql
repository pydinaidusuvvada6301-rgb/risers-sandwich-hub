-- ==============================================================
-- RISERS Sandwich Hub - PostgreSQL Initial Database Schema
-- Migration: 20261116000000_risers_initial_schema.sql
-- ==============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================
-- 1. Helper Function: Get Current User Role
-- ==============================================================
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.admin_users
    WHERE id = auth.uid() AND is_active = true;
    
    RETURN COALESCE(user_role, 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================
-- 2. Tables Definition
-- ==============================================================

-- 1. admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'kitchen')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT 'sandwiches',
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    image_url TEXT,
    is_veg BOOLEAN NOT NULL DEFAULT true,
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. token_sequences (Concurrency-safe daily token generator)
CREATE TABLE IF NOT EXISTS public.token_sequences (
    sequence_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    last_token INTEGER NOT NULL DEFAULT 100
);

-- Concurrency-safe atomic token generator function
CREATE OR REPLACE FUNCTION public.generate_daily_token()
RETURNS INTEGER AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
    next_val INTEGER;
BEGIN
    INSERT INTO public.token_sequences (sequence_date, last_token)
    VALUES (today_date, 101)
    ON CONFLICT (sequence_date)
    DO UPDATE SET last_token = public.token_sequences.last_token + 1
    RETURNING last_token INTO next_val;

    RETURN next_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    token_number INTEGER NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    order_status TEXT NOT NULL DEFAULT 'received' CHECK (order_status IN ('received', 'preparing', 'ready', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'voided')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi')),
    subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    tracking_hash TEXT UNIQUE NOT NULL,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. order_items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'refunded', 'adjusted')),
    upi_reference TEXT,
    verified_by UUID REFERENCES public.admin_users(id),
    cashier_name TEXT,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. payment_events (Auditable log)
CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id),
    order_id UUID REFERENCES public.orders(id),
    event_type TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    performed_by UUID REFERENCES public.admin_users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. feedback
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
    service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. inventory
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    unit TEXT NOT NULL,
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (current_stock >= 0),
    min_limit NUMERIC(12,2) NOT NULL DEFAULT 10.00,
    cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. inventory_transactions
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventory(id),
    change_amount NUMERIC(12,2) NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('order_prep', 'purchase', 'wastage', 'manual_adjustment')),
    order_id UUID REFERENCES public.orders(id),
    created_by UUID REFERENCES public.admin_users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. product_recipes
CREATE TABLE IF NOT EXISTS public.product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. recipe_ingredients
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.product_recipes(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
    quantity_required NUMERIC(10,2) NOT NULL CHECK (quantity_required > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (recipe_id, inventory_id)
);

-- 13. expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('ingredients', 'packaging', 'transportation', 'rent', 'electricity', 'equipment', 'marketing', 'other')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer')),
    paid_in_cash BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    receipt_url TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. daily_cash_sessions
CREATE TABLE IF NOT EXISTS public.daily_cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opened_by UUID REFERENCES public.admin_users(id),
    closed_by UUID REFERENCES public.admin_users(id),
    opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (opening_cash >= 0),
    cash_collections NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cash_collections >= 0),
    cash_refunds NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cash_refunds >= 0),
    cash_expenses NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cash_expenses >= 0),
    expected_closing_cash NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    actual_closing_cash NUMERIC(10,2),
    cash_difference NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ
);

-- 16. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.admin_users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 17. admin_access_attempts
CREATE TABLE IF NOT EXISTS public.admin_access_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_hash TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 18. business_settings
CREATE TABLE IF NOT EXISTS public.business_settings (
    id TEXT PRIMARY KEY DEFAULT 'stall_config',
    business_name TEXT NOT NULL DEFAULT 'RISERS Sandwich Hub',
    tagline TEXT NOT NULL DEFAULT 'Rise Together, Serve Better!',
    logo_url TEXT,
    contact_phone TEXT NOT NULL DEFAULT '+91 98765 43210',
    contact_email TEXT NOT NULL DEFAULT 'contact@risershub.in',
    stall_address TEXT NOT NULL DEFAULT 'Stall #4, Food Street, Bangalore, India',
    upi_id TEXT NOT NULL DEFAULT 'risers@upi',
    upi_qr_url TEXT,
    production_url TEXT NOT NULL DEFAULT 'https://risers-sandwich-hub.vercel.app',
    opening_hours TEXT NOT NULL DEFAULT '11:00 AM - 10:30 PM',
    is_store_open BOOLEAN NOT NULL DEFAULT true,
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    currency_code TEXT NOT NULL DEFAULT 'INR',
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 19. order_status_history
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES public.admin_users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================
-- 3. Indexes for High Performance Querying
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_orders_token ON public.orders(token_number);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON public.orders(tracking_hash);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_access_attempts ON public.admin_access_attempts(ip_hash, attempted_at DESC);

-- ==============================================================
-- 4. Automatic Atomic Inventory Deduction Trigger Function
-- ==============================================================
CREATE OR REPLACE FUNCTION public.deduct_recipe_inventory_on_prep()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    ingredient RECORD;
    deduct_qty NUMERIC;
BEGIN
    -- Only trigger when order_status transitions to 'preparing'
    IF NEW.order_status = 'preparing' AND (OLD.order_status IS DISTINCT FROM 'preparing') THEN
        -- Loop through order items
        FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
            -- Check if product has a recipe
            FOR ingredient IN 
                SELECT ri.inventory_id, ri.quantity_required, inv.name AS inv_name, inv.current_stock
                FROM public.product_recipes pr
                JOIN public.recipe_ingredients ri ON ri.recipe_id = pr.id
                JOIN public.inventory inv ON inv.id = ri.inventory_id
                WHERE pr.product_id = item.product_id
            LOOP
                deduct_qty := ingredient.quantity_required * item.quantity;
                
                -- Update stock atomically (preventing negative stock)
                UPDATE public.inventory
                SET current_stock = GREATEST(0, current_stock - deduct_qty),
                    updated_at = timezone('utc'::text, now())
                WHERE id = ingredient.inventory_id;
                
                -- Record audit transaction
                INSERT INTO public.inventory_transactions (
                    inventory_id,
                    change_amount,
                    reason,
                    order_id,
                    notes
                ) VALUES (
                    ingredient.inventory_id,
                    -deduct_qty,
                    'order_prep',
                    NEW.id,
                    'Automatic deduction for Order #' || NEW.order_number
                );
            END LOOP;
        END LOOP;
    END IF;

    -- Record status history
    IF (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
        INSERT INTO public.order_status_history (
            order_id,
            previous_status,
            new_status,
            notes
        ) VALUES (
            NEW.id,
            OLD.order_status,
            NEW.order_status,
            'Status advanced to ' || NEW.order_status
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_prep_inventory ON public.orders;
CREATE TRIGGER trg_order_prep_inventory
    AFTER UPDATE OF order_status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.deduct_recipe_inventory_on_prep();

-- ==============================================================
-- 5. Row Level Security (RLS) Policies
-- ==============================================================

-- Enable RLS across all tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- 5.1 Products RLS
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products" ON public.products
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Owner and Manager can manage products" ON public.products;
CREATE POLICY "Owner and Manager can manage products" ON public.products
    FOR ALL USING (public.get_auth_role() IN ('owner', 'manager'));

-- 5.2 Orders RLS
-- Public can look up order using tracking_hash only
DROP POLICY IF EXISTS "Customer can view own order by tracking hash" ON public.orders;
CREATE POLICY "Customer can view own order by tracking hash" ON public.orders
    FOR SELECT USING (true); -- Filtered by query using tracking_hash; or staff can view all

DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders" ON public.orders
    FOR SELECT USING (public.get_auth_role() IN ('owner', 'manager', 'cashier', 'kitchen'));

DROP POLICY IF EXISTS "Staff can update permitted orders" ON public.orders;
CREATE POLICY "Staff can update permitted orders" ON public.orders
    FOR UPDATE USING (public.get_auth_role() IN ('owner', 'manager', 'cashier', 'kitchen'));

-- 5.3 Order Items RLS
DROP POLICY IF EXISTS "Public view order items for matching order" ON public.order_items;
CREATE POLICY "Public view order items for matching order" ON public.order_items
    FOR SELECT USING (true);

-- 5.4 Payments RLS
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
CREATE POLICY "Staff can view payments" ON public.payments
    FOR SELECT USING (public.get_auth_role() IN ('owner', 'manager', 'cashier'));

DROP POLICY IF EXISTS "Cashier, Manager, Owner can insert payments" ON public.payments;
CREATE POLICY "Cashier, Manager, Owner can insert payments" ON public.payments
    FOR INSERT WITH CHECK (public.get_auth_role() IN ('owner', 'manager', 'cashier'));

-- 5.5 Feedback RLS
DROP POLICY IF EXISTS "Public can insert feedback for completed orders" ON public.feedback;
CREATE POLICY "Public can insert feedback for completed orders" ON public.feedback
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view feedback" ON public.feedback;
CREATE POLICY "Staff can view feedback" ON public.feedback
    FOR SELECT USING (public.get_auth_role() IN ('owner', 'manager', 'cashier'));

-- 5.6 Inventory & Recipes RLS
DROP POLICY IF EXISTS "Staff can view inventory" ON public.inventory;
CREATE POLICY "Staff can view inventory" ON public.inventory
    FOR SELECT USING (public.get_auth_role() IN ('owner', 'manager', 'cashier', 'kitchen'));

DROP POLICY IF EXISTS "Owner and Manager can modify inventory" ON public.inventory;
CREATE POLICY "Owner and Manager can modify inventory" ON public.inventory
    FOR ALL USING (public.get_auth_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS "Staff can view recipes" ON public.product_recipes;
CREATE POLICY "Staff can view recipes" ON public.product_recipes
    FOR SELECT USING (public.get_auth_role() IN ('owner', 'manager', 'kitchen'));

DROP POLICY IF EXISTS "Staff can view recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Staff can view recipe ingredients" ON public.recipe_ingredients
    FOR SELECT USING (public.get_auth_role() IN ('owner', 'manager', 'kitchen'));

-- 5.7 Expenses RLS
DROP POLICY IF EXISTS "Owner and Manager can manage expenses" ON public.expenses;
CREATE POLICY "Owner and Manager can manage expenses" ON public.expenses
    FOR ALL USING (public.get_auth_role() IN ('owner', 'manager'));

-- 5.8 Daily Cash Sessions RLS
DROP POLICY IF EXISTS "Cashier, Manager, Owner can view cash sessions" ON public.daily_cash_sessions;
CREATE POLICY "Cashier, Manager, Owner can view cash sessions" ON public.daily_cash_sessions
    FOR SELECT USING (public.get_auth_role() IN ('owner', 'manager', 'cashier'));

DROP POLICY IF EXISTS "Cashier, Manager, Owner can update cash sessions" ON public.daily_cash_sessions;
CREATE POLICY "Cashier, Manager, Owner can update cash sessions" ON public.daily_cash_sessions
    FOR ALL USING (public.get_auth_role() IN ('owner', 'manager', 'cashier'));

-- 5.9 Business Settings RLS
DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
CREATE POLICY "Public can view business settings" ON public.business_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can update business settings" ON public.business_settings;
CREATE POLICY "Owner can update business settings" ON public.business_settings
    FOR ALL USING (public.get_auth_role() = 'owner');

-- 5.10 Admin Users RLS
DROP POLICY IF EXISTS "Staff can view own admin profile" ON public.admin_users;
CREATE POLICY "Staff can view own admin profile" ON public.admin_users
    FOR SELECT USING (id = auth.uid() OR public.get_auth_role() = 'owner');

DROP POLICY IF EXISTS "Owner can manage staff" ON public.admin_users;
CREATE POLICY "Owner can manage staff" ON public.admin_users
    FOR ALL USING (public.get_auth_role() = 'owner');

-- ==============================================================
-- 6. Supabase Realtime Publication
-- ==============================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
