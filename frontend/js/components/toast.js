let toastTimer = null;

export function showToast(message) {
  let el = document.getElementById('bk-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bk-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
