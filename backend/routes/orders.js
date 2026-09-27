// backend/routes/orders.js — Orders, Checkout, Cancellation, and Admin Status
const express = require('express');
const db      = require('../config/db');
const { getRazorpay, isRazorpayConfigured } = require('../config/razorpay');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

const router = express.Router();

// ── CHECKOUT FROM CART ─────────────────────────────────────
// POST /orders/checkout
// Creates a pending order from all items in the user's cart
router.post('/checkout', isLoggedIn, async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Get cart items with latest product prices and stocks
    const [cartItems] = await db.query(
      `SELECT cart.quantity, products.id AS product_id,
              products.name, products.price, products.stock
       FROM cart
       JOIN products ON cart.product_id = products.id
       WHERE cart.user_id = ?`,
      [userId]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    // 2. Validate stock for all items
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          error: `"${item.name}" only has ${item.stock} items in stock.`
        });
      }
    }

    // 3. Calculate server-side total from trusted database prices
    const subtotal = cartItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
    );
    const shipping = subtotal > 999 ? 0 : 99;
    const total = subtotal + shipping;

    // 4. Create the order with pending / unpaid status
    const [orderResult] = await db.query(
      'INSERT INTO orders (user_id, total, status, payment_status) VALUES (?, ?, ?, ?)',
      [userId, total.toFixed(2), 'pending', 'unpaid']
    );
    const orderId = orderResult.insertId;

    // 5. Save order items with trusted database prices
    for (const item of cartItems) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    // 6. Clear user's cart
    await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);

    res.status(201).json({
      message: 'Order placed! Proceed to payment.',
      orderId,
      total: total.toFixed(2)
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Unable to process checkout. Please try again.' });
  }
});

// ── BUY NOW (Instant single-item checkout) ─────────────────
// POST /orders/buy-now
// Body: { product_id, quantity }
router.post('/buy-now', isLoggedIn, async (req, res) => {
  const userId = req.user.userId;
  const { product_id, quantity = 1 } = req.body;

  const productId = parseInt(product_id, 10);
  const requestedQty = parseInt(quantity, 10);

  if (isNaN(productId) || productId <= 0 || isNaN(requestedQty) || requestedQty < 1) {
    return res.status(400).json({ error: 'A valid product ID and positive integer quantity are required.' });
  }

  try {
    const [products] = await db.query(
      'SELECT id, name, price, stock FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = products[0];

    if (product.stock < requestedQty) {
      return res.status(400).json({
        error: `Only ${product.stock} items in stock for "${product.name}".`
      });
    }

    const subtotal = parseFloat(product.price) * requestedQty;
    const shipping = subtotal > 999 ? 0 : 99;
    const total = subtotal + shipping;

    const [orderResult] = await db.query(
      'INSERT INTO orders (user_id, total, status, payment_status) VALUES (?, ?, ?, ?)',
      [userId, total.toFixed(2), 'pending', 'unpaid']
    );
    const orderId = orderResult.insertId;

    await db.query(
      'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
      [orderId, productId, requestedQty, product.price]
    );

    res.status(201).json({
      message: 'Order created! Proceed to payment.',
      orderId,
      total: total.toFixed(2)
    });
  } catch (err) {
    console.error('Buy now error:', err);
    res.status(500).json({ error: 'Unable to create order.' });
  }
});

// ── CANCEL ORDER ───────────────────────────────────────────
// POST /orders/:id/cancel
// User can cancel within 24 hours of placing the order.
// Restores inventory stock and initiates refund if already paid.
router.post('/:id/cancel', isLoggedIn, async (req, res) => {
  const userId  = req.user.userId;
  const orderId = parseInt(req.params.id, 10);

  if (isNaN(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'A valid numeric order ID is required.' });
  }

  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orders[0];

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Order has already been cancelled.' });
    }
    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'Delivered orders cannot be cancelled.' });
    }
    if (order.status === 'shipped') {
      return res.status(400).json({ error: 'Order has already been shipped and cannot be cancelled.' });
    }

    // 24-hour cancellation rule
    const orderTime = new Date(order.created_at).getTime();
    const hoursPassed = (Date.now() - orderTime) / (1000 * 60 * 60);

    if (hoursPassed > 24) {
      return res.status(400).json({
        error: 'Cancellation window expired. Orders can only be cancelled within 24 hours.'
      });
    }

    let refundMessage = '';

    // If paid and payment ID exists, trigger refund via Razorpay if configured
    if (order.payment_status === 'paid' && order.razorpay_payment_id) {
      if (isRazorpayConfigured()) {
        const rzp = getRazorpay();
        try {
          await rzp.payments.refund(order.razorpay_payment_id, {
            amount: Math.round(order.total * 100)
          });
          refundMessage = ' Refund has been initiated and will reflect in 5-7 business days.';
        } catch (refundErr) {
          console.error('Razorpay refund error:', refundErr);
          return res.status(500).json({
            error: 'Could not process payment refund through gateway. Please contact support.'
          });
        }
      } else {
        refundMessage = ' Refund request recorded.';
      }
    }

    // Restore stock if the order was paid (meaning stock was deducted during payment confirmation)
    if (order.payment_status === 'paid') {
      const [items] = await db.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );

      for (const item of items) {
        await db.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    await db.query(
      `UPDATE orders SET status = 'cancelled', payment_status = ? WHERE id = ?`,
      [order.payment_status === 'paid' ? 'refund_initiated' : 'unpaid', orderId]
    );

    res.json({ message: `Order cancelled successfully.${refundMessage}` });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Unable to cancel order.' });
  }
});

// ── GET MY ORDERS ──────────────────────────────────────────
// GET /orders/my
// Returns all user orders that have been confirmed / paid / cancelled
router.get('/my', isLoggedIn, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*,
         JSON_ARRAYAGG(
           JSON_OBJECT(
             'product_id', oi.product_id,
             'name',       p.name,
             'quantity',   oi.quantity,
             'price',      oi.price,
             'category_name', c.name
           )
         ) AS items
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p     ON oi.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE o.user_id = ?
         AND o.payment_status != 'unpaid'
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.userId]
    );

    res.json(orders);
  } catch (err) {
    console.error('Fetch my orders error:', err);
    res.status(500).json({ error: 'Unable to retrieve your order history.' });
  }
});

// ── GET SINGLE ORDER ───────────────────────────────────────
// GET /orders/:id
router.get('/:id', isLoggedIn, async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'A valid numeric order ID is required.' });
  }

  try {
    let orderQuery = 'SELECT * FROM orders WHERE id = ?';
    const params = [orderId];

    if (req.user.role !== 'admin') {
      orderQuery += ' AND user_id = ?';
      params.push(req.user.userId);
    }

    const [orders] = await db.query(orderQuery, params);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const [items] = await db.query(
      `SELECT oi.*, p.name, p.image_url, c.name AS category_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    res.json({ order: orders[0], items });
  } catch (err) {
    console.error('Fetch single order error:', err);
    res.status(500).json({ error: 'Unable to retrieve order details.' });
  }
});

// ── UPDATE ORDER STATUS (Admin only) ──────────────────────
// PUT /orders/:id/status
// Body: { status }
router.put('/:id/status', isLoggedIn, isAdmin, async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'A valid numeric order ID is required.' });
  }

  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const [result] = await db.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({ message: `Order #${orderId} status updated to "${status}".` });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

// ── ALL STORE ORDERS (Admin only) ──────────────────────────
// GET /orders/admin/all
router.get('/admin/all', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    res.json(orders);
  } catch (err) {
    console.error('Admin fetch orders error:', err);
    res.status(500).json({ error: 'Unable to retrieve store orders.' });
  }
});

module.exports = router;