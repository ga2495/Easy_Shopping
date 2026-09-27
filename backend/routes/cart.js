// backend/routes/cart.js — Shopping Cart Management
const express = require('express');
const db      = require('../config/db');
const { isLoggedIn } = require('../middleware/auth');

const router = express.Router();

// ── VIEW CART ──────────────────────────────────────────────
// GET /cart
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT
         cart.id AS cart_item_id,
         cart.quantity,
         products.id AS product_id,
         products.name,
         products.price,
         products.image_url,
         products.stock,
         c.name AS category_name,
         (cart.quantity * products.price) AS subtotal
       FROM cart
       JOIN products ON cart.product_id = products.id
       LEFT JOIN categories c ON products.category_id = c.id
       WHERE cart.user_id = ?
       ORDER BY cart.id ASC`,
      [req.user.userId]
    );

    const total = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    res.json({ items, total: total.toFixed(2) });
  } catch (err) {
    console.error('Fetch cart error:', err);
    res.status(500).json({ error: 'Unable to retrieve your shopping cart.' });
  }
});

// ── ADD TO CART ────────────────────────────────────────────
// POST /cart/add
// Body: { product_id, quantity }
router.post('/add', isLoggedIn, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const userId = req.user.userId;

    const productId = parseInt(product_id, 10);
    const requestedQty = parseInt(quantity, 10);

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ error: 'A valid numeric product ID is required.' });
    }

    if (isNaN(requestedQty) || requestedQty < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }

    // Verify product exists and has stock
    const [products] = await db.query(
      'SELECT id, name, price, stock FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = products[0];

    if (product.stock <= 0) {
      return res.status(400).json({ error: `"${product.name}" is currently out of stock.` });
    }

    // Check if item is already in user's cart
    const [existing] = await db.query(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (existing.length > 0) {
      const newTotalQty = existing[0].quantity + requestedQty;
      if (newTotalQty > product.stock) {
        return res.status(400).json({
          error: `Cannot add more. You already have ${existing[0].quantity} in your cart, and only ${product.stock} are in stock.`
        });
      }

      await db.query(
        'UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
        [newTotalQty, existing[0].id, userId]
      );
    } else {
      if (requestedQty > product.stock) {
        return res.status(400).json({
          error: `Only ${product.stock} items are currently in stock.`
        });
      }

      await db.query(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, productId, requestedQty]
      );
    }

    res.json({ message: 'Product added to cart successfully!' });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Unable to add item to cart.' });
  }
});

// ── UPDATE ITEM QUANTITY ───────────────────────────────────
// PUT /cart/update
// Body: { cart_item_id, quantity }
router.put('/update', isLoggedIn, async (req, res) => {
  try {
    const { cart_item_id, quantity } = req.body;
    const userId = req.user.userId;

    const cartItemId = parseInt(cart_item_id, 10);
    const requestedQty = parseInt(quantity, 10);

    if (isNaN(cartItemId) || cartItemId <= 0) {
      return res.status(400).json({ error: 'A valid numeric cart item ID is required.' });
    }

    if (isNaN(requestedQty) || requestedQty < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }

    const [items] = await db.query(
      `SELECT cart.id, cart.quantity, products.name, products.stock
       FROM cart
       JOIN products ON cart.product_id = products.id
       WHERE cart.id = ? AND cart.user_id = ?`,
      [cartItemId, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    const item = items[0];

    if (requestedQty > item.stock) {
      return res.status(400).json({
        error: `Cannot set quantity to ${requestedQty}. Only ${item.stock} items of "${item.name}" are in stock.`
      });
    }

    await db.query(
      'UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
      [requestedQty, cartItemId, userId]
    );

    res.json({ message: 'Cart updated successfully!' });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ error: 'Unable to update cart quantity.' });
  }
});

// ── REMOVE ITEM FROM CART ──────────────────────────────────
// DELETE /cart/remove/:cart_item_id
router.delete('/remove/:cart_item_id', isLoggedIn, async (req, res) => {
  const cartItemId = parseInt(req.params.cart_item_id, 10);
  if (isNaN(cartItemId) || cartItemId <= 0) {
    return res.status(400).json({ error: 'A valid numeric cart item ID is required.' });
  }

  try {
    const [result] = await db.query(
      'DELETE FROM cart WHERE id = ? AND user_id = ?',
      [cartItemId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    res.json({ message: 'Item removed from cart.' });
  } catch (err) {
    console.error('Remove cart item error:', err);
    res.status(500).json({ error: 'Unable to remove item from cart.' });
  }
});

// ── CLEAR ENTIRE CART ──────────────────────────────────────
// DELETE /cart/clear
router.delete('/clear', isLoggedIn, async (req, res) => {
  try {
    await db.query('DELETE FROM cart WHERE user_id = ?', [req.user.userId]);
    res.json({ message: 'Cart cleared successfully.' });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Unable to clear cart.' });
  }
});

module.exports = router;