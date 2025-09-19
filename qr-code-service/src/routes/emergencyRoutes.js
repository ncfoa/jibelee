const express = require('express');
const { emergencyController } = require('../controllers');
const {
  authenticateToken,
  requireAdmin,
  validateEmergencyOverride,
  validateEmergencyApproval,
  validateEmergencyUsage,
  validateUUID,
  emergencyRateLimit,
  adminRateLimit,
  generalRateLimit,
  auditLogger,
  strictRateLimit
} = require('../middleware');

const router = express.Router();

/**
 * Emergency Override Request Routes
 */

// Request emergency override
router.post('/',
  emergencyRateLimit,
  authenticateToken,
  validateEmergencyOverride,
  auditLogger,
  emergencyController.requestEmergencyOverride
);

// Get user's override history
router.get('/history',
  generalRateLimit,
  authenticateToken,
  emergencyController.getUserOverrideHistory
);

// Get override details
router.get('/:overrideId',
  generalRateLimit,
  authenticateToken,
  validateUUID('overrideId'),
  emergencyController.getOverrideDetails
);

// Cancel override request (before approval)
router.post('/:overrideId/cancel',
  generalRateLimit,
  authenticateToken,
  validateUUID('overrideId'),
  auditLogger,
  emergencyController.cancelOverrideRequest
);

/**
 * Emergency Override Usage Routes
 */

// Use emergency override
router.post('/:overrideId/use',
  strictRateLimit,
  authenticateToken,
  validateUUID('overrideId'),
  validateEmergencyUsage,
  auditLogger,
  emergencyController.useEmergencyOverride
);

/**
 * Admin-Only Routes
 */

// Get pending override requests (Admin only)
router.get('/pending',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  emergencyController.getPendingOverrides
);

// Approve emergency override (Admin only)
router.post('/:overrideId/approve',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  validateUUID('overrideId'),
  validateEmergencyApproval,
  auditLogger,
  emergencyController.approveEmergencyOverride
);

// Reject emergency override (Admin only)
router.post('/:overrideId/reject',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  validateUUID('overrideId'),
  auditLogger,
  emergencyController.rejectEmergencyOverride
);

// Get override statistics (Admin only)
router.get('/statistics',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  emergencyController.getOverrideStatistics
);

// Get approval queue metrics (Admin only)
router.get('/queue-metrics',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  emergencyController.getQueueMetrics
);

// Bulk approve overrides (Admin only)
router.post('/bulk-approve',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  auditLogger,
  emergencyController.bulkApproveOverrides
);

/**
 * Delivery-Specific Override Routes
 */

// Get current override status for delivery
router.get('/delivery/:deliveryId/status',
  generalRateLimit,
  authenticateToken,
  validateUUID('deliveryId'),
  emergencyController.getDeliveryOverrideStatus
);

module.exports = router;