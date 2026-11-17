// ==============================================================
// RISERS Sandwich Hub - Admin Dashboard Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, resetMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, formatDateTime, escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let dateFilter = 'today';

export async function initDashboard() {
  currentAdmin = await requireAuth(['owner', 'manager', 'cashier']);
  if (!currentAdmin) return;

  setupDateFilters();
  setupManualResetModal();
  await loadDashboardData();
}

function setupDateFilters() {
  const filterBtns = document.querySelectorAll('.dash-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      filterBtns.forEach(b => b.classList.remove('btn-primary'));
      filterBtns.forEach(b => b.classList.add('btn-secondary'));
      e.currentTarget.classList.remove('btn-secondary');
      e.currentTarget.classList.add('btn-primary');

      dateFilter = e.currentTarget.dataset.range;
      await loadDashboardData();
    });
  });
}

export async function loadDashboardData() {
  try {
    let orders = [];
    let payments = [];
    let expenses = [];
    let inventory = [];

    if (isConfigured && supabase) {
      // 1. Orders
      const { data: ords } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      orders = ords || [];

      // 2. Payments
      const { data: pays } = await supabase.from('payments').select('*').order('confirmed_at', { ascending: false });
      payments = pays || [];

      // 3. Expenses
      const { data: exps } = await supabase.from('expenses').select('*');
      expenses = exps || [];

      // 4. Inventory
      const { data: inv } = await supabase.from('inventory').select('*');
      inventory = inv || [];
    } else {
      // Local mock DB
      const db = getMockDB();
      orders = db.orders;
      payments = db.payments;
      expenses = db.expenses;
      inventory = db.inventory;
    }

    // Filter by date range
    const filteredOrders = filterByDate(orders, 'created_at');
    const filteredPayments = filterByDate(payments, 'confirmed_at');
    const filteredExpenses = filterByDate(expenses, 'expense_date');

    renderMetrics(filteredOrders, filteredPayments, filteredExpenses, inventory);
    renderRecentOrders(filteredOrders.slice(0, 5));
    renderRecentPayments(filteredPayments.slice(0, 5));
  } catch (err) {
    console.error('Failed to load dashboard metrics', err);
  }
}

function filterByDate(items, dateField) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return items.filter(item => {
    const d = new Date(item[dateField] || item.created_at);
    if (dateFilter === 'today') {
      return d >= startOfToday;
    } else if (dateFilter === 'yesterday') {
      const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
      return d >= startOfYesterday && d < startOfToday;
    } else if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 86400000);
      return d >= sevenDaysAgo;
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 86400000);
      return d >= thirtyDaysAgo;
    }
    return true;
  });
}

function renderMetrics(orders, payments, expenses, inventory) {
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.order_status === 'completed').length;
  const pendingOrders = orders.filter(o => ['received', 'preparing', 'ready'].includes(o.order_status)).length;
  
  // Paid Sales Revenue
  const paidSales = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  // Pending Payments Amount
  const pendingPaymentsAmount = orders
    .filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Cash vs UPI collections
  const cashSales = payments
    .filter(p => p.payment_method === 'cash')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const upiSales = payments
    .filter(p => p.payment_method === 'upi')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Estimated Gross Profit
  const estimatedProfit = paidSales - totalExpenses;

  // Low Stock Items (< min_limit)
  const lowStockCount = inventory.filter(i => Number(i.current_stock) <= Number(i.min_limit)).length;

  // Set DOM Values
  setElText('metric-orders-count', totalOrders);
  setElText('metric-sales-total', formatCurrency(paidSales));
  setElText('metric-completed-count', completedOrders);
  setElText('metric-pending-count', pendingOrders);
  setElText('metric-pending-pay', formatCurrency(pendingPaymentsAmount));
  setElText('metric-expenses-total', formatCurrency(totalExpenses));
  setElText('metric-profit-total', formatCurrency(estimatedProfit));
  setElText('metric-low-stock', lowStockCount);

  // Cash vs UPI Split Bars
  setElText('split-cash-amount', formatCurrency(cashSales));
  setElText('split-upi-amount', formatCurrency(upiSales));

  const totalCollected = cashSales + upiSales;
  const cashPct = totalCollected > 0 ? Math.round((cashSales / totalCollected) * 100) : 50;
  const upiPct = totalCollected > 0 ? (100 - cashPct) : 50;

  const cashBar = document.getElementById('bar-cash');
  const upiBar = document.getElementById('bar-upi');
  if (cashBar) cashBar.style.width = `${cashPct}%`;
  if (upiBar) upiBar.style.width = `${upiPct}%`;
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recent-orders-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No orders found in this period.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    let statusBadge = `<span class="badge badge-pending">${o.order_status}</span>`;
    if (o.order_status === 'preparing') statusBadge = `<span class="badge badge-preparing">PREPARING</span>`;
    if (o.order_status === 'ready') statusBadge = `<span class="badge badge-ready">READY</span>`;
    if (o.order_status === 'completed') statusBadge = `<span class="badge badge-completed">COMPLETED</span>`;
    if (o.order_status === 'cancelled') statusBadge = `<span class="badge badge-cancelled">CANCELLED</span>`;

    const payBadge = o.payment_status === 'paid'
      ? `<span class="badge badge-ready">PAID</span>`
      : `<span class="badge badge-pending">PENDING</span>`;

    return `
      <tr>
        <td style="font-weight: 700; font-family: var(--font-mono);">#${o.token_number}</td>
        <td>${escapeHtml(o.order_number)}</td>
        <td>${escapeHtml(o.customer_name)}</td>
        <td style="font-weight: 700;">${formatCurrency(o.total_amount)}</td>
        <td>${statusBadge}</td>
        <td>${payBadge}</td>
      </tr>
    `;
  }).join('');
}

function renderRecentPayments(payments) {
  const tbody = document.getElementById('recent-payments-tbody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No payments confirmed in this period.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td style="font-family: var(--font-mono); font-size: 0.8rem;">${(p.id || '').slice(0, 10)}...</td>
      <td><strong>${(p.payment_method || 'cash').toUpperCase()}</strong></td>
      <td style="font-weight: 700; color: var(--color-success);">${formatCurrency(p.amount)}</td>
      <td>${escapeHtml(p.cashier_name || 'Staff')}</td>
      <td style="font-size: 0.85rem; color: var(--text-muted);">${formatDateTime(p.confirmed_at)}</td>
    </tr>
  `).join('');
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Handles the Operational Maintenance & Manual Reset functionality
 * Protected for Owner and Manager roles with explicit confirmation
 */
function setupManualResetModal() {
  const openBtn = document.getElementById('open-reset-modal-btn');
  const modal = document.getElementById('reset-modal');
  const closeBtn = document.getElementById('close-reset-modal-btn');
  const cancelBtn = document.getElementById('cancel-reset-btn');
  const form = document.getElementById('manual-reset-form');
  const scopeSelect = document.getElementById('reset-scope-select');
  const explanationEl = document.getElementById('reset-explanation');
  const confirmInput = document.getElementById('reset-confirm-input');
  const executeBtn = document.getElementById('execute-reset-btn');

  // Hide if cashier role
  if (currentAdmin && currentAdmin.role === 'cashier') {
    if (openBtn) openBtn.style.display = 'none';
    return;
  }

  const explanations = {
    clear_test_orders: 'Deletes test orders where notes or customer name contains "test", preserving real customer orders and financial records.',
    reset_daily_tokens: 'Resets today’s token sequence back to #101 without deleting existing orders or revenue metrics.',
    clear_completed_queue: 'Cleans up archived cancelled orders from the active queue to keep dashboard views uncluttered.',
    reset_all_mock: 'Restores offline demo cache to pristine initial seed state (Chicken ₹99 & Paneer ₹79).'
  };

  const openModal = () => {
    if (modal) modal.style.display = 'flex';
    if (confirmInput) confirmInput.value = '';
    if (scopeSelect && explanationEl) {
      explanationEl.textContent = explanations[scopeSelect.value] || '';
    }
  };

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (scopeSelect && explanationEl) {
    scopeSelect.addEventListener('change', () => {
      explanationEl.textContent = explanations[scopeSelect.value] || '';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const confirmation = (confirmInput?.value || '').trim();
      if (confirmation !== 'CONFIRM') {
        showToast('Please type CONFIRM exactly to authorize this reset.', 'error');
        return;
      }

      const resetType = scopeSelect?.value || 'clear_test_orders';
      if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = 'Resetting...';
      }

      try {
        if (isConfigured && supabase) {
          const { data, error } = await supabase.functions.invoke('admin-operations', {
            body: {
              action: 'manual_reset',
              payload: {
                reset_type: resetType,
                confirmation: 'CONFIRM'
              }
            }
          });

          if (error || (data && data.error)) {
            throw new Error(data?.error || error?.message || 'Server reset failed');
          }

          showToast(data?.message || 'Maintenance reset completed successfully!', 'success');
        } else {
          // Offline / Local Mock Reset
          const res = resetMockDB(resetType);
          if (!res.success) throw new Error(res.error || 'Local reset failed');
          showToast(res.message, 'success');
        }

        closeModal();
        await loadDashboardData();
      } catch (err) {
        console.error('Manual reset error:', err);
        showToast(`Reset Failed: ${err.message}`, 'error');
      } finally {
        if (executeBtn) {
          executeBtn.disabled = false;
          executeBtn.textContent = 'Execute Reset';
        }
      }
    });
  }
}

// Auto init on page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('metric-orders-count')) {
      initDashboard();
    }
  });
}
