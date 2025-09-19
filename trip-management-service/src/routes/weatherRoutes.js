const express = require('express');
const weatherController = require('../controllers/weatherController');
const { auth, validation, rateLimit } = require('../middleware');

const router = express.Router();

// Weather Information Routes
router.get('/alerts',
  auth.verifyToken,
  validation.validate(validation.schema.object({
    severity: validation.schema.string().valid('low', 'medium', 'high', 'critical').optional(),
    limit: validation.schema.number().integer().min(1).max(100).default(20)
  }), 'query'),
  weatherController.getWeatherAlerts
);

router.post('/forecast',
  auth.optionalAuth,
  validation.validate(validation.schema.object({
    origin: validation.schema.alternatives().try(
      validation.addressSchema,
      validation.schema.string().min(2).max(200)
    ).required(),
    destination: validation.schema.alternatives().try(
      validation.addressSchema,
      validation.schema.string().min(2).max(200)
    ).required(),
    departureTime: validation.schema.date().iso().required()
  })),
  rateLimit.apiRateLimit,
  weatherController.getRouteForecast
);

// Trip-specific Weather Routes (these are also available in trip routes)
router.get('/:id',
  validation.validateUUID('id'),
  auth.optionalAuth,
  weatherController.getTripWeather
);

router.get('/:id/detailed',
  validation.validateUUID('id'),
  auth.optionalAuth,
  weatherController.getDetailedWeather
);

router.post('/:id/refresh',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  rateLimit.strictRateLimit,
  weatherController.refreshTripWeather
);

module.exports = router;