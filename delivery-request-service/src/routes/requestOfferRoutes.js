const express = require('express');
const offerController = require('../controllers/offerController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const rateLimitMiddleware = require('../middleware/rateLimitMiddleware');

const router = express.Router({ mergeParams: true });

// Apply general rate limiting to all routes
router.use(rateLimitMiddleware.general());

// All routes require authentication
router.use(authMiddleware.verifyToken);

// Offers for specific delivery request
router.get('/',
  validationMiddleware.validateUUID(),
  offerController.getRequestOffers
);

router.post('/',
  authMiddleware.requireTraveler,
  rateLimitMiddleware.offers(),
  rateLimitMiddleware.perUser({
    windowMs: 5 * 60 * 1000,
    max: 10,
    action: 'create_offer',
    message: 'Too many offers submitted, please wait'
  }),
  validationMiddleware.validateUUID(),
  validationMiddleware.validateCreateOffer(),
  offerController.createOffer
);

module.exports = router;