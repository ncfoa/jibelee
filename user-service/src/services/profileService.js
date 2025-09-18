const { User, UserPreferences, UserStatistics, UserAddress } = require('../models');
const { cacheService } = require('../config/redis');
const { logger } = require('../config/logger');
const { fileUploadService } = require('../config/storage');
const imageProcessingService = require('./imageProcessingService');

class ProfileService {
  constructor() {
    this.cacheService = cacheService;
    this.logger = logger;
  }

  // Get user profile with privacy filters
  async getUserProfile(userId, requesterId = null, includePrivateData = false) {
    try {
      // Check cache first
      const cacheKey = `user:profile:${userId}:${requesterId || 'public'}`;
      const cachedProfile = await this.cacheService.get(cacheKey);
      
      if (cachedProfile) {
        this.logger.debug('Profile retrieved from cache', { userId, requesterId });
        return cachedProfile;
      }

      // Fetch from database
      const user = await User.findByPk(userId, {
        include: [
          {
            model: UserPreferences,
            as: 'Preferences'
          },
          {
            model: UserStatistics,
            as: 'Statistics'
          },
          {
            model: UserAddress,
            as: 'Addresses',
            where: { isDefault: true },
            required: false
          }
        ]
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Apply privacy filters
      const profile = this.applyPrivacyFilters(user, requesterId, includePrivateData);
      
      // Cache the result
      await this.cacheService.set(cacheKey, profile, 300); // 5 minutes

      this.logger.info('Profile retrieved successfully', { userId, requesterId });
      return profile;
    } catch (error) {
      this.logger.error('Error retrieving user profile', {
        userId,
        requesterId,
        error: error.message
      });
      throw error;
    }
  }

  // Update user profile
  async updateProfile(userId, updateData, requesterId = null) {
    try {
      // Validate update data
      const validatedData = this.validateProfileUpdate(updateData);
      
      // Get current user
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to update this profile');
      }

      // Update user
      await user.update(validatedData);
      
      // Update search index if applicable
      await this.updateSearchIndex(user);
      
      // Invalidate cache
      await this.invalidateUserCache(userId);
      
      // Get updated profile
      const updatedProfile = await this.getUserProfile(userId, requesterId, true);

      this.logger.info('Profile updated successfully', { 
        userId, 
        updatedFields: Object.keys(validatedData) 
      });

      return updatedProfile;
    } catch (error) {
      this.logger.error('Error updating profile', {
        userId,
        error: error.message,
        updateData: Object.keys(updateData)
      });
      throw error;
    }
  }

  // Upload and update profile picture
  async uploadProfilePicture(userId, imageFile, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to update this profile picture');
      }

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Process image
      const processedImage = await imageProcessingService.processProfileImage(imageFile.buffer);
      
      // Upload to storage
      const uploadResult = await fileUploadService.uploadImage(
        processedImage, 
        'profile-pictures',
        imageFile.originalname
      );
      
      // Delete old profile picture if exists
      if (user.profilePictureUrl) {
        const oldKey = this.extractKeyFromUrl(user.profilePictureUrl);
        if (oldKey) {
          await fileUploadService.deleteFile(oldKey);
        }
      }
      
      // Update user record
      await user.update({ profilePictureUrl: uploadResult.url });
      
      // Invalidate cache
      await this.invalidateUserCache(userId);

      this.logger.info('Profile picture uploaded successfully', { 
        userId, 
        url: uploadResult.url,
        size: uploadResult.size
      });

      return {
        profilePictureUrl: uploadResult.url,
        size: uploadResult.size
      };
    } catch (error) {
      this.logger.error('Error uploading profile picture', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Delete profile picture
  async deleteProfilePicture(userId, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to delete this profile picture');
      }

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.profilePictureUrl) {
        throw new Error('No profile picture to delete');
      }

      // Delete from storage
      const key = this.extractKeyFromUrl(user.profilePictureUrl);
      if (key) {
        await fileUploadService.deleteFile(key);
      }

      // Update user record
      await user.update({ profilePictureUrl: null });
      
      // Invalidate cache
      await this.invalidateUserCache(userId);

      this.logger.info('Profile picture deleted successfully', { userId });

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting profile picture', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Search users
  async searchUsers(query, filters = {}, pagination = {}) {
    try {
      const { 
        userType = null,
        verificationLevel = null,
        minRating = null,
        location = null,
        radiusKm = null
      } = filters;
      
      const { page = 1, limit = 20 } = pagination;
      const offset = (page - 1) * limit;

      // Build where clause
      const where = {};
      
      if (query) {
        where[User.sequelize.Sequelize.Op.or] = [
          { firstName: { [User.sequelize.Sequelize.Op.iLike]: `%${query}%` } },
          { lastName: { [User.sequelize.Sequelize.Op.iLike]: `%${query}%` } },
          { email: { [User.sequelize.Sequelize.Op.iLike]: `%${query}%` } }
        ];
      }

      if (userType) {
        where.userType = userType;
      }

      if (verificationLevel) {
        where.verificationLevel = verificationLevel;
      }

      where.status = 'active';

      // Build includes
      const include = [
        {
          model: UserStatistics,
          as: 'Statistics',
          where: minRating ? { averageRating: { [User.sequelize.Sequelize.Op.gte]: minRating } } : undefined
        }
      ];

      // Add location filtering if provided
      if (location && radiusKm) {
        include.push({
          model: UserAddress,
          as: 'Addresses',
          where: User.sequelize.where(
            User.sequelize.fn(
              'ST_DWithin',
              User.sequelize.col('Addresses.coordinates'),
              User.sequelize.fn('ST_GeogFromText', `POINT(${location.lng} ${location.lat})`),
              radiusKm * 1000
            ),
            true
          ),
          required: true
        });
      }

      // Execute search
      const { count, rows } = await User.findAndCountAll({
        where,
        include,
        limit,
        offset,
        order: [['firstName', 'ASC'], ['lastName', 'ASC']],
        distinct: true
      });

      // Format results
      const users = rows.map(user => this.formatSearchResult(user));

      const result = {
        users,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

      this.logger.info('User search completed', { 
        query, 
        filters, 
        resultCount: users.length 
      });

      return result;
    } catch (error) {
      this.logger.error('Error searching users', {
        query,
        filters,
        error: error.message
      });
      throw error;
    }
  }

  // Get user statistics
  async getUserStatistics(userId, period = 'all') {
    try {
      const user = await User.findByPk(userId, {
        include: [{
          model: UserStatistics,
          as: 'Statistics'
        }]
      });

      if (!user || !user.Statistics) {
        throw new Error('User statistics not found');
      }

      const stats = user.Statistics;
      
      // Get period-specific data
      let periodData = {};
      if (period !== 'all') {
        periodData = this.getPeriodStatistics(stats, period);
      }

      const result = {
        period,
        totalDeliveries: stats.totalDeliveries,
        successfulDeliveries: stats.successfulDeliveries,
        cancelledDeliveries: stats.cancelledDeliveries,
        totalEarnings: parseFloat(stats.totalEarnings),
        totalSpent: parseFloat(stats.totalSpent),
        averageRating: parseFloat(stats.averageRating),
        totalRatings: stats.totalRatings,
        completionRate: parseFloat(stats.completionRate),
        responseTimeMinutes: stats.responseTimeMinutes,
        distanceTraveled: parseFloat(stats.distanceTraveled),
        itemsDelivered: stats.itemsDelivered,
        performanceScore: stats.getPerformanceScore(),
        ...periodData
      };

      return result;
    } catch (error) {
      this.logger.error('Error retrieving user statistics', {
        userId,
        period,
        error: error.message
      });
      throw error;
    }
  }

  // Apply privacy filters to user data
  applyPrivacyFilters(user, requesterId, includePrivateData = false) {
    const relationship = this.getUserRelationship(user.id, requesterId);
    const preferences = user.Preferences;
    
    // Base profile data
    const profile = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      userType: user.userType,
      status: user.status,
      verificationLevel: user.verificationLevel,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt
    };

    // Add preferences if available
    if (preferences) {
      const privacySettings = preferences.privacySettings || {};
      
      // Apply privacy rules
      if (!this.shouldShowField(privacySettings, 'showRealName', relationship)) {
        profile.firstName = 'User';
        profile.lastName = user.id.substring(0, 8);
      }
      
      if (this.shouldShowField(privacySettings, 'showPhoneNumber', relationship)) {
        profile.phoneNumber = user.phoneNumber;
      }
      
      if (this.shouldShowField(privacySettings, 'showRating', relationship) && user.Statistics) {
        profile.rating = {
          average: parseFloat(user.Statistics.averageRating),
          count: user.Statistics.totalRatings,
          breakdown: user.Statistics.ratingBreakdown
        };
      }
      
      if (this.shouldShowField(privacySettings, 'showStatistics', relationship) && user.Statistics) {
        profile.statistics = {
          totalDeliveries: user.Statistics.totalDeliveries,
          successfulDeliveries: user.Statistics.successfulDeliveries,
          totalEarnings: relationship === 'self' ? parseFloat(user.Statistics.totalEarnings) : null,
          joinedDate: user.createdAt
        };
      }
    }

    // Include private data for self or authorized requests
    if (includePrivateData && (relationship === 'self' || requesterId === user.id)) {
      profile.email = user.email;
      profile.phoneNumber = user.phoneNumber;
      profile.dateOfBirth = user.dateOfBirth;
      profile.bio = user.bio;
      profile.preferredLanguage = user.preferredLanguage;
      profile.timezone = user.timezone;
      profile.preferredCurrency = user.preferredCurrency;
      
      if (preferences) {
        profile.preferences = preferences.toJSON();
      }
      
      if (user.Addresses) {
        profile.addresses = user.Addresses.map(addr => addr.toJSON());
      }
    }

    return profile;
  }

  // Validate profile update data
  validateProfileUpdate(updateData) {
    const allowedFields = [
      'firstName', 'lastName', 'phoneNumber', 'dateOfBirth', 'bio',
      'preferredLanguage', 'timezone', 'preferredCurrency'
    ];

    const validatedData = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        validatedData[field] = updateData[field];
      }
    }

    // Additional validation
    if (validatedData.firstName && validatedData.firstName.length < 2) {
      throw new Error('First name must be at least 2 characters long');
    }
    
    if (validatedData.lastName && validatedData.lastName.length < 2) {
      throw new Error('Last name must be at least 2 characters long');
    }
    
    if (validatedData.bio && validatedData.bio.length > 1000) {
      throw new Error('Bio must be less than 1000 characters');
    }

    return validatedData;
  }

  // Helper methods
  getUserRelationship(userId, requesterId) {
    if (!requesterId) return 'public';
    if (userId === requesterId) return 'self';
    // TODO: Implement friend/trusted relationship logic
    return 'public';
  }

  shouldShowField(privacySettings, field, relationship) {
    if (relationship === 'self') return true;
    
    const setting = privacySettings[field];
    if (setting === undefined) return true;
    
    return setting;
  }

  formatSearchResult(user) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      userType: user.userType,
      verificationLevel: user.verificationLevel,
      rating: user.Statistics ? {
        average: parseFloat(user.Statistics.averageRating),
        count: user.Statistics.totalRatings
      } : null,
      statistics: user.Statistics ? {
        totalDeliveries: user.Statistics.totalDeliveries,
        successfulDeliveries: user.Statistics.successfulDeliveries,
        joinedDate: user.createdAt
      } : null
    };
  }

  getPeriodStatistics(stats, period) {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarter':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        return {};
    }

    // This would typically involve more complex date-based queries
    // For now, return monthly stats if available
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return stats.monthlyStats[yearMonth] || {};
  }

  extractKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return null;
    }
  }

  async updateSearchIndex(user) {
    // TODO: Implement search index update (Elasticsearch, etc.)
    this.logger.debug('Search index update triggered', { userId: user.id });
  }

  async invalidateUserCache(userId) {
    await this.cacheService.invalidatePattern(`user:*:${userId}*`);
    this.logger.debug('User cache invalidated', { userId });
  }
}

module.exports = new ProfileService();