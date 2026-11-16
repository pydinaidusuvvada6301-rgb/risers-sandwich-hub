// ==============================================================
// RISERS Sandwich Hub - Customer Order Tracking Controller
// ==============================================================

import { supabase, isConfigured, getMockDB } from '../config/supabase.js';
import { formatCurrency, formatDateTime, escapeHtml } from '../shared/utils.js';

let currentOrder = null;
let realtimeChannel = null;

export async function initTracking() {
  const urlParams = new URLSearchParams(window.location.search);
  const hash = urlParams.get('hash');

  const container = document.getElementById('tracking-content');
  if (!container) return;

  if (!hash) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem 1.5rem; max-width: 500px; margin: 2rem auto;">
        <h3 style="margin-bottom: 0.75rem;">No Order Reference Provided</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
          Please open the tracking link provided when you placed your order or scan your receipt QR code.
        </p>
        <a href="menu.html" class="btn btn-primary">Go to Sandwich Menu</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="text-align: center; padding: 4rem 0;">
      <p style="color: var(--text-muted); font-size: 1.1rem;">Retrieving order status...</p>
    </div>
  `;

  await fetchOrderDetails(hash);
  setupRealtime(hash);
}

async function fetchOrderDetails(hash) {
  const container = document.getElementById('tracking-content');
  if (!container) return;

  try {
    let order = null;
    let items = [];

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          token_number,
          customer_name,
          order_status,
          payment_status,
          payment_method,
          total_amount,
          notes,
          created_at,
          order_items (
            product_name,
            unit_price,
            quantity,
            subtotal
          )
        `)
        .eq('tracking_hash', hash)
        .single();

      if (error || !data) throw new Error('Order not found or link expired.');
      order = data;
      items = data.order_items || [];
    } else {
      // Local development fallback
      const db = getMockDB();
      order = db.orders.find(o => o.tracking_hash === hash);
      if (!order) {
        // Fallback to first order if mock hash not found
        order = db.orders[0];
      }
      if (order) {
        items = db.order_items.filter(i => i.order_id === order.id);
      }
    }

    if (!order) {
      throw new Error('Could not find order matching this security token.');
    }

    currentOrder = order;
    renderTrackingView(order, items);
  } catch (err) {
    console.error('Tracking fetch error:', err);
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem 1.5rem; max-width: 500px; margin: 2rem auto;">
        <h3 style="color: var(--color-danger); margin-bottom: 0.75rem;">Order Lookup Failed</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${escapeHtml(err.message)}</p>
        <a href="menu.html" class="btn btn-secondary">Return to Menu</a>
      </div>
    `;
  }
}

function renderTrackingView(order, items) {
  const container = document.getElementById('tracking-content');
  if (!container) return;

  const isPaid = order.payment_status === 'paid';
  const payBadge = isPaid
    ? `<span class="badge badge-ready">PAID AT STALL</span>`
    : `<span class="badge badge-pending">PAYMENT PENDING (${order.payment_method.toUpperCase()})</span>`;

  // Status mapping
  const statuses = [
    { key: 'received', title: 'Order Received', desc: 'Sent to stall queue' },
    { key: 'preparing', title: 'Fresh Preparation', desc: 'Crafting & grilling your sandwich' },
    { key: 'ready', title: 'Ready for Collection', desc: 'Please collect at stall counter!' },
    { key: 'completed', title: 'Order Completed', desc: 'Enjoy your hot toasted meal!' }
  ];

  const currentIdx = statuses.findIndex(s => s.key === order.order_status);

  const timelineHtml = statuses.map((step, idx) => {
    let stepClass = 'timeline-step';
    if (idx < currentIdx) stepClass += ' completed';
    else if (idx === currentIdx) stepClass += ' active';

    return `
      <div class="${stepClass}">
        <div class="timeline-dot">${idx < currentIdx ? '✓' : ''}</div>
        <div style="font-weight: 700; font-size: 1.05rem; color: ${idx === currentIdx ? 'var(--color-primary-dark)' : 'var(--text-main)'};">
          ${step.title}
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${step.desc}</div>
      </div>
    `;
  }).join('');

  // Stall payment reminder
  const paymentInstructions = !isPaid ? `
    <div style="background-color: #FEF3C7; border: 1.5px solid #FDE68A; border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
      <span style="font-size: 1.75rem;">🔔</span>
      <div>
        <div style="font-weight: 700; color: #92400E;">Payment Action Required at Counter</div>
        <div style="font-size: 0.875rem; color: #78350F;">
          Please show Token <strong>#${order.token_number}</strong> to the stall cashier and pay <strong>${formatCurrency(order.total_amount)}</strong> via <strong>${order.payment_method.toUpperCase()}</strong>.
        </div>
      </div>
    </div>
  ` : `
    <div style="background-color: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: var(--radius-lg); padding: 1rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.5rem; color: #059669;">✓</span>
      <div style="font-size: 0.9rem; color: #065F46; font-weight: 600;">
        Payment verified by cashier. Your order is in the preparation queue.
      </div>
    </div>
  `;

  // Feedback CTA if completed
  const feedbackCta = order.order_status === 'completed' ? `
    <div style="margin-top: 2rem; text-align: center; background-color: var(--bg-alt); padding: 1.5rem; border-radius: var(--radius-lg);">
      <h4 style="margin-bottom: 0.5rem;">How was your sandwich?</h4>
      <p style="font-size: 0.875rem; margin-bottom: 1rem;">Tell us about the crispiness, flavors, and stall service!</p>
      <a href="feedback.html?order=${order.id}" class="btn btn-primary btn-sm">Rate Your Meal ★★★★★</a>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="tracking-wrapper">
      <div class="token-highlight-card">
        <div style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem; font-weight: 700; opacity: 0.9;">
          Your Stall Order Token
        </div>
        <div class="token-giant">#${order.token_number}</div>
        <div style="font-size: 0.95rem; opacity: 0.95;">
          ${order.order_number} • ${formatDateTime(order.created_at)}
        </div>
      </div>

      ${paymentInstructions}

      <div class="card" style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1.5rem; font-size: 1.25rem;">Live Preparation Status</h3>
        <div class="status-timeline">
          ${timelineHtml}
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem;">
          <h3 style="font-size: 1.15rem;">Order Details</h3>
          ${payBadge}
        </div>

        <div style="margin-bottom: 1rem;">
          ${items.map(it => `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.95rem;">
              <span><strong>${it.quantity} ×</strong> ${escapeHtml(it.product_name)}</span>
              <span>${formatCurrency(it.subtotal || (it.unit_price * it.quantity))}</span>
            </div>
          `).join('')}
        </div>

        ${order.notes ? `
          <div style="background-color: #F5F5F4; padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
            <strong>Special Note:</strong> ${escapeHtml(order.notes)}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-size: 1.25rem; font-weight: 800; border-top: 2px dashed var(--border-light); padding-top: 1rem; color: var(--color-primary-dark);">
          <span>Total Payable</span>
          <span>${formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      ${feedbackCta}
    </div>
  `;
}

function setupRealtime(hash) {
  if (!isConfigured || !supabase) return;

  try {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
      .channel(`order-track-${hash}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `tracking_hash=eq.${hash}` },
        (payload) => {
          if (payload.new) {
            fetchOrderDetails(hash);
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Realtime subscription error:', err);
  }
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tracking-content')) {
      initTracking();
    }
  });
}
