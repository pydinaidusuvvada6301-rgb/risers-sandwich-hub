# RISERS Sandwich Hub – Database Schema Documentation

This document describes the PostgreSQL relational database architecture hosted on Supabase for RISERS Sandwich Hub.

---

## 1. Schema Diagram Overview

```
                                  +-------------------+
                                  |    auth.users     |
                                  +-------------------+
                                            │
                                            ▼
+---------------------+           +-------------------+
|  token_sequences    |           |    admin_users    |
+---------------------+           +-------------------+
                                            │
                                            ▼
+---------------------+           +-------------------+
|      customers      |           |    audit_logs     |
+---------------------+           +-------------------+
           │
           ▼
+---------------------+           +-------------------+
|       orders        |◀──────────|  daily_cash_sess. |
+---------------------+           +-------------------+
      │         │
      │         ▼
      │   +---------------------+
      │   |     order_items     |
      │   +---------------------+
      │              │
      │              ▼
      │   +---------------------+
      │   |      products       |
      │   +---------------------+
      │              │
      │              ▼
      │   +---------------------+
      │   |   product_recipes   |
      │   +---------------------+
      │              │
      │              ▼
      │   +---------------------+
      │   | recipe_ingredients  |
      │   +---------------------+
      │              │
      │              ▼
      │   +---------------------+           +-------------------+
      │   |      inventory      |◀──────────|  inv_transactions |
      │   +---------------------+           +-------------------+
      │
      ├─────────────────────────┐
      ▼                         ▼
+---------------------+   +---------------------+
|      payments       |   |      feedback       |
+---------------------+   +---------------------+
      │
      ▼
+---------------------+
|   payment_events    |
+---------------------+
```

---

## 2. Table Specifications

### 2.1 `admin_users`
Stores staff profile and role attributes linked to Supabase `auth.users`.
- `id` (UUID, PK, References `auth.users.id` ON DELETE CASCADE)
- `email` (TEXT, UNIQUE, NOT NULL)
- `full_name` (TEXT, NOT NULL)
- `role` (TEXT, NOT NULL, CHECK: `role IN ('owner', 'manager', 'cashier', 'kitchen')`)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.2 `customers`
Lightweight registry of customers identified primarily by mobile number.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `name` (TEXT, NOT NULL)
- `phone` (TEXT, UNIQUE, NOT NULL)
- `total_orders` (INTEGER, DEFAULT 0)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.3 `products`
The sandwich and beverage menu items.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `name` (TEXT, NOT NULL)
- `slug` (TEXT, UNIQUE, NOT NULL)
- `category` (TEXT, DEFAULT 'sandwiches')
- `description` (TEXT)
- `price` (NUMERIC(10,2), NOT NULL CHECK (price >= 0))
- `cost_price` (NUMERIC(10,2), DEFAULT 0.00 CHECK (cost_price >= 0))
- `image_url` (TEXT)
- `is_veg` (BOOLEAN, DEFAULT true)
- `is_available` (BOOLEAN, DEFAULT true)
- `is_active` (BOOLEAN, DEFAULT true)
- `display_order` (INTEGER, DEFAULT 0)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.4 `orders`
The central order ledger.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `order_number` (TEXT, UNIQUE, NOT NULL) -- Format: RSH-YYYYMMDD-XXXX
- `token_number` (INTEGER, NOT NULL) -- Daily sequential token (e.g., 101, 102)
- `customer_id` (UUID, References `customers.id`)
- `customer_name` (TEXT, NOT NULL)
- `customer_phone` (TEXT, NOT NULL)
- `order_status` (TEXT, NOT NULL DEFAULT 'received' CHECK: `order_status IN ('received', 'preparing', 'ready', 'completed', 'cancelled')`)
- `payment_status` (TEXT, NOT NULL DEFAULT 'pending' CHECK: `payment_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'voided')`)
- `payment_method` (TEXT, NOT NULL CHECK: `payment_method IN ('cash', 'upi')`)
- `subtotal_amount` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
- `discount_amount` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
- `total_amount` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
- `notes` (TEXT)
- `tracking_hash` (TEXT, UNIQUE, NOT NULL) -- Cryptographic reference for secure customer tracking
- `cancelled_reason` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.5 `order_items`
Line items with historical price snapshots.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `order_id` (UUID, NOT NULL References `orders.id` ON DELETE CASCADE)
- `product_id` (UUID, References `products.id`)
- `product_name` (TEXT, NOT NULL) -- Snapshot
- `unit_price` (NUMERIC(10,2), NOT NULL) -- Snapshot
- `quantity` (INTEGER, NOT NULL CHECK (quantity > 0))
- `subtotal` (NUMERIC(10,2), NOT NULL)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.6 `payments`
Physical stall payments (Cash / UPI) verified by cashier/staff.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `order_id` (UUID, NOT NULL References `orders.id` ON DELETE RESTRICT)
- `payment_method` (TEXT, NOT NULL CHECK: `payment_method IN ('cash', 'upi')`)
- `amount` (NUMERIC(10,2), NOT NULL CHECK (amount > 0))
- `payment_status` (TEXT, NOT NULL DEFAULT 'paid' CHECK: `payment_status IN ('paid', 'refunded', 'adjusted')`)
- `upi_reference` (TEXT) -- UPI transaction UTR / reference entered by cashier if UPI
- `verified_by` (UUID, References `admin_users.id`)
- `cashier_name` (TEXT)
- `confirmed_at` (TIMESTAMPTZ, DEFAULT NOW())
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.7 `payment_events`
Append-only audit trail for all payment operations.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `payment_id` (UUID, References `payments.id`)
- `order_id` (UUID, References `orders.id`)
- `event_type` (TEXT, NOT NULL) -- 'CONFIRMED', 'REFUNDED', 'ADJUSTED'
- `amount` (NUMERIC(10,2), NOT NULL)
- `performed_by` (UUID, References `admin_users.id`)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.8 `feedback`
Post-completion customer satisfaction reviews.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `order_id` (UUID, UNIQUE, NOT NULL References `orders.id` ON DELETE CASCADE)
- `overall_rating` (INTEGER, NOT NULL CHECK (overall_rating BETWEEN 1 AND 5))
- `food_rating` (INTEGER, CHECK (food_rating BETWEEN 1 AND 5))
- `service_rating` (INTEGER, CHECK (service_rating BETWEEN 1 AND 5))
- `comments` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.9 `inventory`
Raw ingredients tracked at the physical stall.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `name` (TEXT, UNIQUE, NOT NULL) -- Bread, Chicken, Paneer, Cheese, Butter, etc.
- `unit` (TEXT, NOT NULL) -- 'slices', 'grams', 'ml', 'pcs'
- `current_stock` (NUMERIC(12,2), NOT NULL DEFAULT 0.00)
- `min_limit` (NUMERIC(12,2), NOT NULL DEFAULT 10.00)
- `cost_per_unit` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.10 `inventory_transactions`
Auditable stock mutations.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `inventory_id` (UUID, NOT NULL References `inventory.id`)
- `change_amount` (NUMERIC(12,2), NOT NULL) -- Positive for purchase, negative for usage
- `reason` (TEXT, NOT NULL) -- 'order_prep', 'purchase', 'wastage', 'manual_adjustment'
- `order_id` (UUID, References `orders.id`)
- `created_by` (UUID, References `admin_users.id`)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.11 `product_recipes` & 2.12 `recipe_ingredients`
Recipe mapping for automatic inventory deduction when order enters preparation.
- `product_recipes`: `(id, product_id, name)`
- `recipe_ingredients`: `(id, recipe_id, inventory_id, quantity_required)`

### 2.13 `expenses`
Stall operational overheads.
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `title` (TEXT, NOT NULL)
- `category` (TEXT, NOT NULL CHECK: `category IN ('ingredients', 'packaging', 'transportation', 'rent', 'electricity', 'equipment', 'marketing', 'other')`)
- `amount` (NUMERIC(10,2), NOT NULL CHECK (amount > 0))
- `payment_method` (TEXT, NOT NULL CHECK: `payment_method IN ('cash', 'upi', 'bank_transfer')`)
- `paid_in_cash` (BOOLEAN, DEFAULT false) -- Essential for cash register balance formula
- `notes` (TEXT)
- `receipt_url` (TEXT)
- `expense_date` (DATE NOT NULL DEFAULT CURRENT_DATE)
- `created_by` (UUID, References `admin_users.id`)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.14 `daily_cash_sessions`
Physical cash register drawer reconciliation.
- Formula:
  $$\text{Expected Cash} = \text{Opening Cash} + \text{Cash Collections} - \text{Cash Refunds} - \text{Cash Expenses Paid in Cash}$$
- Columns:
  - `id` (UUID, PK)
  - `session_date` (DATE NOT NULL DEFAULT CURRENT_DATE)
  - `opened_by` (UUID, References `admin_users.id`)
  - `closed_by` (UUID, References `admin_users.id`)
  - `opening_cash` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
  - `cash_collections` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
  - `cash_refunds` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
  - `cash_expenses` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
  - `expected_closing_cash` (NUMERIC(10,2), NOT NULL DEFAULT 0.00)
  - `actual_closing_cash` (NUMERIC(10,2))
  - `cash_difference` (NUMERIC(10,2))
  - `status` (TEXT, DEFAULT 'open' CHECK: `status IN ('open', 'closed')`)
  - `notes` (TEXT)
  - `opened_at` (TIMESTAMPTZ, DEFAULT NOW())
  - `closed_at` (TIMESTAMPTZ)

### 2.15 `token_sequences`
Concurrency-safe atomic daily token reset.
- `sequence_date` (DATE, PRIMARY KEY)
- `last_token` (INTEGER, NOT NULL DEFAULT 100)

### 2.16 `audit_logs`
System-wide admin action recording.

### 2.17 `admin_access_attempts`
Brute-force protection tracking for the `ADMIN_ACCESS_CODE` gate.
- Tracks IP hash, attempt timestamp, status, and temporary lockout expiration.

### 2.18 `business_settings`
Configurable business metadata (Stall name, UPI ID, QR link, operational hours, banner alerts).

### 2.19 `order_status_history`
Chronological status transition timeline for every order.
