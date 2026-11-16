// ==============================================================
// RISERS Sandwich Hub - Shared Utilities
// Timezone: Asia/Kolkata | Currency: INR (₹)
// ==============================================================

/**
 * Format a numeric amount to Indian Rupee format (e.g., ₹1,234.50)
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(num);
}

/**
 * Format date string into human-readable Indian date (Asia/Kolkata)
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

/**
 * Format timestamp into date and time in Asia/Kolkata
 */
export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Sanitize and escape HTML entities to prevent XSS
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Debounce helper for search and filter inputs
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Generate a random UUID / idempotency key
 */
export function generateIdempotencyKey() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
