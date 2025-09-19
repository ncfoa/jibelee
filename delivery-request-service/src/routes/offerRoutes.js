const express = require('express');
const offerController = require('../controllers/offerController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const rateLimitMiddleware = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// Apply general rate limiting to all routes
router.use(rateLimitMiddleware.general());

// All routes require authentication
router.use(authMiddleware.verifyToken);

// Offer management routes
router.get('/my-offers',
  validationMiddleware.validatePaginationQuery(),
  offerController.getMyOffers
);

router.get('/statistics',
  offerController.getOfferStatistics
);

// Individual offer routes
router.put('/:offerId',
  authMiddleware.requireTraveler,
  rateLimitMiddleware.perUser({
    windowMs: 5 * 60 * 1000,
    max: 10,
    action: 'update_offer',
    message: 'Too many offer updates, please wait'
  }),
  validationMiddleware.validateUUID(),
  validationMiddleware.validateUpdateOffer(),
  offerController.updateOffer
);

router.post('/:offerId/accept',
  authMiddleware.requireCustomer,
  rateLimitMiddleware.burst({
    windowMs: 2000, // 2 seconds between accepts
    max: 1,
    keyPrefix: 'accept_offer'
  }),
  validationMiddleware.validateUUID(),
  validationMiddleware.validateAcceptOffer(),
  offerController.acceptOffer
);

router.post('/:offerId/decline',
  authMiddleware.requireCustomer,
  rateLimitMiddleware.perUser({
    windowMs: 1 * 60 * 1000,
    max: 20,
    action: 'decline_offer',
    message: 'Too many decline requests, please wait'
  }),
  validationMiddleware.validateUUID(),
  validationMiddleware.validateCancellationReason(),
  offerController.declineOffer
);

router.delete('/:offerId',
  authMiddleware.requireTraveler,
  rateLimitMiddleware.perUser({
    windowMs: 1 * 60 * 1000,
    max: 10,
    action: 'withdraw_offer',
    message: 'Too many withdraw requests, please wait'
  }),
  validationMiddleware.validateUUID(),
  validationMiddleware.validateCancellationReason(),
  offerController.withdrawOffer
);

module.exports = router;