const express = require('express');
const reviewController = require('../controllers/reviewController');
const { auth, validation, security } = require('../middleware');

const router = express.Router();

// Submit review
router.post('/reviews',
  auth.authenticateToken,
  auth.requireVerificationLevel('email_verified'),
  security.strictRateLimit,
  validation.reviewValidation(),
  reviewController.submitReview
);

// Get user reviews
router.get('/:userId/reviews',
  auth.optionalAuth,
  validation.uuidParamValidation('userId'),
  validation.paginationValidation(),
  reviewController.getUserReviews
);

// Get review statistics
router.get('/:userId/review-statistics',
  auth.optionalAuth,
  validation.uuidParamValidation('userId'),
  reviewController.getReviewStatistics
);

// Add response to review
router.post('/reviews/:reviewId/response',
  auth.authenticateToken,
  validation.uuidParamValidation('reviewId'),
  validation.reviewResponseValidation(),
  reviewController.addReviewResponse
);

// Report review
router.post('/reviews/:reviewId/report',
  auth.authenticateToken,
  validation.uuidParamValidation('reviewId'),
  validation.reviewReportValidation(),
  reviewController.reportReview
);

// Vote on review helpfulness
router.post('/reviews/:reviewId/vote',
  auth.authenticateToken,
  validation.uuidParamValidation('reviewId'),
  validation.reviewVoteValidation(),
  reviewController.voteOnReview
);

module.exports = router;