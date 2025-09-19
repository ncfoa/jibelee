const express = require('express');
const EmergencyController = require('../controllers/emergencyController');
const { validate, validateUUID } = require('../middleware/validation');
const { authenticate, validateEmergencyAccess, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const emergencyController = new EmergencyController();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route POST /api/v1/location/emergency
 * @desc Report an emergency
 * @access Private
 */
router.post('/',
  validate('reportEmergency'),
  validateEmergencyAccess,
  emergencyController.reportEmergency
);

/**
 * @route PUT /api/v1/location/emergency/:emergencyId
 * @desc Update emergency status
 * @access Private (Admin/Support)
 */
router.put('/:emergencyId',
  validateUUID('emergencyId'),
  validate('updateEmergencyStatus'),
  validateEmergencyAccess,
  emergencyController.updateEmergencyStatus
);

/**
 * @route GET /api/v1/location/emergency/services
 * @desc Get nearby emergency services
 * @access Private
 */
router.get('/services',
  validate('nearbyEmergencyServices', 'query'),
  validateEmergencyAccess,
  emergencyController.getNearbyEmergencyServices
);

/**
 * @route GET /api/v1/location/emergency/:emergencyId
 * @desc Get emergency details
 * @access Private
 */
router.get('/:emergencyId',
  validateUUID('emergencyId'),
  validateEmergencyAccess,
  emergencyController.getEmergencyDetails
);

/**
 * @route GET /api/v1/location/emergency/history
 * @desc Get emergency history for user or delivery
 * @access Private
 */
router.get('/history',
  emergencyController.getEmergencyHistory
);

/**
 * @route GET /api/v1/location/emergency/stats
 * @desc Get emergency statistics
 * @access Private
 */
router.get('/stats',
  emergencyController.getEmergencyStats
);

/**
 * @route GET /api/v1/location/emergency/active
 * @desc Get active emergencies (admin only)
 * @access Admin
 */
router.get('/active',
  requireAdmin,
  emergencyController.getActiveEmergencies
);

module.exports = router;