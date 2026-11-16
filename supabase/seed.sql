-- ==============================================================
-- RISERS Sandwich Hub - Idempotent Seed Data
-- File: supabase/seed.sql
-- ==============================================================

-- 1. Initial Products
INSERT INTO public.products (id, name, slug, category, description, price, cost_price, image_url, is_veg, is_available, is_active, display_order)
VALUES
    ('c1111111-1111-4111-a111-111111111111', 'Chicken Sandwich', 'chicken-sandwich', 'sandwiches', 'Grilled succulent chicken breast seasoned with aromatic herbs, crisp lettuce, farm-fresh tomatoes, and our signature RISERS herb mayo, toasted between buttered artisan bread.', 99.00, 42.00, '/assets/images/chicken-sandwich.jpg', false, true, true, 1),
    ('c2222222-2222-4222-a222-222222222222', 'Paneer Sandwich', 'paneer-sandwich', 'sandwiches', 'Fresh cottage cheese paneer cubes tossed in rich tandoori spices, topped with crunchy bell peppers, sliced red onion, and creamy mint mayo on toasted golden sourdough.', 79.00, 31.00, '/assets/images/paneer-sandwich.jpg', true, true, true, 2)
ON CONFLICT (slug) 
DO UPDATE SET
    price = EXCLUDED.price,
    cost_price = EXCLUDED.cost_price,
    description = EXCLUDED.description,
    is_available = EXCLUDED.is_available,
    is_active = EXCLUDED.is_active;

-- 2. Initial Inventory Items
INSERT INTO public.inventory (id, name, unit, current_stock, min_limit, cost_per_unit)
VALUES
    ('i1111111-1111-4111-b111-111111111111', 'Artisan Bread', 'slices', 200.00, 40.00, 2.50),
    ('i2222222-2222-4222-b222-222222222222', 'Chicken Breast', 'grams', 5000.00, 1000.00, 0.28),
    ('i3333333-3333-4333-b333-333333333333', 'Fresh Paneer', 'grams', 4000.00, 800.00, 0.25),
    ('i4444444-4444-4444-b444-444444444444', 'Cheddar Cheese', 'slices', 150.00, 30.00, 6.00),
    ('i5555555-5555-4555-b555-555555555555', 'Fresh Vegetables', 'grams', 6000.00, 1000.00, 0.08),
    ('i6666666-6666-4666-b666-666666666666', 'Signature Sauces', 'ml', 4000.00, 500.00, 0.12),
    ('i7777777-7777-4777-b777-777777777777', 'Butter', 'grams', 2500.00, 400.00, 0.35),
    ('i8888888-8888-4888-b888-888888888888', 'Paper Packaging Box', 'pcs', 300.00, 50.00, 3.50)
ON CONFLICT (name)
DO UPDATE SET
    min_limit = EXCLUDED.min_limit,
    cost_per_unit = EXCLUDED.cost_per_unit;

-- 3. Product Recipes
-- Chicken Sandwich Recipe
INSERT INTO public.product_recipes (id, product_id, name)
VALUES ('r1111111-1111-4111-c111-111111111111', 'c1111111-1111-4111-a111-111111111111', 'Classic Chicken Sandwich Recipe')
ON CONFLICT (product_id) DO NOTHING;

-- Paneer Sandwich Recipe
INSERT INTO public.product_recipes (id, product_id, name)
VALUES ('r2222222-2222-4222-c222-222222222222', 'c2222222-2222-4222-a222-222222222222', 'Classic Paneer Sandwich Recipe')
ON CONFLICT (product_id) DO NOTHING;

-- Recipe Ingredients
-- Chicken Sandwich: 2 slices bread, 100g chicken, 30g veggies, 25ml sauce, 15g butter, 1 packaging box
INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, quantity_required)
VALUES
    ('r1111111-1111-4111-c111-111111111111', 'i1111111-1111-4111-b111-111111111111', 2.00),
    ('r1111111-1111-4111-c111-111111111111', 'i2222222-2222-4222-b222-222222222222', 100.00),
    ('r1111111-1111-4111-c111-111111111111', 'i5555555-5555-4555-b555-555555555555', 30.00),
    ('r1111111-1111-4111-c111-111111111111', 'i6666666-6666-4666-b666-666666666666', 25.00),
    ('r1111111-1111-4111-c111-111111111111', 'i7777777-7777-4777-b777-777777777777', 15.00),
    ('r1111111-1111-4111-c111-111111111111', 'i8888888-8888-4888-b888-888888888888', 1.00)
ON CONFLICT (recipe_id, inventory_id) DO NOTHING;

-- Paneer Sandwich: 2 slices bread, 80g paneer, 35g veggies, 25ml sauce, 15g butter, 1 packaging box
INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, quantity_required)
VALUES
    ('r2222222-2222-4222-c222-222222222222', 'i1111111-1111-4111-b111-111111111111', 2.00),
    ('r2222222-2222-4222-c222-222222222222', 'i3333333-3333-4333-b333-333333333333', 80.00),
    ('r2222222-2222-4222-c222-222222222222', 'i5555555-5555-4555-b555-555555555555', 35.00),
    ('r2222222-2222-4222-c222-222222222222', 'i6666666-6666-4666-b666-666666666666', 25.00),
    ('r2222222-2222-4222-c222-222222222222', 'i7777777-7777-4777-b777-777777777777', 15.00),
    ('r2222222-2222-4222-c222-222222222222', 'i8888888-8888-4888-b888-888888888888', 1.00)
ON CONFLICT (recipe_id, inventory_id) DO NOTHING;

-- 4. Initial Business Settings
INSERT INTO public.business_settings (
    id, business_name, tagline, contact_phone, contact_email, stall_address,
    upi_id, production_url, opening_hours, is_store_open, currency_symbol, currency_code
) VALUES (
    'stall_config',
    'RISERS Sandwich Hub',
    'Rise Together, Serve Better!',
    '+91 98765 43210',
    'contact@risershub.in',
    'Stall #4, Food Street, Bangalore, India',
    'risers@upi',
    'https://risers-sandwich-hub.vercel.app',
    '11:00 AM - 10:30 PM',
    true,
    '₹',
    'INR'
)
ON CONFLICT (id) DO NOTHING;
