const express = require('express');
const trackingRoutes = require('./trackingRoutes');
const geofenceRoutes = require('./geofenceRoutes');
const emergencyRoutes = require('./emergencyRoutes');
const routeRoutes = require('./routeRoutes');
const geocodingRoutes = require('./geocodingRoutes');
const privacyRoutes = require('./privacyRoutes');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'location-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
router.use('/', trackingRoutes);
router.use('/geofence', geofenceRoutes);
router.use('/geofences', geofenceRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/route', routeRoutes);
router.use('/geocode', geocodingRoutes);
router.use('/privacy', privacyRoutes);

module.exports = router;