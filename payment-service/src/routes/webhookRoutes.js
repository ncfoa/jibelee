const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const PayoutService = require('../services/payoutService');
const {
  verifyWebhookSignature,
  validateWebhookPayload,
  rateLimitConfigs
} = require('../middleware');

const paymentService = new PaymentService();
const payoutService = new PayoutService();

// Apply webhook-specific rate limiting
router.use(rateLimitConfigs.webhook);

/**
 * @route POST /api/v1/webhooks/stripe
 * @desc Handle Stripe webhooks
 * @access Public (but verified)
 */
router.post('/stripe',
  verifyWebhookSignature,
  validateWebhookPayload,
  async (req, res) => {
    const event = req.stripeEvent;
    
    let processed = false;
    
    // Route to appropriate service based on event type
    if (event.type.startsWith('payment_intent.') || event.type.startsWith('charge.')) {
      processed = await paymentService.processWebhook(event);
    } else if (event.type.startsWith('payout.') || event.type.startsWith('account.')) {
      processed = await payoutService.processPayoutWebhook(event);
    }
    
    if (processed) {
      res.json({ received: true });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Webhook processing failed' 
      });
    }
  }
);

module.exports = router;