// Main routes index file
const pricingRoutes = require('./pricingRoutes');
const paymentRoutes = require('./paymentRoutes');
const escrowRoutes = require('./escrowRoutes');
const payoutRoutes = require('./payoutRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const webhookRoutes = require('./webhookRoutes');

module.exports = {
  pricingRoutes,
  paymentRoutes,
  escrowRoutes,
  payoutRoutes,
  subscriptionRoutes,
  analyticsRoutes,
  webhookRoutes
};