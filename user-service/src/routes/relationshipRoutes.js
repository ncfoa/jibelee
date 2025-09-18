const express = require('express');
const { auth, validation, security } = require('../middleware');
const { UserBlock, UserFavorite } = require('../models');
const { logger } = require('../config/logger');

const router = express.Router();

// Block user endpoints

// Block a user
router.post('/me/blocked-users',
  auth.authenticateToken,
  validation.blockUserValidation(),
  async (req, res) => {
    try {
      const blockerId = req.user.id;
      const { userId, reason, comment } = req.body;

      if (blockerId === userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot block yourself',
          errors: ['You cannot block your own account']
        });
      }

      const block = await UserBlock.blockUser(blockerId, userId, reason, comment);

      logger.info('User blocked successfully', {
        blockerId,
        blockedId: userId,
        reason
      });

      res.status(201).json({
        success: true,
        message: 'User blocked successfully',
        data: {
          id: block.id,
          blockedUserId: userId,
          reason: block.reason,
          createdAt: block.createdAt
        }
      });
    } catch (error) {
      logger.error('Error blocking user', {
        blockerId: req.user?.id,
        userId: req.body?.userId,
        error: error.message
      });

      if (error.message.includes('already blocked')) {
        return res.status(409).json({
          success: false,
          message: 'User already blocked',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to block user',
        errors: [error.message]
      });
    }
  }
);

// Unblock a user
router.delete('/me/blocked-users/:userId',
  auth.authenticateToken,
  validation.uuidParamValidation('userId'),
  async (req, res) => {
    try {
      const blockerId = req.user.id;
      const { userId } = req.params;

      const block = await UserBlock.unblockUser(blockerId, userId);

      logger.info('User unblocked successfully', {
        blockerId,
        unblockedId: userId
      });

      res.json({
        success: true,
        message: 'User unblocked successfully',
        data: {
          unblockedUserId: userId,
          unblockedAt: block.unblockedAt
        }
      });
    } catch (error) {
      logger.error('Error unblocking user', {
        blockerId: req.user?.id,
        userId: req.params.userId,
        error: error.message
      });

      if (error.message.includes('No active block')) {
        return res.status(404).json({
          success: false,
          message: 'Block not found',
          errors: ['No active block found for this user']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to unblock user',
        errors: [error.message]
      });
    }
  }
);

// Get blocked users
router.get('/me/blocked-users',
  auth.authenticateToken,
  async (req, res) => {
    try {
      const blockerId = req.user.id;
      const blockedUsers = await UserBlock.findByBlockerId(blockerId);

      res.json({
        success: true,
        data: blockedUsers.map(block => ({
          id: block.id,
          blockedUser: block.BlockedUser,
          reason: block.reason,
          comment: block.comment,
          blockedAt: block.createdAt
        }))
      });
    } catch (error) {
      logger.error('Error getting blocked users', {
        blockerId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve blocked users',
        errors: [error.message]
      });
    }
  }
);

// Favorite user endpoints

// Add user to favorites
router.post('/me/favorites',
  auth.authenticateToken,
  validation.favoriteUserValidation(),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const { userId, notes, priority, notificationSettings } = req.body;

      if (customerId === userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot favorite yourself',
          errors: ['You cannot add yourself to favorites']
        });
      }

      const favorite = await UserFavorite.addFavorite(customerId, userId, {
        notes,
        priority,
        notificationSettings
      });

      logger.info('User added to favorites', {
        customerId,
        travelerId: userId,
        priority
      });

      res.status(201).json({
        success: true,
        message: 'User added to favorites successfully',
        data: {
          id: favorite.id,
          userId,
          priority: favorite.priority,
          addedAt: favorite.addedAt
        }
      });
    } catch (error) {
      logger.error('Error adding user to favorites', {
        customerId: req.user?.id,
        userId: req.body?.userId,
        error: error.message
      });

      if (error.message.includes('already in favorites')) {
        return res.status(409).json({
          success: false,
          message: 'User already in favorites',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add user to favorites',
        errors: [error.message]
      });
    }
  }
);

// Remove user from favorites
router.delete('/me/favorites/:userId',
  auth.authenticateToken,
  validation.uuidParamValidation('userId'),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const { userId } = req.params;

      const favorite = await UserFavorite.removeFavorite(customerId, userId);

      logger.info('User removed from favorites', {
        customerId,
        travelerId: userId
      });

      res.json({
        success: true,
        message: 'User removed from favorites successfully',
        data: {
          removedUserId: userId,
          removedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error removing user from favorites', {
        customerId: req.user?.id,
        userId: req.params.userId,
        error: error.message
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'Favorite not found',
          errors: ['User is not in your favorites']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to remove user from favorites',
        errors: [error.message]
      });
    }
  }
);

// Get favorite users
router.get('/me/favorites',
  auth.authenticateToken,
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const favorites = await UserFavorite.findByCustomerId(customerId);

      res.json({
        success: true,
        data: favorites.map(fav => ({
          id: fav.id,
          traveler: fav.Traveler,
          priority: fav.priority,
          notes: fav.notes,
          totalDeliveries: fav.totalDeliveries,
          successfulDeliveries: fav.successfulDeliveries,
          averageRating: parseFloat(fav.averageRating),
          lastDeliveryAt: fav.lastDeliveryAt,
          addedAt: fav.addedAt,
          notificationSettings: {
            notifyOnNewTrip: fav.notifyOnNewTrip,
            notifyOnPriceChange: fav.notifyOnPriceChange,
            maxNotificationDistance: fav.maxNotificationDistance
          }
        }))
      });
    } catch (error) {
      logger.error('Error getting favorite users', {
        customerId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve favorite users',
        errors: [error.message]
      });
    }
  }
);

// Report user
router.post('/reports',
  auth.authenticateToken,
  security.strictRateLimit,
  validation.reportUserValidation(),
  async (req, res) => {
    try {
      const reporterId = req.user.id;
      const { reportedUserId, deliveryId, category, description, evidence } = req.body;

      if (reporterId === reportedUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot report yourself',
          errors: ['You cannot report your own account']
        });
      }

      // TODO: Create user report record in database
      // For now, just log the report
      logger.warn('User reported', {
        reporterId,
        reportedUserId,
        deliveryId,
        category,
        description,
        evidenceCount: evidence?.length || 0
      });

      res.status(201).json({
        success: true,
        message: 'User report submitted successfully',
        data: {
          reportId: `report_${Date.now()}`,
          reportedUserId,
          category,
          submittedAt: new Date(),
          status: 'pending_review'
        }
      });
    } catch (error) {
      logger.error('Error reporting user', {
        reporterId: req.user?.id,
        reportedUserId: req.body?.reportedUserId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to submit user report',
        errors: [error.message]
      });
    }
  }
);

module.exports = router;