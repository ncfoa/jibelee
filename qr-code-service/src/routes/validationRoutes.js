const express = require('express');
const { validationController } = require('../controllers');
const {
  authenticateToken,
  validateQRValidation,
  validateBackupCode,
  validateUUID,
  qrValidationRateLimit,
  generalRateLimit,
  auditLogger,
  suspiciousActivityDetector
} = require('../middleware');

const router = express.Router();

/**
 * QR Code Validation Routes
 */

// Validate pickup QR code
router.post('/pickup/validate',
  qrValidationRateLimit,
  authenticateToken,
  validateQRValidation,
  suspiciousActivityDetector,
  auditLogger,
  validationController.validatePickupQR
);

// Validate delivery QR code
router.post('/delivery/validate',
  qrValidationRateLimit,
  authenticateToken,
  validateQRValidation,
  suspiciousActivityDetector,
  auditLogger,
  validationController.validateDeliveryQR
);

// Generic QR code validation
router.post('/validate',
  qrValidationRateLimit,
  authenticateToken,
  validateQRValidation,
  suspiciousActivityDetector,
  auditLogger,
  validationController.validateQRCode
);

// Validate backup code
router.post('/validate-backup',
  qrValidationRateLimit,
  authenticateToken,
  validateBackupCode,
  suspiciousActivityDetector,
  auditLogger,
  validationController.validateBackupCode
);

/**
 * QR Code Integrity and Security Routes
 */

// Verify QR code integrity (without marking as used)
router.post('/verify-integrity',
  generalRateLimit,
  authenticateToken,
  validationController.verifyQRCodeIntegrity
);

/**
 * Validation Analytics Routes
 */

// Get scan history for a QR code
router.get('/:qrCodeId/scans',
  generalRateLimit,
  authenticateToken,
  validateUUID('qrCodeId'),
  validationController.getQRCodeScans
);

// Get validation statistics
router.get('/validation-stats',
  generalRateLimit,
  authenticateToken,
  validationController.getValidationStatistics
);

// Get suspicious scan activities
router.get('/suspicious-scans',
  generalRateLimit,
  authenticateToken,
  validationController.getSuspiciousScans
);

// Get real-time validation status
router.get('/validation-status',
  generalRateLimit,
  authenticateToken,
  validationController.getValidationStatus
);

module.exports = router;