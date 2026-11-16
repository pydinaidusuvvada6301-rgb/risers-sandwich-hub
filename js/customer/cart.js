// ==============================================================
// RISERS Sandwich Hub - Customer Shopping Cart
// ==============================================================

const CART_KEY = 'risers_customer_cart_v1';

export class Cart {
  static getItems() {
    try {
      const data = localStorage.getItem(CART_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveItems(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('risers:cart_updated', { detail: { items } }));
    } catch (err) {
      console.error('Failed to save cart', err);
    }
  }

  static addItem(product, quantity = 1) {
    const items = this.getItems();
    const existingIndex = items.findIndex(i => i.product_id === product.id);

    if (existingIndex > -1) {
      items[existingIndex].quantity = Math.min(items[existingIndex].quantity + quantity, 50);
    } else {
      items.push({
        product_id: product.id,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        is_veg: product.is_veg,
        quantity: Math.min(quantity, 50)
      });
    }

    this.saveItems(items);
    return items;
  }

  static updateQuantity(productId, quantity) {
    let items = this.getItems();
    if (quantity <= 0) {
      items = items.filter(i => i.product_id !== productId);
    } else {
      const target = items.find(i => i.product_id === productId);
      if (target) {
        target.quantity = Math.min(quantity, 50);
      }
    }
    this.saveItems(items);
    return items;
  }

  static removeItem(productId) {
    const items = this.getItems().filter(i => i.product_id !== productId);
    this.saveItems(items);
    return items;
  }

  static clear() {
    localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new CustomEvent('risers:cart_updated', { detail: { items: [] } }));
  }

  static getTotalCount() {
    return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  static getSubtotal() {
    const total = this.getItems().reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    return Math.round(total * 100) / 100;
  }

  static syncBadge() {
    const badges = document.querySelectorAll('.cart-count-badge');
    const count = this.getTotalCount();
    badges.forEach(b => {
      b.textContent = count;
      b.style.display = count > 0 ? 'inline-block' : 'none';
    });
  }
}

// Auto-sync cart badges on load and update
if (typeof window !== 'undefined') {
  window.addEventListener('risers:cart_updated', () => Cart.syncBadge());
  document.addEventListener('DOMContentLoaded', () => Cart.syncBadge());
}
