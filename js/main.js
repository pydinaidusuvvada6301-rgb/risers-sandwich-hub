// ==============================================================
// RISERS Sandwich Hub - Main Customer Entry Point
// ==============================================================

import { Cart } from './customer/cart.js';

document.addEventListener('DOMContentLoaded', () => {
  Cart.syncBadge();
  console.log('RISERS Sandwich Hub initialized: Rise Together, Serve Better!');
});
