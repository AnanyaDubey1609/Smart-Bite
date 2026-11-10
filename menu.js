const express = require('express');
const db = require('../config/db');
const { CATEGORIES, validateMenuItem } = require('../utils/validate');

const publicRouter = express.Router();
const adminRouter = express.Router();

const sortMenu = (list) =>
  list.sort(
    (a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name)
  );

// ---------- Public: GET /api/menu (only available items) ----------
publicRouter.get('/', async (req, res, next) => {
  try {
    const items = (await db.listMenu()).filter((i) => i.available !== false);
    res.json({ categories: CATEGORIES, items: sortMenu(items) });
  } catch (e) { next(e); }
});

// ---------- Admin: /api/admin/menu ----------
adminRouter.get('/', async (req, res, next) => {
  try {
    res.json({ categories: CATEGORIES, items: sortMenu(await db.listMenu()) });
  } catch (e) { next(e); }
});

adminRouter.post('/', async (req, res, next) => {
  try {
    const { error, value } = validateMenuItem(req.body, false);
    if (error) return res.status(400).json({ error });
    value.createdAt = new Date().toISOString();
    res.status(201).json(await db.createMenuItem(value));
  } catch (e) { next(e); }
});

adminRouter.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = validateMenuItem(req.body, true);
    if (error) return res.status(400).json({ error });
    if (Object.keys(value).length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    value.updatedAt = new Date().toISOString();
    const updated = await db.updateMenuItem(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Food item not found.' });
    res.json(updated);
  } catch (e) { next(e); }
});

adminRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await db.deleteMenuItem(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Food item not found.' });
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = { publicRouter, adminRouter };
