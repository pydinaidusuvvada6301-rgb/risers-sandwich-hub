# RISERS Sandwich Hub 🥪

> **Motto:** *Rise Together, Serve Better!*  
> **Business Category:** Quick Service Sandwich Stall with QR-Code Digital Ordering & Realtime Operations  
> **Location:** India | **Currency:** INR (₹)  

---

## 🌟 About the Project

**RISERS Sandwich Hub** is a full-featured, production-ready web application engineered for physical food stalls. It bridges the gap between offline counter operations and modern digital convenience:

1. **For Customers:** Scan stall QR code ➔ Browse dynamic menu ➔ Build cart ➔ Place order with Cash or UPI at stall ➔ Track live progress on smartphone with token number.
2. **For Kitchen Staff:** Tablet-optimized Kitchen Display System (KDS) with audio chimes and one-touch status transitions.
3. **For Cashiers:** Fast Cash and UPI confirmation, order lookup, and daily physical drawer reconciliation.
4. **For Business Owners & Managers:** Comprehensive dashboard, catalog management, inventory control with recipe auto-deduction, expense ledger, profit & loss reports, and full transaction export to CSV, Excel, and PDF.

---

## 🚀 Key Features

- **Double-Gated Admin Access:** Direct admin access requires entering a secret `ADMIN_ACCESS_CODE` (verified server-side with brute-force rate-limiting) before displaying the Supabase Authentication login.
- **Role-Based Access Control (RBAC):** Strict permissions for Owner, Manager, Cashier, and Kitchen Staff.
- **Physical Stall Payment Workflows:** Distinguishes between Cash and UPI. Payments are confirmed only upon physical receipt by cashier.
- **Audit-Ready Financials:** Download transaction statements in **CSV**, **Excel (.xlsx)** via SheetJS, **PDF statements** via jsPDF, and individual transaction receipts.
- **Physical Cash Register (Drawer) Reconciliation:**
  $$\text{Expected Cash} = \text{Opening} + \text{Cash Collections} - \text{Cash Refunds} - \text{Cash Expenses (Paid in Cash)}$$
- **Concurrency-Safe Token Generator:** Daily sequential customer tokens (101, 102...) backed by database sequence functions.
- **Realtime Operations:** Supabase Realtime delivers instant updates to KDS, cashier screens, and customer order tracking.

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript ES6+ (No React/Angular/Vue dependencies)
- **Tooling:** Node.js, npm, Vite
- **Backend:** Supabase (PostgreSQL, Supabase Auth, Row Level Security, Edge Functions, Realtime)
- **Reporting & Export:** SheetJS (`xlsx`), jsPDF, jsPDF-AutoTable, QRCode
- **Hosting:** Vercel

---

## 💻 Local Quickstart (Windows 11 PowerShell)

### 1. Install Dependencies
```powershell
npm.cmd install
```

### 2. Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Update `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

### 3. Run Development Server
```powershell
npm.cmd run dev
```
Open your browser at `http://localhost:5173`.

---

## 📂 Project Structure

```
RISERS-SANDWICH2/
├── index.html                 # Customer Home Page
├── menu.html                  # Live Dynamic Menu
├── checkout.html              # Cart & Stall Checkout
├── track-order.html           # Live Realtime Order Tracker
├── feedback.html              # Post-Meal Rating & Comments
├── about.html                 # Brand Story & Standards
├── contact.html               # Stall Location & Contact
│
├── admin/
│   ├── index.html             # Admin Access Gate (Secret Code Challenge)
│   ├── login.html             # Supabase Auth Login
│   ├── dashboard.html         # Realtime KPIs & Business Charts
│   ├── orders.html            # Order Management & Thermal Ticket Print
│   ├── kitchen.html           # Touchscreen Kitchen Display System (KDS)
│   ├── payments.html          # Cash & UPI Payment Verification
│   ├── transactions.html      # CSV, Excel, PDF Statements & Receipts
│   ├── products.html          # Menu & Pricing Management
│   ├── inventory.html         # Stock Control & Low-Stock Alerts
│   ├── expenses.html          # Operational Expense Tracker
│   ├── cash-register.html     # Physical Cash Drawer Reconciliation
│   ├── feedback.html          # Customer Reviews & Satisfaction
│   ├── reports.html           # Profit & Loss Reports
│   ├── staff.html             # RBAC Staff Management
│   └── settings.html          # Business Settings & Printable QR Code
│
├── css/
│   ├── global.css             # Theme, Variables & Base Styles
│   ├── components.css         # UI Components, Modals, Buttons, Badges
│   ├── customer.css           # Customer Interface Layouts
│   ├── admin.css              # Dashboard & Admin Modules
│   └── responsive.css         # Mobile & Tablet Adaptations
│
├── js/
│   ├── config/supabase.js     # Supabase Client & Local Mock Fallback
│   ├── customer/              # Customer-facing JS modules
│   ├── admin/                 # Admin module controllers
│   └── shared/                # Utilities, Validation, Alerts & Export
│
├── supabase/
│   ├── migrations/            # Complete PostgreSQL Schema & RLS
│   ├── functions/             # Secure Deno Edge Functions
│   └── seed.sql               # Chicken Sandwich (₹99), Paneer Sandwich (₹79)
│
├── DEVELOPMENT_PLAN.md
├── DATABASE_SCHEMA.md
├── API_DOCUMENTATION.md
├── SECURITY.md
├── TESTING_CHECKLIST.md
└── DEPLOYMENT_GUIDE.md
```

---

## 🔒 Security Best Practices

- `ADMIN_ACCESS_CODE` is NEVER committed or exposed to the client.
- Price validation occurs strictly server-side.
- Row Level Security (RLS) is active on every single table.
- Cashier identity is stamped on all payment confirmations.
