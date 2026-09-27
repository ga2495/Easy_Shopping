// backend/routes/payments.js — Razorpay Payment Gateway Integration
const express = require('express');
const crypto  = require('crypto');
const db      = require('../config/db');
const { getRazorpay, isRazorpayConfigured } = require('../config/razorpay');
const { isLoggedIn } = require('../middleware/auth');

const router = express.Router();

// ── STEP 1: CREATE PAYMENT ORDER ───────────────────────────
// POST /payments/create
// Body: { order_id }
router.post('/create', isLoggedIn, async (req, res) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: 'Payment service is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.'
    });
  }

  const { order_id } = req.body;
  const orderId = parseInt(order_id, 10);

  if (isNaN(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'A valid numeric order ID is required.' });
  }

  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orders[0];

    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'This order has already been paid.' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot process payment for a cancelled order.' });
    }

    const rzp = getRazorpay();
    const razorpayOrder = await rzp.orders.create({
      amount:   Math.round(parseFloat(order.total) * 100), // Razorpay operates in paise
      currency: 'INR',
      receipt:  `receipt_order_${orderId}`
    });

    await db.query(
      'UPDATE orders SET razorpay_order_id = ? WHERE id = ?',
      [razorpayOrder.id, orderId]
    );

    res.json({
      razorpay_order_id: razorpayOrder.id,
      amount:            razorpayOrder.amount,
      currency:          razorpayOrder.currency,
      key_id:            process.env.RAZORPAY_KEY_ID,
      order_id:          orderId
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Could not initialize payment session.' });
  }
});

// ── STEP 2: VERIFY PAYMENT SIGNATURE & CONFIRM ORDER ───────
// POST /payments/verify
// Body: { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/verify', isLoggedIn, async (req, res) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: 'Payment service is not configured.'
    });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    order_id
  } = req.body;

  const orderId = parseInt(order_id, 10);

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || isNaN(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'All payment verification fields and a valid order ID are required.' });
  }

  try {
    // 1. Verify Razorpay cryptographic HMAC SHA-256 signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const signatureBuffer = Buffer.from(razorpay_signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
      return res.status(400).json({ error: 'Payment signature verification failed. Possible tampering detected.' });
    }

    // 2. Atomic Database Transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [orders] = await connection.query(
        'SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
        [orderId, req.user.userId]
      );

      if (orders.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Order not found.' });
      }

      const order = orders[0];

      if (order.payment_status === 'paid') {
        await connection.rollback();
        return res.json({ message: 'Payment was already verified for this order.' });
      }

      if (order.razorpay_order_id !== razorpay_order_id) {
        await connection.rollback();
        return res.status(400).json({ error: 'Gateway order ID does not match the local order record.' });
      }

      if (order.status === 'cancelled') {
        await connection.rollback();
        return res.status(400).json({ error: 'Cannot confirm payment for a cancelled order.' });
      }

      // Fetch order items to deduct inventory
      const [items] = await connection.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );

      for (const item of items) {
        const [result] = await connection.query(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [item.quantity, item.product_id, item.quantity]
        );

        if (result.affectedRows !== 1) {
          await connection.rollback();
          return res.status(409).json({ error: 'One or more items in your order are no longer available in stock.' });
        }
      }

      // Mark order as paid and confirmed
      await connection.query(
        `UPDATE orders
         SET payment_status = 'paid',
             status = 'confirmed',
             razorpay_payment_id = ?
         WHERE id = ? AND user_id = ? AND payment_status = 'unpaid'`,
        [razorpay_payment_id, orderId, req.user.userId]
      );

      await connection.commit();
      res.json({ message: 'Payment verified successfully! Your order is confirmed.' });
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// ── GET PAYMENT STATUS ─────────────────────────────────────
// GET /payments/status/:order_id
router.get('/status/:order_id', isLoggedIn, async (req, res) => {
  const orderId = parseInt(req.params.order_id, 10);
  if (isNaN(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'A valid numeric order ID is required.' });
  }

  try {
    const [orders] = await db.query(
      `SELECT id, total, status, payment_status, razorpay_payment_id, created_at
       FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, req.user.userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json(orders[0]);
  } catch (err) {
    console.error('Payment status error:', err);
    res.status(500).json({ error: 'Unable to check payment status.' });
  }
});

module.exports = router;