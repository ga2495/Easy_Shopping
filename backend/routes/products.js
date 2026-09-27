// backend/routes/products.js — Product Catalog & Admin Product Management
const express = require('express');
const db      = require('../config/db');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

const router = express.Router();

// ── GET ALL PRODUCTS ───────────────────────────────────────
// GET /products
// Optional query params: ?search=phone  ?category=3
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;

    let query = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Search filter
    if (search && typeof search === 'string' && search.trim() !== '') {
      const keyword = search.trim();
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // Category filter
    if (category) {
      const catId = parseInt(category, 10);
      if (!isNaN(catId) && catId > 0) {
        query += ' AND p.category_id = ?';
        params.push(catId);
      }
    }

    query += ' ORDER BY p.created_at DESC';

    const [products] = await db.query(query, params);
    res.json(products);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'Unable to retrieve products at this time.' });
  }
});

// ── GET SINGLE PRODUCT ─────────────────────────────────────
// GET /products/:id
router.get('/:id', async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ error: 'A valid numeric product ID is required.' });
  }

  try {
    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(products[0]);
  } catch (err) {
    console.error('Fetch single product error:', err);
    res.status(500).json({ error: 'Unable to retrieve product details.' });
  }
});

// ── ADD PRODUCT (Admin only) ───────────────────────────────
// POST /products
// Body: { name, description, price, stock, image_url, category_id }
router.post('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, image_url, category_id } = req.body;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const numericPrice = parseFloat(price);
    const numericStock = parseInt(stock, 10);

    if (!trimmedName) {
      return res.status(400).json({ error: 'Product name is required.' });
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Product price must be a valid positive number.' });
    }
    if (isNaN(numericStock) || numericStock < 0) {
      return res.status(400).json({ error: 'Product stock must be a non-negative integer.' });
    }

    let validCategoryId = null;
    if (category_id !== undefined && category_id !== null && category_id !== '') {
      const parsedCat = parseInt(category_id, 10);
      if (!isNaN(parsedCat) && parsedCat > 0) {
        const [catExists] = await db.query('SELECT id FROM categories WHERE id = ?', [parsedCat]);
        if (catExists.length > 0) {
          validCategoryId = parsedCat;
        }
      }
    }

    const [result] = await db.query(
      `INSERT INTO products (name, description, price, stock, image_url, category_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        trimmedName,
        description ? String(description).trim() : null,
        numericPrice,
        numericStock,
        image_url ? String(image_url).trim() : null,
        validCategoryId
      ]
    );

    res.status(201).json({
      message: 'Product added successfully!',
      productId: result.insertId
    });
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Unable to add product. Please check input values.' });
  }
});

// ── UPDATE PRODUCT (Admin only) ────────────────────────────
// PUT /products/:id
// Body: { name, description, price, stock, image_url, category_id }
router.put('/:id', isLoggedIn, isAdmin, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ error: 'A valid numeric product ID is required.' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const { name, description, price, stock, image_url, category_id } = req.body;

    let updatedName = existing[0].name;
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Product name cannot be empty.' });
      }
      updatedName = trimmed;
    }

    let updatedPrice = existing[0].price;
    if (price !== undefined) {
      const numPrice = parseFloat(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({ error: 'Product price must be a valid positive number.' });
      }
      updatedPrice = numPrice;
    }

    let updatedStock = existing[0].stock;
    if (stock !== undefined) {
      const numStock = parseInt(stock, 10);
      if (isNaN(numStock) || numStock < 0) {
        return res.status(400).json({ error: 'Product stock must be a non-negative integer.' });
      }
      updatedStock = numStock;
    }

    let updatedDesc = description !== undefined ? (description ? String(description).trim() : null) : existing[0].description;
    let updatedImage = image_url !== undefined ? (image_url ? String(image_url).trim() : null) : existing[0].image_url;

    let updatedCategory = existing[0].category_id;
    if (category_id !== undefined) {
      if (category_id === null || category_id === '') {
        updatedCategory = null;
      } else {
        const parsedCat = parseInt(category_id, 10);
        if (!isNaN(parsedCat) && parsedCat > 0) {
          const [catExists] = await db.query('SELECT id FROM categories WHERE id = ?', [parsedCat]);
          if (catExists.length > 0) {
            updatedCategory = parsedCat;
          }
        }
      }
    }

    await db.query(
      `UPDATE products
       SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, category_id = ?
       WHERE id = ?`,
      [updatedName, updatedDesc, updatedPrice, updatedStock, updatedImage, updatedCategory, productId]
    );

    res.json({ message: 'Product updated successfully!' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Unable to update product.' });
  }
});

// ── DELETE PRODUCT (Admin only) ────────────────────────────
// DELETE /products/:id
router.delete('/:id', isLoggedIn, isAdmin, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ error: 'A valid numeric product ID is required.' });
  }

  try {
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [productId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Unable to delete product.' });
  }
});

module.exports = router;