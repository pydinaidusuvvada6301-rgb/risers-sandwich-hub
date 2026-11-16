# RISERS Sandwich Hub – Security Architecture & Rules

This document outlines the security policies, access controls, and data protection measures implemented across RISERS Sandwich Hub.

---

## 1. Core Security Principles

1. **Defense in Depth:** Security is enforced at the database level (PostgreSQL RLS), API layer (Edge Functions with JWT validation), and client interface.
2. **Zero Client Trust:** The frontend is treated as completely untrusted:
   - Item prices submitted by the browser are discarded; server recalculates from DB.
   - Payments can NEVER be marked as received or verified by the customer.
   - Customers can never view other customers' orders or mobile numbers.
3. **Strict Separation of Secrets:**
   - `ADMIN_ACCESS_CODE` is stored strictly as a Supabase Edge Function server secret. It is NEVER placed in frontend code, environment variables prefixed with `VITE_`, or client bundles.
   - `SUPABASE_SERVICE_ROLE_KEY` is strictly used within secure Edge Functions; never exported to browser.

---

## 2. Row Level Security (RLS) Policies

All 19 tables in PostgreSQL have Row Level Security enabled (`ENABLE ROW LEVEL SECURITY`).

### 2.1 Public Tables (Customer Access)
- **`products`**: Public `SELECT` allowed only for rows where `is_active = true`. Modifications restricted to `owner` and `manager`.
- **`orders`**:
  - `INSERT`: Through service role in `create-order` Edge Function.
  - `SELECT`: Customers may select an order ONLY by providing matching `tracking_hash`. Customer cannot list or search all orders.
- **`feedback`**:
  - `INSERT`: Allowed if order exists, is in status `completed`, and no previous feedback has been recorded for this `order_id`.
- **`business_settings`**: Public `SELECT` for public metadata (name, tagline, UPI ID, opening hours).

### 2.2 Staff & Financial Tables (Restricted Access)
- **`payments`, `payment_events`, `expenses`, `daily_cash_sessions`, `audit_logs`**:
  - Public access: `DENY ALL`
  - Authenticated access: Enforces role check via helper function `get_auth_role()`.
    - `owner`: Full `SELECT`, `INSERT`, `UPDATE`.
    - `manager`: Full `SELECT`, `INSERT`, `UPDATE` (except system settings & staff role escalation).
    - `cashier`: `SELECT` orders & payments; `INSERT` payments and cash session entries; No access to general expenses or staff config.
    - `kitchen`: `SELECT` active kitchen orders (`order_status IN ('received', 'preparing', 'ready')`); No financial columns or payment info exposed.

---

## 3. Special Admin Access Code Gate Workflow

To prevent unauthorized automated scanning of the admin login endpoint:
1. Public navigation does not link to the admin area.
2. Direct navigation to `/admin/` presents a security code challenge.
3. The entered code is submitted to `verify-admin-code` Edge Function.
4. The server applies rate-limiting: maximum 5 attempts per 15 minutes per IP address.
5. Verification uses constant-time string comparison (`timingSafeEqual`) to prevent timing attacks.
6. The code is never returned in any response, and successful verification issues a temporary signed gate token that displays the Supabase Auth login screen.
7. Actual dashboard access requires valid Supabase Auth credentials AND an active row in `admin_users` with an authorized role.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Module / Action | Owner | Manager | Cashier | Kitchen | Customer |
|---|:---:|:---:|:---:|:---:|:---:|
| Browse Menu | ✅ | ✅ | ✅ | ✅ | ✅ |
| Place Order | ✅ | ✅ | ✅ | ✅ | ✅ |
| Track Own Order | ✅ | ✅ | ✅ | ✅ | ✅ |
| View All Orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| Kitchen Display (KDS) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Advance Prep Status | ✅ | ✅ | ❌ | ✅ | ❌ |
| Confirm Cash/UPI Payment | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cash Register Reconciliation | ✅ | ✅ | ✅ | ❌ | ❌ |
| Download Transactions (CSV/XLSX/PDF)| ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Menu & Prices | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Inventory & Stock | ✅ | ✅ | ❌ | ❌ | ❌ |
| Record Expenses | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Financial Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Staff Accounts | ✅ | ❌ | ❌ | ❌ | ❌ |
| Business Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
