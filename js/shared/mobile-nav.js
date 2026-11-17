// ==============================================================
// RISERS Sandwich Hub - Mobile Navigation & Responsive Helper
// Provides accessible, smooth mobile drawer navigation
// ==============================================================

export function initMobileNav() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.getElementById('mobile-nav-backdrop');
  const closeBtn = document.getElementById('mobile-nav-close');

  if (!toggleBtn || !drawer) return;

  function openDrawer() {
    drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('visible');
    toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-locked');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('visible');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-locked');
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeDrawer();
    });
  }

  // Close when clicking any link inside drawer
  drawer.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      closeDrawer();
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });

  // Highlight active link
  const currentPath = window.location.pathname.toLowerCase();
  drawer.querySelectorAll('.mobile-nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const cleanHref = href.toLowerCase().replace(/^\//, '');
      const cleanPath = currentPath.replace(/^\//, '');
      if (cleanHref === cleanPath || (cleanHref === 'index.html' && (cleanPath === '' || cleanPath === 'index.html'))) {
        link.classList.add('active');
      }
    }
  });
}

// Auto initialize on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
  });
}
