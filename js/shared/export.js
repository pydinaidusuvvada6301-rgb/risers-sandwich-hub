// ==============================================================
// RISERS Sandwich Hub - Export Engine
// Supports: CSV, Excel (.xlsx via SheetJS), PDF (via jsPDF & AutoTable), Receipts
// ==============================================================

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTablePlugin, { applyPlugin } from 'jspdf-autotable';
import { formatCurrency, formatDateTime } from './utils.js';

/**
 * Universal autoTable runner compatible with both browser bundling and Node
 */
function runAutoTable(doc, options) {
  if (typeof doc.autoTable === 'function') {
    doc.autoTable(options);
  } else if (typeof autoTablePlugin === 'function') {
    autoTablePlugin(doc, options);
  } else if (autoTablePlugin && typeof autoTablePlugin.default === 'function') {
    autoTablePlugin.default(doc, options);
  } else if (typeof applyPlugin === 'function') {
    applyPlugin(doc);
    if (typeof doc.autoTable === 'function') {
      doc.autoTable(options);
    }
  }
}

/**
 * Generates and triggers download of an RFC-4180 compliant CSV file
 */
export function exportToCSV(filename, columns, rows) {
  const headerLine = columns.map(col => `"${String(col.header).replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(row => {
    return columns.map(col => {
      let val = row[col.key];
      if (val === undefined || val === null) val = '';
      if (col.format && typeof col.format === 'function') {
        val = col.format(val, row);
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Generates and triggers download of a styled Excel (.xlsx) file using SheetJS
 */
export function exportToExcel(filename, sheetName, columns, rows, summaryTotals = null) {
  const data = rows.map(row => {
    const obj = {};
    columns.forEach(col => {
      let val = row[col.key];
      if (col.format && typeof col.format === 'function') {
        val = col.format(val, row);
      }
      obj[col.header] = val;
    });
    return obj;
  });

  if (summaryTotals && typeof summaryTotals === 'object') {
    data.push({}); // empty row
    data.push(summaryTotals); // summary row
  }

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set friendly column widths
  const colWidths = columns.map(c => ({ wch: Math.max(c.header.length + 4, 16) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Transactions');

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Generates and downloads a branded PDF transaction statement using jsPDF and autoTable
 */
export function exportToPDF(filename, title, subtitle, columns, rows, summaryInfo = null) {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  // Brand Header Background
  doc.setFillColor(217, 119, 6); // Warm Roasted Amber #D97706
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 70, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('RISERS SANDWICH HUB', 40, 36);

  // Motto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(254, 243, 199);
  doc.text('Rise Together, Serve Better! | Official Business Statement', 40, 52);

  // Subtitle / Filters
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 40, 100);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(`${subtitle} | Generated on: ${formatDateTime(new Date().toISOString())}`, 40, 116);

  let currentY = 135;

  // Render Summary Box if provided
  if (summaryInfo) {
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(40, currentY, doc.internal.pageSize.getWidth() - 80, 50, 6, 6, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'bold');

    const totalText = `Total Amount: ${formatCurrency(summaryInfo.totalAmount || 0)}`;
    const cashText = `Cash Collections: ${formatCurrency(summaryInfo.cashTotal || 0)}`;
    const upiText = `UPI Collections: ${formatCurrency(summaryInfo.upiTotal || 0)}`;
    const countText = `Records: ${rows.length}`;

    doc.text(totalText, 55, currentY + 30);
    doc.text(cashText, 250, currentY + 30);
    doc.text(upiText, 450, currentY + 30);
    doc.text(countText, 650, currentY + 30);

    currentY += 65;
  }

  // Format table data
  const head = [columns.map(c => c.header)];
  const body = rows.map(r => {
    return columns.map(col => {
      let val = r[col.key];
      if (col.format && typeof col.format === 'function') {
        val = col.format(val, r);
      }
      return val !== undefined && val !== null ? String(val) : '';
    });
  });

  runAutoTable(doc, {
    startY: currentY,
    head: head,
    body: body,
    theme: 'grid',
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      overflow: 'linebreak'
    },
    alternateRowStyles: {
      fillColor: [253, 251, 247]
    },
    margin: { left: 40, right: 40 }
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Downloads a single transaction receipt as a printable PDF
 */
export function downloadReceiptPDF(transaction, order) {
  const doc = new jsPDF('portrait', 'pt', [300, 480]); // Thermal receipt slip dimensions

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6);
  doc.text('RISERS SANDWICH HUB', 150, 35, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Rise Together, Serve Better!', 150, 48, { align: 'center' });
  doc.text('Stall #4, Food Street | Bengaluru', 150, 60, { align: 'center' });

  doc.setLineDash([2, 2]);
  doc.line(20, 72, 280, 72);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('PAYMENT RECEIPT', 150, 92, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  let y = 115;
  const printRow = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 25, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 275, y, { align: 'right' });
    y += 18;
  };

  printRow('Transaction ID:', (transaction.id || transaction.transaction_id || '').slice(0, 16));
  printRow('Order Number:', transaction.order_number || order?.order_number || '-');
  printRow('Date & Time:', formatDateTime(transaction.confirmed_at || transaction.created_at));
  printRow('Customer:', transaction.customer_reference || order?.customer_name || 'Guest');
  printRow('Payment Method:', (transaction.payment_method || 'cash').toUpperCase());
  if (transaction.upi_reference) {
    printRow('UPI Ref / UTR:', transaction.upi_reference);
  }
  printRow('Verified By:', transaction.verified_by || transaction.cashier_name || 'Cashier');
  printRow('Status:', 'PAID (VERIFIED)');

  doc.setLineDash([2, 2]);
  doc.line(20, y + 4, 280, y + 4);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(217, 119, 6);
  doc.text('AMOUNT RECEIVED:', 25, y);
  doc.text(formatCurrency(transaction.amount || order?.total_amount || 0), 275, y, { align: 'right' });

  y += 35;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('Thank you for choosing RISERS!', 150, y, { align: 'center' });
  doc.text('Please retain this slip for your records.', 150, y + 12, { align: 'center' });

  const safeOrderNo = (transaction.order_number || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Receipt_${safeOrderNo}.pdf`);
}

/**
 * Browser download helper for blobs
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
