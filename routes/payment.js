const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
};

// Create payment intent
router.post('/create-intent', requireAuth, paymentController.createPaymentIntent);

// Confirm payment
router.post('/confirm', requireAuth, paymentController.confirmPayment);

// Release payment to freelancer
router.post('/release', requireAuth, paymentController.releasePayment);

// Get payment status
router.get('/status/:jobId', requireAuth, paymentController.getPaymentStatus);

module.exports = router;
