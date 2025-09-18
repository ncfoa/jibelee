const reviewService = require('../services/reviewService');
const { logger } = require('../config/logger');

class ReviewController {
  constructor() {
    this.logger = logger;
  }

  // Submit a new review
  submitReview = async (req, res) => {
    try {
      const reviewerId = req.user.id;
      const { revieweeId } = req.params;
      const reviewData = {
        ...req.body,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      };

      const review = await reviewService.submitReview(
        reviewerId,
        revieweeId,
        reviewData,
        reviewerId
      );

      res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        data: review
      });
    } catch (error) {
      this.logger.error('Error submitting review', {
        reviewerId: req.user?.id,
        revieweeId: req.params.revieweeId,
        error: error.message
      });

      if (error.message.includes('already reviewed') || error.message.includes('Cannot review')) {
        return res.status(400).json({
          success: false,
          message: 'Review not allowed',
          errors: [error.message]
        });
      }

      if (error.message.includes('must be between') || error.message.includes('required')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to submit review',
        errors: [error.message]
      });
    }
  };

  // Get user reviews (received)
  getUserReviews = async (req, res) => {
    try {
      const { userId } = req.params;
      const options = {
        type: req.query.type || 'received',
        rating: req.query.rating ? parseInt(req.query.rating) : null,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await reviewService.getUserReviews(userId, options);

      res.json({
        success: true,
        data: result.reviews,
        pagination: result.pagination
      });
    } catch (error) {
      this.logger.error('Error getting user reviews', {
        userId: req.params.userId,
        options: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve reviews',
        errors: [error.message]
      });
    }
  };

  // Get review statistics
  getReviewStatistics = async (req, res) => {
    try {
      const { userId } = req.params;
      const statistics = await reviewService.getReviewStatistics(userId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      this.logger.error('Error getting review statistics', {
        userId: req.params.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve review statistics',
        errors: [error.message]
      });
    }
  };

  // Add response to review
  addReviewResponse = async (req, res) => {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      const { response } = req.body;

      const result = await reviewService.addReviewResponse(
        reviewId,
        response,
        userId,
        userId
      );

      res.json({
        success: true,
        message: 'Review response added successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error adding review response', {
        userId: req.user?.id,
        reviewId: req.params.reviewId,
        error: error.message
      });

      if (error.message === 'Review not found') {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
          errors: ['The requested review could not be found']
        });
      }

      if (error.message.includes('Only the reviewee') || error.message.includes('already has a response')) {
        return res.status(400).json({
          success: false,
          message: 'Response not allowed',
          errors: [error.message]
        });
      }

      if (error.message.includes('cannot be empty') || error.message.includes('must be less than')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add review response',
        errors: [error.message]
      });
    }
  };

  // Report a review
  reportReview = async (req, res) => {
    try {
      const reporterId = req.user.id;
      const { reviewId } = req.params;
      const { reason, description } = req.body;

      const result = await reviewService.reportReview(
        reviewId,
        reporterId,
        reason,
        description
      );

      res.json({
        success: true,
        message: 'Review reported successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error reporting review', {
        reporterId: req.user?.id,
        reviewId: req.params.reviewId,
        reason: req.body?.reason,
        error: error.message
      });

      if (error.message === 'Review not found') {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
          errors: ['The requested review could not be found']
        });
      }

      if (error.message.includes('Invalid reason')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to report review',
        errors: [error.message]
      });
    }
  };

  // Vote on review helpfulness
  voteOnReview = async (req, res) => {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      const { helpful } = req.body;

      const result = await reviewService.voteOnReview(reviewId, userId, helpful);

      res.json({
        success: true,
        message: 'Vote recorded successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error voting on review', {
        userId: req.user?.id,
        reviewId: req.params.reviewId,
        helpful: req.body?.helpful,
        error: error.message
      });

      if (error.message === 'Review not found') {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
          errors: ['The requested review could not be found']
        });
      }

      if (error.message.includes('Cannot vote on your own')) {
        return res.status(400).json({
          success: false,
          message: 'Vote not allowed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to record vote',
        errors: [error.message]
      });
    }
  };
}

module.exports = new ReviewController();