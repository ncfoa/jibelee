const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: false,
});

const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID,
  
  // Fee structure
  platformFeeRate: parseFloat(process.env.PLATFORM_FEE_RATE) || 0.10, // 10%
  stripeFeeRate: parseFloat(process.env.STRIPE_FEE_RATE) || 0.029, // 2.9%
  stripeFeeFixed: parseInt(process.env.STRIPE_FEE_FIXED, 10) || 30, // 30 cents
  
  // Instant payout fees
  instantPayoutFeeRate: parseFloat(process.env.INSTANT_PAYOUT_FEE_RATE) || 0.015, // 1.5%
  instantPayoutFeeMin: parseInt(process.env.INSTANT_PAYOUT_FEE_MIN, 10) || 50, // $0.50
  
  // Minimum amounts (in cents)
  minPaymentAmount: parseInt(process.env.MIN_PAYMENT_AMOUNT, 10) || 100, // $1.00
  minPayoutAmount: parseInt(process.env.MIN_PAYOUT_AMOUNT, 10) || 100, // $1.00
  minInstantPayoutAmount: parseInt(process.env.MIN_INSTANT_PAYOUT_AMOUNT, 10) || 500, // $5.00
  
  // Currency settings
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
  supportedCurrencies: (process.env.SUPPORTED_CURRENCIES || 'USD,EUR,GBP,CAD').split(','),
  
  // Connect settings
  connectAccountType: process.env.STRIPE_CONNECT_ACCOUNT_TYPE || 'express',
  
  // Webhook settings
  webhookTolerance: parseInt(process.env.STRIPE_WEBHOOK_TOLERANCE, 10) || 300 // 5 minutes
};

// Validate required configuration
const validateStripeConfig = () => {
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required Stripe configuration: ${missing.join(', ')}`);
  }
};

module.exports = {
  stripe,
  stripeConfig,
  validateStripeConfig
};