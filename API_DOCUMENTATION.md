# RISERS Sandwich Hub – API & Edge Functions Documentation

This document describes the API interface, Supabase Edge Functions, and server endpoints for RISERS Sandwich Hub.

---

## 1. Overview & Security Architecture

Public clients (customers) communicate with the backend through:
1. **Supabase Edge Functions** for atomic operations requiring server validation (creating orders, verifying the access code).
2. **Supabase PostgREST client** with strict Row Level Security (RLS) for read-only catalog browsing and authenticated staff operations.

---

## 2. Supabase Edge Functions

### 2.1 `POST /functions/v1/create-order`
Creates a new customer order with server-calculated totals and concurrency-safe token generation.

**Access:** Public (Rate-limited)

**Request Body:**
```json
{
  "customer_name": "Arjun Sharma",
  "customer_phone": "9876543210",
  "payment_method": "cash", // or "upi"
  "notes": "Extra spicy, toasted well",
  "items": [
    {
      "product_id": "00000000-0000-0000-0000-000000000001",
      "quantity": 2
    },
    {
      "product_id": "00000000-0000-0000-0000-000000000002",
      "quantity": 1
    }
  ],
  "idempotency_key": "unique-client-guid-to-prevent-double-orders"
}
```

**Server Processing:**
1. Validates phone number (10-digit Indian standard format).
2. Queries database for current prices of `product_id`s (never trusts browser prices).
3. Verifies products are active and available.
4. Generates order number: `RSH-YYYYMMDD-XXXX`.
5. Calls PostgreSQL function `generate_daily_token()` for concurrency-safe sequential token (e.g., 101, 102).
6. Generates high-entropy cryptographic tracking hash for secure public order lookup.
7. Inserts `orders` and `order_items` in a single transaction.
8. Logs initial status in `order_status_history`.

**Response (201 Created):**
```json
{
  "success": true,
  "order": {
    "order_number": "RSH-20261116-0101",
    "token_number": 101,
    "tracking_hash": "a9f8b7c6d5e4f3a2b1...",
    "subtotal": 277.00,
    "total": 277.00,
    "payment_method": "cash",
    "payment_status": "pending",
    "order_status": "received"
  }
}
```

---

### 2.2 `POST /functions/v1/verify-admin-code`
Validates the special admin gate access code against the secret server configuration `ADMIN_ACCESS_CODE`.

**Access:** Public (With rate-limiting & temporary lockout on repeated failures)

**Request Body:**
```json
{
  "code": "SUPPLIED_CODE"
}
```

**Server Processing:**
1. Checks client IP and attempt count in `admin_access_attempts`.
2. Rejects with 429 if rate limit exceeded (>5 failed attempts in 15 minutes).
3. Performs constant-time timing-safe comparison with environment variable `ADMIN_ACCESS_CODE`.
4. If invalid: increments failed counter, logs attempt, returns 401 Unauthorized.
5. If valid: resets failure counter, issues a short-lived signed access ticket (HMAC token) allowing access to the Supabase login screen.

**Response (200 OK):**
```json
{
  "success": true,
  "gate_token": "signed.access.ticket"
}
```

---

### 2.3 `POST /functions/v1/confirm-payment`
Confirms receipt of physical stall payment (Cash or UPI) by an authorized cashier or manager.

**Access:** Authenticated Staff (Role: `cashier`, `manager`, `owner`)

**Request Body:**
```json
{
  "order_id": "00000000-0000-0000-0000-000000000000",
  "payment_method": "cash", // or "upi"
  "amount_received": 277.00,
  "upi_reference": "UTR123456789012" // required if UPI
}
```

**Server Processing:**
1. Verifies caller JWT and role from `admin_users`.
2. Validates `amount_received` matches or satisfies order total.
3. Inserts row into `payments` table with `verified_by = auth.uid()`.
4. Creates audit log in `payment_events`.
5. Updates `orders.payment_status = 'paid'`.
6. Broadcasts payment update via Supabase Realtime channel `stall-orders`.

---

### 2.4 `POST /functions/v1/update-order-status`
Progresses order lifecycle status.

**Access:** Authenticated Staff (`kitchen`, `cashier`, `manager`, `owner`)

**Status Transitions Allowed:**
- `received` -> `preparing` (Deducts recipe inventory atomically)
- `preparing` -> `ready` (Dispatches notification to customer tracking view)
- `ready` -> `completed`
- Any non-completed status -> `cancelled` (with required reason, restores inventory if deducted)

---

### 2.5 `POST /functions/v1/export-transactions`
Provides paginated or filtered financial data export for authorized personnel.

**Access:** Authenticated Staff (`owner`, `manager`)

**Filters:**
- Date ranges (`today`, `yesterday`, `last_7_days`, `last_30_days`, `custom`)
- Payment methods (`cash`, `upi`)
- Payment status (`paid`, `refunded`, `pending`)

**Format:** Returns structured JSON array sanitized of sensitive private details, ready for local rendering or direct stream download.
