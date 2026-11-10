const os = require('os');

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return null;
}

// Decide which website address goes inside the QR codes.
function resolveBaseUrl(override) {
  const clean = (u) => String(u).replace(/\/+$/, '');
  if (override) return clean(override);
  const env = process.env.BASE_URL || 'http://localhost:3000';
  if (!/localhost|127\.0\.0\.1/i.test(env)) return clean(env);
  const ip = getLanIp();
  return ip ? `http://${ip}:${process.env.PORT || 3000}` : clean(env);
}

module.exports = { getLanIp, resolveBaseUrl };
