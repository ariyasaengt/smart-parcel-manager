export function showToast(message, type = 'info') {
  const id = 'toast-container';
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement('div');
    container.id = id;
    container.className = 'fixed right-4 top-4 z-[9999] space-y-2';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `rounded-lg border px-3 py-2 text-xs shadow ${type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}
