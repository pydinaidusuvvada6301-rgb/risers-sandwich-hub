// ==============================================================
// RISERS Sandwich Hub - Admin Orders Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, formatDateTime, escapeHtml, debounce } from '../shared/utils.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let allOrders = [];
let allOrderItems = [];
let selectedOrder = null;

export async function initOrders() {
  currentAdmin = await requireAuth(['owner', 'manager', 'cashier']);
  if (!currentAdmin) return;

  setupFilters();
  setupModalActions();
  await loadOrders();
}

export async function loadOrders() {
  const tbody = document.getElementById('orders-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading orders...</td></tr>`;

  try {
    if (isConfigured && supabase) {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      allOrders = orders || [];
      allOrderItems = allOrders.flatMap(o => o.order_items || []);
    } else {
      const db = getMockDB();
      allOrders = db.orders;
      allOrderItems = db.order_items;
    }

    applyFilters();
  } catch (err) {
    console.error('Error loading orders', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-danger); padding: 2rem;">Failed to load orders: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function setupFilters() {
  const searchInput = document.getElementById('order-search');
  const statusFilter = document.getElementById('filter-order-status');
  const paymentFilter = document.getElementById('filter-payment-status');

  const onFilterChange = debounce(() => applyFilters(), 250);

  if (searchInput) searchInput.addEventListener('input', onFilterChange);
  if (statusFilter) statusFilter.addEventListener('change', onFilterChange);
  if (paymentFilter) paymentFilter.addEventListener('change', onFilterChange);
}

function applyFilters() {
  const search = (document.getElementById('order-search')?.value || '').toLowerCase().trim();
  const status = document.getElementById('filter-order-status')?.value || 'all';
  const payStatus = document.getElementById('filter-payment-status')?.value || 'all';

  const filtered = allOrders.filter(o => {
    const matchSearch = !search || 
      String(o.token_number).includes(search) ||
      o.order_number.toLowerCase().includes(search) ||
      o.customer_name.toLowerCase().includes(search) ||
      o.customer_phone.includes(search);

    const matchStatus = status === 'all' || o.order_status === status;
    const matchPay = payStatus === 'all' || o.payment_status === payStatus;

    return matchSearch && matchStatus && matchPay;
  });

  renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-table-tbody');
  const countEl = document.getElementById('orders-count-label');
  if (!tbody) return;

  if (countEl) countEl.textContent = `Showing ${orders.length} orders`;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">No orders matching filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    let statusBadge = `<span class="badge badge-pending">RECEIVED</span>`;
    if (o.order_status === 'preparing') statusBadge = `<span class="badge badge-preparing">PREPARING</span>`;
    if (o.order_status === 'ready') statusBadge = `<span class="badge badge-ready">READY</span>`;
    if (o.order_status === 'completed') statusBadge = `<span class="badge badge-completed">COMPLETED</span>`;
    if (o.order_status === 'cancelled') statusBadge = `<span class="badge badge-cancelled">CANCELLED</span>`;

    const payBadge = o.payment_status === 'paid'
      ? `<span class="badge badge-ready">PAID</span>`
      : `<span class="badge badge-pending">PENDING (${o.payment_method.toUpperCase()})</span>`;

    return `
      <tr>
        <td style="font-weight: 800; font-family: var(--font-mono); font-size: 1.1rem; color: var(--color-primary-dark);">
          #${o.token_number}
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(o.order_number)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDateTime(o.created_at)}</div>
        </td>
        <td>
          <div><strong>${escapeHtml(o.customer_name)}</strong></div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(o.customer_phone)}</div>
        </td>
        <td style="font-weight: 700;">${formatCurrency(o.total_amount)}</td>
        <td>${payBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm view-order-btn" data-id="${o.id}">Details / Manage</button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind detail buttons
  tbody.querySelectorAll('.view-order-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orderId = e.currentTarget.dataset.id;
      openOrderModal(orderId);
    });
  });
}

function openOrderModal(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;
  selectedOrder = order;

  const items = (isConfigured && supabase) 
    ? (order.order_items || [])
    : allOrderItems.filter(i => i.order_id === order.id);

  const modal = document.getElementById('order-detail-modal');
  if (!modal) return;

  // Populate modal fields
  document.getElementById('modal-token-num').textContent = `#${order.token_number}`;
  document.getElementById('modal-order-num').textContent = order.order_number;
  document.getElementById('modal-customer-info').textContent = `${order.customer_name} (${order.customer_phone})`;
  document.getElementById('modal-order-time').textContent = formatDateTime(order.created_at);
  document.getElementById('modal-order-notes').textContent = order.notes || 'None';
  document.getElementById('modal-order-total').textContent = formatCurrency(order.total_amount);

  // Status select
  const statusSelect = document.getElementById('modal-status-select');
  if (statusSelect) statusSelect.value = order.order_status;

  // Render items
  const itemsContainer = document.getElementById('modal-items-tbody');
  if (itemsContainer) {
    itemsContainer.innerHTML = items.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.product_name)}</strong></td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right; font-weight: 700;">${formatCurrency(item.subtotal || (item.unit_price * item.quantity))}</td>
      </tr>
    `).join('');
  }

  modal.classList.add('active');
}

function setupModalActions() {
  const modal = document.getElementById('order-detail-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const updateStatusBtn = document.getElementById('modal-update-status-btn');
  const printBtn = document.getElementById('modal-print-ticket-btn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (updateStatusBtn) {
    updateStatusBtn.addEventListener('click', async () => {
      if (!selectedOrder) return;
      const newStatus = document.getElementById('modal-status-select')?.value;
      if (!newStatus) return;

      try {
        updateStatusBtn.disabled = true;
        updateStatusBtn.textContent = 'Updating...';

        if (isConfigured && supabase) {
          const { error } = await supabase.functions.invoke('update-order-status', {
            body: { order_id: selectedOrder.id, new_status: newStatus }
          });
          if (error) throw error;
        } else {
          // Mock update
          const db = getMockDB();
          const target = db.orders.find(o => o.id === selectedOrder.id);
          if (target) {
            target.order_status = newStatus;
            target.updated_at = new Date().toISOString();
            saveMockDB(db);
          }
        }

        showToast(`Order #${selectedOrder.token_number} status updated to ${newStatus.toUpperCase()}`, 'success');
        modal.classList.remove('active');
        await loadOrders();
      } catch (err) {
        showToast(err.message || 'Status update failed', 'error');
      } finally {
        updateStatusBtn.disabled = false;
        updateStatusBtn.textContent = 'Save Status';
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('orders-table-tbody')) {
      initOrders();
    }
  });
}
