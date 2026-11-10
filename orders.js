const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const bus = require('../utils/events');
const { STATUSES, ORDER_ID_RE, validateOrder } = require('../utils/validate');

const publicRouter = express.Router();
const adminRouter = express.Router();
const totalTables = () => Math.max(1, parseInt(process.env.TOTAL_TABLES, 10) || 10);

// Example: SB-250114-K7QX  (SB + date + 4 random characters)
function makeOrderId() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tail = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) tail += alphabet[bytes[i] % alphabet.length];
  return `SB-${ymd}-${tail}`;
}

// What a customer is allowed to see about an order (no phone number).
const publicView = (o) => ({
  orderId: o.orderId,
  customerName: o.customerName,
  tableNumber: o.tableNumber,
  items: o.items,
  total: o.total,
  status: o.status,
  note: o.note,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});

// ---------- Public: place an order ----------
publicRouter.post('/', async (req, res, next) => {
  try {
    const { error, value } = validateOrder(req.body, totalTables());
    if (error) return res.status(400).json({ error });

    // Prices are ALWAYS taken from the database, never trusted from the browser.
    const lines = [];
    let total = 0;
    for (const { id, quantity } of value.items) {
      const food = await db.getMenuItem(id);
      if (!food || food.available === false)
        return res.status(400).json({ error: 'One of the items in your cart is no longer available. Please refresh the menu.' });
      const subtotal = Math.round(food.price * quantity * 100) / 100;
      total += subtotal;
      lines.push({ id, name: food.name, price: food.price, quantity, subtotal });
    }
    total = Math.round(total * 100) / 100;

    const now = new Date().toISOString();
    const order = {
      orderId: '',
      customerName: value.customerName,
      phone: value.phone,
      tableNumber: value.tableNumber,
      note: value.note,
      items: lines,
      total,
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    };

    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      order.orderId = makeOrderId();
      try {
        await db.createOrder(order);
        saved = true;
      } catch (e) {
        if (e.code !== 'EXISTS') throw e;
      }
    }
    if (!saved) return res.status(500).json({ error: 'Could not create order. Please try again.' });

    bus.emit('order:new', order);
    res.status(201).json(publicView(order));
  } catch (e) { next(e); }
});

// ---------- Public: check order status ----------
publicRouter.get('/:orderId', async (req, res, next) => {
  try {
    const id = String(req.params.orderId).trim().toUpperCase();
    if (!ORDER_ID_RE.test(id)) return res.status(400).json({ error: 'Order ID looks wrong. Example: SB-250114-K7QX' });
    const order = await db.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found. Check the ID and try again.' });
    res.json(publicView(order));
  } catch (e) { next(e); }
});

// ---------- Admin: list all orders ----------
adminRouter.get('/', async (req, res, next) => {
  try { res.json({ orders: await db.listOrders() }); } catch (e) { next(e); }
});

// ---------- Admin: change order status ----------
adminRouter.patch('/:orderId/status', async (req, res, next) => {
  try {
    const status = req.body && req.body.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const current = await db.getOrder(req.params.orderId);
    if (!current) return res.status(404).json({ error: 'Order not found.' });
    if (['Completed', 'Rejected'].includes(current.status))
      return res.status(400).json({ error: `This order is already ${current.status} and cannot be changed.` });
    if (status === 'Rejected' && current.status !== 'Pending')
      return res.status(400).json({ error: 'Only pending orders can be rejected.' });
    const updated = await db.updateOrder(req.params.orderId, { status, updatedAt: new Date().toISOString() });
    bus.emit('order:update', updated);
    res.json(updated);
  } catch (e) { next(e); }
});

module.exports = { publicRouter, adminRouter };
