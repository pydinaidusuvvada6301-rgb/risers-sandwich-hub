// ==============================================================
// RISERS Sandwich Hub - Customer Menu Controller
// ==============================================================

import { supabase, isConfigured, getMockDB } from '../config/supabase.js';
import { Cart } from './cart.js';
import { formatCurrency, escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/notifications.js';

let allProducts = [];

export async function initMenu() {
  const container = document.getElementById('menu-items-grid');
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem 0;">
      <p style="color: var(--text-muted); font-size: 1.1rem;">Loading fresh sandwiches...</p>
    </div>
  `;

  try {
    let products = [];
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      products = data || [];
    } else {
      // Local development fallback
      const db = getMockDB();
      products = db.products.filter(p => p.is_active);
    }

    allProducts = products;
    renderMenu(allProducts);
    setupFilterButtons();
  } catch (err) {
    console.error('Menu load error:', err);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
        <p style="color: var(--color-danger); font-weight: 600;">Unable to load sandwiches right now. Please try again or visit our counter.</p>
      </div>
    `;
  }
}

function renderMenu(products) {
  const container = document.getElementById('menu-items-grid');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <p style="color: var(--text-muted);">No sandwiches available in this category.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => {
    const isVeg = product.is_veg;
    const dietBadge = isVeg 
      ? `<span class="badge badge-veg"><span class="diet-dot veg"></span> 100% VEG</span>`
      : `<span class="badge badge-nonveg"><span class="diet-dot non-veg"></span> NON-VEG</span>`;

    const isAvailable = product.is_available;
    const buttonHtml = isAvailable
      ? `<button class="btn btn-primary btn-sm add-to-cart-btn" data-product-id="${product.id}">
           <span>+ Add to Cart</span>
         </button>`
      : `<button class="btn btn-secondary btn-sm" disabled>Sold Out</button>`;

    return `
      <article class="sandwich-card">
        <div class="sandwich-img-wrapper">
          <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="sandwich-img" loading="lazy" />
          <div class="sandwich-badge-overlay">${dietBadge}</div>
          <div class="sandwich-price-tag">${formatCurrency(product.price)}</div>
        </div>
        <div class="sandwich-body">
          <div class="sandwich-title-row">
            <h3 class="sandwich-name">${escapeHtml(product.name)}</h3>
          </div>
          <p class="sandwich-desc">${escapeHtml(product.description || '')}</p>
          <div class="sandwich-card-footer">
            <div class="qty-stepper">
              <button class="qty-btn qty-decrease" data-product-id="${product.id}">−</button>
              <span class="qty-val" id="qty-${product.id}">1</span>
              <button class="qty-btn qty-increase" data-product-id="${product.id}">+</button>
            </div>
            ${buttonHtml}
          </div>
        </div>
      </article>
    `;
  }).join('');

  attachEventListeners();
}

function attachEventListeners() {
  // Steppers
  document.querySelectorAll('.qty-increase').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.productId;
      const el = document.getElementById(`qty-${pid}`);
      if (el) {
        let val = parseInt(el.textContent, 10) || 1;
        el.textContent = Math.min(val + 1, 20);
      }
    });
  });

  document.querySelectorAll('.qty-decrease').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.productId;
      const el = document.getElementById(`qty-${pid}`);
      if (el) {
        let val = parseInt(el.textContent, 10) || 1;
        el.textContent = Math.max(val - 1, 1);
      }
    });
  });

  // Add to cart buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.productId;
      const product = allProducts.find(p => p.id === pid);
      if (!product) return;

      const qtyEl = document.getElementById(`qty-${pid}`);
      const qty = qtyEl ? (parseInt(qtyEl.textContent, 10) || 1) : 1;

      Cart.addItem(product, qty);
      showToast(`Added ${qty} × ${product.name} to your cart!`, 'success');

      // reset stepper to 1
      if (qtyEl) qtyEl.textContent = '1';
    });
  });
}

function setupFilterButtons() {
  const filterBtns = document.querySelectorAll('.menu-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('btn-primary'));
      filterBtns.forEach(b => b.classList.add('btn-secondary'));
      e.currentTarget.classList.remove('btn-secondary');
      e.currentTarget.classList.add('btn-primary');

      const filter = e.currentTarget.dataset.filter;
      if (filter === 'all') {
        renderMenu(allProducts);
      } else if (filter === 'veg') {
        renderMenu(allProducts.filter(p => p.is_veg));
      } else if (filter === 'nonveg') {
        renderMenu(allProducts.filter(p => !p.is_veg));
      }
    });
  });
}

// Auto init on page load if element exists
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('menu-items-grid')) {
      initMenu();
    }
  });
}
