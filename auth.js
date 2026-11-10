const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

function signToken(username) {
  return jwt.sign({ role: 'admin', username }, JWT_SECRET, { expiresIn: '8h' });
}

// Protects admin routes. Token comes from the "Authorization: Bearer ..." header.
// The live-stream route also accepts ?token= because EventSource cannot send headers.
function requireAdmin(req, res, next) {
  let token = null;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) token = h.slice(7);
  else if (req.path === '/stream' && req.query.token) token = String(req.query.token);
  if (!token) return res.status(401).json({ error: 'Please log in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('bad role');
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { signToken, requireAdmin };
