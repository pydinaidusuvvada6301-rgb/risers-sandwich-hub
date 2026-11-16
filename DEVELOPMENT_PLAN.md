# RISERS Sandwich Hub – Master Development Plan

**Project:** RISERS Sandwich Hub  
**Team:** RISERS  
**Motto / Tagline:** *Rise Together, Serve Better!*  
**Business Category:** Physical/Offline Food & Sandwich Stall with QR-Code Customer Ordering  
**Country:** India  
**Currency:** INR (₹)  
**Primary Stack:** HTML5, CSS3, Vanilla JavaScript ES6+, Supabase (PostgreSQL, Auth, Edge Functions, RLS, Realtime), Vite, Vercel  

---

## 1. Project Overview & Architectural Boundaries

RISERS Sandwich Hub is designed specifically for an offline quick-service sandwich stall operating in India.
Customers arrive at or near the physical stall, scan a table/counter QR code, view the live digital menu on their smartphones, customize their order, and submit it.
Payment is made at the stall (either by cash or through UPI to the stall's UPI ID/QR code). Stall cashiers/managers verify and confirm the payment on the admin dashboard, triggering instant kitchen dispatch via the live Kitchen Display System (KDS). Customers track their order status via a dedicated token and secure tracking reference.

### Crucial Project Independence Rule
- **Zero cross-contamination:** This project is completely distinct and isolated from any previous projects (such as CareerPivot AI).
- No shared database credentials, no shared APIs, no shared storage, and no shared repository.

---

## 2. Phased Development Roadmap

```
+-----------------------------------------------------------------------------------+
| Phase 1: Setup & Documentation                                                    |
| - Repository initialization, Vite configuration, dependencies, complete docs      |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Phase 2: Database Architecture, Migrations & Edge Functions                       |
| - 19 PostgreSQL tables, RLS policies, daily token generator, Edge Functions       |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Phase 3: Brand Styling, CSS Architecture & Shared Utilities                       |
| - Custom typography, warm roasted palette, modular responsive CSS, utils & export|
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Phase 4: Customer-Facing Ordering Web App                                         |
| - Home, dynamic Menu, Cart, Checkout, Realtime Tracking, and Customer Feedback    |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Phase 5: Admin Access Code Gate & Supabase Role-Based Authentication             |
| - Edge-verified ADMIN_ACCESS_CODE gate, rate-limiting, secure RBAC                |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Phase 6: Admin Dashboard & Business Management Modules                            |
| - Dashboard KPIs, Orders, Kitchen Display, Cash & UPI Payments, Downloadable      |
|   Transactions (CSV, XLSX, PDF, Receipt), Products, Inventory, Expenses,         |
|   Cash Register (Opening/Closing balance), Reports, Staff & Settings              |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Phase 7: Testing, Verification & Production Deployment Preparation                |
| - End-to-end user & admin flow tests, print QR generator, deployment guide        |
+-----------------------------------------------------------------------------------+
```

---

## 3. Milestone Breakdown

### Milestone 1: Workspace Initialization & Documentation [IN PROGRESS]
- [x] Workspace inspection and confirmation of clean directory
- [x] Multi-page Vite configuration (`vite.config.js`)
- [x] Package dependencies setup (`@supabase/supabase-js`, `xlsx`, `jspdf`, `jspdf-autotable`, `qrcode`)
- [ ] `README.md`
- [x] `DEVELOPMENT_PLAN.md`
- [ ] `DATABASE_SCHEMA.md`
- [ ] `API_DOCUMENTATION.md`
- [ ] `SECURITY.md`
- [ ] `TESTING_CHECKLIST.md`
- [ ] `DEPLOYMENT_GUIDE.md`

### Milestone 2: Supabase Schema, RLS & Edge Functions
- [ ] Complete SQL migration script (`supabase/migrations/20261116000000_risers_initial_schema.sql`)
- [ ] Idempotent seed data (`supabase/seed.sql`) containing Chicken Sandwich (₹99) and Paneer Sandwich (₹79)
- [ ] Concurrency-safe atomic token sequence generator
- [ ] Supabase Edge Functions:
  - `create-order`: Server-side price calculation, token generation, order placement
  - `verify-admin-code`: Brute-force protected comparison of `ADMIN_ACCESS_CODE`
  - `confirm-payment`: Cashier verification & auditable payment logging
  - `update-order-status`: State machine validation & atomic recipe inventory deduction
  - `export-transactions`: Secure backend transaction data retrieval
  - `admin-operations`: User role assignments, settings management

### Milestone 3: Design System & Shared Frontend Libraries
- [ ] CSS architecture: `global.css`, `components.css`, `customer.css`, `admin.css`, `responsive.css`
- [ ] Brand palette: Amber Roasted Gold, Deep Charcoal, Fresh Crisp Emerald, Clean Cream
- [ ] Client libraries: `supabase.js` (with local test/demo fallback), `utils.js`, `validation.js`, `notifications.js`, `export.js`

### Milestone 4: Customer Ordering Experience
- [ ] `index.html`: Hero, Featured Sandwiches, Brand Story, Customer Reviews, Stall Details
- [ ] `menu.html`: Live Supabase menu, Veg/Non-Veg filter, pricing, Add to Cart
- [ ] `checkout.html`: Responsive cart summary, 10-digit Indian mobile validation, Cash/UPI stall selector
- [ ] `track-order.html`: Live status pipeline (Received -> Preparing -> Ready -> Completed)
- [ ] `feedback.html`: Post-order 5-star ratings and customer comments

### Milestone 5: Admin Security Gate & Authentication
- [ ] `admin/index.html`: Access code verification gate
- [ ] `admin/login.html`: Supabase Auth login form with role redirect
- [ ] Client-side route guards verifying role tokens and session validity

### Milestone 6: Admin Management Hub
- [ ] `admin/dashboard.html`: Realtime metrics (Orders, Revenue, Cash vs UPI, Expenses, Low Stock)
- [ ] `admin/orders.html`: Search, filter, status advancement, printable order ticket
- [ ] `admin/kitchen.html`: Dedicated KDS with large touchscreen cards & audio chime
- [ ] `admin/payments.html`: Verify Cash & UPI at stall with cashier name attribution
- [ ] `admin/transactions.html`: Full filterable table + CSV, Excel (.xlsx), PDF Statement, and Receipt downloads
- [ ] `admin/products.html`: Dynamic catalog & price editor
- [ ] `admin/inventory.html`: Stock levels, minimum thresholds, purchase records
- [ ] `admin/expenses.html`: Expense tracker with category breakdown
- [ ] `admin/cash-register.html`: Opening/Closing physical cash reconciliation
- [ ] `admin/feedback.html`: Customer reviews overview
- [ ] `admin/reports.html`: Profit & Loss, sales breakdown
- [ ] `admin/staff.html`: Role assignment (Owner, Manager, Cashier, Kitchen)
- [ ] `admin/settings.html`: Stall profile, UPI QR code, printable stall table QR generator

### Milestone 7: Verification & Launch Checklist
- [ ] Local build and preview verification
- [ ] End-to-end test execution across customer & admin workflows
- [ ] Export file validation (CSV, XLSX, PDF generation)
- [ ] Final launch instructions
