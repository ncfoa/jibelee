const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserPreferences = sequelize.define('UserPreferences', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    notificationSettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'notification_settings',
      defaultValue: {
        email: {
          newDeliveryRequest: true,
          deliveryUpdates: true,
          paymentNotifications: true,
          reviewNotifications: true,
          promotions: false,
          newsletter: false,
          securityAlerts: true
        },
        push: {
          newDeliveryRequest: true,
          deliveryUpdates: true,
          paymentNotifications: true,
          reviewNotifications: true,
          locationUpdates: true,
          chatMessages: true,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          }
        },
        sms: {
          deliveryUpdates: false,
          paymentNotifications: true,
          securityAlerts: true,
          emergencyOnly: true
        }
      }
    },
    privacySettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'privacy_settings',
      defaultValue: {
        showRealName: true,
        showPhoneNumber: false,
        showRating: true,
        showStatistics: true,
        showLastActive: true,
        profileVisibility: 'public', // public, friends, private
        locationSharing: {
          duringDelivery: true,
          afterDelivery: false,
          precision: 'approximate' // exact, approximate, city
        },
        dataRetention: {
          deleteInactiveAccount: false,
          monthsInactive: 24,
          deleteDeliveryHistory: false,
          monthsAfterDelivery: 12
        }
      }
    },
    deliverySettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'delivery_settings',
      defaultValue: {
        autoAccept: {
          enabled: false,
          maxPrice: null,
          trustedUsersOnly: false,
          conditions: []
        },
        preferences: {
          maxWeight: 10, // kg
          maxDistance: 50, // km
          preferredCategories: [],
          excludedCategories: [],
          acceptFragile: true,
          acceptPerishable: false,
          acceptHazardous: false
        },
        availability: {
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          timeSlots: {
            morning: { start: '08:00', end: '12:00', available: true },
            afternoon: { start: '12:00', end: '17:00', available: true },
            evening: { start: '17:00', end: '22:00', available: true }
          },
          timezone: 'UTC'
        }
      }
    },
    paymentSettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'payment_settings',
      defaultValue: {
        defaultPaymentMethod: null,
        autoPayment: false,
        paymentReminders: true,
        currency: 'USD',
        taxSettings: {
          country: 'US',
          taxId: null,
          businessAccount: false
        },
        payoutSettings: {
          method: 'bank_transfer', // bank_transfer, paypal, stripe
          frequency: 'weekly', // daily, weekly, monthly
          minimumAmount: 10,
          autoWithdraw: false
        }
      }
    },
    securitySettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'security_settings',
      defaultValue: {
        twoFactorAuth: {
          enabled: false,
          method: 'app', // app, sms, email
          backupCodes: []
        },
        loginAlerts: true,
        deviceManagement: {
          requireApproval: false,
          maxDevices: 5,
          sessionTimeout: 30 // days
        },
        passwordPolicy: {
          requireStrongPassword: true,
          passwordExpiry: 0, // days, 0 = never
          preventReuse: 5
        }
      }
    },
    accessibilitySettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'accessibility_settings',
      defaultValue: {
        visualAids: {
          highContrast: false,
          largeText: false,
          screenReader: false
        },
        motorAids: {
          voiceControl: false,
          gestureNavigation: false,
          reducedMotion: false
        },
        cognitiveAids: {
          simplifiedInterface: false,
          extraConfirmations: false,
          readingAssistance: false
        }
      }
    }
  }, {
    tableName: 'user_preferences',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      }
    ]
  });

  // Instance methods
  UserPreferences.prototype.getNotificationPreference = function(type, channel) {
    const settings = this.notificationSettings || {};
    const channelSettings = settings[channel] || {};
    return channelSettings[type] !== undefined ? channelSettings[type] : false;
  };

  UserPreferences.prototype.setNotificationPreference = function(type, channel, value) {
    const settings = { ...this.notificationSettings };
    if (!settings[channel]) settings[channel] = {};
    settings[channel][type] = value;
    this.notificationSettings = settings;
  };

  UserPreferences.prototype.getPrivacySetting = function(setting) {
    const settings = this.privacySettings || {};
    return settings[setting];
  };

  UserPreferences.prototype.setPrivacySetting = function(setting, value) {
    const settings = { ...this.privacySettings };
    settings[setting] = value;
    this.privacySettings = settings;
  };

  UserPreferences.prototype.canReceiveNotification = function(type, channel = 'email') {
    // Check if user wants this type of notification via this channel
    const wantsNotification = this.getNotificationPreference(type, channel);
    if (!wantsNotification) return false;

    // Check quiet hours for push notifications
    if (channel === 'push') {
      const pushSettings = this.notificationSettings.push || {};
      const quietHours = pushSettings.quietHours;
      
      if (quietHours && quietHours.enabled) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const startTime = parseTime(quietHours.start);
        const endTime = parseTime(quietHours.end);
        
        // Handle quiet hours that span midnight
        if (startTime > endTime) {
          if (currentTime >= startTime || currentTime <= endTime) {
            return false;
          }
        } else {
          if (currentTime >= startTime && currentTime <= endTime) {
            return false;
          }
        }
      }
    }

    return true;
  };

  UserPreferences.prototype.isProfileVisible = function(viewerRelation = 'public') {
    const visibility = this.getPrivacySetting('profileVisibility') || 'public';
    
    switch (visibility) {
      case 'private':
        return viewerRelation === 'self';
      case 'friends':
        return ['self', 'friend', 'trusted'].includes(viewerRelation);
      case 'public':
      default:
        return true;
    }
  };

  UserPreferences.prototype.shouldShowField = function(field, viewerRelation = 'public') {
    const setting = this.getPrivacySetting(field);
    
    if (setting === undefined) return true;
    if (viewerRelation === 'self') return true;
    
    return setting;
  };

  UserPreferences.prototype.getDeliveryPreference = function(setting) {
    const settings = this.deliverySettings || {};
    return settings[setting];
  };

  UserPreferences.prototype.setDeliveryPreference = function(setting, value) {
    const settings = { ...this.deliverySettings };
    settings[setting] = value;
    this.deliverySettings = settings;
  };

  UserPreferences.prototype.canAutoAcceptDelivery = function(deliveryData) {
    const autoAccept = this.getDeliveryPreference('autoAccept') || {};
    
    if (!autoAccept.enabled) return false;
    
    // Check price limit
    if (autoAccept.maxPrice && deliveryData.price > autoAccept.maxPrice) {
      return false;
    }
    
    // Check if from trusted user only
    if (autoAccept.trustedUsersOnly && !deliveryData.isTrustedUser) {
      return false;
    }
    
    // Check other conditions
    const conditions = autoAccept.conditions || [];
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, deliveryData)) {
        return false;
      }
    }
    
    return true;
  };

  UserPreferences.prototype.evaluateCondition = function(condition, data) {
    // Simple condition evaluation - can be extended
    switch (condition.type) {
      case 'weight':
        return data.weight <= condition.value;
      case 'distance':
        return data.distance <= condition.value;
      case 'category':
        return condition.values.includes(data.category);
      default:
        return true;
    }
  };

  // Class methods
  UserPreferences.createDefault = function(userId) {
    return this.create({ userId });
  };

  UserPreferences.findByUserId = function(userId) {
    return this.findOne({ where: { userId } });
  };

  // Associations
  UserPreferences.associate = function(models) {
    UserPreferences.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
  };

  return UserPreferences;
};

// Helper function to parse time string (HH:MM) to minutes
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}