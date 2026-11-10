// Order status page: looks up an order and refreshes it every 5 seconds.
(function () {
  const $ = (id) => document.getElementById(id);
  const ORDER = ['Pending', 'Preparing', 'Ready', 'Completed'];
  let timer = null;
  let currentId = '';

  function showError(msg) { $('lookupError').textContent = msg; $('lookupError').hidden = !msg; }

  function paint(o) {
    $('statusCard').hidden = false;
    $('stId').textContent = o.orderId;
    $('stMeta').textContent = `Table ${o.tableNumber} | ${o.customerName} | placed ${SB.timeAgo(o.createdAt)}`;
    $('stBadge').textContent = o.status;
    $('stBadge').className = 'badge ' + o.status;

    const idx = ORDER.indexOf(o.status);
    document.querySelectorAll('#steps li').forEach((li) => {
      const i = ORDER.indexOf(li.dataset.step);
      li.classList.toggle('done', idx >= 0 && i <= idx);
      li.classList.toggle('current', i === idx && o.status !== 'Completed');
    });
    $('steps').hidden = o.status === 'Rejected';
    $('rejectMsg').hidden = o.status !== 'Rejected';

    $('stItems').innerHTML = o.items
      .map((i) => `<li><span>${i.quantity} &times; ${SB.esc(i.name)}</span><span>${SB.money(i.subtotal)}</span></li>`)
      .join('');
    $('stTotal').textContent = SB.money(o.total);
    const finished = o.status === 'Completed' || o.status === 'Rejected';
    $('liveNote').textContent = finished ? 'This order is finished.' : 'This page updates by itself every few seconds.';
    return finished;
  }

  async function check(id, silent) {
    try {
      const o = await SB.api('/api/orders/' + encodeURIComponent(id));
      showError('');
      const finished = paint(o);
      clearInterval(timer);
      if (!finished) timer = setInterval(() => check(id, true), 5000);
    } catch (err) {
      if (!silent) { $('statusCard').hidden = true; clearInterval(timer); showError(err.message); }
    }
  }

  function start(id) {
    id = id.trim().toUpperCase();
    if (!id) return showError('Please type your order ID.');
    currentId = id;
    try { localStorage.setItem('sb_last_order', id); } catch { /* ignore */ }
    history.replaceState(null, '', '?id=' + encodeURIComponent(id));
    check(id, false);
  }

  $('lookupForm').addEventListener('submit', (e) => { e.preventDefault(); start($('orderIdInput').value); });

  const fromUrl = new URLSearchParams(location.search).get('id');
  let saved = '';
  try { saved = localStorage.getItem('sb_last_order') || ''; } catch { /* ignore */ }
  const first = fromUrl || saved;
  if (first) { $('orderIdInput').value = first.toUpperCase(); start(first); }
})();
