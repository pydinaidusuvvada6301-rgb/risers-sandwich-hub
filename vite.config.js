import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        menu: resolve(__dirname, 'menu.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        trackOrder: resolve(__dirname, 'track-order.html'),
        feedback: resolve(__dirname, 'feedback.html'),
        about: resolve(__dirname, 'about.html'),
        contact: resolve(__dirname, 'contact.html'),
        adminGate: resolve(__dirname, 'admin/index.html'),
        adminLogin: resolve(__dirname, 'admin/login.html'),
        adminDashboard: resolve(__dirname, 'admin/dashboard.html'),
        adminOrders: resolve(__dirname, 'admin/orders.html'),
        adminKitchen: resolve(__dirname, 'admin/kitchen.html'),
        adminPayments: resolve(__dirname, 'admin/payments.html'),
        adminTransactions: resolve(__dirname, 'admin/transactions.html'),
        adminProducts: resolve(__dirname, 'admin/products.html'),
        adminInventory: resolve(__dirname, 'admin/inventory.html'),
        adminExpenses: resolve(__dirname, 'admin/expenses.html'),
        adminCashRegister: resolve(__dirname, 'admin/cash-register.html'),
        adminFeedback: resolve(__dirname, 'admin/feedback.html'),
        adminReports: resolve(__dirname, 'admin/reports.html'),
        adminStaff: resolve(__dirname, 'admin/staff.html'),
        adminSettings: resolve(__dirname, 'admin/settings.html')
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
