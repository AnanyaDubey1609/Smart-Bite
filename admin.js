// Admin dashboard logic: stats, live orders, order actions, menu management, QR codes.
(function () {
  if (!localStorage.getItem('sb_admin_token')) { location.replace('/admin/login.html'); return; }

  const $ = (id) => document.getElementById(id);
  const state = { orders: [], menu: [], categories: [], filter: 'active', tab: 'overview', qrLoaded: false, editingId: null };
  const TITLES = { overview: 'Overview', orders: 'Orders', menu: 'Menu', qr: 'QR codes' };

  // ---------------- Tabs ----------------
  function showTab(name) {
    state.tab = name;
    document.querySelectorAll('.tab').forEach((s) => (s.hidden = s.id !== 'tab-' + name));
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $('pageTitle').textContent = TITLES[name];
    if (name === 'qr' && !state.qrLoaded) loadQr(false);
  }
  $('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('logoutBtn').addEventListener('click', () => { localStorage.removeItem('sb_admin_token'); location.href = '/admin/login.html'; });

  // ---------------- Stats ----------------
  let statsTimer = null;
  async function loadStats() {
    try {
      const s = await SB.api('/api/admin/stats');
      $('stTotal').textContent = s.totalOrders;
      $('stPending').textContent = s.pendingOrders;
      $('stCompleted').textContent = s.completedOrders;
      $('stSales').textContent = SB.money(s.totalSales);
      $('stExtra').textContent = `Today: ${s.todaysOrders} orders | Preparing: ${s.preparingOrders} | Ready: ${s.readyOrders} | Rejected: ${s.rejectedOrders}. Sales count completed orders only.`;
      $('navPending').textContent = s.pendingOrders;
      $('navPending').hidden = s.pendingOrders === 0;
    } catch (e) { /* shown elsewhere */ }
  }
  const refreshStats = () => { clearTimeout(statsTimer); statsTimer = setTimeout(loadStats, 250); };

  // ---------------- Orders ----------------
  function actionsFor(o) {
    const b = (status, label, cls) => `<button type="button" class="btn btn-sm ${cls}" data-status="${status}">${label}</button>`;
    if (o.status === 'Pending') return b('Preparing', 'Accept', 'btn-primary') + b('Rejected', 'Reject', 'btn-danger');
    if (o.status === 'Preparing') return b('Ready', 'Mark ready', 'btn-primary');
    if (o.status === 'Ready') return b('Completed', 'Mark completed', 'btn-primary');
    return '';
  }

  function orderCard(o, flash) {
    return `<article class="order-card is-${o.status}${flash ? ' flash' : ''}" data-id="${SB.esc(o.orderId)}">
      <div class="oc-head"><strong>${SB.esc(o.orderId)}</strong><span class="badge ${o.status}">${o.status}</span></div>
      <div class="oc-meta">
        <span>Table <b>${o.tableNumber}</b></span>
        <span>${SB.esc(o.customerName)}</span>
        ${o.phone ? `<span>${SB.esc(o.phone)}</span>` : ''}
        <span>${SB.timeAgo(o.createdAt)}</span>
      </div>
      <ul class="lines">${o.items.map((i) => `<li><span>${i.quantity} &times; ${SB.esc(i.name)}</span><span>${SB.money(i.subtotal)}</span></li>`).join('')}</ul>
      ${o.note ? `<div class="note">Note: ${SB.esc(o.note)}</div>` : ''}
      <div class="oc-foot"><strong>${SB.money(o.total)}</strong><div class="actions">${actionsFor(o)}</div></div>
    </article>`;
  }

  function renderOrders(flashId) {
    $('recentOrders').innerHTML = state.orders.slice(0, 6).map((o) => orderCard(o, o.orderId === flashId)).join('') ||
      '<div class="empty">No orders yet. New orders will appear here automatically.</div>';

    let list = state.orders;
    if (state.filter === 'active') list = list.filter((o) => ['Pending', 'Preparing', 'Ready'].includes(o.status));
    else if (state.filter !== 'all') list = list.filter((o) => o.status === state.filter);
    // Oldest active orders first so the kitchen serves in order; history newest first.
    if (state.filter === 'active') list = [...list].reverse();
    $('ordersList').innerHTML = list.map((o) => orderCard(o, o.orderId === flashId)).join('') ||
      '<div class="empty">No orders in this view.</div>';
  }

  async function loadOrders() {
    const r = await SB.api('/api/admin/orders');
    state.orders = r.orders;
    renderOrders();
  }

  async function changeStatus(orderId, status, btn) {
    if (status === 'Rejected' && !confirm('Reject this order? The customer will see it as rejected.')) return;
    btn.disabled = true;
    try {
      const updated = await SB.api(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: { status } });
      upsertOrder(updated);
      renderOrders();
      refreshStats();
      SB.toast(`${orderId} is now ${status}`, 'success');
    } catch (e) {
      SB.toast(e.message, 'error');
      btn.disabled = false;
    }
  }
  function upsertOrder(o) {
    const i = state.orders.findIndex((x) => x.orderId === o.orderId);
    if (i >= 0) state.orders[i] = o; else state.orders.unshift(o);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    changeStatus(b.closest('.order-card').dataset.id, b.dataset.status, b);
  });
  $('orderFilters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    state.filter = b.dataset.f;
    document.querySelectorAll('#orderFilters button').forEach((x) => x.classList.toggle('active', x === b));
    renderOrders();
  });

  // ---------------- Real-time (Server-Sent Events) ----------------
  let audioCtx = null;
  document.addEventListener('click', () => {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* no sound */ }
  }, { once: true });
  function beep() {
    try {
      if (!audioCtx) return;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.5);
    } catch { /* ignore */ }
  }

  function setLive(on) {
    const el = $('liveState');
    el.className = 'live ' + (on ? 'on' : 'off');
    el.querySelector('em').textContent = on ? 'Live: new orders appear automatically' : 'Offline: reconnecting...';
  }

  let es = null;
  function connectStream() {
    if (es) es.close();
    es = new EventSource('/api/admin/stream?token=' + encodeURIComponent(localStorage.getItem('sb_admin_token')));
    es.addEventListener('connected', () => { setLive(true); loadOrders().then(refreshStats).catch(() => {}); });
    es.addEventListener('order-new', (ev) => {
      const o = JSON.parse(ev.data);
      upsertOrder(o);
      renderOrders(o.orderId);
      refreshStats();
      beep();
      SB.toast(`New order ${o.orderId} from Table ${o.tableNumber}`, 'success');
    });
    es.addEventListener('order-update', (ev) => {
      const o = JSON.parse(ev.data);
      upsertOrder(o);
      renderOrders();
      refreshStats();
    });
    es.onerror = () => {
      setLive(false);
      if (es.readyState === EventSource.CLOSED) {
        // Connection was refused (maybe the login expired). This call logs out if so.
        SB.api('/api/admin/stats').then(() => setTimeout(connectStream, 3000)).catch(() => {});
      }
    };
  }

  // Keep "x min ago" fresh
  setInterval(() => renderOrders(), 60000);

  // ---------------- Menu management ----------------
  function fillCategories() {
    $('fCat').innerHTML = state.categories.map((c) => `<option>${SB.esc(c)}</option>`).join('');
    $('menuCat').innerHTML = '<option value="">All categories</option>' + state.categories.map((c) => `<option>${SB.esc(c)}</option>`).join('');
  }

  function renderMenu() {
    const q = $('menuSearch').value.trim().toLowerCase();
    const cat = $('menuCat').value;
    const list = state.menu.filter((m) => (!cat || m.category === cat) && (!q || (m.name + ' ' + m.description).toLowerCase().includes(q)));
    $('menuBody').innerHTML = list.map((m) => `
      <tr data-id="${SB.esc(m.id)}">
        <td><div class="item-cell"><img src="${SB.esc(m.imageUrl)}" alt="" onerror="SB.fallbackImg(this)"><div><strong>${SB.esc(m.name)}</strong><small>${SB.esc(m.description)}</small></div></div></td>
        <td>${SB.esc(m.category)}</td>
        <td><strong>${SB.money(m.price)}</strong></td>
        <td><label class="switch"><input type="checkbox" data-act="toggle" ${m.available !== false ? 'checked' : ''} aria-label="Show ${SB.esc(m.name)} on menu"><span></span></label></td>
        <td><div class="actions"><button type="button" class="btn btn-sm btn-outline" data-act="edit">Edit</button><button type="button" class="btn btn-sm btn-danger" data-act="delete">Delete</button></div></td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:28px">No food items found.</td></tr>';
  }

  async function loadMenu() {
    const r = await SB.api('/api/admin/menu');
    state.menu = r.items; state.categories = r.categories;
    fillCategories(); renderMenu();
  }

  $('menuSearch').addEventListener('input', renderMenu);
  $('menuCat').addEventListener('change', renderMenu);

  $('menuBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('tr').dataset.id;
    const item = state.menu.find((m) => m.id === id);
    if (!item) return;
    if (b.dataset.act === 'edit') openModal(item);
    if (b.dataset.act === 'delete') {
      if (!confirm(`Delete "${item.name}" from the menu? This cannot be undone.`)) return;
      try {
        await SB.api('/api/admin/menu/' + encodeURIComponent(id), { method: 'DELETE' });
        state.menu = state.menu.filter((m) => m.id !== id);
        renderMenu(); SB.toast('Food item deleted', 'success');
      } catch (err) { SB.toast(err.message, 'error'); }
    }
  });
  $('menuBody').addEventListener('change', async (e) => {
    if (e.target.dataset.act !== 'toggle') return;
    const id = e.target.closest('tr').dataset.id;
    try {
      const u = await SB.api('/api/admin/menu/' + encodeURIComponent(id), { method: 'PUT', body: { available: e.target.checked } });
      state.menu = state.menu.map((m) => (m.id === id ? u : m));
      SB.toast(u.available ? 'Item is on the menu' : 'Item hidden from the menu', 'success');
    } catch (err) { SB.toast(err.message, 'error'); e.target.checked = !e.target.checked; }
  });

  // Add / edit modal
  function openModal(item) {
    state.editingId = item ? item.id : null;
    $('foodModalTitle').textContent = item ? 'Edit food item' : 'Add food item';
    $('fName').value = item ? item.name : '';
    $('fCat').value = item ? item.category : state.categories[0];
    $('fPrice').value = item ? item.price : '';
    $('fDesc').value = item ? item.description : '';
    $('fImage').value = item && !item.imageUrl.endsWith('default.svg') ? item.imageUrl : '';
    $('fFile').value = '';
    $('fAvail').checked = item ? item.available !== false : true;
    $('fError').hidden = true;
    updatePreview();
    $('foodModal').hidden = false;
    $('fName').focus();
  }
  function closeModal() { $('foodModal').hidden = true; }
  function updatePreview(src) {
    const p = $('fPreview');
    const s = src || $('fImage').value.trim();
    if (s) { p.src = s; p.hidden = false; p.onerror = () => { p.hidden = true; }; } else p.hidden = true;
  }
  $('addFoodBtn').addEventListener('click', () => openModal(null));
  $('fCancel').addEventListener('click', closeModal);
  $('foodModal').addEventListener('click', (e) => { if (e.target === $('foodModal')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('foodModal').hidden) closeModal(); });
  $('fImage').addEventListener('input', () => updatePreview());
  $('fFile').addEventListener('change', () => {
    const f = $('fFile').files[0];
    if (f) updatePreview(URL.createObjectURL(f));
  });

  $('foodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('fError'); err.hidden = true;
    const btn = $('fSave'); btn.disabled = true; btn.textContent = 'Saving...';
    try {
      let imageUrl = $('fImage').value.trim();
      const file = $('fFile').files[0];
      if (file) {
        const fd = new FormData(); fd.append('image', file);
        imageUrl = (await SB.api('/api/admin/upload', { method: 'POST', formData: fd })).url;
      }
      const body = {
        name: $('fName').value, category: $('fCat').value, price: $('fPrice').value,
        description: $('fDesc').value, imageUrl, available: $('fAvail').checked,
      };
      if (state.editingId) {
        const u = await SB.api('/api/admin/menu/' + encodeURIComponent(state.editingId), { method: 'PUT', body });
        state.menu = state.menu.map((m) => (m.id === u.id ? u : m));
        SB.toast('Food item updated', 'success');
      } else {
        const c = await SB.api('/api/admin/menu', { method: 'POST', body });
        state.menu.push(c);
        SB.toast('Food item added', 'success');
      }
      await loadMenu();
      closeModal();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { btn.disabled = false; btn.textContent = 'Save'; }
  });

  // ---------------- QR codes ----------------
  function renderQr(list) {
    $('qrGrid').innerHTML = list.map((q) => `
      <div class="qr-card">
        <img src="${SB.esc(q.image)}" alt="QR code for table ${q.table}">
        <h3>Table ${q.table}</h3>
        <small>${SB.esc(q.url)}</small>
        <a class="btn btn-sm btn-outline" href="${SB.esc(q.download)}" download="smart-bite-table-${q.table}.png">Download PNG</a>
      </div>`).join('');
  }
  async function loadQr(manual) {
    const btn = $('qrGenBtn');
    btn.disabled = true; btn.textContent = 'Generating...';
    try {
      const base = $('qrBase').value.trim();
      const r = await SB.api('/api/admin/qr/generate', { method: 'POST', body: base ? { baseUrl: base } : {} });
      state.qrLoaded = true;
      $('qrBase').value = r.baseUrl;
      renderQr(r.qrCodes);
      if (manual) SB.toast(`${r.qrCodes.length} QR codes created`, 'success');
    } catch (e) { SB.toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Generate QR codes'; }
  }
  $('qrGenBtn').addEventListener('click', () => loadQr(true));
  $('qrPrintBtn').addEventListener('click', () => {
    if (!$('qrGrid').children.length) return SB.toast('Generate the QR codes first.', 'error');
    window.print();
  });
  async function loadQrInfo() {
    try {
      const i = await SB.api('/api/admin/qr/info');
      $('qrBase').value = i.baseUrl;
      $('qrHint').textContent = /localhost|127\.0\.0\.1/.test(i.baseUrl)
        ? 'Warning: "localhost" only works on this laptop. Put your laptop Wi-Fi IP here (like http://192.168.1.5:3000) so phones can open the menu.'
        : 'Phones on the same Wi-Fi can open this address. If you change the address, generate the codes again.';
    } catch { /* ignore */ }
  }

  // ---------------- Start ----------------
  (async function init() {
    showTab('overview');
    setLive(false);
    $('liveState').querySelector('em').textContent = 'Connecting...';
    try {
      await Promise.all([loadOrders(), loadMenu(), loadStats(), loadQrInfo()]);
    } catch (e) { SB.toast(e.message, 'error'); }
    connectStream();
  })();
})();
