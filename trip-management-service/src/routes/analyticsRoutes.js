const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { auth, validation, rateLimit } = require('../middleware');

const router = express.Router();

// User Analytics Routes
router.get('/',
  auth.verifyToken,
  validation.validateAnalyticsQuery(),
  analyticsController.getTripAnalytics
);

router.get('/statistics',
  auth.verifyToken,
  validation.validate(validation.schema.object({
    period: validation.schema.string().valid('week', 'month', 'quarter', 'year').default('month'),
    groupBy: validation.schema.string().valid('day', 'week', 'month').optional(),
    startDate: validation.schema.date().iso().optional(),
    endDate: validation.schema.date().iso().min(validation.schema.ref('startDate')).optional()
  }), 'query'),
  analyticsController.getTripStatistics
);

// Trip-specific Analytics Routes
router.get('/:id/performance',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireOwnership('traveler_id'),
  analyticsController.getTripPerformance
);

// Market Analytics Routes (Public)
router.get('/popular-routes',
  auth.optionalAuth,
  validation.validate(validation.schema.object({
    period: validation.schema.string().valid('week', 'month', 'quarter', 'year').default('month'),
    limit: validation.schema.number().integer().min(1).max(50).default(10),
    origin: validation.schema.string().max(200).optional(),
    destination: validation.schema.string().max(200).optional()
  }), 'query'),
  analyticsController.getPopularRoutes
);

router.get('/recommendations',
  auth.verifyToken,
  validation.validate(validation.schema.object({
    origin: validation.schema.string().max(200).optional(),
    destination: validation.schema.string().max(200).optional(),
    type: validation.schema.string().valid('flight', 'train', 'bus', 'car', 'ship', 'other').optional(),
    preferences: validation.schema.object().optional()
  }), 'query'),
  analyticsController.getTripRecommendations
);

module.exports = router;