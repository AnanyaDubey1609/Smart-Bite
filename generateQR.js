// Command line QR generator:  npm run qr   (optional: npm run qr -- http://192.168.1.5:3000)
require('dotenv').config();
const { generateAll } = require('../routes/qr');
const { resolveBaseUrl } = require('../utils/network');

const arg = process.argv[2] && /^https?:\/\//i.test(process.argv[2]) ? process.argv[2] : '';
const baseUrl = resolveBaseUrl(arg);
generateAll(baseUrl)
  .then((list) => {
    console.log(`Created ${list.length} QR codes in public/qrcodes/`);
    console.log(`Each QR opens: ${baseUrl}/?table=<number>`);
  })
  .catch((e) => { console.error('QR generation failed:', e.message); process.exit(1); });
