// ==============================================================
// RISERS Sandwich Hub - Downloadable Transactions Controller
// Mandatory Requirement: CSV, Excel (.xlsx), PDF Statements & Receipts
// ==============================================================

import { supabase, isConfigured, getMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, formatDateTime, formatDate, escapeHtml, debounce } from '../shared/utils.js';
import { exportToCSV, exportToExcel, exportToPDF, downloadReceiptPDF } from '../shared/export.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let allTransactions = [];
let filteredTransactions = [];

// Table columns definition for export and display
const EXPORT_COLUMNS = [
  { header: 'Transaction ID', key: 'transaction_id' },
  { header: 'Order Number', key: 'order_number' },
  { header: 'Customer Reference', key: 'customer_reference' },
  { header: 'Date & Time (IST)', key: 'confirmed_at', format: (v) => formatDateTime(v) },
  { header: 'Payment Method', key: 'payment_method', format: (v) => String(v || '').toUpperCase() },
  { header: 'Transaction Type', key: 'transaction_type' },
  { header: 'Amount (INR)', key: 'amount', format: (v) => formatCurrency(v) },
  { header: 'Payment Status', key: 'payment_status', format: (v) => String(v || '').toUpperCase() },
  { header: 'UPI Reference (UTR)', key: 'upi_reference' },
  { header: 'Verified By (Staff)', key: 'verified_by' },
  { header: 'Confirmation Time', key: 'confirmed_at', format: (v) => formatDateTime(v) }
];

export async function initTransactions() {
  currentAdmin = await requireAuth(['owner', 'manager']);
  if (!currentAdmin) return;

  setupFilters();
  setupDownloadButtons();
  await loadTransactions();
}

export async function loadTransactions() {
  const tbody = document.getElementById('transactions-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem;">Loading transaction records...</td></tr>`;

  try {
    if (isConfigured && supabase) {
      // Fetch via Supabase Edge Function or joined tables
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          order_id,
          payment_method,
          amount,
          payment_status,
          upi_reference,
          cashier_name,
          confirmed_at,
          created_at,
          orders (
            order_number,
            customer_name,
            total_amount
          )
        `)
        .order('confirmed_at', { ascending: false });

      if (error) throw error;

      allTransactions = (data || []).map(p => ({
        transaction_id: p.id,
        order_id: p.order_id,
        order_number: p.orders?.order_number || 'N/A',
        customer_reference: p.orders?.customer_name || 'Guest',
        payment_method: p.payment_method,
        transaction_type: p.payment_method === 'cash' ? 'Cash Received' : 'UPI Received',
        amount: Number(p.amount) || 0,
        payment_status: p.payment_status || 'paid',
        upi_reference: p.upi_reference || '-',
        verified_by: p.cashier_name || 'Staff',
        confirmed_at: p.confirmed_at || p.created_at
      }));
    } else {
      // Local mock database
      const db = getMockDB();
      allTransactions = db.payments.map(p => {
        const order = db.orders.find(o => o.id === p.order_id);
        return {
          transaction_id: p.id,
          order_id: p.order_id,
          order_number: order ? order.order_number : 'RSH-20261116-0100',
          customer_reference: order ? order.customer_name : 'Guest',
          payment_method: p.payment_method,
          transaction_type: p.payment_method === 'cash' ? 'Cash Received' : 'UPI Received',
          amount: Number(p.amount) || 0,
          payment_status: p.payment_status || 'paid',
          upi_reference: p.upi_reference || '-',
          verified_by: p.cashier_name || 'Store Cashier',
          confirmed_at: p.confirmed_at || p.created_at
        };
      });
    }

    applyFilters();
  } catch (err) {
    console.error('Error loading transactions', err);
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--color-danger); padding: 2rem;">Failed to load transactions: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function setupFilters() {
  const searchInput = document.getElementById('tx-search');
  const datePreset = document.getElementById('tx-date-preset');
  const customRange = document.getElementById('tx-custom-range');
  const startDate = document.getElementById('tx-start-date');
  const endDate = document.getElementById('tx-end-date');
  const methodFilter = document.getElementById('tx-method-filter');
  const statusFilter = document.getElementById('tx-status-filter');

  const onFilterChange = debounce(() => applyFilters(), 250);

  if (searchInput) searchInput.addEventListener('input', onFilterChange);
  if (methodFilter) methodFilter.addEventListener('change', onFilterChange);
  if (statusFilter) statusFilter.addEventListener('change', onFilterChange);

  if (datePreset) {
    datePreset.addEventListener('change', () => {
      if (datePreset.value === 'custom') {
        if (customRange) customRange.style.display = 'flex';
      } else {
        if (customRange) customRange.style.display = 'none';
        applyFilters();
      }
    });
  }

  if (startDate) startDate.addEventListener('change', onFilterChange);
  if (endDate) endDate.addEventListener('change', onFilterChange);
}

function applyFilters() {
  const search = (document.getElementById('tx-search')?.value || '').toLowerCase().trim();
  const preset = document.getElementById('tx-date-preset')?.value || 'all';
  const method = document.getElementById('tx-method-filter')?.value || 'all';
  const status = document.getElementById('tx-status-filter')?.value || 'all';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  filteredTransactions = allTransactions.filter(tx => {
    // Search
    const matchSearch = !search ||
      tx.transaction_id.toLowerCase().includes(search) ||
      tx.order_number.toLowerCase().includes(search) ||
      tx.customer_reference.toLowerCase().includes(search) ||
      String(tx.upi_reference).toLowerCase().includes(search);

    // Method
    const matchMethod = method === 'all' || tx.payment_method === method;

    // Status
    const matchStatus = status === 'all' || tx.payment_status === status;

    // Date
    const txDate = new Date(tx.confirmed_at);
    let matchDate = true;

    if (preset === 'today') {
      matchDate = txDate >= startOfToday;
    } else if (preset === 'yesterday') {
      const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
      matchDate = txDate >= startOfYesterday && txDate < startOfToday;
    } else if (preset === '7days') {
      const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 86400000);
      matchDate = txDate >= sevenDaysAgo;
    } else if (preset === '30days') {
      const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 86400000);
      matchDate = txDate >= thirtyDaysAgo;
    } else if (preset === 'custom') {
      const sVal = document.getElementById('tx-start-date')?.value;
      const eVal = document.getElementById('tx-end-date')?.value;
      if (sVal) {
        matchDate = matchDate && txDate >= new Date(sVal);
      }
      if (eVal) {
        const endD = new Date(eVal);
        endD.setHours(23, 59, 59, 999);
        matchDate = matchDate && txDate <= endD;
      }
    }

    return matchSearch && matchMethod && matchStatus && matchDate;
  });

  renderTransactionsTable(filteredTransactions);
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactions-table-tbody');
  const countEl = document.getElementById('tx-count-label');
  const totalAmountEl = document.getElementById('tx-total-amount');
  const cashTotalEl = document.getElementById('tx-cash-total');
  const upiTotalEl = document.getElementById('tx-upi-total');
  if (!tbody) return;

  let totalAmt = 0;
  let cashAmt = 0;
  let upiAmt = 0;

  transactions.forEach(t => {
    const a = Number(t.amount) || 0;
    totalAmt += a;
    if (t.payment_method === 'cash') cashAmt += a;
    if (t.payment_method === 'upi') upiAmt += a;
  });

  if (countEl) countEl.textContent = `Showing ${transactions.length} transactions`;
  if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalAmt);
  if (cashTotalEl) cashTotalEl.textContent = formatCurrency(cashAmt);
  if (upiTotalEl) upiTotalEl.textContent = formatCurrency(upiAmt);

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-muted); padding: 3rem;">No transactions matching the selected filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td style="font-family: var(--font-mono); font-size: 0.8rem;">${(t.transaction_id || '').slice(0, 10)}...</td>
      <td style="font-weight: 700;">${escapeHtml(t.order_number)}</td>
      <td>${escapeHtml(t.customer_reference)}</td>
      <td style="font-size: 0.85rem; color: var(--text-muted);">${formatDateTime(t.confirmed_at)}</td>
      <td>
        <span class="badge ${t.payment_method === 'cash' ? 'badge-pending' : 'badge-preparing'}">
          ${(t.payment_method || 'cash').toUpperCase()}
        </span>
      </td>
      <td>${t.transaction_type}</td>
      <td style="font-weight: 800; color: var(--color-success);">${formatCurrency(t.amount)}</td>
      <td><span class="badge badge-ready">${(t.payment_status || 'paid').toUpperCase()}</span></td>
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${escapeHtml(t.upi_reference)}</td>
      <td>${escapeHtml(t.verified_by)}</td>
      <td style="font-size: 0.85rem; color: var(--text-muted);">${formatDateTime(t.confirmed_at)}</td>
      <td>
        <button class="btn btn-secondary btn-sm download-receipt-btn" data-id="${t.transaction_id}">
          🧾 Receipt PDF
        </button>
      </td>
    </tr>
  `).join('');

  // Bind single receipt downloads
  tbody.querySelectorAll('.download-receipt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const txId = e.currentTarget.dataset.id;
      const tx = allTransactions.find(t => t.transaction_id === txId);
      if (tx) {
        downloadReceiptPDF(tx);
        showToast(`Downloaded receipt for Order #${tx.order_number}`, 'success');
      }
    });
  });
}

function setupDownloadButtons() {
  const csvBtn = document.getElementById('download-csv-btn');
  const xlsxBtn = document.getElementById('download-xlsx-btn');
  const pdfBtn = document.getElementById('download-pdf-btn');

  const getDynamicDateStr = () => {
    return new Date().toISOString().slice(0, 10);
  };

  const getSummary = () => {
    let total = 0, cash = 0, upi = 0;
    filteredTransactions.forEach(t => {
      const a = Number(t.amount) || 0;
      total += a;
      if (t.payment_method === 'cash') cash += a;
      if (t.payment_method === 'upi') upi += a;
    });
    return {
      totalAmount: total,
      cashTotal: cash,
      upiTotal: upi
    };
  };

  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      if (filteredTransactions.length === 0) {
        showToast('No transactions to export with current filters', 'warning');
        return;
      }
      const filename = `RISERS_Transactions_${getDynamicDateStr()}.csv`;
      exportToCSV(filename, EXPORT_COLUMNS, filteredTransactions);
      showToast(`Exported ${filteredTransactions.length} records to CSV!`, 'success');
    });
  }

  if (xlsxBtn) {
    xlsxBtn.addEventListener('click', () => {
      if (filteredTransactions.length === 0) {
        showToast('No transactions to export with current filters', 'warning');
        return;
      }
      const filename = `RISERS_Transactions_${getDynamicDateStr()}.xlsx`;
      const summary = getSummary();
      const summaryObj = {
        'Transaction ID': 'TOTAL',
        'Amount (INR)': formatCurrency(summary.totalAmount),
        'Payment Method': `Cash: ${formatCurrency(summary.cashTotal)} | UPI: ${formatCurrency(summary.upiTotal)}`
      };
      exportToExcel(filename, 'Stall Transactions', EXPORT_COLUMNS, filteredTransactions, summaryObj);
      showToast(`Generated Excel statement: ${filename}`, 'success');
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      if (filteredTransactions.length === 0) {
        showToast('No transactions to export with current filters', 'warning');
        return;
      }
      const filename = `RISERS_Transactions_${getDynamicDateStr()}.pdf`;
      const summary = getSummary();
      exportToPDF(
        filename,
        'Financial Transactions Statement',
        'Official Stall Register Reconciliation',
        EXPORT_COLUMNS,
        filteredTransactions,
        summary
      );
      showToast(`Generated PDF Statement: ${filename}`, 'success');
    });
  }
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('transactions-table-tbody')) {
      initTransactions();
    }
  });
}
