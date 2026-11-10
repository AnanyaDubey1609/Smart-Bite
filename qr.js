const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { resolveBaseUrl, getLanIp } = require('../utils/network');

const router = express.Router();
const QR_DIR = path.join(__dirname, '..', '..', 'public', 'qrcodes');
const totalTables = () => Math.max(1, parseInt(process.env.TOTAL_TABLES, 10) || 10);

// Creates PNG files for tables 1..N. Used by this route and by scripts/generateQR.js
async function generateAll(baseUrl) {
  fs.mkdirSync(QR_DIR, { recursive: true });
  const list = [];
  for (let t = 1; t <= totalTables(); t++) {
    const url = `${baseUrl}/?table=${t}`; // the table number is inside the link
    const file = `table-${t}.png`;
    await QRCode.toFile(path.join(QR_DIR, file), url, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#2f5d3a', light: '#ffffff' },
    });
    list.push({ table: t, url, image: `/qrcodes/${file}?v=${Date.now()}`, download: `/qrcodes/${file}` });
  }
  return list;
}

// POST /api/admin/qr/generate   body: { baseUrl?: "http://192.168.1.5:3000" }
router.post('/generate', async (req, res, next) => {
  try {
    let override = req.body && req.body.baseUrl ? String(req.body.baseUrl).trim() : '';
    if (override && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(override))
      return res.status(400).json({ error: 'Website address must start with http:// or https://' });
    const baseUrl = resolveBaseUrl(override);
    res.json({ baseUrl, lanIp: getLanIp(), qrCodes: await generateAll(baseUrl) });
  } catch (e) { next(e); }
});

// GET /api/admin/qr/info  - what address would be used right now
router.get('/info', (req, res) => {
  res.json({ baseUrl: resolveBaseUrl(), lanIp: getLanIp(), totalTables: totalTables() });
});

module.exports = { router, generateAll };
