// ==============================================================
// RISERS Sandwich Hub - Admin Cash Register Controller
// Physical Counter Drawer Reconciliation Formula:
// Expected Cash = Opening Cash + Cash Collections - Cash Refunds - Cash Expenses Paid in Cash
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, formatDateTime, escapeHtml } from '../shared/utils.js';
import { exportToPDF } from '../shared/export.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let currentSession = null;
let sessionHistory = [];

export async function initCashRegister() {
  currentAdmin = await requireAuth(['cashier', 'manager', 'owner']);
  if (!currentAdmin) return;

  setupModals();
  await loadCashSession();
}

export async function loadCashSession() {
  const today = new Date().toISOString().slice(0, 10);

  try {
    let session = null;
    let history = [];

    if (isConfigured && supabase) {
      // 1. Get today's active session
      const { data: active } = await supabase
        .from('daily_cash_sessions')
        .select('*')
        .eq('session_date', today)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      session = active;

      // 2. Load recent session history
      const { data: hist } = await supabase
        .from('daily_cash_sessions')
        .select('*')
        .order('session_date', { ascending: false })
        .limit(10);

      history = hist || [];
    } else {
      // Mock data
      const db = getMockDB();
      session = db.cash_session;
      history = [db.cash_session];
    }

    currentSession = session;
    sessionHistory = history;

    renderSessionView(currentSession);
    renderSessionHistory(sessionHistory);
  } catch (err) {
    console.error('Error loading cash session', err);
  }
}

function renderSessionView(session) {
  const openFloatEl = document.getElementById('cr-open-float');
  const collectionsEl = document.getElementById('cr-cash-collections');
  const refundsEl = document.getElementById('cr-cash-refunds');
  const expensesEl = document.getElementById('cr-cash-expenses');
  const expectedEl = document.getElementById('cr-expected-cash');
  const sessionStatusBadge = document.getElementById('cr-status-badge');
  const openSessionBtn = document.getElementById('open-session-btn');
  const closeSessionBtn = document.getElementById('close-session-btn');

  if (!session || session.status === 'closed') {
    if (sessionStatusBadge) {
      sessionStatusBadge.className = 'badge badge-cancelled';
      sessionStatusBadge.textContent = 'DRAWER CLOSED';
    }
    if (openFloatEl) openFloatEl.textContent = formatCurrency(0);
    if (collectionsEl) collectionsEl.textContent = formatCurrency(0);
    if (refundsEl) refundsEl.textContent = formatCurrency(0);
    if (expensesEl) expensesEl.textContent = formatCurrency(0);
    if (expectedEl) expectedEl.textContent = formatCurrency(0);

    if (openSessionBtn) openSessionBtn.style.display = 'inline-block';
    if (closeSessionBtn) closeSessionBtn.style.display = 'none';
    return;
  }

  // Active Open Session
  if (sessionStatusBadge) {
    sessionStatusBadge.className = 'badge badge-ready';
    sessionStatusBadge.textContent = 'DRAWER OPEN (ACTIVE)';
  }

  const opening = Number(session.opening_cash) || 0;
  const collections = Number(session.cash_collections) || 0;
  const refunds = Number(session.cash_refunds) || 0;
  const expenses = Number(session.cash_expenses) || 0;

  // FORMULA
  const expected = opening + collections - refunds - expenses;

  if (openFloatEl) openFloatEl.textContent = formatCurrency(opening);
  if (collectionsEl) collectionsEl.textContent = formatCurrency(collections);
  if (refundsEl) refundsEl.textContent = formatCurrency(refunds);
  if (expensesEl) expensesEl.textContent = formatCurrency(expenses);
  if (expectedEl) expectedEl.textContent = formatCurrency(expected);

  if (openSessionBtn) openSessionBtn.style.display = 'none';
  if (closeSessionBtn) closeSessionBtn.style.display = 'inline-block';
}

function renderSessionHistory(history) {
  const tbody = document.getElementById('session-history-tbody');
  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No drawer reconciliation history.</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(s => {
    const exp = Number(s.opening_cash) + Number(s.cash_collections) - Number(s.cash_refunds) - Number(s.cash_expenses);
    const act = s.actual_closing_cash !== null && s.actual_closing_cash !== undefined ? Number(s.actual_closing_cash) : null;
    const diff = act !== null ? (act - exp) : null;

    let diffBadge = `<span style="color: var(--text-muted);">-</span>`;
    if (diff !== null) {
      if (Math.abs(diff) < 0.01) {
        diffBadge = `<span class="badge badge-ready">BALANCED (₹0.00)</span>`;
      } else if (diff > 0) {
        diffBadge = `<span class="badge badge-preparing">+${formatCurrency(diff)} (OVER)</span>`;
      } else {
        diffBadge = `<span class="badge badge-cancelled">${formatCurrency(diff)} (SHORT)</span>`;
      }
    }

    return `
      <tr>
        <td style="font-weight: 700;">${s.session_date}</td>
        <td>${formatCurrency(s.opening_cash)}</td>
        <td style="color: var(--color-success); font-weight: 700;">+${formatCurrency(s.cash_collections)}</td>
        <td style="color: var(--color-danger); font-weight: 700;">−${formatCurrency(s.cash_expenses)}</td>
        <td style="font-weight: 800;">${formatCurrency(exp)}</td>
        <td style="font-weight: 800;">${act !== null ? formatCurrency(act) : 'Drawer Open'}</td>
        <td>${diffBadge}</td>
      </tr>
    `;
  }).join('');
}

function setupModals() {
  const openModal = document.getElementById('open-session-modal');
  const closeModal = document.getElementById('close-session-modal');

  // Trigger buttons
  document.getElementById('open-session-btn')?.addEventListener('click', () => {
    document.getElementById('open-float-input').value = '1000';
    openModal?.classList.add('active');
  });

  document.getElementById('close-session-btn')?.addEventListener('click', () => {
    if (!currentSession) return;
    const opening = Number(currentSession.opening_cash) || 0;
    const collections = Number(currentSession.cash_collections) || 0;
    const refunds = Number(currentSession.cash_refunds) || 0;
    const expenses = Number(currentSession.cash_expenses) || 0;
    const exp = opening + collections - refunds - expenses;

    document.getElementById('close-expected-display').textContent = formatCurrency(exp);
    document.getElementById('close-actual-cash-input').value = exp;
    document.getElementById('close-session-notes').value = '';
    updateDifferencePreview(exp, exp);
    closeModal?.classList.add('active');
  });

  // Close modals
  document.getElementById('open-session-close')?.addEventListener('click', () => openModal?.classList.remove('active'));
  document.getElementById('close-session-close')?.addEventListener('click', () => closeModal?.classList.remove('active'));

  // Difference calculator on input change
  const actualInput = document.getElementById('close-actual-cash-input');
  if (actualInput) {
    actualInput.addEventListener('input', () => {
      const exp = parseCurrencyString(document.getElementById('close-expected-display')?.textContent || '0');
      const act = parseFloat(actualInput.value) || 0;
      updateDifferencePreview(exp, act);
    });
  }

  // Open Form Submit
  document.getElementById('open-session-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const floatVal = parseFloat(document.getElementById('open-float-input')?.value || 0);

    try {
      if (isConfigured && supabase) {
        const { error } = await supabase.from('daily_cash_sessions').insert({
          session_date: new Date().toISOString().slice(0, 10),
          opening_cash: floatVal,
          opened_by: currentAdmin.id,
          status: 'open'
        });
        if (error) throw error;
      } else {
        const db = getMockDB();
        db.cash_session = {
          id: 'cs-' + Date.now(),
          session_date: new Date().toISOString().slice(0, 10),
          opening_cash: floatVal,
          cash_collections: 0.00,
          cash_refunds: 0.00,
          cash_expenses: 0.00,
          status: 'open',
          opened_at: new Date().toISOString()
        };
        saveMockDB(db);
      }

      showToast('Daily cash drawer opened with float of ' + formatCurrency(floatVal), 'success');
      openModal?.classList.remove('active');
      await loadCashSession();
    } catch (err) {
      showToast(err.message || 'Failed to open session', 'error');
    }
  });

  // Close Form Submit
  document.getElementById('close-session-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSession) return;

    const actual = parseFloat(document.getElementById('close-actual-cash-input')?.value || 0);
    const notes = document.getElementById('close-session-notes')?.value.trim();

    try {
      if (isConfigured && supabase) {
        const { error } = await supabase.functions.invoke('admin-operations', {
          body: {
            action: 'close_cash_session',
            payload: {
              session_id: currentSession.id,
              actual_closing_cash: actual,
              notes: notes
            }
          }
        });
        if (error) throw error;
      } else {
        const db = getMockDB();
        const exp = Number(db.cash_session.opening_cash) + Number(db.cash_session.cash_collections) - Number(db.cash_session.cash_expenses);
        db.cash_session.actual_closing_cash = actual;
        db.cash_session.cash_difference = actual - exp;
        db.cash_session.status = 'closed';
        db.cash_session.closed_at = new Date().toISOString();
        db.cash_session.notes = notes;
        saveMockDB(db);
      }

      showToast('Cash drawer successfully closed and reconciled!', 'success');
      closeModal?.classList.remove('active');
      await loadCashSession();
    } catch (err) {
      showToast(err.message || 'Failed to close session', 'error');
    }
  });
}

function updateDifferencePreview(expected, actual) {
  const diffEl = document.getElementById('close-diff-display');
  if (!diffEl) return;

  const diff = actual - expected;
  if (Math.abs(diff) < 0.01) {
    diffEl.innerHTML = `<span style="color: var(--color-success); font-weight: 700;">Balanced (Exact Match)</span>`;
  } else if (diff > 0) {
    diffEl.innerHTML = `<span style="color: #2563EB; font-weight: 700;">+${formatCurrency(diff)} (Cash Surplus)</span>`;
  } else {
    diffEl.innerHTML = `<span style="color: var(--color-danger); font-weight: 700;">${formatCurrency(diff)} (Cash Shortage)</span>`;
  }
}

function parseCurrencyString(str) {
  return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('cr-expected-cash')) {
      initCashRegister();
    }
  });
}
