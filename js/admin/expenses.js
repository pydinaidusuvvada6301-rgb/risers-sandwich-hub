// ==============================================================
// RISERS Sandwich Hub - Admin Expense Management Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, formatDate, escapeHtml } from '../shared/utils.js';
import { exportToCSV, exportToExcel, exportToPDF } from '../shared/export.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let allExpenses = [];

const EXPENSE_EXPORT_COLUMNS = [
  { header: 'Expense ID', key: 'id' },
  { header: 'Title / Description', key: 'title' },
  { header: 'Category', key: 'category', format: (v) => String(v).toUpperCase() },
  { header: 'Amount (INR)', key: 'amount', format: (v) => formatCurrency(v) },
  { header: 'Payment Method', key: 'payment_method', format: (v) => String(v).toUpperCase() },
  { header: 'Paid In Physical Cash', key: 'paid_in_cash', format: (v) => v ? 'YES' : 'NO' },
  { header: 'Expense Date', key: 'expense_date', format: (v) => formatDate(v) },
  { header: 'Notes', key: 'notes' }
];

export async function initExpenses() {
  currentAdmin = await requireAuth(['owner', 'manager']);
  if (!currentAdmin) return;

  setupModal();
  setupExportButtons();
  await loadExpenses();
}

export async function loadExpenses() {
  const tbody = document.getElementById('expenses-table-tbody');
  const totalAmountEl = document.getElementById('expenses-total-amount');
  const cashExpensesEl = document.getElementById('expenses-cash-amount');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading expense records...</td></tr>`;

  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) throw error;
      allExpenses = data || [];
    } else {
      const db = getMockDB();
      allExpenses = db.expenses;
    }

    let total = 0;
    let cashTotal = 0;

    allExpenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      total += amt;
      if (e.paid_in_cash) cashTotal += amt;
    });

    if (totalAmountEl) totalAmountEl.textContent = formatCurrency(total);
    if (cashExpensesEl) cashExpensesEl.textContent = formatCurrency(cashTotal);

    renderExpensesTable(allExpenses);
  } catch (err) {
    console.error('Error loading expenses', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 2rem;">Failed to load expenses: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expenses-table-tbody');
  if (!tbody) return;

  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">No expenses recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td style="font-weight: 700;">${escapeHtml(e.title)}</td>
      <td><span class="badge badge-pending">${escapeHtml(e.category).toUpperCase()}</span></td>
      <td style="font-weight: 800; font-size: 1.05rem; color: var(--color-danger);">${formatCurrency(e.amount)}</td>
      <td>${(e.payment_method || 'cash').toUpperCase()}</td>
      <td>
        <span class="badge ${e.paid_in_cash ? 'badge-cancelled' : 'badge-completed'}">
          ${e.paid_in_cash ? 'CASH DRAWER' : 'ONLINE/BANK'}
        </span>
      </td>
      <td style="font-size: 0.85rem; color: var(--text-muted);">${formatDate(e.expense_date)}</td>
      <td style="font-size: 0.85rem;">${escapeHtml(e.notes || '-')}</td>
    </tr>
  `).join('');
}

function setupModal() {
  const modal = document.getElementById('expense-modal');
  const openBtn = document.getElementById('open-add-expense-btn');
  const closeBtn = document.getElementById('expense-modal-close');
  const form = document.getElementById('expense-form');
  const methodSelect = document.getElementById('exp-method');
  const paidCashCheckbox = document.getElementById('exp-paid-in-cash');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      document.getElementById('exp-title').value = '';
      document.getElementById('exp-amount').value = '';
      document.getElementById('exp-notes').value = '';
      document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
      modal.classList.add('active');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (methodSelect && paidCashCheckbox) {
    methodSelect.addEventListener('change', () => {
      paidCashCheckbox.checked = (methodSelect.value === 'cash');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('exp-title').value.trim();
      const category = document.getElementById('exp-category').value;
      const amount = parseFloat(document.getElementById('exp-amount').value);
      const payment_method = document.getElementById('exp-method').value;
      const paid_in_cash = document.getElementById('exp-paid-in-cash').checked;
      const expense_date = document.getElementById('exp-date').value;
      const notes = document.getElementById('exp-notes').value.trim();

      const payload = {
        title,
        category,
        amount,
        payment_method,
        paid_in_cash,
        expense_date,
        notes
      };

      try {
        if (isConfigured && supabase) {
          const { error } = await supabase.from('expenses').insert({
            ...payload,
            created_by: currentAdmin.id
          });
          if (error) throw error;
        } else {
          // Mock save
          const db = getMockDB();
          payload.id = 'exp-' + Date.now();
          payload.created_at = new Date().toISOString();
          db.expenses.unshift(payload);

          // Update active cash session if paid in cash
          if (paid_in_cash) {
            db.cash_session.cash_expenses = (Number(db.cash_session.cash_expenses) || 0) + amount;
          }

          saveMockDB(db);
        }

        showToast(`Expense "${title}" recorded!`, 'success');
        modal.classList.remove('active');
        await loadExpenses();
      } catch (err) {
        showToast(err.message || 'Failed to record expense', 'error');
      }
    });
  }
}

function setupExportButtons() {
  const getDynamicDateStr = () => new Date().toISOString().slice(0, 10);

  document.getElementById('exp-export-csv')?.addEventListener('click', () => {
    if (allExpenses.length === 0) return;
    exportToCSV(`RISERS_Expenses_${getDynamicDateStr()}.csv`, EXPENSE_EXPORT_COLUMNS, allExpenses);
    showToast('Exported expenses to CSV!', 'success');
  });

  document.getElementById('exp-export-xlsx')?.addEventListener('click', () => {
    if (allExpenses.length === 0) return;
    exportToExcel(`RISERS_Expenses_${getDynamicDateStr()}.xlsx`, 'Expenses', EXPENSE_EXPORT_COLUMNS, allExpenses);
    showToast('Exported expenses to Excel (.xlsx)!', 'success');
  });

  document.getElementById('exp-export-pdf')?.addEventListener('click', () => {
    if (allExpenses.length === 0) return;
    exportToPDF(
      `RISERS_Expenses_${getDynamicDateStr()}.pdf`,
      'Stall Expense Report',
      'Operational Overhead Ledger',
      EXPENSE_EXPORT_COLUMNS,
      allExpenses
    );
    showToast('Generated Expense PDF Statement!', 'success');
  });
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('expenses-table-tbody')) {
      initExpenses();
    }
  });
}
