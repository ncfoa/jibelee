const express = require('express');
const qrCodeRoutes = require('./qrCodeRoutes');
const validationRoutes = require('./validationRoutes');
const emergencyRoutes = require('./emergencyRoutes');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'QR Code Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Service info endpoint
router.get('/info', (req, res) => {
  res.json({
    success: true,
    service: {
      name: 'QR Code Service',
      description: 'Secure QR code generation and validation for P2P Delivery Platform',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: [
        'Encrypted QR code generation',
        'Multi-level security validation',
        'Emergency override system',
        'Real-time tracking and analytics',
        'Blockchain integration (optional)'
      ],
      endpoints: {
        generation: '/api/v1/qr',
        validation: '/api/v1/qr',
        emergency: '/api/v1/qr/emergency-override'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Mount route modules
router.use('/qr', qrCodeRoutes);
router.use('/qr', validationRoutes);
router.use('/qr/emergency-override', emergencyRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /api/v1/health',
      'GET /api/v1/info',
      'POST /api/v1/qr/pickup/generate',
      'POST /api/v1/qr/delivery/generate',
      'POST /api/v1/qr/validate',
      'POST /api/v1/qr/emergency-override'
    ]
  });
});

module.exports = router;