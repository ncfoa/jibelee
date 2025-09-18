const { UserPreferences } = require('../models');
const { logger } = require('../config/logger');
const { cacheService } = require('../config/redis');

class PreferencesController {
  constructor() {
    this.logger = logger;
  }

  // Get user preferences
  getUserPreferences = async (req, res) => {
    try {
      const userId = req.user.id;

      // Check cache first
      const cacheKey = `user:preferences:${userId}`;
      let preferences = await cacheService.get(cacheKey);

      if (!preferences) {
        // Get from database
        preferences = await UserPreferences.findByUserId(userId);
        
        if (!preferences) {
          // Create default preferences if they don't exist
          preferences = await UserPreferences.createDefault(userId);
        }

        // Cache the result
        await cacheService.set(cacheKey, preferences, 600); // 10 minutes
      }

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      this.logger.error('Error getting user preferences', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve preferences',
        errors: [error.message]
      });
    }
  };

  // Update user preferences
  updatePreferences = async (req, res) => {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      // Get existing preferences
      let preferences = await UserPreferences.findByUserId(userId);
      
      if (!preferences) {
        // Create default preferences if they don't exist
        preferences = await UserPreferences.createDefault(userId);
      }

      // Update preferences
      const updatedData = {};
      
      if (updateData.notificationSettings) {
        updatedData.notificationSettings = {
          ...preferences.notificationSettings,
          ...updateData.notificationSettings
        };
      }

      if (updateData.privacySettings) {
        updatedData.privacySettings = {
          ...preferences.privacySettings,
          ...updateData.privacySettings
        };
      }

      if (updateData.deliverySettings) {
        updatedData.deliverySettings = {
          ...preferences.deliverySettings,
          ...updateData.deliverySettings
        };
      }

      if (updateData.paymentSettings) {
        updatedData.paymentSettings = {
          ...preferences.paymentSettings,
          ...updateData.paymentSettings
        };
      }

      if (updateData.securitySettings) {
        updatedData.securitySettings = {
          ...preferences.securitySettings,
          ...updateData.securitySettings
        };
      }

      if (updateData.accessibilitySettings) {
        updatedData.accessibilitySettings = {
          ...preferences.accessibilitySettings,
          ...updateData.accessibilitySettings
        };
      }

      await preferences.update(updatedData);

      // Invalidate cache
      const cacheKey = `user:preferences:${userId}`;
      await cacheService.del(cacheKey);

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences
      });
    } catch (error) {
      this.logger.error('Error updating preferences', {
        userId: req.user?.id,
        error: error.message,
        updateData: Object.keys(req.body)
      });

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors?.map(e => e.message) || [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update preferences',
        errors: [error.message]
      });
    }
  };

  // Update notification preferences specifically
  updateNotificationPreferences = async (req, res) => {
    try {
      const userId = req.user.id;
      const notificationSettings = req.body;

      // Get existing preferences
      let preferences = await UserPreferences.findByUserId(userId);
      
      if (!preferences) {
        preferences = await UserPreferences.createDefault(userId);
      }

      // Update notification settings
      const updatedNotificationSettings = {
        ...preferences.notificationSettings,
        ...notificationSettings
      };

      await preferences.update({
        notificationSettings: updatedNotificationSettings
      });

      // Invalidate cache
      const cacheKey = `user:preferences:${userId}`;
      await cacheService.del(cacheKey);

      res.json({
        success: true,
        message: 'Notification preferences updated successfully',
        data: {
          notificationSettings: preferences.notificationSettings
        }
      });
    } catch (error) {
      this.logger.error('Error updating notification preferences', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
        errors: [error.message]
      });
    }
  };

  // Get specific preference setting
  getPreferenceSetting = async (req, res) => {
    try {
      const userId = req.user.id;
      const { category, setting } = req.params;

      const preferences = await UserPreferences.findByUserId(userId);
      
      if (!preferences) {
        return res.status(404).json({
          success: false,
          message: 'Preferences not found',
          errors: ['User preferences not found']
        });
      }

      let value;
      switch (category) {
        case 'notification':
          value = preferences.getNotificationPreference(setting, 'email'); // Default to email
          break;
        case 'privacy':
          value = preferences.getPrivacySetting(setting);
          break;
        case 'delivery':
          value = preferences.getDeliveryPreference(setting);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid category',
            errors: ['Category must be one of: notification, privacy, delivery']
          });
      }

      res.json({
        success: true,
        data: {
          category,
          setting,
          value
        }
      });
    } catch (error) {
      this.logger.error('Error getting preference setting', {
        userId: req.user?.id,
        category: req.params.category,
        setting: req.params.setting,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve preference setting',
        errors: [error.message]
      });
    }
  };

  // Update specific preference setting
  updatePreferenceSetting = async (req, res) => {
    try {
      const userId = req.user.id;
      const { category, setting } = req.params;
      const { value } = req.body;

      if (value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Value is required',
          errors: ['Value field is required']
        });
      }

      let preferences = await UserPreferences.findByUserId(userId);
      
      if (!preferences) {
        preferences = await UserPreferences.createDefault(userId);
      }

      // Update the specific setting
      switch (category) {
        case 'notification':
          // For notification preferences, we need channel info
          const channel = req.body.channel || 'email';
          preferences.setNotificationPreference(setting, channel, value);
          break;
        case 'privacy':
          preferences.setPrivacySetting(setting, value);
          break;
        case 'delivery':
          preferences.setDeliveryPreference(setting, value);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid category',
            errors: ['Category must be one of: notification, privacy, delivery']
          });
      }

      await preferences.save();

      // Invalidate cache
      const cacheKey = `user:preferences:${userId}`;
      await cacheService.del(cacheKey);

      res.json({
        success: true,
        message: 'Preference setting updated successfully',
        data: {
          category,
          setting,
          value
        }
      });
    } catch (error) {
      this.logger.error('Error updating preference setting', {
        userId: req.user?.id,
        category: req.params.category,
        setting: req.params.setting,
        value: req.body?.value,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update preference setting',
        errors: [error.message]
      });
    }
  };

  // Reset preferences to default
  resetPreferences = async (req, res) => {
    try {
      const userId = req.user.id;
      const { category } = req.body; // Optional: reset specific category

      let preferences = await UserPreferences.findByUserId(userId);
      
      if (!preferences) {
        preferences = await UserPreferences.createDefault(userId);
        
        res.json({
          success: true,
          message: 'Preferences reset to default',
          data: preferences
        });
        return;
      }

      // Reset specific category or all preferences
      if (category) {
        const defaultPrefs = await UserPreferences.createDefault(userId);
        
        switch (category) {
          case 'notification':
            preferences.notificationSettings = defaultPrefs.notificationSettings;
            break;
          case 'privacy':
            preferences.privacySettings = defaultPrefs.privacySettings;
            break;
          case 'delivery':
            preferences.deliverySettings = defaultPrefs.deliverySettings;
            break;
          case 'payment':
            preferences.paymentSettings = defaultPrefs.paymentSettings;
            break;
          case 'security':
            preferences.securitySettings = defaultPrefs.securitySettings;
            break;
          case 'accessibility':
            preferences.accessibilitySettings = defaultPrefs.accessibilitySettings;
            break;
          default:
            return res.status(400).json({
              success: false,
              message: 'Invalid category',
              errors: ['Invalid preference category']
            });
        }
        
        await defaultPrefs.destroy(); // Clean up temporary default
      } else {
        // Reset all preferences
        const defaultPrefs = await UserPreferences.createDefault(userId);
        
        preferences.notificationSettings = defaultPrefs.notificationSettings;
        preferences.privacySettings = defaultPrefs.privacySettings;
        preferences.deliverySettings = defaultPrefs.deliverySettings;
        preferences.paymentSettings = defaultPrefs.paymentSettings;
        preferences.securitySettings = defaultPrefs.securitySettings;
        preferences.accessibilitySettings = defaultPrefs.accessibilitySettings;
        
        await defaultPrefs.destroy(); // Clean up temporary default
      }

      await preferences.save();

      // Invalidate cache
      const cacheKey = `user:preferences:${userId}`;
      await cacheService.del(cacheKey);

      res.json({
        success: true,
        message: `Preferences ${category ? `(${category})` : ''} reset to default`,
        data: preferences
      });
    } catch (error) {
      this.logger.error('Error resetting preferences', {
        userId: req.user?.id,
        category: req.body?.category,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to reset preferences',
        errors: [error.message]
      });
    }
  };
}

module.exports = new PreferencesController();