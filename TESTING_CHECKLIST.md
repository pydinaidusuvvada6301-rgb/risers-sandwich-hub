# RISERS Sandwich Hub – Quality Assurance & Testing Checklist

This checklist is maintained throughout development and verified before release.

---

## 1. Customer Ordering Flow Testing

- [ ] **Home Page (`index.html`)**
  - [ ] Page renders with hero banner, logo, and tagline "Rise Together, Serve Better!"
  - [ ] Featured sandwiches displayed (Chicken Sandwich ₹99, Paneer Sandwich ₹79)
  - [ ] "Order Now" and "Explore Menu" buttons navigate correctly to `menu.html`
  - [ ] Mobile responsive layout renders cleanly with touch navigation
- [ ] **Menu Page (`menu.html`)**
  - [ ] Menu items load dynamically from Supabase `products` table
  - [ ] Product cards show name, price in ₹, description, dietary badge (Veg/Non-veg)
  - [ ] Quantity selector (+ / -) adjusts counts cleanly
  - [ ] "Add to Cart" updates the cart count and drawer/bar
  - [ ] Out of stock / unavailable items cannot be added
- [ ] **Cart & Checkout (`checkout.html`)**
  - [ ] Cart persists items across page navigation in `localStorage`
  - [ ] Subtotal and total amounts accurately reflect item quantities
  - [ ] Indian mobile number validation (exactly 10 digits, starts with 6, 7, 8, or 9)
  - [ ] Customer name validation (required, sanitized)
  - [ ] Payment method selection: "Cash at Stall" vs "UPI at Stall"
  - [ ] Order submission sends request with idempotency protection
  - [ ] Double-click prevention on "Place Order" button
  - [ ] Successful submission clears cart and redirects to tracking page with tracking hash
- [ ] **Order Tracking (`track-order.html`)**
  - [ ] Loads order details via secure `tracking_hash` (does not expose other orders)
  - [ ] Displays unique Order Number and sequential Token Number (e.g., #101)
  - [ ] Shows live visual timeline: Received ➔ Preparing ➔ Ready for Collection ➔ Completed
  - [ ] Supabase Realtime subscription updates status automatically without page refresh
  - [ ] Clear stall collection instructions displayed to customer
- [ ] **Feedback (`feedback.html`)**
  - [ ] Allows submission only for orders in `completed` status
  - [ ] 5-star rating controls for overall, food, and service
  - [ ] Prevents duplicate reviews for the same order

---

## 2. Admin & Security Gate Testing

- [ ] **Admin Security Gate (`admin/index.html`)**
  - [ ] Access code prompt appears
  - [ ] Submitting incorrect code displays clear error without revealing code
  - [ ] Rate-limiting triggers after repeated failed attempts
  - [ ] Submitting valid `ADMIN_ACCESS_CODE` unlocks access to login
- [ ] **Admin Authentication (`admin/login.html`)**
  - [ ] Supabase email/password login functions properly
  - [ ] Invalid credentials display friendly notification
  - [ ] Verifies active staff account in `admin_users`
  - [ ] Redirects to dashboard according to assigned role permissions
  - [ ] Unauthenticated direct access to `/admin/dashboard.html` redirects to gate/login
- [ ] **Role-Based Access Enforcement**
  - [ ] Kitchen staff restricted from payments, expenses, and settings
  - [ ] Cashier restricted from inventory configuration, reports, and staff management
  - [ ] Manager restricted from staff role escalation and sensitive settings
  - [ ] Owner has unrestricted business access

---

## 3. Operations & Business Management Testing

- [ ] **Admin Dashboard (`admin/dashboard.html`)**
  - [ ] Realtime KPI counters (Today's Orders, Paid Sales, Pending Payments, Expenses)
  - [ ] Sales charts render without errors
  - [ ] Date filtering (Today, Yesterday, 7 Days, 30 Days) updates numbers accurately
  - [ ] Realtime badge alerts on new incoming orders
- [ ] **Order Management (`admin/orders.html`)**
  - [ ] Order list displays customer name, token, total, and status badges
  - [ ] Search by order number and customer token
  - [ ] Filter by order status and payment status
  - [ ] Modal shows full itemized order breakdown
  - [ ] Status transition buttons advance order correctly
  - [ ] Cancel order requires a reason and updates record
  - [ ] "Print Ticket" generates clean thermal/receipt format
- [ ] **Kitchen Display System (`admin/kitchen.html`)**
  - [ ] Large touch-friendly cards for active orders
  - [ ] Realtime automatic card addition when new order is placed
  - [ ] Sound/audio chime toggle for kitchen alerts
  - [ ] One-click action: "Start Preparing" and "Mark Ready"
- [ ] **Payment Verification (`admin/payments.html`)**
  - [ ] Pending orders listed clearly with amount due
  - [ ] Confirm Cash payment records exact amount and cashier identity
  - [ ] Confirm UPI payment records UTR reference and cashier identity
  - [ ] Cash drawer session updated accordingly
- [ ] **Downloadable Transactions (`admin/transactions.html`)**
  - [ ] Complete transaction ledger with columns 1-12
  - [ ] Search by Transaction ID, Order Number, or UTR reference
  - [ ] Filter by date range (Today, 7d, 30d, Custom) and method (Cash, UPI)
  - [ ] **CSV Export:** Generates valid RFC-compliant CSV with headers and escaped commas
  - [ ] **Excel Export (.xlsx):** Generates valid spreadsheet via SheetJS with formatted columns and totals
  - [ ] **PDF Statement:** Generates branded RISERS summary statement with totals via jsPDF
  - [ ] **Individual Receipt PDF:** Downloads printable transaction receipt
- [ ] **Product Catalog (`admin/products.html`)**
  - [ ] Lists Chicken Sandwich (₹99) and Paneer Sandwich (₹79)
  - [ ] Add new item form with price and cost price
  - [ ] Toggle availability (Instantly reflects on customer menu)
- [ ] **Inventory & Recipe Management (`admin/inventory.html`)**
  - [ ] Displays stock levels for Bread, Chicken, Paneer, Cheese, Sauces, Butter, Packaging
  - [ ] Low-stock warning when stock < min_limit
  - [ ] Manual stock adjustment records audit reason and user
  - [ ] Order entering "preparing" status automatically deducts recipe ingredients
- [ ] **Expense Tracker (`admin/expenses.html`)**
  - [ ] Log operational expenses with category and payment method
  - [ ] Cash expenses properly flagged for cash register formula
  - [ ] Export expense ledger to CSV/XLSX/PDF
- [ ] **Cash Register Drawer (`admin/cash-register.html`)**
  - [ ] Open daily session with opening float
  - [ ] Accurately calculates Expected Cash:
    $$\text{Expected} = \text{Opening} + \text{Cash Collections} - \text{Cash Refunds} - \text{Cash Expenses}$$
  - [ ] Excludes UPI transactions from physical cash balance
  - [ ] Close session records actual counted cash, difference, and variance note
- [ ] **Business Reports (`admin/reports.html`)**
  - [ ] Profit & Loss breakdown (Revenue - Ingredient Cost - Overhead Expenses)
  - [ ] Separates cash collections vs UPI collections
  - [ ] Excludes unpaid orders from realized revenue
- [ ] **Settings & Stall QR Generator (`admin/settings.html`)**
  - [ ] Manage stall profile, operating hours, and UPI ID
  - [ ] Generate downloadable high-resolution QR code linking to deployed production URL
