// Stateless admin auth: a single shared password gates the font-management
// panel. On success we hand back a signed, expiring cookie -- no session
// store or database needed.

const crypto = require('crypto');

const COOKIE_NAME = 'hdc_admin_session';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function requireSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing SESSION_SECRET environment variable');
  return secret;
}

function createSessionToken() {
  const secret = requireSecret();
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = String(expires);
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token) return false;
  let secret;
  try {
    secret = requireSecret();
  } catch {
    return false;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && Date.now() < expires;
}

function checkPassword(candidate) {
  const actual = process.env.ADMIN_PASSWORD;
  if (!actual || !candidate) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(String(actual));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!verifySessionToken(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  TOKEN_TTL_MS,
  createSessionToken,
  verifySessionToken,
  checkPassword,
  requireAuth,
};
