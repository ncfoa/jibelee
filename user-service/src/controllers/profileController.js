const profileService = require('../services/profileService');
const { logger } = require('../config/logger');

class ProfileController {
  constructor() {
    this.logger = logger;
  }

  // Get current user profile
  getCurrentProfile = async (req, res) => {
    try {
      const userId = req.user.id;
      const profile = await profileService.getUserProfile(userId, userId, true);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      this.logger.error('Error getting current profile', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        errors: [error.message]
      });
    }
  };

  // Get user profile by ID
  getUserProfile = async (req, res) => {
    try {
      const { userId } = req.params;
      const requesterId = req.user?.id;
      
      const profile = await profileService.getUserProfile(userId, requesterId);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      this.logger.error('Error getting user profile', {
        userId: req.params.userId,
        requesterId: req.user?.id,
        error: error.message
      });

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          errors: ['The requested user could not be found']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        errors: [error.message]
      });
    }
  };

  // Update current user profile
  updateProfile = async (req, res) => {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      const updatedProfile = await profileService.updateProfile(
        userId, 
        updateData, 
        userId
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      this.logger.error('Error updating profile', {
        userId: req.user?.id,
        error: error.message,
        updateData: Object.keys(req.body)
      });

      if (error.message.includes('Validation') || error.message.includes('must be')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          errors: ['User not found']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        errors: [error.message]
      });
    }
  };

  // Upload profile picture
  uploadProfilePicture = async (req, res) => {
    try {
      const userId = req.user.id;
      const imageFile = req.file;

      if (!imageFile) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided',
          errors: ['Profile picture file is required']
        });
      }

      const result = await profileService.uploadProfilePicture(
        userId, 
        imageFile, 
        userId
      );

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error uploading profile picture', {
        userId: req.user?.id,
        error: error.message,
        fileSize: req.file?.size
      });

      if (error.message.includes('Image processing') || error.message.includes('upload')) {
        return res.status(400).json({
          success: false,
          message: 'Image processing failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to upload profile picture',
        errors: [error.message]
      });
    }
  };

  // Delete profile picture
  deleteProfilePicture = async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await profileService.deleteProfilePicture(userId, userId);

      res.json({
        success: true,
        message: 'Profile picture deleted successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error deleting profile picture', {
        userId: req.user?.id,
        error: error.message
      });

      if (error.message === 'No profile picture to delete') {
        return res.status(400).json({
          success: false,
          message: 'No profile picture to delete',
          errors: ['User does not have a profile picture']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete profile picture',
        errors: [error.message]
      });
    }
  };

  // Search users
  searchUsers = async (req, res) => {
    try {
      const query = req.query.q;
      const filters = {
        userType: req.query.userType,
        verificationLevel: req.query.verificationLevel,
        minRating: req.query.minRating ? parseFloat(req.query.minRating) : null,
        location: req.query.lat && req.query.lng ? {
          lat: parseFloat(req.query.lat),
          lng: parseFloat(req.query.lng)
        } : null,
        radiusKm: req.query.radius ? parseFloat(req.query.radius) : null
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await profileService.searchUsers(query, filters, pagination);

      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      this.logger.error('Error searching users', {
        query: req.query.q,
        filters: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to search users',
        errors: [error.message]
      });
    }
  };

  // Get user statistics
  getUserStatistics = async (req, res) => {
    try {
      const { userId } = req.params;
      const period = req.query.period || 'all';

      // Check if user can access these statistics
      if (userId !== req.user.id && !req.user.isAdmin) {
        // Only allow access to basic statistics for other users
        // TODO: Implement privacy checks
      }

      const statistics = await profileService.getUserStatistics(userId, period);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      this.logger.error('Error getting user statistics', {
        userId: req.params.userId,
        period: req.query.period,
        requesterId: req.user?.id,
        error: error.message
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'Statistics not found',
          errors: ['User statistics not found']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics',
        errors: [error.message]
      });
    }
  };

  // Get user activity
  getUserActivity = async (req, res) => {
    try {
      const userId = req.user.id;
      const options = {
        type: req.query.type,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      // TODO: Implement activity service
      // const activities = await activityService.getUserActivity(userId, options);

      // For now, return placeholder
      const activities = {
        activities: [],
        pagination: {
          page: options.page,
          limit: options.limit,
          total: 0,
          totalPages: 0
        }
      };

      res.json({
        success: true,
        data: activities.activities,
        pagination: activities.pagination
      });
    } catch (error) {
      this.logger.error('Error getting user activity', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity',
        errors: [error.message]
      });
    }
  };

  // Delete user account
  deleteAccount = async (req, res) => {
    try {
      const userId = req.user.id;
      const { password, reason, feedback } = req.body;

      // TODO: Implement account deletion service
      // This should:
      // 1. Verify password
      // 2. Cancel active deliveries
      // 3. Process refunds
      // 4. Anonymize data
      // 5. Send confirmation email
      
      this.logger.info('Account deletion requested', {
        userId,
        reason,
        hasFeedback: !!feedback
      });

      // For now, just return success
      res.json({
        success: true,
        message: 'Account deletion initiated',
        data: {
          message: 'Your account deletion request has been received and will be processed within 24 hours.'
        }
      });
    } catch (error) {
      this.logger.error('Error deleting account', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to delete account',
        errors: [error.message]
      });
    }
  };
}

module.exports = new ProfileController();