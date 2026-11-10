const express = require('express');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const bus = require('../utils/events');
const { signToken } = require('../middleware/auth');

const loginRouter = express.Router();
const protectedRouter = express.Router();

// ---------- Login (max 10 attempts per 15 minutes per IP) ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

loginRouter.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const okUser = safeEqual(username ?? '', process.env.ADMIN_USERNAME || 'admin');
  const okPass = safeEqual(password ?? '', process.env.ADMIN_PASSWORD || '');
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set in .env' });
  if (!(okUser && okPass)) return res.status(401).json({ error: 'Wrong username or password.' });
  res.json({ token: signToken(username) });
});

// ---------- Dashboard numbers ----------
protectedRouter.get('/stats', async (req, res, next) => {
  try {
    const orders = await db.listOrders();
    const count = (s) => orders.filter((o) => o.status === s).length;
    const today = new Date().toDateString();
    const completed = orders.filter((o) => o.status === 'Completed');
    res.json({
      totalOrders: orders.length,
      pendingOrders: count('Pending'),
      preparingOrders: count('Preparing'),
      readyOrders: count('Ready'),
      completedOrders: completed.length,
      rejectedOrders: count('Rejected'),
      totalSales: Math.round(completed.reduce((s, o) => s + o.total, 0) * 100) / 100,
      todaysOrders: orders.filter((o) => new Date(o.createdAt).toDateString() === today).length,
    });
  } catch (e) { next(e); }
});

// ---------- Real-time stream (Server-Sent Events) ----------
protectedRouter.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  res.write('event: connected\ndata: {}\n\n');

  const send = (type) => (data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  const onNew = send('order-new');
  const onUpdate = send('order-update');
  bus.on('order:new', onNew);
  bus.on('order:update', onUpdate);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('order:new', onNew);
    bus.off('order:update', onUpdate);
  });
});

// ---------- Image upload ----------
const uploadDir = path.join(__dirname, '..', '..', 'assets', 'uploads');
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `food-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ALLOWED[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'))),
});

protectedRouter.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 2 MB.' : err.message });
    if (!req.file) return res.status(400).json({ error: 'Please choose an image.' });
    res.status(201).json({ url: `/assets/uploads/${req.file.filename}` });
  });
});

module.exports = { loginRouter, protectedRouter };
