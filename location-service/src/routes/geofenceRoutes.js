const express = require('express');
const GeofenceController = require('../controllers/geofenceController');
const { validate, validateUUID } = require('../middleware/validation');
const { authenticate, validateDeliveryAccess, requireAdmin, authorize } = require('../middleware/auth');

const router = express.Router();
const geofenceController = new GeofenceController();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route POST /api/v1/location/geofence
 * @desc Create a new geofence
 * @access Private
 */
router.post('/',
  validate('createGeofence'),
  geofenceController.createGeofence
);

/**
 * @route GET /api/v1/location/geofences/active
 * @desc Get active geofences
 * @access Private
 */
router.get('/active',
  validate('activeGeofences', 'query'),
  geofenceController.getActiveGeofences
);

/**
 * @route PUT /api/v1/location/geofences/:geofenceId
 * @desc Update a geofence
 * @access Private
 */
router.put('/:geofenceId',
  validateUUID('geofenceId'),
  validate('updateGeofence'),
  geofenceController.updateGeofence
);

/**
 * @route DELETE /api/v1/location/geofences/:geofenceId
 * @desc Delete a geofence
 * @access Private
 */
router.delete('/:geofenceId',
  validateUUID('geofenceId'),
  geofenceController.deleteGeofence
);

/**
 * @route POST /api/v1/location/geofence/check
 * @desc Check geofence status for a location
 * @access Private
 */
router.post('/check',
  validate('checkGeofence'),
  geofenceController.checkGeofenceStatus
);

/**
 * @route GET /api/v1/location/geofences/:geofenceId/events
 * @desc Get geofence events
 * @access Private
 */
router.get('/:geofenceId/events',
  validateUUID('geofenceId'),
  geofenceController.getGeofenceEvents
);

/**
 * @route GET /api/v1/location/geofences/:geofenceId/stats
 * @desc Get geofence statistics
 * @access Private
 */
router.get('/:geofenceId/stats',
  validateUUID('geofenceId'),
  geofenceController.getGeofenceStats
);

/**
 * @route POST /api/v1/location/geofences/delivery
 * @desc Create delivery-specific geofences
 * @access Private
 */
router.post('/delivery',
  validate('createGeofence'), // Reuse validation schema
  geofenceController.createDeliveryGeofences
);

/**
 * @route GET /api/v1/location/geofences/recommendations
 * @desc Get geofence recommendations for a location
 * @access Private
 */
router.get('/recommendations',
  validate('recommendations', 'query'),
  geofenceController.getGeofenceRecommendations
);

module.exports = router;