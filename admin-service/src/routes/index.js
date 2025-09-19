const express = require('express');
const router = express.Router();

// Import route modules
const dashboardRoutes = require('./dashboardRoutes');
const userRoutes = require('./userRoutes');
const financeRoutes = require('./financeRoutes');
const disputeRoutes = require('./disputeRoutes');
const systemRoutes = require('./systemRoutes');
const analyticsRoutes = require('./analyticsRoutes');

// Import middleware
const { authenticateAdminFlex } = require('../middleware/adminAuthMiddleware');
const { requestId, responseTime, cacheControl } = require('../middleware');

// Apply common middleware
router.use(requestId);
router.use(responseTime);
router.use(cacheControl({ maxAge: 0, noCache: true }));

// Apply authentication to all admin routes
router.use(authenticateAdminFlex);

// Mount routes
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/financials', financeRoutes);
router.use('/disputes', disputeRoutes);
router.use('/system', systemRoutes);
router.use('/analytics', analyticsRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'admin-service',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Admin and Management service for P2P Delivery Platform',
    endpoints: {
      dashboard: '/dashboard',
      users: '/users',
      financials: '/financials',
      disputes: '/disputes',
      system: '/system',
      analytics: '/analytics'
    },
    documentation: 'https://docs.p2pdelivery.com/admin-api',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;