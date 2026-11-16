# RISERS Sandwich Hub – Production Deployment Guide

This guide provides end-to-end instructions for deploying RISERS Sandwich Hub to Supabase, GitHub, and Vercel.

---

## 1. Prerequisites

- A GitHub Account
- A Vercel Account
- A Supabase Account (Separate from any other projects)
- Node.js v18+ and npm installed locally

---

## 2. Supabase Project Setup

### Step 2.1: Create a New Supabase Project
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project**.
3. Name the project: `RISERS-Sandwich-Hub`.
4. Choose an Indian or nearby region (e.g., `AWS Mumbai - ap-south-1`).
5. Set a strong database password and save it securely.

### Step 2.2: Execute Database Migrations
1. Navigate to the **SQL Editor** in the Supabase Dashboard.
2. Open `supabase/migrations/20261116000000_risers_initial_schema.sql` from this repository.
3. Paste the contents into a new query window and click **Run**.
4. Next, open `supabase/seed.sql` and run it to seed default products (Chicken Sandwich ₹99, Paneer Sandwich ₹79), initial inventory items, and business settings.

### Step 2.3: Configure Edge Functions & Secrets
In your local terminal (Windows PowerShell):
```powershell
# Login to Supabase CLI
npx.cmd supabase login

# Link your local project to your remote Supabase project
npx.cmd supabase link --project-ref <your-supabase-project-id>

# Set the secure server-side admin access code secret
npx.cmd supabase secrets set ADMIN_ACCESS_CODE="YourSecretCodeHere"

# Deploy all Edge Functions
npx.cmd supabase functions deploy create-order
npx.cmd supabase functions deploy verify-admin-code
npx.cmd supabase functions deploy confirm-payment
npx.cmd supabase functions deploy update-order-status
npx.cmd supabase functions deploy export-transactions
npx.cmd supabase functions deploy admin-operations
```

### Step 2.4: Create the Initial Owner Account
1. In the Supabase Dashboard, go to **Authentication ➔ Users**.
2. Click **Add User ➔ Create User**, and enter your Owner email and password.
3. Copy the generated User UID.
4. Go to the **SQL Editor** and insert the owner profile into `admin_users`:
```sql
INSERT INTO public.admin_users (id, email, full_name, role, is_active)
VALUES ('<PASTE-USER-UID-HERE>', 'owner@risers.com', 'Store Owner', 'owner', true)
ON CONFLICT (id) DO UPDATE SET role = 'owner', is_active = true;
```

---

## 3. GitHub Repository Setup

```powershell
# Initialize git if not already initialized
git init

# Stage all files
git add .

# Commit files
git commit -m "Initial commit: RISERS Sandwich Hub complete system"

# Add your separate remote repository (e.g. RISERS-SANDWICH-HUB)
git remote add origin https://github.com/<your-username>/risers-sandwich-hub.git

# Push to main branch
git branch -M main
git push -u origin main
```

> **IMPORTANT:** Never commit `.env` or any file containing passwords, service-role keys, or the `ADMIN_ACCESS_CODE`. Only `.env.example` should be committed.

---

## 4. Vercel Deployment

1. Log in to [Vercel](https://vercel.com) and click **Add New ➔ Project**.
2. Import the `risers-sandwich-hub` GitHub repository.
3. Framework Preset will auto-detect as **Vite**.
4. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: `https://<your-project-id>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `<your-supabase-anon-key>`
   - `VITE_BUSINESS_NAME`: `RISERS Sandwich Hub`
   - `VITE_BUSINESS_TAGLINE`: `Rise Together, Serve Better!`
   - `VITE_DEFAULT_UPI_ID`: `your-stall-vpa@upi`
5. Click **Deploy**.

---

## 5. Post-Deployment Verification

1. Open your deployed Vercel URL (e.g. `https://risers-sandwich-hub.vercel.app`).
2. Verify customer ordering flow (browse, cart, order submission).
3. Access `/admin/`, enter the access code, log in with the Owner credentials, and open `admin/settings.html`.
4. Update the **Production Site URL** to your actual Vercel domain.
5. Click **Generate QR Code** to create the high-resolution printable QR code for customer tables and counter display!
