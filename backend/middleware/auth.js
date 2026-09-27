// backend/middleware/auth.js — Authentication & Role-Based Authorization
const jwt = require('jsonwebtoken');

// ── Checks if user is logged in ────────────────────────────
function isLoggedIn(req, res, next) {
  const authHeader = req.headers['authorization'];

  // Token format: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }

  const jwtSecret = process.env.JWT_SECRET || 'shopease_jwt_secret_dev_fallback';

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // attaches { userId, role } to request
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// ── Checks if user is an admin ─────────────────────────────
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

module.exports = { isLoggedIn, isAdmin };