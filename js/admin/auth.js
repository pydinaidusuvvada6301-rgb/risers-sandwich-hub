// ==============================================================
// RISERS Sandwich Hub - Admin Authentication & Route Guards
// ==============================================================

import { supabase, isConfigured, getMockDB } from '../config/supabase.js';
import { showToast } from '../shared/notifications.js';

const GATE_TICKET_SESSION_KEY = 'risers_admin_gate_ticket_v1';
const MOCK_AUTH_USER_KEY = 'risers_mock_admin_user_v1';

/**
 * Validates the admin gate ticket or redirects to the access code challenge
 */
export function checkGateUnlocked() {
  const ticket = sessionStorage.getItem(GATE_TICKET_SESSION_KEY);
  if (!ticket) {
    const rawPath = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
    const isGatePage = rawPath === '/admin' || 
                       rawPath === '/admin/index' || 
                       rawPath.endsWith('/admin/index.html');
    if (!isGatePage) {
      window.location.href = '/admin/index.html';
    }
    return false;
  }
  return true;
}

/**
 * Sets the gate ticket in memory/sessionStorage upon successful Edge Function verification
 */
export function setGateTicket(ticket) {
  sessionStorage.setItem(GATE_TICKET_SESSION_KEY, ticket || 'unlocked');
}

/**
 * Gets currently logged in admin user and role
 */
export async function getCurrentAdmin() {
  if (isConfigured && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return null;

    const { data: profile } = await supabase
      .from('admin_users')
      .select('id, email, full_name, role, is_active')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_active) return null;
    return profile;
  } else {
    // Mock user for offline local development
    try {
      const raw = localStorage.getItem(MOCK_AUTH_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      return null;
    }
    return null;
  }
}

/**
 * Guard function to be called at the top of every protected admin page
 * @param {string[]} allowedRoles - e.g. ['owner', 'manager', 'cashier', 'kitchen']
 */
export async function requireAuth(allowedRoles = ['owner', 'manager', 'cashier', 'kitchen']) {
  // 1. Ensure security gate was passed
  if (!checkGateUnlocked()) return null;

  // 2. Fetch authenticated admin profile
  const admin = await getCurrentAdmin();
  if (!admin) {
    window.location.href = '/admin/login.html';
    return null;
  }

  // 3. Verify role authorization
  if (allowedRoles.length > 0 && !allowedRoles.includes(admin.role)) {
    showToast(`Access Denied: Your role (${admin.role}) cannot access this section.`, 'error');
    // Redirect to default authorized view
    if (admin.role === 'kitchen') {
      window.location.href = '/admin/kitchen.html';
    } else {
      window.location.href = '/admin/dashboard.html';
    }
    return null;
  }

  // 4. Update UI with admin details
  populateAdminSidebar(admin);

  return admin;
}

/**
 * Perform login via email and password
 */
export async function loginAdmin(email, password) {
  if (isConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Check admin_users table
    const { data: profile, error: profErr } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profErr || !profile || !profile.is_active) {
      await supabase.auth.signOut();
      throw new Error('Access Denied: You do not have an active staff role assigned.');
    }

    return profile;
  } else {
    // Offline Mock Login for testing
    // Accepts owner@risers.com, manager@risers.com, cashier@risers.com, kitchen@risers.com
    const cleanEmail = email.toLowerCase().trim();
    let role = 'owner';
    let name = 'Store Owner';

    if (cleanEmail.includes('manager')) {
      role = 'manager';
      name = 'Store Manager';
    } else if (cleanEmail.includes('cashier')) {
      role = 'cashier';
      name = 'Counter Cashier';
    } else if (cleanEmail.includes('kitchen')) {
      role = 'kitchen';
      name = 'Head Grill Cook';
    }

    const mockAdmin = {
      id: 'mock-admin-' + role,
      email: cleanEmail,
      full_name: name,
      role: role,
      is_active: true
    };

    localStorage.setItem(MOCK_AUTH_USER_KEY, JSON.stringify(mockAdmin));
    return mockAdmin;
  }
}

/**
 * Logout admin user
 */
export async function logoutAdmin() {
  if (isConfigured && supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(MOCK_AUTH_USER_KEY);
  sessionStorage.removeItem(GATE_TICKET_SESSION_KEY);
  window.location.href = '/admin/index.html';
}

/**
 * Render user profile info in the admin sidebar & topbar
 */
function populateAdminSidebar(admin) {
  const nameEls = document.querySelectorAll('.admin-name');
  const roleEls = document.querySelectorAll('.admin-role');
  const avatarEls = document.querySelectorAll('.admin-avatar');

  nameEls.forEach(el => el.textContent = admin.full_name);
  roleEls.forEach(el => el.textContent = admin.role.toUpperCase());

  const initials = admin.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  avatarEls.forEach(el => el.textContent = initials || 'R');

  // Mobile admin sidebar toggle & backdrop
  const sidebar = document.getElementById('admin-sidebar');
  const toggleBtn = document.getElementById('admin-sidebar-toggle');
  let backdrop = document.getElementById('admin-sidebar-backdrop');
  if (!backdrop && sidebar) {
    backdrop = document.createElement('div');
    backdrop.id = 'admin-sidebar-backdrop';
    backdrop.className = 'admin-sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  const closeAdminSidebar = () => {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('visible');
    document.body.classList.remove('admin-sidebar-open');
  };

  const openAdminSidebar = () => {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('visible');
    document.body.classList.add('admin-sidebar-open');
  };

  const toggleAdminSidebar = () => {
    if (!sidebar) return;
    if (sidebar.classList.contains('mobile-open')) {
      closeAdminSidebar();
    } else {
      openAdminSidebar();
    }
  };

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAdminSidebar();
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener('click', () => {
      closeAdminSidebar();
    });
  }

  // Close when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
      closeAdminSidebar();
    }
  });

  // Close when clicking any navigation link inside sidebar on mobile
  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-nav-item a, .sidebar-brand, .logout-btn').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
          closeAdminSidebar();
        }
      });
    });
  }

  // Bind logout buttons
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutAdmin();
    });
  });

  // Hide nav items not permitted for this role
  applyRoleNavFilters(admin.role);
}

/**
 * Filters sidebar navigation items based on Role-Based Access Control
 */
function applyRoleNavFilters(role) {
  const roleRules = {
    kitchen: ['kitchen', 'logout'],
    cashier: ['dashboard', 'orders', 'payments', 'cash-register', 'logout'],
    manager: ['dashboard', 'orders', 'kitchen', 'payments', 'transactions', 'products', 'inventory', 'expenses', 'cash-register', 'feedback', 'reports', 'logout'],
    owner: ['dashboard', 'orders', 'kitchen', 'payments', 'transactions', 'products', 'inventory', 'expenses', 'cash-register', 'feedback', 'reports', 'staff', 'settings', 'logout']
  };

  const allowedNav = roleRules[role] || [];
  document.querySelectorAll('[data-nav-id]').forEach(item => {
    const navId = item.dataset.navId;
    if (!allowedNav.includes(navId)) {
      item.style.display = 'none';
    } else {
      item.style.display = '';
    }
  });
}
