// ==============================================================
// RISERS Sandwich Hub - Admin Settings & Stall QR Generator Controller
// ==============================================================

import QRCode from 'qrcode';
import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { showToast } from '../shared/notifications.js';

let currentAdmin = null;
let currentSettings = null;

export async function initSettings() {
  currentAdmin = await requireAuth(['owner']);
  if (!currentAdmin) return;

  setupSettingsForm();
  setupQRGenerator();
  await loadSettings();
}

export async function loadSettings() {
  try {
    let settings = null;

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('id', 'stall_config')
        .single();

      if (error) throw error;
      settings = data;
    } else {
      const db = getMockDB();
      settings = db.settings;
    }

    currentSettings = settings;
    populateForm(settings);
    generatePrintableStallQR(settings.production_url || window.location.origin);
  } catch (err) {
    console.error('Error loading settings', err);
  }
}

function populateForm(s) {
  setVal('set-name', s.business_name || 'RISERS Sandwich Hub');
  setVal('set-tagline', s.tagline || 'Rise Together, Serve Better!');
  setVal('set-phone', s.contact_phone || '+91 98765 43210');
  setVal('set-address', s.stall_address || 'Stall #4, Food Street, Bangalore, India');
  setVal('set-upi-id', s.upi_id || 'risers@upi');
  setVal('set-hours', s.opening_hours || '11:00 AM - 10:30 PM');
  setVal('set-prod-url', s.production_url || window.location.origin);

  const openCheckbox = document.getElementById('set-is-open');
  if (openCheckbox) openCheckbox.checked = s.is_store_open !== false;
}

function setupSettingsForm() {
  const form = document.getElementById('settings-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      business_name: document.getElementById('set-name').value.trim(),
      tagline: document.getElementById('set-tagline').value.trim(),
      contact_phone: document.getElementById('set-phone').value.trim(),
      stall_address: document.getElementById('set-address').value.trim(),
      upi_id: document.getElementById('set-upi-id').value.trim(),
      opening_hours: document.getElementById('set-hours').value.trim(),
      production_url: document.getElementById('set-prod-url').value.trim(),
      is_store_open: document.getElementById('set-is-open').checked
    };

    try {
      if (isConfigured && supabase) {
        const { error } = await supabase
          .from('business_settings')
          .update(payload)
          .eq('id', 'stall_config');
        if (error) throw error;
      } else {
        const db = getMockDB();
        db.settings = { ...db.settings, ...payload };
        saveMockDB(db);
      }

      showToast('Stall settings updated successfully!', 'success');
      generatePrintableStallQR(payload.production_url);
    } catch (err) {
      showToast(err.message || 'Failed to update settings', 'error');
    }
  });
}

async function generatePrintableStallQR(targetUrl) {
  const canvas = document.getElementById('qr-canvas');
  const urlDisplay = document.getElementById('qr-url-display');
  if (!canvas) return;

  const orderUrl = targetUrl ? `${targetUrl.replace(/\/$/, '')}/menu.html` : `${window.location.origin}/menu.html`;
  if (urlDisplay) urlDisplay.textContent = orderUrl;

  try {
    await QRCode.toCanvas(canvas, orderUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('Failed to generate QR code', err);
  }
}

function setupQRGenerator() {
  document.getElementById('download-qr-btn')?.addEventListener('click', () => {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `RISERS_Stall_Counter_QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Downloaded High-Res Stall QR Code Poster (PNG)!', 'success');
  });

  document.getElementById('print-standee-btn')?.addEventListener('click', () => {
    window.print();
  });
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('settings-form')) {
      initSettings();
    }
  });
}
