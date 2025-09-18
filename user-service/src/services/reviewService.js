const { Review, User, UserStatistics } = require('../models');
const { cacheService } = require('../config/redis');
const { logger } = require('../config/logger');

class ReviewService {
  constructor() {
    this.cacheService = cacheService;
    this.logger = logger;
  }

  // Submit a new review
  async submitReview(reviewerId, revieweeId, reviewData, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== reviewerId) {
        throw new Error('Unauthorized to submit review for this user');
      }

      // Validate review eligibility
      await this.validateReviewEligibility(reviewerId, revieweeId, reviewData.deliveryId);

      // Validate review data
      const validatedData = this.validateReviewData(reviewData);

      // Check for existing review
      const existingReview = await Review.findOne({
        where: {
          deliveryId: reviewData.deliveryId,
          reviewerId
        }
      });

      if (existingReview) {
        throw new Error('You have already reviewed this delivery');
      }

      // Create review
      const review = await Review.create({
        ...validatedData,
        reviewerId,
        revieweeId,
        deliveryId: reviewData.deliveryId,
        metadata: {
          submittedAt: new Date().toISOString(),
          ipAddress: reviewData.metadata?.ipAddress,
          userAgent: reviewData.metadata?.userAgent
        }
      });

      // Update user statistics
      await this.updateUserRatingStatistics(revieweeId);

      // Invalidate cache
      await this.invalidateReviewCache(revieweeId);
      await this.invalidateReviewCache(reviewerId);

      // TODO: Trigger notification to reviewee
      // await notificationService.sendReviewNotification(revieweeId, review);

      this.logger.info('Review submitted successfully', {
        reviewId: review.id,
        reviewerId,
        revieweeId,
        deliveryId: reviewData.deliveryId,
        overallRating: review.overallRating
      });

      return this.formatReview(review);
    } catch (error) {
      this.logger.error('Error submitting review', {
        reviewerId,
        revieweeId,
        deliveryId: reviewData?.deliveryId,
        error: error.message
      });
      throw error;
    }
  }

  // Get reviews for a user (received)
  async getUserReviews(userId, options = {}) {
    try {
      const {
        type = 'received', // 'received' or 'given'
        rating = null,
        page = 1,
        limit = 20,
        includeHidden = false
      } = options;

      const offset = (page - 1) * limit;

      // Build cache key
      const cacheKey = `user:reviews:${userId}:${type}:${rating || 'all'}:${page}:${limit}`;
      const cachedReviews = await this.cacheService.get(cacheKey);

      if (cachedReviews) {
        this.logger.debug('Reviews retrieved from cache', { userId, type });
        return cachedReviews;
      }

      // Build where clause
      const where = {};
      
      if (type === 'received') {
        where.revieweeId = userId;
      } else {
        where.reviewerId = userId;
      }

      if (rating) {
        where.overallRating = rating;
      }

      if (!includeHidden) {
        where.status = 'active';
        where.moderationStatus = 'approved';
      }

      // Execute query
      const { count, rows } = await Review.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: User,
            as: type === 'received' ? 'Reviewer' : 'Reviewee',
            attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
          }
        ]
      });

      // Format reviews
      const reviews = rows.map(review => this.formatReview(review, type));

      const result = {
        reviews,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

      // Cache the result
      await this.cacheService.set(cacheKey, result, 300); // 5 minutes

      this.logger.info('User reviews retrieved successfully', {
        userId,
        type,
        count: reviews.length
      });

      return result;
    } catch (error) {
      this.logger.error('Error retrieving user reviews', {
        userId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  // Get review statistics for a user
  async getReviewStatistics(userId) {
    try {
      const cacheKey = `user:review_stats:${userId}`;
      const cachedStats = await this.cacheService.get(cacheKey);

      if (cachedStats) {
        this.logger.debug('Review statistics retrieved from cache', { userId });
        return cachedStats;
      }

      // Get overall statistics
      const [overallStats] = await Review.getAverageRatingForUser(userId);
      
      // Get rating breakdown
      const ratingBreakdown = await Review.getRatingBreakdown(userId);
      
      // Get category averages
      const [categoryStats] = await Review.getReviewStats(userId);

      // Format statistics
      const stats = {
        totalReviews: parseInt(overallStats?.totalReviews || 0),
        averageRating: parseFloat(overallStats?.averageRating || 0),
        ratingBreakdown: this.formatRatingBreakdown(ratingBreakdown),
        categoryAverages: {
          communication: parseFloat(categoryStats?.avgCommunication || 0),
          punctuality: parseFloat(categoryStats?.avgPunctuality || 0),
          carefulness: parseFloat(categoryStats?.avgCarefulness || 0),
          friendliness: parseFloat(categoryStats?.avgFriendliness || 0)
        }
      };

      // Cache the result
      await this.cacheService.set(cacheKey, stats, 600); // 10 minutes

      this.logger.info('Review statistics retrieved successfully', {
        userId,
        totalReviews: stats.totalReviews,
        averageRating: stats.averageRating
      });

      return stats;
    } catch (error) {
      this.logger.error('Error retrieving review statistics', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Add response to review
  async addReviewResponse(reviewId, response, userId, requesterId = null) {
    try {
      // Get review
      const review = await Review.findByPk(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Check permissions (only reviewee can respond)
      if (review.revieweeId !== userId) {
        throw new Error('Only the reviewee can respond to this review');
      }

      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to respond to this review');
      }

      if (review.response) {
        throw new Error('Review already has a response');
      }

      // Validate response
      if (!response || response.trim().length === 0) {
        throw new Error('Response cannot be empty');
      }

      if (response.length > 500) {
        throw new Error('Response must be less than 500 characters');
      }

      // Add response
      review.addResponse(response.trim());
      await review.save();

      // Invalidate cache
      await this.invalidateReviewCache(review.revieweeId);
      await this.invalidateReviewCache(review.reviewerId);

      this.logger.info('Review response added successfully', {
        reviewId,
        revieweeId: userId,
        responseLength: response.length
      });

      return this.formatReview(review);
    } catch (error) {
      this.logger.error('Error adding review response', {
        reviewId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Report a review
  async reportReview(reviewId, reporterId, reason, description = null) {
    try {
      const review = await Review.findByPk(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Validate reason
      const allowedReasons = [
        'inappropriate_content', 'spam', 'harassment', 
        'false_information', 'personal_attack', 'other'
      ];
      
      if (!allowedReasons.includes(reason)) {
        throw new Error(`Invalid reason. Allowed reasons: ${allowedReasons.join(', ')}`);
      }

      // TODO: Create review report record
      // await ReviewReport.create({
      //   reviewId,
      //   reporterId,
      //   reason,
      //   description
      // });

      // Flag review for moderation if not already flagged
      if (review.moderationStatus === 'approved') {
        review.moderationStatus = 'flagged';
        await review.save();
      }

      this.logger.info('Review reported successfully', {
        reviewId,
        reporterId,
        reason
      });

      return { success: true, message: 'Review reported for moderation' };
    } catch (error) {
      this.logger.error('Error reporting review', {
        reviewId,
        reporterId,
        reason,
        error: error.message
      });
      throw error;
    }
  }

  // Vote on review helpfulness
  async voteOnReview(reviewId, userId, helpful = true) {
    try {
      const review = await Review.findByPk(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      if (review.reviewerId === userId || review.revieweeId === userId) {
        throw new Error('Cannot vote on your own reviews');
      }

      // TODO: Check if user already voted and update vote
      // For now, just increment the counter
      if (helpful) {
        review.helpfulVotes += 1;
      } else {
        review.unhelpfulVotes += 1;
      }

      await review.save();

      // Invalidate cache
      await this.invalidateReviewCache(review.revieweeId);

      this.logger.info('Review vote recorded', {
        reviewId,
        userId,
        helpful,
        helpfulVotes: review.helpfulVotes,
        unhelpfulVotes: review.unhelpfulVotes
      });

      return {
        helpfulVotes: review.helpfulVotes,
        unhelpfulVotes: review.unhelpfulVotes,
        helpfulnessScore: review.getHelpfulnessScore()
      };
    } catch (error) {
      this.logger.error('Error voting on review', {
        reviewId,
        userId,
        helpful,
        error: error.message
      });
      throw error;
    }
  }

  // Update user rating statistics
  async updateUserRatingStatistics(userId) {
    try {
      // Get user statistics
      const userStats = await UserStatistics.findByUserId(userId);
      if (!userStats) {
        this.logger.warn('User statistics not found', { userId });
        return;
      }

      // Get all active reviews for this user
      const reviews = await Review.findAll({
        where: {
          revieweeId: userId,
          status: 'active',
          moderationStatus: 'approved'
        }
      });

      if (reviews.length === 0) {
        return;
      }

      // Calculate new statistics
      const totalRatings = reviews.length;
      const totalPoints = reviews.reduce((sum, review) => sum + review.overallRating, 0);
      const averageRating = totalPoints / totalRatings;

      // Calculate rating breakdown
      const ratingBreakdown = reviews.reduce((breakdown, review) => {
        breakdown[review.overallRating] = (breakdown[review.overallRating] || 0) + 1;
        return breakdown;
      }, { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });

      // Update user statistics
      await userStats.update({
        totalRatings,
        averageRating: Math.round(averageRating * 100) / 100,
        ratingBreakdown
      });

      // Invalidate cache
      await this.cacheService.invalidatePattern(`user:*:${userId}*`);

      this.logger.info('User rating statistics updated', {
        userId,
        totalRatings,
        averageRating,
        ratingBreakdown
      });
    } catch (error) {
      this.logger.error('Error updating user rating statistics', {
        userId,
        error: error.message
      });
      // Don't throw error as this is a background operation
    }
  }

  // Validate review eligibility
  async validateReviewEligibility(reviewerId, revieweeId, deliveryId) {
    // Basic validation
    if (reviewerId === revieweeId) {
      throw new Error('Cannot review yourself');
    }

    if (!deliveryId) {
      throw new Error('Delivery ID is required');
    }

    // TODO: Validate that the delivery exists and involves both users
    // TODO: Validate that the delivery is completed
    // TODO: Validate that the review period hasn't expired

    return true;
  }

  // Validate review data
  validateReviewData(reviewData) {
    const {
      overallRating,
      comment,
      communicationRating,
      punctualityRating,
      carefulnessRating,
      friendlinessRating,
      isAnonymous = false
    } = reviewData;

    // Validate overall rating
    if (!overallRating || overallRating < 1 || overallRating > 5) {
      throw new Error('Overall rating must be between 1 and 5');
    }

    // Validate category ratings if provided
    const categoryRatings = {
      communicationRating,
      punctualityRating,
      carefulnessRating,
      friendlinessRating
    };

    for (const [key, rating] of Object.entries(categoryRatings)) {
      if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
        throw new Error(`${key} must be between 1 and 5`);
      }
    }

    // Validate comment
    if (comment && comment.length > 1000) {
      throw new Error('Comment must be less than 1000 characters');
    }

    return {
      overallRating,
      comment: comment?.trim() || null,
      communicationRating: communicationRating || null,
      punctualityRating: punctualityRating || null,
      carefulnessRating: carefulnessRating || null,
      friendlinessRating: friendlinessRating || null,
      isAnonymous: Boolean(isAnonymous)
    };
  }

  // Format review for response
  formatReview(review, type = 'received') {
    const reviewData = {
      id: review.id,
      overallRating: review.overallRating,
      comment: review.comment,
      categoryRatings: review.getCategoryRatings(),
      isAnonymous: review.isAnonymous,
      isVerified: review.isVerified,
      helpfulVotes: review.helpfulVotes,
      unhelpfulVotes: review.unhelpfulVotes,
      helpfulnessScore: review.getHelpfulnessScore(),
      response: review.response,
      responseAt: review.responseAt,
      tags: review.tags,
      createdAt: review.createdAt
    };

    // Add reviewer/reviewee info if not anonymous
    if (!review.isAnonymous && review.Reviewer) {
      reviewData.reviewer = {
        id: review.Reviewer.id,
        firstName: review.Reviewer.firstName,
        lastName: review.Reviewer.lastName,
        profilePictureUrl: review.Reviewer.profilePictureUrl
      };
    }

    if (!review.isAnonymous && review.Reviewee) {
      reviewData.reviewee = {
        id: review.Reviewee.id,
        firstName: review.Reviewee.firstName,
        lastName: review.Reviewee.lastName,
        profilePictureUrl: review.Reviewee.profilePictureUrl
      };
    }

    return reviewData;
  }

  // Format rating breakdown
  formatRatingBreakdown(ratingBreakdown) {
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    
    ratingBreakdown.forEach(item => {
      breakdown[item.overall_rating] = parseInt(item.count);
    });

    return breakdown;
  }

  // Invalidate review cache
  async invalidateReviewCache(userId) {
    await this.cacheService.invalidatePattern(`user:review*:${userId}*`);
    this.logger.debug('Review cache invalidated', { userId });
  }
}

module.exports = new ReviewService();