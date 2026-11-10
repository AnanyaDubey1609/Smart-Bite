const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.argv.includes('--demo')) process.env.USE_MOCK_DB = 'true';

const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const restaurant = require('./data/restaurant');
const { requireAdmin } = require('./middleware/auth');
const { getLanIp } = require('./utils/network');
const { seedMenu } = require('./scripts/seedMenu');

const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qr');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = path.join(__dirname, '..');
const totalTables = () => Math.max(1, parseInt(process.env.TOTAL_TABLES, 10) || 10);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin' });
  next();
});

// ---------- API ----------
app.get('/api/config', (req, res) => res.json({ ...restaurant, totalTables: totalTables() }));
app.use('/api/menu', menuRoutes.publicRouter);
app.use('/api/orders', orderRoutes.publicRouter);

app.use('/api/admin', adminRoutes.loginRouter);            // POST /login (no token needed)
app.use('/api/admin', requireAdmin, adminRoutes.protectedRouter);
app.use('/api/admin/menu', requireAdmin, menuRoutes.adminRouter);
app.use('/api/admin/orders', requireAdmin, orderRoutes.adminRouter);
app.use('/api/admin/qr', requireAdmin, qrRoutes.router);

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// ---------- Website files ----------
app.use('/css', express.static(path.join(ROOT, 'frontend', 'css')));
app.use('/js', express.static(path.join(ROOT, 'frontend', 'js')));
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/qrcodes', express.static(path.join(ROOT, 'public', 'qrcodes'), { maxAge: 0 }));
app.get('/admin', (req, res) => res.redirect('/admin/login.html'));
app.use('/admin', express.static(path.join(ROOT, 'frontend', 'admin')));
app.use(express.static(path.join(ROOT, 'frontend', 'customer')));

// ---------- Errors ----------
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON sent.' });
  console.error('Server error:', err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

async function start() {
  if (db.mode === 'memory') {
    const n = await seedMenu();
    console.log(`DEMO MODE: data is kept in memory (lost on restart). ${n} sample food items loaded.`);
  } else {
    console.log('Connected to Firebase Firestore.');
    if ((await db.countMenu()) === 0) console.log('Tip: your menu is empty. Run "npm run seed" to add the sample menu.');
  }
  if (!process.env.JWT_SECRET) console.warn('Warning: JWT_SECRET is not set in .env (admin will be logged out on every restart).');
  if (!process.env.ADMIN_PASSWORD) console.warn('Warning: ADMIN_PASSWORD is not set in .env. Admin login will not work.');

  app.listen(PORT, '0.0.0.0', () => {
    const ip = getLanIp();
    console.log('\n  SMART BITE is running!');
    console.log(`  Customer menu : http://localhost:${PORT}`);
    console.log(`  Admin login   : http://localhost:${PORT}/admin`);
    if (ip) console.log(`  On your phone : http://${ip}:${PORT}   (phone and laptop must be on the same Wi-Fi)`);
    console.log('');
  });
}

start().catch((e) => {
  console.error('\nCould not start the server:\n ', e.message);
  process.exit(1);
});
