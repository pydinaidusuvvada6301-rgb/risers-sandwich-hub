// ==============================================================
// RISERS Sandwich Hub - Supabase Client & Local Mock Fallback
// ==============================================================

import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if valid remote Supabase credentials are provided
export const isConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-supabase-anon')
);

// Real client instance (if configured)
export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// ==============================================================
// Resilient Mock Store for Local Development & Testing
// Allows full interactive verification without remote keys
// ==============================================================
const MOCK_STORAGE_KEY = 'risers_mock_db_v1';

const DEFAULT_MOCK_DATA = {
  products: [
    {
      id: 'c1111111-1111-4111-a111-111111111111',
      name: 'Chicken Sandwich',
      slug: 'chicken-sandwich',
      category: 'sandwiches',
      description: 'Grilled succulent chicken breast seasoned with aromatic herbs, crisp lettuce, farm-fresh tomatoes, and our signature RISERS herb mayo, toasted between buttered artisan bread.',
      price: 99.00,
      cost_price: 42.00,
      image_url: 'https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?auto=format&fit=crop&w=600&q=80',
      is_veg: false,
      is_available: true,
      is_active: true,
      display_order: 1
    },
    {
      id: 'c2222222-2222-4222-a222-222222222222',
      name: 'Paneer Sandwich',
      slug: 'paneer-sandwich',
      category: 'sandwiches',
      description: 'Fresh cottage cheese paneer cubes tossed in rich tandoori spices, topped with crunchy bell peppers, sliced red onion, and creamy mint mayo on toasted golden sourdough.',
      price: 79.00,
      cost_price: 31.00,
      image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
      is_veg: true,
      is_available: true,
      is_active: true,
      display_order: 2
    }
  ],
  orders: [
    {
      id: 'ord-101',
      order_number: 'RSH-20261116-0101',
      token_number: 101,
      customer_name: 'Rahul Verma',
      customer_phone: '9876543210',
      order_status: 'preparing',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal_amount: 178.00,
      discount_amount: 0.00,
      total_amount: 178.00,
      notes: 'Extra spicy please!',
      tracking_hash: 'mock-hash-101',
      created_at: new Date(Date.now() - 25 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60000).toISOString()
    },
    {
      id: 'ord-102',
      order_number: 'RSH-20261116-0102',
      token_number: 102,
      customer_name: 'Pooja Nair',
      customer_phone: '9812345678',
      order_status: 'received',
      payment_status: 'pending',
      payment_method: 'cash',
      subtotal_amount: 99.00,
      discount_amount: 0.00,
      total_amount: 99.00,
      notes: 'Well toasted',
      tracking_hash: 'mock-hash-102',
      created_at: new Date(Date.now() - 12 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 12 * 60000).toISOString()
    },
    {
      id: 'ord-103',
      order_number: 'RSH-20261116-0103',
      token_number: 103,
      customer_name: 'Vikram Singh',
      customer_phone: '9765432109',
      order_status: 'ready',
      payment_status: 'paid',
      payment_method: 'cash',
      subtotal_amount: 158.00,
      discount_amount: 0.00,
      total_amount: 158.00,
      notes: 'No onions in one sandwich',
      tracking_hash: 'mock-hash-103',
      created_at: new Date(Date.now() - 35 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 60000).toISOString()
    }
  ],
  order_items: [
    {
      id: 'oi-1',
      order_id: 'ord-101',
      product_id: 'c1111111-1111-4111-a111-111111111111',
      product_name: 'Chicken Sandwich',
      unit_price: 99.00,
      quantity: 1,
      subtotal: 99.00
    },
    {
      id: 'oi-2',
      order_id: 'ord-101',
      product_id: 'c2222222-2222-4222-a222-222222222222',
      product_name: 'Paneer Sandwich',
      unit_price: 79.00,
      quantity: 1,
      subtotal: 79.00
    },
    {
      id: 'oi-3',
      order_id: 'ord-102',
      product_id: 'c1111111-1111-4111-a111-111111111111',
      product_name: 'Chicken Sandwich',
      unit_price: 99.00,
      quantity: 1,
      subtotal: 99.00
    },
    {
      id: 'oi-4',
      order_id: 'ord-103',
      product_id: 'c2222222-2222-4222-a222-222222222222',
      product_name: 'Paneer Sandwich',
      unit_price: 79.00,
      quantity: 2,
      subtotal: 158.00
    }
  ],
  payments: [
    {
      id: 'pay-1',
      order_id: 'ord-101',
      payment_method: 'upi',
      amount: 178.00,
      payment_status: 'paid',
      upi_reference: 'UPI/20261116/092819',
      cashier_name: 'Stall Cashier',
      confirmed_at: new Date(Date.now() - 20 * 60000).toISOString(),
      created_at: new Date(Date.now() - 20 * 60000).toISOString()
    },
    {
      id: 'pay-2',
      order_id: 'ord-103',
      payment_method: 'cash',
      amount: 158.00,
      payment_status: 'paid',
      upi_reference: null,
      cashier_name: 'Stall Cashier',
      confirmed_at: new Date(Date.now() - 30 * 60000).toISOString(),
      created_at: new Date(Date.now() - 30 * 60000).toISOString()
    }
  ],
  inventory: [
    { id: 'inv-1', name: 'Artisan Bread', unit: 'slices', current_stock: 180, min_limit: 40, cost_per_unit: 2.50 },
    { id: 'inv-2', name: 'Chicken Breast', unit: 'grams', current_stock: 4500, min_limit: 1000, cost_per_unit: 0.28 },
    { id: 'inv-3', name: 'Fresh Paneer', unit: 'grams', current_stock: 3600, min_limit: 800, cost_per_unit: 0.25 },
    { id: 'inv-4', name: 'Cheddar Cheese', unit: 'slices', current_stock: 140, min_limit: 30, cost_per_unit: 6.00 },
    { id: 'inv-5', name: 'Fresh Vegetables', unit: 'grams', current_stock: 5200, min_limit: 1000, cost_per_unit: 0.08 },
    { id: 'inv-6', name: 'Signature Sauces', unit: 'ml', current_stock: 3800, min_limit: 500, cost_per_unit: 0.12 },
    { id: 'inv-7', name: 'Butter', unit: 'grams', current_stock: 2200, min_limit: 400, cost_per_unit: 0.35 },
    { id: 'inv-8', name: 'Paper Packaging Box', unit: 'pcs', current_stock: 280, min_limit: 50, cost_per_unit: 3.50 }
  ],
  expenses: [
    {
      id: 'exp-1',
      title: 'Fresh Bread Slices & Buns',
      category: 'ingredients',
      amount: 500.00,
      payment_method: 'cash',
      paid_in_cash: true,
      notes: 'Morning wholesale bakery supply',
      expense_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    },
    {
      id: 'exp-2',
      title: 'Biodegradable Takeaway Boxes',
      category: 'packaging',
      amount: 450.00,
      payment_method: 'upi',
      paid_in_cash: false,
      notes: 'Order of 100 craft boxes',
      expense_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    }
  ],
  cash_session: {
    id: 'cs-today',
    session_date: new Date().toISOString().slice(0, 10),
    opening_cash: 1000.00,
    cash_collections: 158.00,
    cash_refunds: 0.00,
    cash_expenses: 500.00,
    status: 'open',
    opened_at: new Date().toISOString()
  },
  feedback: [
    {
      id: 'fb-1',
      order_id: 'ord-100',
      overall_rating: 5,
      food_rating: 5,
      service_rating: 5,
      comments: 'Crispy sandwich, fresh paneer and outstanding mint mayo! Will definitely order again.',
      created_at: new Date(Date.now() - 3 * 3600000).toISOString()
    }
  ],
  settings: {
    business_name: 'RISERS Sandwich Hub',
    tagline: 'Rise Together, Serve Better!',
    contact_phone: '+91 98765 43210',
    stall_address: 'Chalapathi University, Mothadaka, Guntur, Andhra Pradesh – 522016, India',
    upi_id: 'risers@upi',
    opening_hours: '11:00 AM - 10:30 PM',
    is_store_open: true,
    currency_symbol: '₹'
  }
};

// Initialize or load mock database from localStorage
export function getMockDB() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_DATA));
      return DEFAULT_MOCK_DATA;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MOCK_DATA;
  }
}

export function saveMockDB(data) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to mock DB', err);
  }
}

/**
 * Resets scoped mock operational data for maintenance & debugging
 */
export function resetMockDB(resetType) {
  try {
    const db = getMockDB();
    if (resetType === 'clear_test_orders') {
      db.orders = db.orders.filter(o => !o.notes?.toLowerCase().includes('test') && !o.customer_name?.toLowerCase().includes('test'));
    } else if (resetType === 'reset_daily_tokens') {
      db.orders.forEach((o, idx) => { o.token_number = 101 + idx; });
    } else if (resetType === 'clear_completed_queue') {
      db.orders = db.orders.filter(o => o.order_status !== 'completed' && o.order_status !== 'cancelled');
    } else if (resetType === 'reset_all_mock') {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_DATA));
      return { success: true, message: 'Local offline database refreshed to clean defaults.' };
    }
    saveMockDB(db);
    return { success: true, message: 'Operational maintenance reset applied.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
