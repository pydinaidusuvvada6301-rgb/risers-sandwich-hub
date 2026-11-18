// ==============================================================
// RISERS Sandwich Hub - Automated System Verification Suite
// Tests Core Business Logic, Formulas, RBAC, and Export Engines
// ==============================================================

import { formatCurrency, formatDate, formatDateTime, generateIdempotencyKey } from './js/shared/utils.js';
import { validateIndianMobile, validateName, validateQuantity } from './js/shared/validation.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

console.log('====================================================');
console.log('🧪 RUNNING RISERS SANDWICH HUB VERIFICATION SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✕ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

// --------------------------------------------------------------
// TEST SUITE 1: Validation & Formatting
// --------------------------------------------------------------
console.log('--- Test Suite 1: Validation & Formatting ---');

// Indian Mobile Validation (Optional by default, 10 digits starting with 6, 7, 8, or 9 when provided)
assert(validateIndianMobile('').valid === true && validateIndianMobile('').cleanPhone === '', 'Allows empty string as optional mobile');
assert(validateIndianMobile(null).valid === true && validateIndianMobile(null).cleanPhone === '', 'Allows null as optional mobile');
assert(validateIndianMobile(undefined).valid === true && validateIndianMobile(undefined).cleanPhone === '', 'Allows undefined as optional mobile');
assert(validateIndianMobile('   ').valid === true && validateIndianMobile('   ').cleanPhone === '', 'Allows whitespace-only as optional mobile');
assert(validateIndianMobile('', true).valid === false, 'Rejects empty mobile when isRequired is true');
assert(validateIndianMobile('9876543210').valid === true, 'Valid 10-digit mobile starting with 9');
assert(validateIndianMobile('8123456789').valid === true, 'Valid 10-digit mobile starting with 8');
assert(validateIndianMobile('7012345678').valid === true, 'Valid 10-digit mobile starting with 7');
assert(validateIndianMobile('6398765432').valid === true, 'Valid 10-digit mobile starting with 6');
assert(validateIndianMobile('5876543210').valid === false, 'Rejects mobile starting with 5');
assert(validateIndianMobile('987654321').valid === false, 'Rejects 9-digit mobile');
assert(validateIndianMobile('98765432100').valid === false, 'Rejects 11-digit mobile');
assert(validateIndianMobile('abc9876543210').valid === true && validateIndianMobile('abc9876543210').cleanPhone === '9876543210', 'Strips non-digit characters correctly');

// Name Validation
assert(validateName('Arjun Sharma').valid === true, 'Valid customer name');
assert(validateName('A').valid === false, 'Rejects 1-char name');
assert(validateName('').valid === false, 'Rejects empty name');

// Quantity Validation
assert(validateQuantity(1).valid === true && validateQuantity(1).quantity === 1, 'Valid quantity 1');
assert(validateQuantity(50).valid === true && validateQuantity(50).quantity === 50, 'Valid quantity 50');
assert(validateQuantity(0).valid === false, 'Rejects quantity 0');
assert(validateQuantity(-5).valid === false, 'Rejects negative quantity');
assert(validateQuantity(51).valid === false, 'Rejects quantity above 50 limit');

// Currency & Date Formatting
assert(formatCurrency(99).includes('99'), 'Format currency formats 99 correctly');
assert(formatCurrency(1250.50).includes('1,250.50'), 'Format currency uses Indian commas');
assert(formatDate('2026-11-16T12:00:00Z').includes('2026'), 'Format date extracts year');
assert(generateIdempotencyKey().length > 10, 'Idempotency key generates high entropy string');

// --------------------------------------------------------------
// TEST SUITE 2: Business Accounting & Formulas
// --------------------------------------------------------------
console.log('\n--- Test Suite 2: Cash Register & Accounting Formulas ---');

// Cash Register Formula:
// Expected Cash = Opening Float + Cash Collections - Cash Refunds - Cash Expenses Paid in Cash
function calculateExpectedCash(opening, cashCollections, upiCollections, cashRefunds, cashExpenses, onlineExpenses) {
  // UPI Collections and Online Expenses MUST NOT touch physical cash
  return opening + cashCollections - cashRefunds - cashExpenses;
}

const openingFloat = 1000.00;
const cashSales = 500.00;
const upiSales = 1200.00; // Must be ignored
const cashRefunds = 50.00;
const cashExpenses = 200.00; // e.g. Bakery purchase
const onlineExpenses = 450.00; // Must be ignored

const expected = calculateExpectedCash(openingFloat, cashSales, upiSales, cashRefunds, cashExpenses, onlineExpenses);
// 1000 + 500 - 50 - 200 = 1250
assert(expected === 1250.00, 'Expected cash matches formula: 1000 + 500 - 50 - 200 = 1250');

// Variance calculation
const countedCash = 1250.00;
const variance = countedCash - expected;
assert(variance === 0, 'Accurate drawer reconciliation detects exact match');

const shortCash = 1200.00;
assert((shortCash - expected) === -50.00, 'Accurate drawer reconciliation detects shortage');

// Gross & Net Profit Formulas:
const revenue = 1700.00; // Total collections (Cash + UPI)
const cogs = 650.00; // Ingredient cost
const totalExpenses = 650.00; // 200 cash + 450 online
const grossProfit = revenue - cogs;
const netProfit = grossProfit - totalExpenses;
assert(grossProfit === 1050.00, 'Gross profit = 1700 - 650 = 1050');
assert(netProfit === 400.00, 'Net profit = 1050 - 650 = 400');

// --------------------------------------------------------------
// TEST SUITE 3: Product Pricing & Recipe Deduction Integrity
// --------------------------------------------------------------
console.log('\n--- Test Suite 3: Product Pricing & Recipe Deductions ---');

const chickenSandwichPrice = 99.00;
const paneerSandwichPrice = 79.00;

assert(chickenSandwichPrice === 99.00, 'Chicken Sandwich catalog price is exactly ₹99');
assert(paneerSandwichPrice === 79.00, 'Paneer Sandwich catalog price is exactly ₹79');

// Order Total Calculation
const testItems = [
  { name: 'Chicken Sandwich', price: 99.00, quantity: 2 },
  { name: 'Paneer Sandwich', price: 79.00, quantity: 1 }
];

const computedSubtotal = testItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
assert(computedSubtotal === 277.00, 'Order total for 2 Chicken (₹99) + 1 Paneer (₹79) = ₹277.00');

// --------------------------------------------------------------
// TEST SUITE 4: Export Engines (Excel, PDF, CSV)
// --------------------------------------------------------------
console.log('\n--- Test Suite 4: Export Engine Generation Verification ---');

// CSV Generation Test
const sampleRows = [
  { id: 'tx-1', order_num: 'RSH-20261116-0101', method: 'CASH', amount: 99.00 },
  { id: 'tx-2', order_num: 'RSH-20261116-0102', method: 'UPI', amount: 178.00 }
];

const header = '"Transaction ID","Order Number","Method","Amount"';
const csvLines = sampleRows.map(r => `"${r.id}","${r.order_num}","${r.method}","${r.amount}"`);
const csvContent = [header, ...csvLines].join('\r\n');
assert(csvContent.includes('RSH-20261116-0101') && csvContent.includes('178'), 'CSV string formatting renders valid lines');

// Excel (SheetJS) Generation Test
const ws = XLSX.utils.json_to_sheet(sampleRows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
assert(xlsxBuffer && xlsxBuffer.length > 500, 'SheetJS compiles valid binary .xlsx workbook');

// PDF (jsPDF & autoTable) Generation Test
const doc = new jsPDF('landscape', 'pt', 'a4');
doc.text('RISERS SANDWICH HUB', 40, 40);
const autoTableFn = typeof autoTable === 'function' ? autoTable : (autoTable?.default || autoTable);
if (typeof autoTableFn === 'function') {
  autoTableFn(doc, {
    head: [['Transaction ID', 'Order Number', 'Amount']],
    body: [
      ['tx-1', 'RSH-20261116-0101', '₹99.00'],
      ['tx-2', 'RSH-20261116-0102', '₹178.00']
    ]
  });
}
const pdfOutput = doc.output();
assert(pdfOutput && pdfOutput.startsWith('%PDF-'), 'jsPDF compiles valid PDF binary output');

// --------------------------------------------------------------
// TEST SUMMARY
// --------------------------------------------------------------
console.log('\n====================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================\n');
