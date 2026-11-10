// Helpers shared by all pages.
const SB = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  money(n) {
    const v = Number(n) || 0;
    return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  },

  timeAgo(iso) {
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  },

  // Talks to the backend. Throws Error(message) on any problem.
  async api(path, { method = 'GET', body, formData } = {}) {
    const headers = {};
    const isAdmin = path.startsWith('/api/admin');
    if (isAdmin) {
      const t = localStorage.getItem('sb_admin_token');
      if (t) headers.Authorization = 'Bearer ' + t;
    }
    let payload;
    if (formData) payload = formData;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, { method, headers, body: payload });
    } catch {
      throw new Error('Cannot reach the server. Check your Wi-Fi and that the server is running.');
    }
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (res.status === 401 && isAdmin && !path.endsWith('/login')) {
      localStorage.removeItem('sb_admin_token');
      location.href = '/admin/login.html';
      throw new Error('Please log in again.');
    }
    if (!res.ok) throw new Error((data && data.error) || 'Request failed (' + res.status + ').');
    return data;
  },

  toast(message, type = 'info') {
    let box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = message;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
  },

  fallbackImg(img) {
    img.onerror = null;
    img.src = '/assets/images/food/default.svg';
  },
};
