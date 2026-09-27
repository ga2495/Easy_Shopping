// backend/routes/auth.js — Register, Login, and Profile Management
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { isLoggedIn } = require('../middleware/auth');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── REGISTER ───────────────────────────────────────────────
// POST /auth/register
// Body: { name, email, password }
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!trimmedName || !trimmedEmail || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({ error: 'Name must not exceed 100 characters.' });
    }

    if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 100) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if email already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = ?',
      [trimmedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'This email is already registered. Please log in.' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save new customer user
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [trimmedName, trimmedEmail, hashedPassword, 'customer']
    );

    res.status(201).json({ message: 'Account created successfully! Please log in.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Unable to complete registration. Please try again later.' });
  }
});

// ── LOGIN ──────────────────────────────────────────────────
// POST /auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!trimmedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user by email
    const [users] = await db.query(
      'SELECT id, name, email, password, role FROM users WHERE LOWER(email) = ?',
      [trimmedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'shopease_jwt_secret_dev_fallback';
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to log in. Please try again later.' });
  }
});

// ── GET CURRENT PROFILE ────────────────────────────────────
// GET /auth/me
router.get('/me', isLoggedIn, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json(users[0]);
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Unable to fetch user profile.' });
  }
});

module.exports = router;