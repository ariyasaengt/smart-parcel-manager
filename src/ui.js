// Minimal toast system & simple helpers (replace alert/confirm)
export function toast(message, { type = 'info', duration = 3000 } = {}) {
  let container = document.getElementById('app-toasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'app-toasts';
    container.style.position = 'fixed';
    container.style.right = '16px';
    container.style.top = '16px';
    container.style.zIndex = 9999;
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.textContent = message;
  el.style.marginTop = '8px';
  el.style.padding = '10px 14px';
  el.style.borderRadius = '8px';
  el.style.background = type === 'error' ? '#fee2e2' : '#ecfccb';
  el.style.color = '#111827';
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function confirmModal(message) {
  // simple fallback: use native confirm for now, can be upgraded to accessible dialog
  return Promise.resolve(window.confirm(message));
}
