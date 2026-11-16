// ==============================================================
// RISERS Sandwich Hub - Admin Feedback Controller
// ==============================================================

import { supabase, isConfigured, getMockDB } from '../config/supabase.js';
import { requireAuth } from './auth.js';
import { formatDateTime, escapeHtml } from '../shared/utils.js';

let currentAdmin = null;

export async function initFeedback() {
  currentAdmin = await requireAuth(['owner', 'manager']);
  if (!currentAdmin) return;

  await loadFeedback();
}

export async function loadFeedback() {
  const container = document.getElementById('feedback-cards-container');
  const avgRatingEl = document.getElementById('fb-avg-rating');
  const totalReviewsEl = document.getElementById('fb-total-count');
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 2rem;">Loading reviews...</div>`;

  try {
    let reviews = [];

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          id,
          order_id,
          overall_rating,
          food_rating,
          service_rating,
          comments,
          created_at,
          orders (
            order_number,
            token_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      reviews = data || [];
    } else {
      const db = getMockDB();
      reviews = db.feedback.map(f => {
        const order = db.orders.find(o => o.id === f.order_id);
        return {
          ...f,
          orders: {
            order_number: order ? order.order_number : 'RSH-20261116-0100',
            token_number: order ? order.token_number : 100
          }
        };
      });
    }

    const totalCount = reviews.length;
    const avgScore = totalCount > 0
      ? (reviews.reduce((sum, r) => sum + r.overall_rating, 0) / totalCount).toFixed(1)
      : '5.0';

    if (avgRatingEl) avgRatingEl.textContent = avgScore;
    if (totalReviewsEl) totalReviewsEl.textContent = `${totalCount} verified reviews`;

    renderReviews(reviews);
  } catch (err) {
    console.error('Error loading feedback', err);
    container.innerHTML = `<div style="color: var(--color-danger); text-align: center; padding: 2rem;">Failed to load reviews: ${escapeHtml(err.message)}</div>`;
  }
}

function renderReviews(reviews) {
  const container = document.getElementById('feedback-cards-container');
  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">No reviews submitted yet.</div>`;
    return;
  }

  container.innerHTML = reviews.map(r => {
    const stars = '★'.repeat(r.overall_rating) + '☆'.repeat(5 - r.overall_rating);

    return `
      <div class="card" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <div style="color: #F59E0B; font-size: 1.25rem; letter-spacing: 2px;">${stars}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Token #${r.orders?.token_number || '-'} (${r.orders?.order_number || 'N/A'})
            </div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${formatDateTime(r.created_at)}</div>
        </div>

        <div style="margin-bottom: 0.75rem; font-size: 0.95rem; font-style: italic;">
          "${escapeHtml(r.comments || 'No written comment.')}"
        </div>

        <div style="display: flex; gap: 1.5rem; font-size: 0.85rem; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 0.5rem;">
          <span>Taste: <strong>${r.food_rating || r.overall_rating}/5</strong></span>
          <span>Stall Service: <strong>${r.service_rating || r.overall_rating}/5</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('feedback-cards-container')) {
      initFeedback();
    }
  });
}
