// backend/server.js — ShopEase Application Server
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// ── MIDDLEWARE ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SERVE STATIC FRONTEND ──────────────────────────────────
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: '🛒 ShopEase API is running!' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '🛒 ShopEase API is running!' });
});

// ── API ROUTES ─────────────────────────────────────────────
app.use('/auth',       require('./routes/auth'));
app.use('/categories', require('./routes/categories'));
app.use('/products',   require('./routes/products'));
app.use('/cart',       require('./routes/cart'));
app.use('/orders',     require('./routes/orders'));
app.use('/payments',   require('./routes/payments'));

// ── FRONTEND ROUTING FALLBACK (HTML5 History fallback) ──────
app.use((req, res, next) => {
  if (req.method === 'GET' &&
      !req.path.startsWith('/auth') &&
      !req.path.startsWith('/categories') &&
      !req.path.startsWith('/products') &&
      !req.path.startsWith('/cart') &&
      !req.path.startsWith('/orders') &&
      !req.path.startsWith('/payments') &&
      !req.path.startsWith('/api')) {
    return res.sendFile(path.join(frontendPath, 'index.html'));
  }
  next();
});

// ── 404 API HANDLER ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ── GLOBAL ERROR HANDLER ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ShopEase Server running at http://localhost:${PORT}`);
});