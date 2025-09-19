const express = require('express');
const { qrCodeController } = require('../controllers');
const {
  authenticateToken,
  requireDeliveryAccess,
  validateQRGeneration,
  validateBulkGeneration,
  validateUUID,
  validateQRFilters,
  qrGenerationRateLimit,
  generalRateLimit,
  auditLogger
} = require('../middleware');

const router = express.Router();

/**
 * QR Code Generation Routes
 */

// Generate pickup QR code
router.post('/pickup/generate',
  qrGenerationRateLimit,
  authenticateToken,
  validateQRGeneration,
  requireDeliveryAccess,
  auditLogger,
  qrCodeController.generatePickupQR
);

// Generate delivery QR code
router.post('/delivery/generate',
  qrGenerationRateLimit,
  authenticateToken,
  validateQRGeneration,
  requireDeliveryAccess,
  auditLogger,
  qrCodeController.generateDeliveryQR
);

// Bulk generate QR codes
router.post('/bulk-generate',
  qrGenerationRateLimit,
  authenticateToken,
  validateBulkGeneration,
  auditLogger,
  qrCodeController.bulkGenerateQRCodes
);

/**
 * QR Code Management Routes
 */

// Get QR code details
router.get('/:qrCodeId',
  generalRateLimit,
  authenticateToken,
  validateUUID('qrCodeId'),
  qrCodeController.getQRCodeDetails
);

// Get QR codes for a delivery
router.get('/delivery/:deliveryId',
  generalRateLimit,
  authenticateToken,
  validateUUID('deliveryId'),
  requireDeliveryAccess,
  qrCodeController.getDeliveryQRCodes
);

// Download QR code image
router.get('/:qrCodeId/image',
  generalRateLimit,
  authenticateToken,
  validateUUID('qrCodeId'),
  qrCodeController.downloadQRCodeImage
);

// Regenerate QR code
router.post('/:qrCodeId/regenerate',
  qrGenerationRateLimit,
  authenticateToken,
  validateUUID('qrCodeId'),
  auditLogger,
  qrCodeController.regenerateQRCode
);

// Revoke QR code
router.post('/:qrCodeId/revoke',
  generalRateLimit,
  authenticateToken,
  validateUUID('qrCodeId'),
  auditLogger,
  qrCodeController.revokeQRCode
);

/**
 * QR Code Analytics and History Routes
 */

// Get QR code history
router.get('/history',
  generalRateLimit,
  authenticateToken,
  validateQRFilters,
  qrCodeController.getQRCodeHistory
);

// Get QR code analytics
router.get('/analytics',
  generalRateLimit,
  authenticateToken,
  qrCodeController.getQRCodeAnalytics
);

// Get performance metrics
router.get('/performance-metrics',
  generalRateLimit,
  authenticateToken,
  qrCodeController.getPerformanceMetrics
);

/**
 * Testing and Utility Routes
 */

// Test QR code scanner
router.post('/test-scanner',
  generalRateLimit,
  authenticateToken,
  qrCodeController.testQRScanner
);

module.exports = router;