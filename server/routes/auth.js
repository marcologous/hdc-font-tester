const express = require('express');
const { checkPassword, createSessionToken, verifySessionToken, COOKIE_NAME, TOKEN_TTL_MS } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token = createSessionToken();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_MS,
  });
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  res.json({ authenticated: verifySessionToken(token) });
});

module.exports = router;
