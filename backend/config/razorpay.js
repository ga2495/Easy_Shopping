// backend/config/razorpay.js — Optional Razorpay SDK Initialization
const Razorpay = require('razorpay');

let razorpayInstance = null;

const keyId = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : '';
const keySecret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim() : '';

const isConfigured = Boolean(keyId && keySecret && keyId !== 'rzp_test_your_key_id' && keySecret !== 'your_razorpay_secret_key');

if (keyId && keySecret) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  } catch (err) {
    console.warn('⚠️ Razorpay initialization warning:', err.message);
    razorpayInstance = null;
  }
}

module.exports = {
  getRazorpay: () => razorpayInstance,
  isRazorpayConfigured: () => Boolean(razorpayInstance && isConfigured)
};
