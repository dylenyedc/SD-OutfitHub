'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRouter = require('./routes/auth');
const promptsRouter = require('./routes/prompts');
const searchRouter = require('./routes/search');

const app = express();

// Body parsing (limit to 5 MB)
app.use(express.json({ limit: '5mb' }));

// CSRF protection: reject state-changing requests that don't originate from
// the same host (browsers always send Origin on cross-origin POST/PUT/DELETE).
app.use((req, res, next) => {
  const method = req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch (_) {
      return res.status(403).json({ message: '无效的请求来源' });
    }
    if (originHost !== host) {
      return res.status(403).json({ message: '跨域请求不被允许' });
    }
  }
  next();
});

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '请求过于频繁，请稍后再试' }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '请求过于频繁，请稍后再试' }
});

// Static file rate limiter
const staticLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

// API routes
app.use('/api/auth', authLimiter, authRouter);
app.get('/api/me', apiLimiter, authRouter.meHandler);
app.use('/api/prompts', apiLimiter, promptsRouter);
app.use('/api/agent-skill/search', apiLimiter, searchRouter);

// Serve static frontend
const ROOT_DIR = path.join(__dirname, '..');
app.use(staticLimiter, express.static(ROOT_DIR, {
  index: 'index.html',
  // Don't cache HTML to ensure fresh loads
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.html') {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

// SPA fallback – serve index.html for any non-API, non-asset route
app.use(staticLimiter, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

module.exports = app;
