// Shopping cart: data (saved in the phone's localStorage) + the cart drawer + placing the order.
const Cart = (() => {
  const KEY = 'sb_cart_v1';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch { items = []; }
  if (!Array.isArray(items)) items = [];
  items = items.filter((i) => i && i.id && i.qty > 0);
  const listeners = [];
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode */ }
    listeners.forEach((fn) => fn());
  };
  const find = (id) => items.find((i) => i.id === id);

  return {
    items: () => items,
    qty: (id) => (find(id) || {}).qty || 0,
    count: () => items.reduce((s, i) => s + i.qty, 0),
    total: () => Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100,
    onChange: (fn) => listeners.push(fn),
    add(food) {
      const e = find(food.id);
      if (e) { if (e.qty < 20) e.qty++; }
      else items.push({ id: food.id, name: food.name, price: food.price, imageUrl: food.imageUrl, qty: 1 });
      save();
    },
    inc(id) { const e = find(id); if (e && e.qty < 20) { e.qty++; save(); } },
    dec(id) { const e = find(id); if (!e) return; e.qty--; if (e.qty <= 0) items = items.filter((i) => i.id !== id); save(); },
    remove(id) { items = items.filter((i) => i.id !== id); save(); },
    clear() { items = []; save(); },
    // Make the cart match the latest menu (removes deleted/unavailable food, refreshes prices).
    sync(menuItems) {
      const map = new Map(menuItems.map((m) => [m.id, m]));
      const before = JSON.stringify(items);
      items = items.filter((i) => map.has(i.id)).map((i) => ({ ...i, name: map.get(i.id).name, price: map.get(i.id).price, imageUrl: map.get(i.id).imageUrl }));
      if (JSON.stringify(items) !== before) save();
    },
  };
})();

const CartUI = (() => {
  const $ = (id) => document.getElementById(id);
  let totalTables = 10;

  function render() {
    const list = Cart.items();
    $('cartCount').textContent = Cart.count();
    $('cartTotal').textContent = SB.money(Cart.total());
    $('floatCount').textContent = Cart.count();
    $('floatTotal').textContent = SB.money(Cart.total());
    $('floatCart').hidden = Cart.count() === 0 || $('cartDrawer').classList.contains('open');
    $('placeOrderBtn').disabled = list.length === 0;

    if (list.length === 0) {
      $('cartItems').innerHTML = '<div class="cart-empty">Your cart is empty.<br>Add something tasty from the menu.</div>';
      return;
    }
    $('cartItems').innerHTML = list.map((i) => `
      <div class="cart-line" data-id="${SB.esc(i.id)}">
        <img src="${SB.esc(i.imageUrl)}" alt="" onerror="SB.fallbackImg(this)">
        <div>
          <h4>${SB.esc(i.name)}</h4>
          <small>${SB.money(i.price)} each</small>
          <div class="qty" style="margin-top:6px">
            <button type="button" data-act="dec" aria-label="Decrease quantity">&minus;</button>
            <span>${i.qty}</span>
            <button type="button" data-act="inc" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="line-right">
          <strong>${SB.money(i.price * i.qty)}</strong>
          <button type="button" class="link-danger" data-act="remove">Remove</button>
        </div>
      </div>`).join('');
  }

  function open() {
    $('cartDrawer').classList.add('open');
    $('cartDrawer').setAttribute('aria-hidden', 'false');
    $('overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    render();
  }
  function close() {
    $('cartDrawer').classList.remove('open');
    $('cartDrawer').setAttribute('aria-hidden', 'true');
    $('overlay').hidden = true;
    document.body.style.overflow = '';
    render();
  }

  function showError(msg) {
    const el = $('formError');
    el.textContent = msg;
    el.hidden = !msg;
  }

  async function submit(e) {
    e.preventDefault();
    showError('');
    if (Cart.count() === 0) return showError('Your cart is empty. Add at least one item.');
    const name = $('custName').value.trim();
    const phone = $('custPhone').value.trim();
    const table = $('custTable').value;
    if (name.length < 2) return showError('Please enter your name.');
    if (phone && !/^\+?\d[\d\s-]{6,15}$/.test(phone)) return showError('Phone number looks wrong. Use digits only, or leave it empty.');
    if (!table) return showError('Please select your table number.');

    const btn = $('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Placing order...';
    try {
      const order = await SB.api('/api/orders', {
        method: 'POST',
        body: {
          customerName: name,
          phone,
          tableNumber: Number(table),
          note: $('custNote').value.trim(),
          items: Cart.items().map((i) => ({ id: i.id, quantity: i.qty })),
        },
      });
      try {
        localStorage.setItem('sb_last_order', order.orderId);
        localStorage.setItem('sb_customer', JSON.stringify({ name, phone }));
      } catch { /* ignore */ }
      Cart.clear();
      $('custNote').value = '';
      close();
      $('confName').textContent = order.customerName;
      $('confOrderId').textContent = order.orderId;
      $('confTable').textContent = order.tableNumber;
      $('confTotal').textContent = SB.money(order.total);
      $('trackLink').href = '/order-status.html?id=' + encodeURIComponent(order.orderId);
      $('confirmModal').hidden = false;
    } catch (err) {
      showError(err.message);
    } finally {
      btn.textContent = 'Place order';
      btn.disabled = Cart.count() === 0;
    }
  }

  function init(tables, presetTable) {
    totalTables = tables;
    let opts = '<option value="">Select your table</option>';
    for (let t = 1; t <= totalTables; t++) opts += `<option value="${t}">Table ${t}</option>`;
    $('custTable').innerHTML = opts;
    if (presetTable) $('custTable').value = String(presetTable);
    try {
      const c = JSON.parse(localStorage.getItem('sb_customer') || 'null');
      if (c) { $('custName').value = c.name || ''; $('custPhone').value = c.phone || ''; }
    } catch { /* ignore */ }

    $('cartBtn').addEventListener('click', open);
    $('floatCart').addEventListener('click', open);
    $('closeCart').addEventListener('click', close);
    $('overlay').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); } });
    $('confClose').addEventListener('click', () => { $('confirmModal').hidden = true; });
    $('orderForm').addEventListener('submit', submit);
    $('cartItems').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.closest('.cart-line').dataset.id;
      if (btn.dataset.act === 'inc') Cart.inc(id);
      if (btn.dataset.act === 'dec') Cart.dec(id);
      if (btn.dataset.act === 'remove') Cart.remove(id);
    });
    let last = Cart.count();
    Cart.onChange(() => {
      render();
      if (Cart.count() > last) { const b = $('cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
      last = Cart.count();
    });
    render();
  }

  return { init, open };
})();
