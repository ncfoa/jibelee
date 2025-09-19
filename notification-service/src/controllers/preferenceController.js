const { logger } = require('../config/logger');
const { NotificationPreference, UserNotificationSetting } = require('../models');
const { NotificationCache } = require('../config/redis');
const { validationResult } = require('express-validator');

class PreferenceController {
  // Get user notification preferences
  async getUserPreferences(req, res) {
    try {
      const { userId } = req.params;

      const preferences = await NotificationPreference.findByUserId(userId);
      
      if (!preferences) {
        // Create default preferences if none exist
        const [newPreferences] = await NotificationPreference.findOrCreateDefault(userId);
        
        return res.status(200).json({
          success: true,
          data: {
            userId,
            preferences: newPreferences.toJSON(),
            isDefault: true,
            lastUpdated: newPreferences.updatedAt
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          userId,
          preferences: preferences.toJSON(),
          isDefault: false,
          lastUpdated: preferences.updatedAt
        }
      });

    } catch (error) {
      logger.error('Get user preferences failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update user notification preferences
  async updateUserPreferences(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const updateData = req.body;

      // Find or create preferences
      let [preferences] = await NotificationPreference.findOrCreateDefault(userId);

      // Update preferences
      await preferences.update(updateData);

      // Clear cache
      await NotificationCache.del(`prefs:${userId}`);

      logger.info('User preferences updated', {
        userId,
        updatedFields: Object.keys(updateData)
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          preferences: preferences.toJSON(),
          updatedAt: preferences.updatedAt
        }
      });

    } catch (error) {
      logger.error('Update user preferences failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update specific channel preferences
  async updateChannelPreferences(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId, channel } = req.params;
      const { enabled, categories } = req.body;

      const validChannels = ['push', 'email', 'sms', 'in_app'];
      if (!validChannels.includes(channel)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid channel'
        });
      }

      let [preferences] = await NotificationPreference.findOrCreateDefault(userId);
      
      await preferences.updateChannelPreference(channel, enabled, categories);

      // Clear cache
      await NotificationCache.del(`prefs:${userId}`);

      logger.info('Channel preferences updated', {
        userId,
        channel,
        enabled,
        categories: categories ? Object.keys(categories) : null
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          channel,
          preferences: preferences.toJSON(),
          updatedAt: preferences.updatedAt
        }
      });

    } catch (error) {
      logger.error('Update channel preferences failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update quiet hours
  async updateQuietHours(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const quietHours = req.body;

      let [preferences] = await NotificationPreference.findOrCreateDefault(userId);
      
      await preferences.updateQuietHours(quietHours);

      // Clear cache
      await NotificationCache.del(`prefs:${userId}`);

      logger.info('Quiet hours updated', {
        userId,
        quietHours
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          quietHours: preferences.pushQuietHours,
          updatedAt: preferences.updatedAt
        }
      });

    } catch (error) {
      logger.error('Update quiet hours failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get user notification settings
  async getUserSettings(req, res) {
    try {
      const { userId } = req.params;
      const { keys } = req.query;

      const settingKeys = keys ? keys.split(',') : null;
      const settings = await UserNotificationSetting.getUserSettings(userId, settingKeys);

      res.status(200).json({
        success: true,
        data: {
          userId,
          settings
        }
      });

    } catch (error) {
      logger.error('Get user settings failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update user notification setting
  async updateUserSetting(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId, settingKey } = req.params;
      const { value } = req.body;

      // Validate setting key
      if (!UserNotificationSetting.validateSettingKey(settingKey)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid setting key'
        });
      }

      await UserNotificationSetting.setUserSetting(userId, settingKey, value);

      logger.info('User setting updated', {
        userId,
        settingKey,
        value
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          settingKey,
          value,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Update user setting failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Bulk update user settings
  async bulkUpdateUserSettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { settings } = req.body;

      // Validate all setting keys
      const invalidKeys = Object.keys(settings).filter(key => 
        !UserNotificationSetting.validateSettingKey(key)
      );

      if (invalidKeys.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid setting keys',
          invalidKeys
        });
      }

      await UserNotificationSetting.bulkSetUserSettings(userId, settings);

      logger.info('User settings bulk updated', {
        userId,
        settingKeys: Object.keys(settings)
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          updatedSettings: Object.keys(settings),
          updatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Bulk update user settings failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Reset user preferences to default
  async resetPreferences(req, res) {
    try {
      const { userId } = req.params;

      // Delete existing preferences
      await NotificationPreference.destroy({
        where: { userId }
      });

      // Create new default preferences
      const [preferences] = await NotificationPreference.findOrCreateDefault(userId);

      // Clear cache
      await NotificationCache.del(`prefs:${userId}`);

      logger.info('User preferences reset to default', { userId });

      res.status(200).json({
        success: true,
        data: {
          userId,
          preferences: preferences.toJSON(),
          resetAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Reset preferences failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Export user preferences
  async exportPreferences(req, res) {
    try {
      const { userId } = req.params;

      const preferences = await NotificationPreference.findByUserId(userId);
      const settings = await UserNotificationSetting.exportUserSettings(userId);

      const exportData = {
        userId,
        exportedAt: new Date(),
        preferences: preferences ? preferences.toJSON() : null,
        settings
      };

      res.status(200).json({
        success: true,
        data: exportData
      });

    } catch (error) {
      logger.error('Export preferences failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Import user preferences
  async importPreferences(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { preferences, settings } = req.body;

      let updatedPreferences = null;
      let importedSettings = {};

      // Import preferences if provided
      if (preferences) {
        const [prefs] = await NotificationPreference.findOrCreateDefault(userId);
        await prefs.update(preferences);
        updatedPreferences = prefs.toJSON();
      }

      // Import settings if provided
      if (settings) {
        await UserNotificationSetting.importUserSettings(userId, settings);
        importedSettings = await UserNotificationSetting.getUserSettings(userId);
      }

      // Clear cache
      await NotificationCache.del(`prefs:${userId}`);

      logger.info('User preferences imported', {
        userId,
        hasPreferences: !!preferences,
        settingsCount: settings ? Object.keys(settings).length : 0
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          preferences: updatedPreferences,
          settings: importedSettings,
          importedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Import preferences failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get preference statistics
  async getPreferenceStats(req, res) {
    try {
      const channelStats = await NotificationPreference.getChannelStats();
      const popularSettings = await UserNotificationSetting.getPopularSettings();

      res.status(200).json({
        success: true,
        data: {
          channelStatistics: channelStats,
          popularSettings,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get preference stats failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = PreferenceController;