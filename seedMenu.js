// Loads the sample menu into the database.
//   npm run seed            -> adds the menu only if the database has no food yet
//   npm run seed -- --reset -> deletes all food items and adds the sample menu again
require('dotenv').config();
const db = require('../config/db');
const sample = require('../data/sampleMenu');

async function seedMenu({ reset = false } = {}) {
  if (reset) await db.clearMenu();
  else if ((await db.countMenu()) > 0) return 0;
  const now = new Date().toISOString();
  for (const item of sample) await db.createMenuItem({ ...item, createdAt: now });
  return sample.length;
}

module.exports = { seedMenu };

if (require.main === module) {
  seedMenu({ reset: process.argv.includes('--reset') })
    .then((n) => {
      console.log(n ? `Done! ${n} food items added to ${db.mode}.` : 'Menu already has items. Use "npm run seed -- --reset" to replace them.');
      process.exit(0);
    })
    .catch((e) => { console.error('Seeding failed:', e.message); process.exit(1); });
}
