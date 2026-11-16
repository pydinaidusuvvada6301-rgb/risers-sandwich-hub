// ==============================================================
// RISERS Sandwich Hub - Admin Products Management Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let allProducts = [];
let editingProduct = null;

export async function initProducts() {
  currentAdmin = await requireAuth(['owner', 'manager']);
  if (!currentAdmin) return;

  setupModal();
  await loadProducts();
}

export async function loadProducts() {
  const tbody = document.getElementById('products-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading sandwich menu items...</td></tr>`;

  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      allProducts = data || [];
    } else {
      const db = getMockDB();
      allProducts = db.products;
    }

    renderProductsTable(allProducts);
  } catch (err) {
    console.error('Error loading products', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 2rem;">Failed to load products: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = products.map(p => {
    const isVeg = p.is_veg;
    const dietBadge = isVeg
      ? `<span class="badge badge-veg"><span class="diet-dot veg"></span> VEG</span>`
      : `<span class="badge badge-nonveg"><span class="diet-dot non-veg"></span> NON-VEG</span>`;

    const availBadge = p.is_available
      ? `<span class="badge badge-ready">AVAILABLE</span>`
      : `<span class="badge badge-cancelled">SOLD OUT</span>`;

    return `
      <tr>
        <td>
          <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" style="width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover;" />
        </td>
        <td>
          <div style="font-weight: 700;">${escapeHtml(p.name)}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(p.slug)}</div>
        </td>
        <td>${dietBadge}</td>
        <td style="font-weight: 800; font-size: 1.05rem; color: var(--color-primary-dark);">${formatCurrency(p.price)}</td>
        <td style="color: var(--text-muted);">${formatCurrency(p.cost_price || 0)}</td>
        <td>${availBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm edit-prod-btn" data-id="${p.id}">Edit</button>
          <button class="btn btn-outline btn-sm toggle-avail-btn" data-id="${p.id}" style="margin-left: 0.25rem;">
            ${p.is_available ? 'Mark Sold Out' : 'Mark Available'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind Actions
  tbody.querySelectorAll('.edit-prod-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.dataset.id;
      openProductModal(pid);
    });
  });

  tbody.querySelectorAll('.toggle-avail-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pid = e.currentTarget.dataset.id;
      const target = allProducts.find(p => p.id === pid);
      if (!target) return;

      const newAvail = !target.is_available;
      await saveProductAvailability(pid, newAvail);
    });
  });
}

function openProductModal(productId = null) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  const titleEl = document.getElementById('product-modal-title');
  const nameInput = document.getElementById('prod-name');
  const slugInput = document.getElementById('prod-slug');
  const priceInput = document.getElementById('prod-price');
  const costInput = document.getElementById('prod-cost');
  const imgInput = document.getElementById('prod-img');
  const descInput = document.getElementById('prod-desc');
  const vegCheckbox = document.getElementById('prod-is-veg');
  const availCheckbox = document.getElementById('prod-is-avail');

  if (productId) {
    editingProduct = allProducts.find(p => p.id === productId);
    titleEl.textContent = 'Edit Sandwich Product';
    nameInput.value = editingProduct.name;
    slugInput.value = editingProduct.slug;
    priceInput.value = editingProduct.price;
    costInput.value = editingProduct.cost_price || 0;
    imgInput.value = editingProduct.image_url;
    descInput.value = editingProduct.description || '';
    vegCheckbox.checked = editingProduct.is_veg;
    availCheckbox.checked = editingProduct.is_available;
  } else {
    editingProduct = null;
    titleEl.textContent = 'Add New Sandwich Product';
    nameInput.value = '';
    slugInput.value = '';
    priceInput.value = '';
    costInput.value = '';
    imgInput.value = 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80';
    descInput.value = '';
    vegCheckbox.checked = true;
    availCheckbox.checked = true;
  }

  modal.classList.add('active');
}

function setupModal() {
  const modal = document.getElementById('product-modal');
  const closeBtn = document.getElementById('product-modal-close');
  const openNewBtn = document.getElementById('open-add-product-btn');
  const form = document.getElementById('product-form');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (openNewBtn) {
    openNewBtn.addEventListener('click', () => openProductModal(null));
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('prod-name').value.trim();
      const slug = document.getElementById('prod-slug').value.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const price = parseFloat(document.getElementById('prod-price').value);
      const cost_price = parseFloat(document.getElementById('prod-cost').value) || 0;
      const image_url = document.getElementById('prod-img').value.trim();
      const description = document.getElementById('prod-desc').value.trim();
      const is_veg = document.getElementById('prod-is-veg').checked;
      const is_available = document.getElementById('prod-is-avail').checked;

      const payload = {
        name,
        slug,
        category: 'sandwiches',
        price,
        cost_price,
        image_url,
        description,
        is_veg,
        is_available,
        is_active: true
      };

      try {
        if (isConfigured && supabase) {
          if (editingProduct) {
            const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('products').insert(payload);
            if (error) throw error;
          }
        } else {
          // Mock save
          const db = getMockDB();
          if (editingProduct) {
            const target = db.products.find(p => p.id === editingProduct.id);
            if (target) Object.assign(target, payload);
          } else {
            payload.id = 'prod-' + Date.now();
            payload.display_order = db.products.length + 1;
            db.products.push(payload);
          }
          saveMockDB(db);
        }

        showToast(`Product "${name}" saved successfully!`, 'success');
        modal.classList.remove('active');
        await loadProducts();
      } catch (err) {
        showToast(err.message || 'Failed to save product', 'error');
      }
    });
  }
}

async function saveProductAvailability(productId, isAvailable) {
  try {
    if (isConfigured && supabase) {
      const { error } = await supabase.from('products').update({ is_available: isAvailable }).eq('id', productId);
      if (error) throw error;
    } else {
      const db = getMockDB();
      const target = db.products.find(p => p.id === productId);
      if (target) target.is_available = isAvailable;
      saveMockDB(db);
    }

    showToast(`Updated availability status`, 'success');
    await loadProducts();
  } catch (err) {
    showToast(err.message || 'Failed to update availability', 'error');
  }
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('products-table-tbody')) {
      initProducts();
    }
  });
}
