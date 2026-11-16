// ==============================================================
// RISERS Sandwich Hub - Admin Profit & Business Reports Controller
// ==============================================================

import { supabase, isConfigured, getMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatCurrency, formatDateTime, formatDate, escapeHtml } from '../shared/utils.js';
import { exportToCSV, exportToExcel, exportToPDF } from '../shared/export.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let dateFilter = 'today';

export async function initReports() {
  currentAdmin = await requireAuth(['owner', 'manager']);
  if (!currentAdmin) return;

  setupDateFilters();
  setupExportButtons();
  await generateReport();
}

function setupDateFilters() {
  const filterBtns = document.querySelectorAll('.report-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      filterBtns.forEach(b => b.classList.remove('btn-primary'));
      filterBtns.forEach(b => b.classList.add('btn-secondary'));
      e.currentTarget.classList.remove('btn-secondary');
      e.currentTarget.classList.add('btn-primary');

      dateFilter = e.currentTarget.dataset.range;
      await generateReport();
    });
  });
}

export async function generateReport() {
  try {
    let orders = [];
    let payments = [];
    let expenses = [];
    let products = [];

    if (isConfigured && supabase) {
      const { data: ords } = await supabase.from('orders').select('*, order_items(*)');
      const { data: pays } = await supabase.from('payments').select('*');
      const { data: exps } = await supabase.from('expenses').select('*');
      const { data: prods } = await supabase.from('products').select('*');

      orders = ords || [];
      payments = pays || [];
      expenses = exps || [];
      products = prods || [];
    } else {
      const db = getMockDB();
      orders = db.orders;
      payments = db.payments;
      expenses = db.expenses;
      products = db.products;
    }

    const filteredOrders = filterByDate(orders, 'created_at');
    const filteredPayments = filterByDate(payments, 'confirmed_at');
    const filteredExpenses = filterByDate(expenses, 'expense_date');

    computeAndRenderReport(filteredOrders, filteredPayments, filteredExpenses, products);
  } catch (err) {
    console.error('Error generating report', err);
  }
}

function filterByDate(items, dateField) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return items.filter(item => {
    const d = new Date(item[dateField] || item.created_at);
    if (dateFilter === 'today') return d >= startOfToday;
    if (dateFilter === 'yesterday') {
      const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
      return d >= startOfYesterday && d < startOfToday;
    }
    if (dateFilter === '7days') return d >= new Date(startOfToday.getTime() - 7 * 86400000);
    if (dateFilter === '30days') return d >= new Date(startOfToday.getTime() - 30 * 86400000);
    return true;
  });
}

function computeAndRenderReport(orders, payments, expenses, products) {
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.order_status === 'completed').length;
  const cancelledOrders = orders.filter(o => o.order_status === 'cancelled').length;

  // Realized Revenue strictly from confirmed payments
  const paidRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const cashCollections = payments.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const upiCollections = payments.filter(p => p.payment_method === 'upi').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Unpaid Orders
  const pendingReceivables = orders
    .filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Overheads
  const totalOverheadExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Ingredient Cost calculation based on cost_price snapshot or product cost
  const prodCostMap = new Map(products.map(p => [p.name, Number(p.cost_price) || 0]));
  let totalIngredientCost = 0;

  // Count sandwich items sold
  const sandwichSalesMap = new Map();

  orders.forEach(o => {
    if (o.order_status !== 'cancelled') {
      const items = o.order_items || [];
      items.forEach(it => {
        const cost = prodCostMap.get(it.product_name) || (Number(it.unit_price) * 0.4);
        totalIngredientCost += (cost * (it.quantity || 1));

        const prev = sandwichSalesMap.get(it.product_name) || { qty: 0, revenue: 0 };
        sandwichSalesMap.set(it.product_name, {
          qty: prev.qty + it.quantity,
          revenue: prev.revenue + (it.unit_price * it.quantity)
        });
      });
    }
  });

  const grossProfit = paidRevenue - totalIngredientCost;
  const netProfit = grossProfit - totalOverheadExpenses;

  // Render to DOM
  setElText('rep-paid-revenue', formatCurrency(paidRevenue));
  setElText('rep-cash-collections', formatCurrency(cashCollections));
  setElText('rep-upi-collections', formatCurrency(upiCollections));
  setElText('rep-pending-receivables', formatCurrency(pendingReceivables));
  setElText('rep-ingredient-cogs', formatCurrency(totalIngredientCost));
  setElText('rep-operating-expenses', formatCurrency(totalOverheadExpenses));
  setElText('rep-gross-profit', formatCurrency(grossProfit));
  setElText('rep-net-profit', formatCurrency(netProfit));

  setElText('rep-total-orders', totalOrders);
  setElText('rep-completed-orders', completedOrders);
  setElText('rep-cancelled-orders', cancelledOrders);

  // Top Selling Table
  const tbody = document.getElementById('rep-best-sellers-tbody');
  if (tbody) {
    const sorted = Array.from(sandwichSalesMap.entries()).sort((a, b) => b[1].qty - a[1].qty);
    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No items sold in this period.</td></tr>`;
    } else {
      tbody.innerHTML = sorted.map(([name, stat], idx) => `
        <tr>
          <td>#${idx + 1}</td>
          <td style="font-weight: 700;">${escapeHtml(name)}</td>
          <td style="font-weight: 800; font-size: 1.05rem;">${stat.qty} units</td>
          <td style="font-weight: 700; color: var(--color-primary-dark);">${formatCurrency(stat.revenue)}</td>
        </tr>
      `).join('');
    }
  }
}

function setupExportButtons() {
  document.getElementById('rep-export-pdf-btn')?.addEventListener('click', () => {
    showToast('Exporting business summary statement to PDF...', 'info');
    const cols = [
      { header: 'Metric', key: 'metric' },
      { header: 'Value (INR)', key: 'value' }
    ];
    const rows = [
      { metric: 'Paid Sales Revenue', value: document.getElementById('rep-paid-revenue')?.textContent },
      { metric: 'Cash Collections at Stall', value: document.getElementById('rep-cash-collections')?.textContent },
      { metric: 'UPI Collections at Stall', value: document.getElementById('rep-upi-collections')?.textContent },
      { metric: 'Raw Ingredient Costs (COGS)', value: document.getElementById('rep-ingredient-cogs')?.textContent },
      { metric: 'Operating Expenses', value: document.getElementById('rep-operating-expenses')?.textContent },
      { metric: 'Estimated Net Business Profit', value: document.getElementById('rep-net-profit')?.textContent },
      { metric: 'Total Order Tickets', value: document.getElementById('rep-total-orders')?.textContent }
    ];

    exportToPDF(
      `RISERS_Business_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      'Business Performance & Profit Report',
      `Accounting Basis: Cash Realized (${dateFilter.toUpperCase()})`,
      cols,
      rows
    );
    showToast('Report PDF downloaded!', 'success');
  });
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('rep-net-profit')) {
      initReports();
    }
  });
}
