const express = require('express');
const TrackingController = require('../controllers/trackingController');
const { validate, validateUUID } = require('../middleware/validation');
const { authenticate, validateDeliveryAccess, validateTrackingPermissions } = require('../middleware/auth');

const router = express.Router();
const trackingController = new TrackingController();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route POST /api/v1/location/track
 * @desc Start/update location tracking
 * @access Private
 */
router.post('/track',
  validate('updateLocation'),
  validateTrackingPermissions,
  trackingController.startTracking
);

/**
 * @route GET /api/v1/location/current/:deliveryId
 * @desc Get current location for a delivery
 * @access Private
 */
router.get('/current/:deliveryId',
  validateUUID('deliveryId'),
  validateDeliveryAccess,
  trackingController.getCurrentLocation
);

/**
 * @route GET /api/v1/location/history/:deliveryId
 * @desc Get location history for a delivery
 * @access Private
 */
router.get('/history/:deliveryId',
  validateUUID('deliveryId'),
  validate('locationHistory', 'query'),
  validateDeliveryAccess,
  trackingController.getLocationHistory
);

/**
 * @route GET /api/v1/location/travelers/nearby
 * @desc Search for available travelers nearby
 * @access Private
 */
router.get('/travelers/nearby',
  validate('nearbyTravelers', 'query'),
  trackingController.findNearbyTravelers
);

/**
 * @route GET /api/v1/location/eta/:deliveryId
 * @desc Get ETA updates for a delivery
 * @access Private
 */
router.get('/eta/:deliveryId',
  validateUUID('deliveryId'),
  validateDeliveryAccess,
  trackingController.getETAUpdates
);

/**
 * @route GET /api/v1/location/analytics
 * @desc Get location analytics
 * @access Private
 */
router.get('/analytics',
  validate('analytics', 'query'),
  trackingController.getLocationAnalytics
);

module.exports = router;