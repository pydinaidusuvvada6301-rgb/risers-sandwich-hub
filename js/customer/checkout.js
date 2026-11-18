// ==============================================================
// RISERS Sandwich Hub - Customer Checkout Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { Cart } from './cart.js';
import { formatCurrency, escapeHtml, generateIdempotencyKey } from '../shared/utils.js';
import { validateIndianMobile, validateName, sanitizeInput } from '../shared/validation.js';
import { showToast } from '../shared/notifications.js';

export function initCheckout() {
  renderCartSummary();
  setupPaymentSelector();
  setupCheckoutForm();

  window.addEventListener('risers:cart_updated', () => {
    renderCartSummary();
  });
}

function renderCartSummary() {
  const container = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const totalEl = document.getElementById('checkout-total');
  const submitBtn = document.getElementById('submit-order-btn');
  if (!container) return;

  const items = Cart.getItems();

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem;">
        <p style="color: var(--text-muted); margin-bottom: 1.25rem;">Your sandwich tray is empty!</p>
        <a href="menu.html" class="btn btn-primary btn-sm">Explore Sandwiches</a>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = formatCurrency(0);
    if (totalEl) totalEl.textContent = formatCurrency(0);
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (submitBtn) submitBtn.disabled = false;

  container.innerHTML = items.map(item => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--border-subtle); gap: 1rem;">
      <div style="flex-grow: 1;">
        <div style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(item.name)}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          ${formatCurrency(item.price)} each
        </div>
      </div>
      <div class="qty-stepper" style="transform: scale(0.9);">
        <button class="qty-btn cart-minus" data-id="${item.product_id}">−</button>
        <span class="qty-val">${item.quantity}</span>
        <button class="qty-btn cart-plus" data-id="${item.product_id}">+</button>
      </div>
      <div style="font-weight: 700; min-width: 70px; text-align: right;">
        ${formatCurrency(item.price * item.quantity)}
      </div>
      <button class="cart-remove-btn" data-id="${item.product_id}" style="background: none; border: none; color: var(--text-light); cursor: pointer; font-size: 1.1rem;" title="Remove">✕</button>
    </div>
  `).join('');

  const subtotal = Cart.getSubtotal();
  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (totalEl) totalEl.textContent = formatCurrency(subtotal);

  // Bind cart modifiers
  container.querySelectorAll('.cart-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.id;
      const target = items.find(i => i.product_id === pid);
      if (target) Cart.updateQuantity(pid, target.quantity + 1);
    });
  });

  container.querySelectorAll('.cart-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.id;
      const target = items.find(i => i.product_id === pid);
      if (target) Cart.updateQuantity(pid, target.quantity - 1);
    });
  });

  container.querySelectorAll('.cart-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.id;
      Cart.removeItem(pid);
      showToast('Item removed from cart', 'info');
    });
  });
}

function setupPaymentSelector() {
  const cards = document.querySelectorAll('.payment-option-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });
}

function setupCheckoutForm() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-order-btn');
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const notesInput = document.getElementById('order-notes');
    const paymentRadio = document.querySelector('input[name="payment_method"]:checked');

    // Validation
    const nameValidation = validateName(nameInput?.value);
    if (!nameValidation.valid) {
      showToast(nameValidation.message, 'error');
      nameInput?.focus();
      return;
    }

    const phoneValidation = validateIndianMobile(phoneInput?.value, false);
    if (!phoneValidation.valid) {
      showToast(phoneValidation.message, 'error');
      phoneInput?.focus();
      return;
    }

    const paymentMethod = paymentRadio ? paymentRadio.value : 'cash';
    const items = Cart.getItems();

    if (items.length === 0) {
      showToast('Your cart is empty! Please add sandwiches first.', 'error');
      return;
    }

    // Lock button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Placing your order...</span>`;
    }

    const orderPayload = {
      customer_name: nameValidation.cleanName,
      customer_phone: phoneValidation.cleanPhone || '',
      payment_method: paymentMethod,
      notes: sanitizeInput(notesInput?.value || ''),
      items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      idempotency_key: generateIdempotencyKey()
    };

    try {
      let createdOrder = null;

      if (isConfigured && supabase) {
        // Submit to live Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('create-order', {
          body: orderPayload
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || 'Failed to submit order');
        }
        createdOrder = data.order;
      } else {
        // Resilient Mock Store for local preview
        const db = getMockDB();
        const nextToken = (db.orders.length > 0 ? Math.max(...db.orders.map(o => o.token_number)) : 100) + 1;
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const orderNum = `RSH-${todayStr}-${String(nextToken).padStart(4, '0')}`;
        const trackingHash = 'track-' + Math.random().toString(36).substring(2, 12);
        const subtotal = Cart.getSubtotal();

        const mockOrder = {
          id: 'ord-' + Date.now(),
          order_number: orderNum,
          token_number: nextToken,
          customer_name: orderPayload.customer_name,
          customer_phone: orderPayload.customer_phone,
          order_status: 'received',
          payment_status: 'pending',
          payment_method: orderPayload.payment_method,
          subtotal_amount: subtotal,
          discount_amount: 0.00,
          total_amount: subtotal,
          notes: orderPayload.notes,
          tracking_hash: trackingHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.orders.unshift(mockOrder);

        // order items
        items.forEach(it => {
          db.order_items.push({
            id: 'oi-' + Math.random().toString(36).substring(2, 9),
            order_id: mockOrder.id,
            product_id: it.product_id,
            product_name: it.name,
            unit_price: it.price,
            quantity: it.quantity,
            subtotal: it.price * it.quantity
          });
        });

        saveMockDB(db);
        createdOrder = mockOrder;
      }

      // Clear cart
      Cart.clear();
      showToast(`Order #${createdOrder.token_number} placed successfully!`, 'success');

      // Redirect to tracking page
      setTimeout(() => {
        window.location.href = `track-order.html?hash=${encodeURIComponent(createdOrder.tracking_hash)}`;
      }, 700);

    } catch (err) {
      console.error('Order submission error:', err);
      showToast(err.message || 'Could not place order. Please check stall connectivity.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Place Order & Pay at Stall</span>`;
      }
    }
  });
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('checkout-items-list')) {
      initCheckout();
    }
  });
}
