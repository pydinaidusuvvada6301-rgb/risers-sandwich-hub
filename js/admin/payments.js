// ==============================================================
// RISERS Sandwich Hub - Admin Payment Verification Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, formatDateTime, escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let pendingOrders = [];
let selectedOrder = null;

export async function initPayments() {
  currentAdmin = await requireAuth(['cashier', 'manager', 'owner']);
  if (!currentAdmin) return;

  setupVerificationModals();
  await loadPendingPayments();
}

export async function loadPendingPayments() {
  const tbody = document.getElementById('pending-payments-tbody');
  const countBadge = document.getElementById('pending-count-badge');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading pending stall payments...</td></tr>`;

  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'pending')
        .neq('order_status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      pendingOrders = data || [];
    } else {
      const db = getMockDB();
      pendingOrders = db.orders.filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled');
    }

    if (countBadge) countBadge.textContent = `${pendingOrders.length} Pending`;

    renderPendingTable(pendingOrders);
  } catch (err) {
    console.error('Error loading pending payments', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 2rem;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderPendingTable(orders) {
  const tbody = document.getElementById('pending-payments-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          ✨ All stall payments are currently reconciled and verified!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-weight: 800; font-family: var(--font-mono); font-size: 1.15rem; color: var(--color-primary-dark);">
        #${o.token_number}
      </td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(o.order_number)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDateTime(o.created_at)}</div>
      </td>
      <td>
        <div><strong>${escapeHtml(o.customer_name)}</strong></div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(o.customer_phone || 'Not provided')}</div>
      </td>
      <td style="font-weight: 800; font-size: 1.1rem;">${formatCurrency(o.total_amount)}</td>
      <td>
        <span class="badge ${o.payment_method === 'cash' ? 'badge-pending' : 'badge-preparing'}">
          ${o.payment_method.toUpperCase()} AT STALL
        </span>
      </td>
      <td><span class="badge badge-pending">PENDING</span></td>
      <td>
        <button class="btn btn-primary btn-sm verify-pay-btn" data-id="${o.id}">
          ✓ Verify & Confirm
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.verify-pay-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orderId = e.currentTarget.dataset.id;
      openVerifyModal(orderId);
    });
  });
}

function openVerifyModal(orderId) {
  const order = pendingOrders.find(o => o.id === orderId);
  if (!order) return;
  selectedOrder = order;

  const modal = document.getElementById('confirm-payment-modal');
  if (!modal) return;

  document.getElementById('pay-modal-token').textContent = `#${order.token_number}`;
  document.getElementById('pay-modal-order-num').textContent = order.order_number;
  document.getElementById('pay-modal-customer').textContent = `${order.customer_name}${order.customer_phone ? ` (${order.customer_phone})` : ' (Not provided)'}`;
  document.getElementById('pay-modal-amount').textContent = formatCurrency(order.total_amount);

  const methodSelect = document.getElementById('pay-modal-method');
  if (methodSelect) methodSelect.value = order.payment_method;

  const amountInput = document.getElementById('pay-modal-amount-input');
  if (amountInput) amountInput.value = order.total_amount;

  const upiField = document.getElementById('pay-modal-upi-field');
  if (upiField) {
    upiField.style.display = order.payment_method === 'upi' ? 'block' : 'none';
  }

  modal.classList.add('active');
}

function setupVerificationModals() {
  const modal = document.getElementById('confirm-payment-modal');
  const closeBtn = document.getElementById('pay-modal-close');
  const methodSelect = document.getElementById('pay-modal-method');
  const upiField = document.getElementById('pay-modal-upi-field');
  const confirmBtn = document.getElementById('pay-modal-confirm-btn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (methodSelect && upiField) {
    methodSelect.addEventListener('change', () => {
      upiField.style.display = methodSelect.value === 'upi' ? 'block' : 'none';
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!selectedOrder) return;

      const method = document.getElementById('pay-modal-method')?.value || selectedOrder.payment_method;
      const amountReceived = parseFloat(document.getElementById('pay-modal-amount-input')?.value || selectedOrder.total_amount);
      const upiRef = document.getElementById('pay-modal-upi-ref')?.value?.trim();

      if (isNaN(amountReceived) || amountReceived < Number(selectedOrder.total_amount)) {
        showToast('Amount received cannot be less than order total', 'error');
        return;
      }

      if (method === 'upi' && (!upiRef || upiRef.length < 4)) {
        showToast('Please enter the UPI Reference (UTR) from customer phone', 'error');
        return;
      }

      try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirming...';

        if (isConfigured && supabase) {
          const { error } = await supabase.functions.invoke('confirm-payment', {
            body: {
              order_id: selectedOrder.id,
              payment_method: method,
              amount_received: amountReceived,
              upi_reference: method === 'upi' ? upiRef : null
            }
          });
          if (error) throw error;
        } else {
          // Mock verification
          const db = getMockDB();
          const target = db.orders.find(o => o.id === selectedOrder.id);
          if (target) {
            target.payment_status = 'paid';
            target.updated_at = new Date().toISOString();
          }

          const newPay = {
            id: 'pay-' + Date.now(),
            order_id: selectedOrder.id,
            payment_method: method,
            amount: amountReceived,
            payment_status: 'paid',
            upi_reference: method === 'upi' ? upiRef : null,
            cashier_name: currentAdmin.full_name,
            confirmed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          };
          db.payments.unshift(newPay);

          // Update cash session if cash
          if (method === 'cash') {
            db.cash_session.cash_collections = (Number(db.cash_session.cash_collections) || 0) + amountReceived;
          }

          saveMockDB(db);
        }

        showToast(`Payment of ${formatCurrency(amountReceived)} confirmed for Token #${selectedOrder.token_number}!`, 'success');
        modal.classList.remove('active');
        await loadPendingPayments();
      } catch (err) {
        showToast(err.message || 'Payment confirmation failed', 'error');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Payment Received';
      }
    });
  }
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('pending-payments-tbody')) {
      initPayments();
    }
  });
}
