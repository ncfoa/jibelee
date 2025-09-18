const express = require('express');
const tripRoutes = require('./tripRoutes');
const templateRoutes = require('./templateRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const weatherRoutes = require('./weatherRoutes');

const router = express.Router();

// Mount route modules
router.use('/trips', tripRoutes);
router.use('/trips/templates', templateRoutes);
router.use('/trips/analytics', analyticsRoutes);
router.use('/trips/weather', weatherRoutes);

// Service info endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'Trip Management Service',
    version: '1.0.0',
    description: 'Comprehensive trip management microservice for P2P delivery platform',
    endpoints: {
      '/trips': 'Trip CRUD operations',
      '/trips/search': 'Trip search functionality',
      '/trips/templates': 'Trip template management',
      '/trips/analytics': 'Trip analytics and statistics',
      '/trips/weather': 'Weather information for trips'
    },
    documentation: '/api/v1/docs',
    health: '/health',
    metrics: '/metrics'
  });
});

module.exports = router;