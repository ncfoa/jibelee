const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const {
  authenticateToken,
  authorizePaymentOperation,
  validateCreatePaymentIntent,
  validateConfirmPayment,
  validatePaymentIntentId,
  validatePaymentHistoryQuery,
  rateLimitConfigs
} = require('../middleware');

const paymentService = new PaymentService();

// Apply payment-specific rate limiting
router.use(rateLimitConfigs.payment);

/**
 * @route POST /api/v1/payments/intents
 * @desc Create payment intent
 * @access Private
 */
router.post('/intents',
  authenticateToken,
  authorizePaymentOperation('create_payment'),
  validateCreatePaymentIntent,
  async (req, res) => {
    const paymentIntent = await paymentService.createPaymentIntent({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceFingerprint: req.get('X-Device-Fingerprint')
    });
    
    res.status(201).json({
      success: true,
      data: paymentIntent
    });
  }
);

/**
 * @route POST /api/v1/payments/intents/:paymentIntentId/confirm
 * @desc Confirm payment intent
 * @access Private
 */
router.post('/intents/:paymentIntentId/confirm',
  authenticateToken,
  validatePaymentIntentId,
  validateConfirmPayment,
  async (req, res) => {
    const result = await paymentService.confirmPayment(
      req.params.paymentIntentId,
      req.body
    );
    
    res.json({
      success: true,
      data: result
    });
  }
);

/**
 * @route GET /api/v1/payments/intents/:paymentIntentId
 * @desc Get payment status
 * @access Private
 */
router.get('/intents/:paymentIntentId',
  authenticateToken,
  validatePaymentIntentId,
  async (req, res) => {
    const payment = await paymentService.getPaymentStatus(req.params.paymentIntentId);
    
    res.json({
      success: true,
      data: payment
    });
  }
);

/**
 * @route POST /api/v1/payments/intents/:paymentIntentId/cancel
 * @desc Cancel payment intent
 * @access Private
 */
router.post('/intents/:paymentIntentId/cancel',
  authenticateToken,
  validatePaymentIntentId,
  async (req, res) => {
    const result = await paymentService.cancelPayment(
      req.params.paymentIntentId,
      req.body.reason
    );
    
    res.json({
      success: true,
      data: result
    });
  }
);

/**
 * @route GET /api/v1/payments/history
 * @desc Get payment history
 * @access Private
 */
router.get('/history',
  authenticateToken,
  validatePaymentHistoryQuery,
  async (req, res) => {
    const history = await paymentService.getPaymentHistory(
      req.user.id,
      { ...req.query, userType: req.user.type }
    );
    
    res.json({
      success: true,
      data: history.data,
      pagination: history.pagination,
      summary: history.summary
    });
  }
);

module.exports = router;