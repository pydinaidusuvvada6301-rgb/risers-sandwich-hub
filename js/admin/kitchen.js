// ==============================================================
// RISERS Sandwich Hub - Kitchen Display System (KDS) Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { escapeHtml } from '../shared/utils.js';
import { showToast, playKitchenChime } from '../shared/notifications.js';

let currentAdmin = null;
let activeOrders = [];
let allOrderItems = [];
let lastOrderCount = 0;

export async function initKitchen() {
  currentAdmin = await requireAuth(['kitchen', 'owner', 'manager']);
  if (!currentAdmin) return;

  setupChimeToggle();
  await loadKitchenOrders();
  setupKitchenRealtime();
}

export async function loadKitchenOrders() {
  const container = document.getElementById('kitchen-board');
  if (!container) return;

  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .in('order_status', ['received', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      activeOrders = data || [];
      allOrderItems = activeOrders.flatMap(o => o.order_items || []);
    } else {
      const db = getMockDB();
      activeOrders = db.orders.filter(o => ['received', 'preparing', 'ready'].includes(o.order_status));
      allOrderItems = db.order_items;
    }

    // Play chime if new orders arrived
    if (activeOrders.length > lastOrderCount && lastOrderCount !== 0) {
      playKitchenChime();
      showToast('New order placed at counter!', 'info');
    }
    lastOrderCount = activeOrders.length;

    renderKitchenBoard(activeOrders);
  } catch (err) {
    console.error('Kitchen load error', err);
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--color-danger); padding: 3rem;">Error loading orders: ${escapeHtml(err.message)}</div>`;
  }
}

function renderKitchenBoard(orders) {
  const container = document.getElementById('kitchen-board');
  const countBadge = document.getElementById('kitchen-queue-count');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${orders.length} Active Orders`;

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
        <div style="font-size: 3.5rem; margin-bottom: 1rem;">✨</div>
        <h2 style="color: var(--text-muted); margin-bottom: 0.5rem;">Kitchen Queue Clear!</h2>
        <p style="color: var(--text-light);">All sandwiches have been grilled and collected.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const items = (isConfigured && supabase)
      ? (order.order_items || [])
      : allOrderItems.filter(i => i.order_id === order.id);

    // Elapsed minutes
    const elapsedMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
    const isUrgent = elapsedMinutes >= 15;

    let actionBtnHtml = '';
    let statusClass = '';

    if (order.order_status === 'received') {
      actionBtnHtml = `<button class="btn btn-primary btn-block kitchen-action-btn" data-id="${order.id}" data-action="preparing">🍳 Start Preparing</button>`;
    } else if (order.order_status === 'preparing') {
      actionBtnHtml = `<button class="btn btn-success btn-block kitchen-action-btn" data-id="${order.id}" data-action="ready">✓ Mark Ready for Pickup</button>`;
    } else if (order.order_status === 'ready') {
      actionBtnHtml = `<button class="btn btn-secondary btn-block kitchen-action-btn" data-id="${order.id}" data-action="completed">📦 Complete / Handed Over</button>`;
    }

    return `
      <article class="kitchen-card ${isUrgent ? 'urgent' : ''}">
        <div class="kitchen-card-header">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Token</div>
            <div class="kitchen-token">#${order.token_number}</div>
          </div>
          <div style="text-align: right;">
            <div class="kitchen-timer">${elapsedMinutes} min ago</div>
            <span class="badge ${order.order_status === 'ready' ? 'badge-ready' : order.order_status === 'preparing' ? 'badge-preparing' : 'badge-pending'}">
              ${order.order_status.toUpperCase()}
            </span>
          </div>
        </div>

        <div class="kitchen-card-body">
          <div style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
            Customer: <strong>${escapeHtml(order.customer_name)}</strong>
          </div>

          <div style="margin-top: 0.75rem;">
            ${items.map(it => `
              <div class="kitchen-item-row">
                <span>${escapeHtml(it.product_name)}</span>
                <span class="kitchen-qty-badge">× ${it.quantity}</span>
              </div>
            `).join('')}
          </div>

          ${order.notes ? `
            <div class="kitchen-card-notes">
              <strong>Note:</strong> ${escapeHtml(order.notes)}
            </div>
          ` : ''}
        </div>

        <div class="kitchen-card-footer">
          ${actionBtnHtml}
        </div>
      </article>
    `;
  }).join('');

  // Bind one-click transition buttons
  container.querySelectorAll('.kitchen-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const orderId = e.currentTarget.dataset.id;
      const nextStatus = e.currentTarget.dataset.action;
      await updateOrderStatus(orderId, nextStatus);
    });
  });
}

async function updateOrderStatus(orderId, nextStatus) {
  try {
    if (isConfigured && supabase) {
      const { error } = await supabase.functions.invoke('update-order-status', {
        body: { order_id: orderId, new_status: nextStatus }
      });
      if (error) throw error;
    } else {
      // Mock update
      const db = getMockDB();
      const target = db.orders.find(o => o.id === orderId);
      if (target) {
        target.order_status = nextStatus;
        target.updated_at = new Date().toISOString();
        saveMockDB(db);
      }
    }

    showToast(`Order status updated to ${nextStatus.toUpperCase()}`, 'success');
    await loadKitchenOrders();
  } catch (err) {
    showToast(err.message || 'Status transition failed', 'error');
  }
}

function setupChimeToggle() {
  const chimeBtn = document.getElementById('test-chime-btn');
  if (chimeBtn) {
    chimeBtn.addEventListener('click', () => {
      playKitchenChime();
      showToast('Audio chime tested!', 'info');
    });
  }
}

function setupKitchenRealtime() {
  if (!isConfigured || !supabase) {
    // Poll mock database every 4 seconds in local preview
    setInterval(loadKitchenOrders, 4000);
    return;
  }

  supabase
    .channel('kitchen-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      loadKitchenOrders();
    })
    .subscribe();
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('kitchen-board')) {
      initKitchen();
    }
  });
}
