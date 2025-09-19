const express = require('express');
const tripController = require('../controllers/tripController');
const { auth, validation, rateLimit } = require('../middleware');

const router = express.Router();

// Trip CRUD Routes
router.post('/', 
  auth.verifyToken,
  auth.requireUserType('traveler', 'both', 'admin'),
  validation.validateCreateTrip(),
  validation.sanitizeInput(),
  rateLimit.createTripRateLimit,
  tripController.createTrip
);

router.get('/search',
  auth.optionalAuth,
  validation.validateTripSearch(),
  validation.validateDateRange(),
  rateLimit.searchRateLimit,
  tripController.searchTrips
);

router.get('/my-trips',
  auth.verifyToken,
  auth.requireUserType('traveler', 'both', 'admin'),
  validation.validatePagination(),
  tripController.getMyTrips
);

router.get('/:id',
  validation.validateUUID('id'),
  auth.optionalAuth,
  tripController.getTripById
);

router.put('/:id',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  validation.validateUpdateTrip(),
  validation.sanitizeInput(),
  rateLimit.updateRateLimit,
  tripController.updateTrip
);

// Trip Operations Routes
router.post('/:id/start',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  validation.validate(validation.schema.object({
    currentLocation: validation.coordinatesSchema.optional(),
    actualDepartureTime: validation.schema.date().iso().optional(),
    notes: validation.schema.string().max(1000).optional()
  })),
  tripController.startTrip
);

router.post('/:id/status',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  validation.validateStatusUpdate(),
  tripController.updateTripStatus
);

router.post('/:id/complete',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  validation.validate(validation.schema.object({
    actualArrivalTime: validation.schema.date().iso().optional(),
    finalLocation: validation.coordinatesSchema.optional(),
    notes: validation.schema.string().max(1000).optional()
  })),
  tripController.completeTrip
);

router.post('/:id/cancel',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  validation.validateCancellation(),
  tripController.cancelTrip
);

router.post('/:id/duplicate',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireUserType('traveler', 'both', 'admin'),
  validation.validate(validation.schema.object({
    departureTime: validation.schema.date().iso().greater('now').required(),
    arrivalTime: validation.schema.date().iso().greater(validation.schema.ref('departureTime')).required(),
    modifications: validation.schema.object({
      title: validation.schema.string().max(255).optional(),
      capacity: validation.capacitySchema.optional(),
      pricing: validation.pricingSchema.optional()
    }).optional()
  })),
  rateLimit.createTripRateLimit,
  tripController.duplicateTrip
);

// Capacity Management Routes
router.get('/:id/capacity',
  validation.validateUUID('id'),
  auth.optionalAuth,
  tripController.getCapacityStatus
);

router.post('/:id/capacity/check',
  validation.validateUUID('id'),
  validation.validate(validation.schema.object({
    capacity: validation.capacitySchema.required()
  })),
  tripController.checkCapacity
);

router.post('/:id/capacity/reserve',
  validation.validateUUID('id'),
  auth.verifyToken,
  validation.validate(validation.schema.object({
    capacity: validation.capacitySchema.required(),
    reservationId: validation.schema.string().uuid().required(),
    holdTime: validation.schema.number().integer().min(1).max(60).default(15)
  })),
  tripController.reserveCapacity
);

router.post('/:id/capacity/release',
  validation.validateUUID('id'),
  auth.verifyToken,
  validation.validate(validation.schema.object({
    reservationId: validation.schema.string().uuid().required()
  })),
  tripController.releaseCapacity
);

// Weather Routes
router.get('/:id/weather',
  validation.validateUUID('id'),
  auth.optionalAuth,
  tripController.getTripWeather
);

router.post('/:id/weather/refresh',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  rateLimit.strictRateLimit,
  tripController.refreshTripWeather
);

// Sharing and Export Routes
router.post('/:id/share',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  validation.validate(validation.schema.object({
    method: validation.schema.string().valid('link', 'qr', 'social').required(),
    platform: validation.schema.string().valid('whatsapp', 'telegram', 'facebook', 'twitter').optional(),
    message: validation.schema.string().max(500).optional()
  })),
  tripController.shareTrip
);

router.get('/:id/export',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  validation.validateExportParams(),
  tripController.exportTripData
);

module.exports = router;