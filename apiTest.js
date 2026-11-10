// Automatic test: starts the server in demo mode and checks the whole ordering flow.
// Run with:  npm test
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3999;
const B = `http://localhost:${PORT}`;
let passed = 0, failed = 0;
const ok = (cond, name) => { cond ? passed++ : failed++; console.log((cond ? '  PASS  ' : '  FAIL  ') + name); };
const j = async (p, o = {}) => {
  const r = await fetch(B + p, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers || {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { s: r.status, d };
};

async function run() {
  const server = spawn('node', [path.join(__dirname, '..', 'backend', 'server.js')], {
    env: { ...process.env, PORT, USE_MOCK_DB: 'true', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'Test12345', JWT_SECRET: 'testsecret', TOTAL_TABLES: '10' },
    stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 30; i++) { try { await fetch(B + '/api/config'); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

    for (const p of ['/', '/order-status.html', '/admin/login.html', '/admin/dashboard.html', '/css/style.css', '/css/admin.css', '/js/menu.js', '/js/cart.js', '/js/admin.js', '/assets/images/logo.svg'])
      ok((await fetch(B + p)).status === 200, `page loads: ${p}`);

    const menu = await j('/api/menu');
    ok(menu.s === 200 && menu.d.items.length === 24, 'menu has 24 sample items');
    ok(menu.d.categories.length === 6, 'six categories');
    const pizza = menu.d.items.find((i) => i.name === 'Margherita Pizza');

    let r = await j('/api/orders', { method: 'POST', body: { customerName: 'Ravi', tableNumber: 3, items: [] } });
    ok(r.s === 400, 'empty order rejected');
    r = await j('/api/orders', { method: 'POST', body: { customerName: '', tableNumber: 3, items: [{ id: pizza.id, quantity: 1 }] } });
    ok(r.s === 400, 'missing name rejected');
    r = await j('/api/orders', { method: 'POST', body: { customerName: 'Ravi', tableNumber: 99, items: [{ id: pizza.id, quantity: 1 }] } });
    ok(r.s === 400, 'invalid table rejected');
    r = await j('/api/orders', { method: 'POST', body: { customerName: 'Ravi', phone: 'abc', tableNumber: 2, items: [{ id: pizza.id, quantity: 1 }] } });
    ok(r.s === 400, 'bad phone rejected');
    r = await j('/api/orders', { method: 'POST', body: { customerName: 'Ravi', tableNumber: 2, items: [{ id: 'nope', quantity: 1 }] } });
    ok(r.s === 400, 'unknown food item rejected');

    r = await j('/api/orders', { method: 'POST', body: { customerName: 'Ravi', phone: '9876543210', tableNumber: 3, items: [{ id: pizza.id, quantity: 2, price: 1 }] } });
    ok(r.s === 201 && /^SB-\d{6}-[A-Z0-9]{4}$/.test(r.d.orderId), 'order created with unique ID ' + (r.d && r.d.orderId));
    ok(r.d.total === 498 && r.d.status === 'Pending', 'server calculated total (price tampering ignored), status Pending');
    ok(r.d.phone === undefined, 'phone not exposed to customers');
    const oid = r.d.orderId;

    r = await j('/api/orders/' + oid);
    ok(r.s === 200 && r.d.status === 'Pending', 'customer can check order status');
    r = await j('/api/orders/SB-000000-ZZZZ');
    ok(r.s === 404, 'unknown order ID gives 404');

    ok((await j('/api/admin/orders')).s === 401, 'admin API blocked without login');
    ok((await j('/api/admin/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } })).s === 401, 'wrong password rejected');
    r = await j('/api/admin/login', { method: 'POST', body: { username: 'admin', password: 'Test12345' } });
    ok(r.s === 200 && r.d.token, 'admin login works');
    const H = { Authorization: 'Bearer ' + r.d.token };

    // Real-time: open the live stream, then place an order and see if it arrives
    const ctrl = new AbortController();
    const sse = await fetch(`${B}/api/admin/stream?token=${r.d.token}`, { signal: ctrl.signal });
    ok(sse.status === 200, 'live stream opens');
    const reader = sse.body.getReader();
    let text = '';
    const pump = (async () => { try { for (;;) { const { value, done } = await reader.read(); if (done) break; text += Buffer.from(value).toString(); } } catch {} })();
    await new Promise((x) => setTimeout(x, 400));
    const live = await j('/api/orders', { method: 'POST', body: { customerName: 'Live Test', tableNumber: 5, items: [{ id: pizza.id, quantity: 1 }] } });
    await new Promise((x) => setTimeout(x, 500));
    ok(text.includes('event: order-new') && text.includes(live.d.orderId), 'new order pushed to admin live (no refresh)');

    r = await j('/api/admin/stats', { headers: H });
    ok(r.d.totalOrders === 2 && r.d.pendingOrders === 2 && r.d.totalSales === 0, 'stats: 2 orders, 2 pending, sales 0');

    for (const s of ['Preparing', 'Ready', 'Completed']) {
      r = await j(`/api/admin/orders/${oid}/status`, { method: 'PATCH', headers: H, body: { status: s } });
      ok(r.s === 200 && r.d.status === s, 'admin sets status ' + s);
    }
    r = await j('/api/orders/' + oid);
    ok(r.d.status === 'Completed', 'customer sees Completed');
    r = await j(`/api/admin/orders/${oid}/status`, { method: 'PATCH', headers: H, body: { status: 'Pending' } });
    ok(r.s === 400, 'finished order cannot be changed');
    r = await j(`/api/admin/orders/${live.d.orderId}/status`, { method: 'PATCH', headers: H, body: { status: 'Rejected' } });
    ok(r.s === 200 && r.d.status === 'Rejected', 'admin can reject a pending order');
    r = await j('/api/admin/stats', { headers: H });
    ok(r.d.completedOrders === 1 && r.d.totalSales === 498 && r.d.rejectedOrders === 1, 'stats: completed 1, sales 498, rejected 1');
    ctrl.abort(); await pump;

    // Menu management
    r = await j('/api/admin/menu', { method: 'POST', headers: H, body: { name: 'Test Dosa', category: 'Main Course', price: 99, description: 'Crispy', imageUrl: '' } });
    ok(r.s === 201 && r.d.id, 'admin adds food item');
    const nid = r.d.id;
    ok((await j('/api/admin/menu', { method: 'POST', headers: H, body: { name: 'X', category: 'Bad', price: -5 } })).s === 400, 'invalid food rejected');
    r = await j('/api/admin/menu/' + nid, { method: 'PUT', headers: H, body: { price: 120, description: 'Very crispy' } });
    ok(r.s === 200 && r.d.price === 120, 'admin edits price and description');
    r = await j('/api/admin/menu/' + nid, { method: 'PUT', headers: H, body: { available: false } });
    r = await j('/api/menu');
    ok(!r.d.items.some((i) => i.id === nid), 'hidden item disappears from customer menu');
    r = await j('/api/admin/menu/' + nid, { method: 'DELETE', headers: H });
    ok(r.s === 200, 'admin deletes food item');
    ok((await j('/api/admin/menu/' + nid, { method: 'DELETE', headers: H })).s === 404, 'deleting again gives 404');

    // QR codes
    r = await j('/api/admin/qr/generate', { method: 'POST', headers: H, body: { baseUrl: 'http://192.168.1.5:3999' } });
    ok(r.s === 200 && r.d.qrCodes.length === 10 && r.d.qrCodes[3].url === 'http://192.168.1.5:3999/?table=4', '10 QR codes generated, table number inside link');
    const png = await fetch(B + '/qrcodes/table-4.png');
    ok(png.status === 200 && png.headers.get('content-type') === 'image/png', 'QR PNG downloadable');
    r = await j('/api/admin/qr/generate', { method: 'POST', headers: H, body: { baseUrl: 'javascript:alert(1)' } });
    ok(r.s === 400, 'unsafe QR address rejected');
  } catch (e) {
    failed++; console.log('  ERROR ', e.message);
  } finally {
    server.kill();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }
}
run();
