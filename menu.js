// Loads restaurant info + menu, handles categories, search and add-to-cart buttons.
(function () {
  const $ = (id) => document.getElementById(id);
  let foods = [];
  let categories = [];
  let activeCat = 'All';
  let query = '';

  // ----- Table number from the QR code link (?table=5) -----
  const params = new URLSearchParams(location.search);
  let table = parseInt(params.get('table'), 10);
  try {
    if (Number.isInteger(table) && table > 0) sessionStorage.setItem('sb_table', String(table));
    else table = parseInt(sessionStorage.getItem('sb_table'), 10);
  } catch { /* ignore */ }

  function qtyControl(food) {
    const q = Cart.qty(food.id);
    if (!q) return `<button class="add-btn" type="button" data-act="add">Add</button>`;
    return `<div class="qty">
      <button type="button" data-act="dec" aria-label="Decrease quantity">&minus;</button>
      <span>${q}</span>
      <button type="button" data-act="inc" aria-label="Increase quantity">+</button></div>`;
  }

  function card(f) {
    return `<article class="food-card" data-id="${SB.esc(f.id)}">
      <div class="food-img"><img src="${SB.esc(f.imageUrl)}" alt="${SB.esc(f.name)}" loading="lazy" onerror="SB.fallbackImg(this)"></div>
      <div class="food-body">
        <span class="cat">${SB.esc(f.category)}</span>
        <h3>${SB.esc(f.name)}</h3>
        <p>${SB.esc(f.description)}</p>
        <div class="food-foot"><span class="price">${SB.money(f.price)}</span><div class="qty-area">${qtyControl(f)}</div></div>
      </div></article>`;
  }

  function renderChips() {
    $('chips').innerHTML = ['All', ...categories]
      .map((c) => `<button type="button" class="chip${c === activeCat ? ' active' : ''}" data-cat="${SB.esc(c)}">${SB.esc(c)}</button>`)
      .join('');
  }

  function renderGrid() {
    const q = query.trim().toLowerCase();
    let list = foods;
    if (activeCat !== 'All') list = list.filter((f) => f.category === activeCat);
    if (q) list = list.filter((f) => (f.name + ' ' + f.description + ' ' + f.category).toLowerCase().includes(q));

    if (!list.length) {
      $('menuGrid').innerHTML = `<p class="state-msg">${q ? 'No food matches "' + SB.esc(query) + '". Try another word.' : 'No items in this category yet.'}</p>`;
      return;
    }
    if (activeCat === 'All' && !q) {
      $('menuGrid').innerHTML = categories
        .map((c) => {
          const part = list.filter((f) => f.category === c);
          return part.length ? `<h2 class="cat-title">${SB.esc(c)}</h2><div class="grid">${part.map(card).join('')}</div>` : '';
        })
        .join('');
    } else {
      $('menuGrid').innerHTML = `<div class="grid">${list.map(card).join('')}</div>`;
    }
  }

  function refreshControls() {
    document.querySelectorAll('.food-card').forEach((el) => {
      const food = foods.find((f) => f.id === el.dataset.id);
      if (food) el.querySelector('.qty-area').innerHTML = qtyControl(food);
    });
  }

  async function load() {
    try {
      const [config, menu] = await Promise.all([SB.api('/api/config'), SB.api('/api/menu')]);

      document.title = config.name + ' | Menu';
      $('brandName').textContent = config.name;
      $('heroTitle').textContent = config.name;
      $('heroTagline').textContent = config.tagline;
      $('heroIntro').textContent = config.intro;
      $('infoHours').textContent = config.hours;
      $('infoAddress').textContent = config.address;
      $('infoPhone').textContent = config.phone;
      $('footAddress').textContent = config.address + '  |  ' + config.phone;

      if (Number.isInteger(table) && table >= 1 && table <= config.totalTables) {
        $('tentNumber').textContent = table;
        $('tentNote').textContent = 'Detected from your QR code';
      } else {
        table = null;
      }

      foods = menu.items;
      categories = menu.categories.filter((c) => foods.some((f) => f.category === c));
      Cart.sync(foods);
      CartUI.init(config.totalTables, table);
      renderChips();
      renderGrid();
    } catch (err) {
      $('menuGrid').innerHTML = `<div class="state-msg"><p>${SB.esc(err.message)}</p><button class="btn btn-primary" type="button" onclick="location.reload()">Try again</button></div>`;
    }
  }

  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    activeCat = b.dataset.cat;
    renderChips();
    renderGrid();
    window.scrollTo({ top: $('menu').offsetTop - 60, behavior: 'smooth' });
  });
  $('searchInput').addEventListener('input', (e) => { query = e.target.value; renderGrid(); });
  $('menuGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('.food-card').dataset.id;
    const food = foods.find((f) => f.id === id);
    if (!food) return;
    if (b.dataset.act === 'add') Cart.add(food);
    if (b.dataset.act === 'inc') Cart.inc(id);
    if (b.dataset.act === 'dec') Cart.dec(id);
  });
  // Only the small +/- control is redrawn, so the page does not flicker.
  Cart.onChange(refreshControls);

  load();
})();
