const express = require('express');
const deliveryRequestController = require('../controllers/deliveryRequestController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const rateLimitMiddleware = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// Apply general rate limiting to all routes
router.use(rateLimitMiddleware.general());

// Public/semi-public routes
router.get('/search', 
  authMiddleware.optionalAuth,
  rateLimitMiddleware.search(),
  validationMiddleware.validateSearchQuery(),
  deliveryRequestController.searchDeliveryRequests
);

router.get('/popular-routes',
  authMiddleware.optionalAuth,
  validationMiddleware.validatePaginationQuery(),
  deliveryRequestController.getPopularRoutes
);

router.get('/recommendations',
  authMiddleware.verifyToken,
  deliveryRequestController.getRecommendations
);

router.get('/statistics',
  authMiddleware.verifyToken,
  deliveryRequestController.getStatistics
);

// Protected routes requiring authentication
router.use(authMiddleware.verifyToken);

// Customer-specific routes
router.post('/',
  authMiddleware.requireCustomer,
  rateLimitMiddleware.creation(),
  validationMiddleware.validateCreateDeliveryRequest(),
  deliveryRequestController.createDeliveryRequest
);

router.get('/my-requests',
  authMiddleware.requireCustomer,
  validationMiddleware.validatePaginationQuery(),
  deliveryRequestController.getMyRequests
);

// Individual delivery request routes
router.get('/:requestId',
  validationMiddleware.validateUUID(),
  deliveryRequestController.getDeliveryRequest
);

router.put('/:requestId',
  authMiddleware.requireCustomer,
  rateLimitMiddleware.perUser({ 
    windowMs: 5 * 60 * 1000, 
    max: 5, 
    action: 'update_request',
    message: 'Too many update requests, please wait'
  }),
  validationMiddleware.validateUUID(),
  validationMiddleware.validateUpdateDeliveryRequest(),
  deliveryRequestController.updateDeliveryRequest
);

router.post('/:requestId/cancel',
  authMiddleware.requireCustomer,
  validationMiddleware.validateUUID(),
  validationMiddleware.validateCancellationReason(),
  deliveryRequestController.cancelDeliveryRequest
);

router.post('/:requestId/find-matches',
  authMiddleware.requireCustomer,
  rateLimitMiddleware.perUser({
    windowMs: 2 * 60 * 1000,
    max: 10,
    action: 'find_matches',
    message: 'Too many matching requests, please wait'
  }),
  validationMiddleware.validateUUID(),
  deliveryRequestController.findMatches
);

router.post('/:requestId/duplicate',
  authMiddleware.requireCustomer,
  rateLimitMiddleware.creation(),
  validationMiddleware.validateUUID(),
  deliveryRequestController.duplicateDeliveryRequest
);

router.get('/:requestId/analytics',
  authMiddleware.requireCustomer,
  validationMiddleware.validateUUID(),
  deliveryRequestController.getRequestAnalytics
);

router.post('/:requestId/report',
  authMiddleware.verifyToken,
  rateLimitMiddleware.perUser({
    windowMs: 10 * 60 * 1000,
    max: 3,
    action: 'report_request',
    message: 'Too many reports, please wait'
  }),
  validationMiddleware.validateUUID(),
  deliveryRequestController.reportDeliveryRequest
);

module.exports = router;