// ==============================================================
// RISERS Sandwich Hub - Input Validation Helpers
// ==============================================================

/**
 * Validates a 10-digit Indian mobile number
 * Must begin with 6, 7, 8, or 9
 */
export function validateIndianMobile(phone) {
  if (!phone) return { valid: false, message: 'Mobile number is required' };
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length !== 10) {
    return { valid: false, message: 'Please enter exactly 10 digits' };
  }
  if (!/^[6-9]/.test(clean)) {
    return { valid: false, message: 'Indian mobile numbers must start with 6, 7, 8, or 9' };
  }
  return { valid: true, cleanPhone: clean };
}

/**
 * Validates customer name
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters' };
  }
  if (trimmed.length > 60) {
    return { valid: false, message: 'Name is too long' };
  }
  return { valid: true, cleanName: trimmed };
}

/**
 * Validates item quantity
 */
export function validateQuantity(qty) {
  const n = parseInt(qty, 10);
  if (isNaN(n) || n <= 0) {
    return { valid: false, message: 'Quantity must be at least 1' };
  }
  if (n > 50) {
    return { valid: false, message: 'Maximum quantity per sandwich is 50' };
  }
  return { valid: true, quantity: n };
}

/**
 * Sanitizes generic user text input
 */
export function sanitizeInput(text) {
  if (!text) return '';
  return String(text).trim().slice(0, 500);
}
