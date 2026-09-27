// backend/routes/categories.js — Categories & Subcategories Management
const express = require('express');
const db      = require('../config/db');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

const router = express.Router();

// ── GET ALL CATEGORIES ─────────────────────────────────────
// GET /categories
router.get('/', async (req, res) => {
  try {
    const [all] = await db.query('SELECT * FROM categories ORDER BY id ASC');

    const parents = all.filter(c => c.parent_id === null);
    const children = all.filter(c => c.parent_id !== null);

    const result = parents.map(parent => ({
      ...parent,
      subcategories: children.filter(c => c.parent_id === parent.id)
    }));

    res.json(result);
  } catch (err) {
    console.error('Categories fetch error:', err);
    res.status(500).json({ error: 'Unable to retrieve categories.' });
  }
});

// ── GET PRODUCTS IN A CATEGORY ─────────────────────────────
// GET /categories/:id/products
router.get('/:id/products', async (req, res) => {
  const categoryId = parseInt(req.params.id, 10);
  if (isNaN(categoryId) || categoryId <= 0) {
    return res.status(400).json({ error: 'A valid numeric category ID is required.' });
  }

  try {
    const [cats] = await db.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
    if (cats.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const [subcats] = await db.query('SELECT id FROM categories WHERE parent_id = ?', [categoryId]);
    const allCategoryIds = [categoryId, ...subcats.map(s => s.id)];

    const placeholders = allCategoryIds.map(() => '?').join(',');
    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.category_id IN (${placeholders})
       ORDER BY p.created_at DESC`,
      allCategoryIds
    );

    res.json({ category: cats[0], products });
  } catch (err) {
    console.error('Category products fetch error:', err);
    res.status(500).json({ error: 'Unable to retrieve category products.' });
  }
});

// ── CREATE CATEGORY (Admin only) ───────────────────────────
// POST /categories
// Body: { name, parent_id }
router.post('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, parent_id } = req.body;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    let validParentId = null;
    if (parent_id !== undefined && parent_id !== null && parent_id !== '') {
      const parsedParent = parseInt(parent_id, 10);
      if (!isNaN(parsedParent) && parsedParent > 0) {
        const [parent] = await db.query('SELECT id FROM categories WHERE id = ?', [parsedParent]);
        if (parent.length === 0) {
          return res.status(400).json({ error: 'Parent category does not exist.' });
        }
        validParentId = parsedParent;
      }
    }

    const [result] = await db.query(
      'INSERT INTO categories (name, parent_id) VALUES (?, ?)',
      [trimmedName, validParentId]
    );

    res.status(201).json({
      message: 'Category created successfully!',
      categoryId: result.insertId
    });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Unable to create category.' });
  }
});

// ── DELETE CATEGORY (Admin only) ───────────────────────────
// DELETE /categories/:id
router.delete('/:id', isLoggedIn, isAdmin, async (req, res) => {
  const categoryId = parseInt(req.params.id, 10);
  if (isNaN(categoryId) || categoryId <= 0) {
    return res.status(400).json({ error: 'A valid numeric category ID is required.' });
  }

  try {
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [categoryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Unable to delete category.' });
  }
});

module.exports = router;