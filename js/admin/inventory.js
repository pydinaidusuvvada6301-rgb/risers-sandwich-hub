// ==============================================================
// RISERS Sandwich Hub - Admin Inventory Management Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let allInventory = [];
let selectedItem = null;

export async function initInventory() {
  currentAdmin = await requireAuth(['owner', 'manager']);
  if (!currentAdmin) return;

  setupAdjustModal();
  await loadInventory();
}

export async function loadInventory() {
  const tbody = document.getElementById('inventory-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading raw ingredients & packaging stock...</td></tr>`;

  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      allInventory = data || [];
    } else {
      const db = getMockDB();
      allInventory = db.inventory;
    }

    renderInventoryTable(allInventory);
  } catch (err) {
    console.error('Error loading inventory', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 2rem;">Failed to load inventory: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderInventoryTable(items) {
  const tbody = document.getElementById('inventory-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = items.map(item => {
    const isLow = Number(item.current_stock) <= Number(item.min_limit);
    const stockBadge = isLow
      ? `<span class="badge badge-cancelled">LOW STOCK</span>`
      : `<span class="badge badge-ready">HEALTHY</span>`;

    return `
      <tr>
        <td style="font-weight: 700; font-size: 1rem;">${escapeHtml(item.name)}</td>
        <td><code>${escapeHtml(item.unit)}</code></td>
        <td style="font-weight: 800; font-size: 1.15rem; color: ${isLow ? 'var(--color-danger)' : 'var(--text-main)'};">
          ${item.current_stock} ${item.unit}
        </td>
        <td style="color: var(--text-muted);">${item.min_limit} ${item.unit}</td>
        <td>${formatCurrency(item.cost_per_unit || 0)} / ${item.unit}</td>
        <td>${stockBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm adjust-stock-btn" data-id="${item.id}">
            ± Adjust / Restock
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.adjust-stock-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      openAdjustModal(id);
    });
  });
}

function openAdjustModal(id) {
  selectedItem = allInventory.find(i => i.id === id);
  if (!selectedItem) return;

  const modal = document.getElementById('stock-adjust-modal');
  if (!modal) return;

  document.getElementById('adjust-item-name').textContent = selectedItem.name;
  document.getElementById('adjust-current-stock').textContent = `${selectedItem.current_stock} ${selectedItem.unit}`;
  document.getElementById('adjust-change-amount').value = '';
  document.getElementById('adjust-notes').value = '';

  modal.classList.add('active');
}

function setupAdjustModal() {
  const modal = document.getElementById('stock-adjust-modal');
  const closeBtn = document.getElementById('adjust-modal-close');
  const form = document.getElementById('adjust-stock-form');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedItem) return;

      const actionType = document.getElementById('adjust-type').value; // 'add' or 'subtract'
      const amount = parseFloat(document.getElementById('adjust-change-amount').value);
      const reason = document.getElementById('adjust-reason').value;
      const notes = document.getElementById('adjust-notes').value.trim();

      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid stock amount', 'error');
        return;
      }

      const delta = actionType === 'add' ? amount : -amount;
      const newStock = Math.max(0, Number(selectedItem.current_stock) + delta);

      try {
        if (isConfigured && supabase) {
          const { error: updErr } = await supabase
            .from('inventory')
            .update({ current_stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', selectedItem.id);

          if (updErr) throw updErr;

          // Record transaction log
          await supabase.from('inventory_transactions').insert({
            inventory_id: selectedItem.id,
            change_amount: delta,
            reason: reason,
            created_by: currentAdmin.id,
            notes: notes || `Manual stock ${actionType} by ${currentAdmin.full_name}`
          });
        } else {
          // Mock update
          const db = getMockDB();
          const target = db.inventory.find(i => i.id === selectedItem.id);
          if (target) {
            target.current_stock = newStock;
            saveMockDB(db);
          }
        }

        showToast(`Stock for ${selectedItem.name} updated to ${newStock} ${selectedItem.unit}`, 'success');
        modal.classList.remove('active');
        await loadInventory();
      } catch (err) {
        showToast(err.message || 'Failed to adjust stock', 'error');
      }
    });
  }
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('inventory-table-tbody')) {
      initInventory();
    }
  });
}
