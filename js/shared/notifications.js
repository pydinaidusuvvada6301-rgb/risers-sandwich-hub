// ==============================================================
// RISERS Sandwich Hub - Notifications & Audio Chime
// ==============================================================

/**
 * Display a floating toast notification
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'} type 
 * @param {number} durationMs 
 */
export function showToast(message, type = 'info', durationMs = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' 
             : type === 'error' ? '✕' 
             : type === 'warning' ? '⚠' 
             : 'ℹ';

  toast.innerHTML = `<span><strong>${icon}</strong></span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

/**
 * Synthesizes a kitchen order bell chime using the Web Audio API
 */
export function playKitchenChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone bell chime
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (err) {
    console.warn('Audio chime could not play', err);
  }
}
