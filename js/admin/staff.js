// ==============================================================
// RISERS Sandwich Hub - Admin Staff Management Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatDateTime, escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let allStaff = [];

const DEFAULT_MOCK_STAFF = [
  { id: 'usr-1', email: 'owner@risers.com', full_name: 'Store Owner', role: 'owner', is_active: true, created_at: new Date().toISOString() },
  { id: 'usr-2', email: 'manager@risers.com', full_name: 'Store Manager', role: 'manager', is_active: true, created_at: new Date().toISOString() },
  { id: 'usr-3', email: 'cashier@risers.com', full_name: 'Counter Cashier', role: 'cashier', is_active: true, created_at: new Date().toISOString() },
  { id: 'usr-4', email: 'kitchen@risers.com', full_name: 'Grill Chef', role: 'kitchen', is_active: true, created_at: new Date().toISOString() }
];

export async function initStaff() {
  // Only Owner can manage staff team
  currentAdmin = await requireAuth(['owner']);
  if (!currentAdmin) return;

  setupModal();
  await loadStaff();
}

export async function loadStaff() {
  const tbody = document.getElementById('staff-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading stall staff directory...</td></tr>`;

  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allStaff = data || [];
    } else {
      const db = getMockDB();
      if (!db.staff) {
        db.staff = DEFAULT_MOCK_STAFF;
        saveMockDB(db);
      }
      allStaff = db.staff;
    }

    renderStaffTable(allStaff);
  } catch (err) {
    console.error('Error loading staff', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-danger); padding: 2rem;">Failed to load staff: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderStaffTable(staffList) {
  const tbody = document.getElementById('staff-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = staffList.map(s => {
    const isSelf = s.id === currentAdmin.id || s.email === currentAdmin.email;
    const statusBadge = s.is_active
      ? `<span class="badge badge-ready">ACTIVE</span>`
      : `<span class="badge badge-cancelled">DEACTIVATED</span>`;

    let roleBadge = `<span class="badge badge-role">${s.role.toUpperCase()}</span>`;
    if (s.role === 'owner') roleBadge = `<span class="badge badge-pending">OWNER</span>`;

    return `
      <tr>
        <td style="font-weight: 700;">
          ${escapeHtml(s.full_name)} ${isSelf ? '<span style="color: var(--color-primary); font-size: 0.8rem;">(You)</span>' : ''}
        </td>
        <td><code>${escapeHtml(s.email)}</code></td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${formatDateTime(s.created_at)}</td>
        <td>
          ${!isSelf ? `
            <button class="btn btn-secondary btn-sm toggle-staff-btn" data-id="${s.id}">
              ${s.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Protected</span>'}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.toggle-staff-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const target = allStaff.find(s => s.id === id);
      if (!target) return;

      const newStatus = !target.is_active;
      await toggleStaffStatus(id, newStatus);
    });
  });
}

async function toggleStaffStatus(staffId, newStatus) {
  try {
    if (isConfigured && supabase) {
      const { error } = await supabase.from('admin_users').update({ is_active: newStatus }).eq('id', staffId);
      if (error) throw error;
    } else {
      const db = getMockDB();
      const target = db.staff.find(s => s.id === staffId);
      if (target) target.is_active = newStatus;
      saveMockDB(db);
    }

    showToast(`Staff account status updated`, 'success');
    await loadStaff();
  } catch (err) {
    showToast(err.message || 'Failed to update staff status', 'error');
  }
}

function setupModal() {
  const modal = document.getElementById('staff-modal');
  const openBtn = document.getElementById('open-add-staff-btn');
  const closeBtn = document.getElementById('staff-modal-close');
  const form = document.getElementById('staff-form');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      document.getElementById('staff-name-input').value = '';
      document.getElementById('staff-email-input').value = '';
      document.getElementById('staff-password-input').value = '';
      modal.classList.add('active');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const full_name = document.getElementById('staff-name-input').value.trim();
      const email = document.getElementById('staff-email-input').value.trim().toLowerCase();
      const password = document.getElementById('staff-password-input').value;
      const role = document.getElementById('staff-role-select').value;

      try {
        if (isConfigured && supabase) {
          // Create Supabase Auth user
          const { data: authData, error: authErr } = await supabase.auth.signUp({
            email,
            password
          });
          if (authErr) throw authErr;

          if (authData.user) {
            const { error: profErr } = await supabase.from('admin_users').insert({
              id: authData.user.id,
              email: email,
              full_name: full_name,
              role: role,
              is_active: true
            });
            if (profErr) throw profErr;
          }
        } else {
          // Mock save
          const db = getMockDB();
          if (!db.staff) db.staff = DEFAULT_MOCK_STAFF;
          db.staff.push({
            id: 'usr-' + Date.now(),
            email: email,
            full_name: full_name,
            role: role,
            is_active: true,
            created_at: new Date().toISOString()
          });
          saveMockDB(db);
        }

        showToast(`Staff account for ${full_name} (${role.toUpperCase()}) created!`, 'success');
        modal.classList.remove('active');
        await loadStaff();
      } catch (err) {
        showToast(err.message || 'Failed to create staff account', 'error');
      }
    });
  }
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('staff-table-tbody')) {
      initStaff();
    }
  });
}
