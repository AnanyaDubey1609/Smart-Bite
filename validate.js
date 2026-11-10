// Input validation helpers. Each returns { error } or { value }.
const CATEGORIES = ['Starters', 'Main Course', 'Pizza', 'Burger', 'Drinks', 'Desserts'];
const STATUSES = ['Pending', 'Preparing', 'Ready', 'Completed', 'Rejected'];
const ORDER_ID_RE = /^SB-\d{6}-[A-Z0-9]{4}$/;

const clean = (s) => String(s ?? '').replace(/[<>]/g, '').trim();

function validateOrder(body, totalTables) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request.' };

  const customerName = clean(body.customerName);
  if (customerName.length < 2 || customerName.length > 50)
    return { error: 'Please enter your name (2 to 50 characters).' };

  const phone = clean(body.phone).replace(/[\s-]/g, '');
  if (phone && !/^\+?\d{7,15}$/.test(phone))
    return { error: 'Phone number must be 7 to 15 digits (or leave it empty).' };

  const tableNumber = Number(body.tableNumber);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > totalTables)
    return { error: `Please select a table between 1 and ${totalTables}.` };

  if (!Array.isArray(body.items) || body.items.length === 0)
    return { error: 'Your cart is empty. Add at least one item.' };
  if (body.items.length > 40) return { error: 'Too many different items in one order.' };

  const merged = new Map();
  for (const it of body.items) {
    const id = clean(it && it.id);
    const q = Number(it && it.quantity);
    if (!id || !Number.isInteger(q) || q < 1 || q > 20)
      return { error: 'Each item needs a quantity between 1 and 20.' };
    merged.set(id, (merged.get(id) || 0) + q);
  }
  for (const q of merged.values()) if (q > 20) return { error: 'Maximum 20 of one item per order.' };

  const note = clean(body.note).slice(0, 200);
  return {
    value: {
      customerName,
      phone,
      tableNumber,
      note,
      items: [...merged.entries()].map(([id, quantity]) => ({ id, quantity })),
    },
  };
}

function validateMenuItem(body, partial = false) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request.' };
  const out = {};

  if (!partial || body.name !== undefined) {
    const name = clean(body.name);
    if (name.length < 2 || name.length > 60) return { error: 'Name must be 2 to 60 characters.' };
    out.name = name;
  }
  if (!partial || body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return { error: 'Choose a valid category.' };
    out.category = body.category;
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000)
      return { error: 'Price must be a number greater than 0.' };
    out.price = Math.round(price * 100) / 100;
  }
  if (!partial || body.description !== undefined) {
    const d = clean(body.description);
    if (d.length > 250) return { error: 'Description can be at most 250 characters.' };
    out.description = d;
  }
  if (!partial || body.imageUrl !== undefined) {
    const u = String(body.imageUrl ?? '').trim();
    if (u && !/^(https?:\/\/|\/assets\/)/i.test(u))
      return { error: 'Image must be an uploaded file or a link starting with http(s)://' };
    if (u.length > 500) return { error: 'Image link is too long.' };
    out.imageUrl = u || '/assets/images/food/default.svg';
  }
  if (body.available !== undefined) out.available = body.available === true || body.available === 'true';
  else if (!partial) out.available = true;
  return { value: out };
}

module.exports = { CATEGORIES, STATUSES, ORDER_ID_RE, validateOrder, validateMenuItem };
