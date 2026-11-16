// ==============================================================
// RISERS Sandwich Hub - Customer Feedback Controller
// ==============================================================

import { supabase, isConfigured, getMockDB, saveMockDB } from '../config/supabase.js';
import { showToast } from '../shared/notifications.js';
import { sanitizeInput } from '../shared/validation.js';

let ratings = {
  overall: 5,
  food: 5,
  service: 5
};

export function initFeedback() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');

  const orderInput = document.getElementById('feedback-order-id');
  if (orderInput && orderId) {
    orderInput.value = orderId;
  }

  setupStarRatings();
  setupFeedbackForm();
}

function setupStarRatings() {
  const categories = ['overall', 'food', 'service'];

  categories.forEach(cat => {
    const starContainer = document.getElementById(`stars-${cat}`);
    if (!starContainer) return;

    const stars = starContainer.querySelectorAll('.star');

    const updateVisuals = (val) => {
      stars.forEach(s => {
        const sVal = parseInt(s.dataset.value, 10);
        if (sVal <= val) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    };

    updateVisuals(ratings[cat]);

    stars.forEach(s => {
      s.addEventListener('mouseenter', () => {
        const val = parseInt(s.dataset.value, 10);
        stars.forEach(star => {
          star.classList.toggle('hovered', parseInt(star.dataset.value, 10) <= val);
        });
      });

      s.addEventListener('mouseleave', () => {
        stars.forEach(star => star.classList.remove('hovered'));
      });

      s.addEventListener('click', () => {
        const val = parseInt(s.dataset.value, 10);
        ratings[cat] = val;
        updateVisuals(val);
      });
    });
  });
}

function setupFeedbackForm() {
  const form = document.getElementById('feedback-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const orderId = document.getElementById('feedback-order-id')?.value;
    const comments = sanitizeInput(document.getElementById('feedback-comments')?.value || '');
    const submitBtn = document.getElementById('submit-feedback-btn');

    if (!orderId) {
      showToast('Order reference is required to submit feedback', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting your review...';
    }

    try {
      if (isConfigured && supabase) {
        const { error } = await supabase.from('feedback').insert({
          order_id: orderId,
          overall_rating: ratings.overall,
          food_rating: ratings.food,
          service_rating: ratings.service,
          comments: comments
        });

        if (error) {
          if (error.code === '23505') {
            throw new Error('Feedback for this order has already been submitted. Thank you!');
          }
          throw error;
        }
      } else {
        // Mock fallback
        const db = getMockDB();
        const existing = db.feedback.find(f => f.order_id === orderId);
        if (existing) {
          throw new Error('Feedback for this order has already been submitted. Thank you!');
        }

        db.feedback.push({
          id: 'fb-' + Date.now(),
          order_id: orderId,
          overall_rating: ratings.overall,
          food_rating: ratings.food,
          service_rating: ratings.service,
          comments: comments,
          created_at: new Date().toISOString()
        });
        saveMockDB(db);
      }

      showToast('Thank you! Your feedback helps us Serve Better.', 'success');
      
      const card = document.getElementById('feedback-card');
      if (card) {
        card.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
            <h2 style="margin-bottom: 0.75rem;">Review Received!</h2>
            <p style="color: var(--text-muted); margin-bottom: 2rem; max-width: 450px; margin-left: auto; margin-right: auto;">
              Thank you for sharing your experience. We toast every sandwich with passion and love hearing from our community!
            </p>
            <a href="index.html" class="btn btn-primary">Back to Home</a>
          </div>
        `;
      }
    } catch (err) {
      console.error('Feedback submission error:', err);
      showToast(err.message || 'Could not submit review', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Review';
      }
    }
  });
}

// Auto init on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('feedback-form')) {
      initFeedback();
    }
  });
}
