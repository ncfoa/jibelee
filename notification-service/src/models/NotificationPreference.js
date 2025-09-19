module.exports = (sequelize, DataTypes) => {
  const NotificationPreference = sequelize.define('NotificationPreference', {
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
      validate: {
        isUUID: 4
      }
    },
    pushEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'push_enabled'
    },
    pushCategories: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'push_categories'
    },
    pushQuietHours: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'push_quiet_hours'
    },
    emailEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'email_enabled'
    },
    emailCategories: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'email_categories'
    },
    emailFrequency: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'immediate',
      field: 'email_frequency',
      validate: {
        isIn: [['immediate', 'daily', 'weekly', 'never']]
      }
    },
    smsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'sms_enabled'
    },
    smsCategories: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'sms_categories'
    },
    inAppEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'in_app_enabled'
    },
    inAppCategories: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'in_app_categories'
    },
    language: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'en',
      validate: {
        len: [2, 10]
      }
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'UTC',
      validate: {
        len: [1, 50]
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'notification_preferences',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
        unique: true
      }
    ],
    hooks: {
      beforeUpdate: (preference) => {
        preference.updatedAt = new Date();
      }
    }
  });

  // Instance methods
  NotificationPreference.prototype.isChannelEnabled = function(channel) {
    switch (channel) {
      case 'push':
        return this.pushEnabled;
      case 'email':
        return this.emailEnabled;
      case 'sms':
        return this.smsEnabled;
      case 'in_app':
        return this.inAppEnabled;
      default:
        return false;
    }
  };

  NotificationPreference.prototype.isCategoryEnabled = function(channel, category) {
    if (!this.isChannelEnabled(channel)) {
      return false;
    }

    let categories;
    switch (channel) {
      case 'push':
        categories = this.pushCategories;
        break;
      case 'email':
        categories = this.emailCategories;
        break;
      case 'sms':
        categories = this.smsCategories;
        break;
      case 'in_app':
        categories = this.inAppCategories;
        break;
      default:
        return false;
    }

    // If no specific category preferences, allow all
    if (!categories || Object.keys(categories).length === 0) {
      return true;
    }

    // Check if category is explicitly enabled
    return categories[category] === true;
  };

  NotificationPreference.prototype.isInQuietHours = function(currentTime = new Date()) {
    if (!this.pushQuietHours || !this.pushQuietHours.enabled) {
      return false;
    }

    const moment = require('moment-timezone');
    const userTime = moment(currentTime).tz(this.timezone);
    const currentHour = userTime.hour();
    const currentMinute = userTime.minute();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const startTime = this.pushQuietHours.start; // Format: "22:00"
    const endTime = this.pushQuietHours.end; // Format: "08:00"

    if (!startTime || !endTime) {
      return false;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes < endMinutes) {
      // Same day quiet hours (e.g., 14:00 to 18:00)
      return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTimeMinutes >= startMinutes || currentTimeMinutes <= endMinutes;
    }
  };

  NotificationPreference.prototype.getNextAllowedTime = function() {
    if (!this.pushQuietHours || !this.pushQuietHours.enabled) {
      return new Date();
    }

    const moment = require('moment-timezone');
    const userTime = moment().tz(this.timezone);
    const endTime = this.pushQuietHours.end;

    if (!endTime) {
      return new Date();
    }

    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Set to end of quiet hours
    const nextAllowed = userTime.clone()
      .hour(endHour)
      .minute(endMinute)
      .second(0)
      .millisecond(0);

    // If the end time is earlier in the day, it means it's the next day
    if (nextAllowed.isBefore(userTime)) {
      nextAllowed.add(1, 'day');
    }

    return nextAllowed.utc().toDate();
  };

  NotificationPreference.prototype.updateChannelPreference = function(channel, enabled, categories = null) {
    switch (channel) {
      case 'push':
        this.pushEnabled = enabled;
        if (categories) this.pushCategories = categories;
        break;
      case 'email':
        this.emailEnabled = enabled;
        if (categories) this.emailCategories = categories;
        break;
      case 'sms':
        this.smsEnabled = enabled;
        if (categories) this.smsCategories = categories;
        break;
      case 'in_app':
        this.inAppEnabled = enabled;
        if (categories) this.inAppCategories = categories;
        break;
    }
    return this.save();
  };

  NotificationPreference.prototype.updateQuietHours = function(quietHours) {
    this.pushQuietHours = quietHours;
    return this.save();
  };

  NotificationPreference.prototype.getEnabledChannels = function() {
    const channels = [];
    if (this.pushEnabled) channels.push('push');
    if (this.emailEnabled) channels.push('email');
    if (this.smsEnabled) channels.push('sms');
    if (this.inAppEnabled) channels.push('in_app');
    return channels;
  };

  NotificationPreference.prototype.getDisabledCategories = function(channel) {
    let categories;
    switch (channel) {
      case 'push':
        categories = this.pushCategories;
        break;
      case 'email':
        categories = this.emailCategories;
        break;
      case 'sms':
        categories = this.smsCategories;
        break;
      case 'in_app':
        categories = this.inAppCategories;
        break;
      default:
        return [];
    }

    if (!categories) return [];

    return Object.keys(categories).filter(cat => categories[cat] === false);
  };

  // Class methods
  NotificationPreference.findByUserId = function(userId) {
    return this.findOne({
      where: { userId }
    });
  };

  NotificationPreference.createDefault = function(userId, options = {}) {
    const defaults = {
      userId,
      pushEnabled: true,
      pushCategories: {
        delivery_update: true,
        new_request: true,
        payment: true,
        system: true,
        promotional: false,
        security: true
      },
      emailEnabled: true,
      emailCategories: {
        delivery_update: true,
        new_request: false,
        payment: true,
        system: true,
        promotional: false,
        security: true
      },
      smsEnabled: false,
      smsCategories: {
        delivery_update: false,
        new_request: false,
        payment: true,
        system: false,
        promotional: false,
        security: true
      },
      inAppEnabled: true,
      inAppCategories: {
        delivery_update: true,
        new_request: true,
        payment: true,
        system: true,
        promotional: true,
        security: true
      },
      language: 'en',
      timezone: 'UTC',
      ...options
    };

    return this.create(defaults);
  };

  NotificationPreference.findOrCreateDefault = function(userId, options = {}) {
    return this.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        pushEnabled: true,
        pushCategories: {
          delivery_update: true,
          new_request: true,
          payment: true,
          system: true,
          promotional: false,
          security: true
        },
        emailEnabled: true,
        emailCategories: {
          delivery_update: true,
          new_request: false,
          payment: true,
          system: true,
          promotional: false,
          security: true
        },
        smsEnabled: false,
        smsCategories: {
          delivery_update: false,
          new_request: false,
          payment: true,
          system: false,
          promotional: false,
          security: true
        },
        inAppEnabled: true,
        inAppCategories: {
          delivery_update: true,
          new_request: true,
          payment: true,
          system: true,
          promotional: true,
          security: true
        },
        language: 'en',
        timezone: 'UTC',
        ...options
      }
    });
  };

  NotificationPreference.getChannelStats = function() {
    return this.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_users'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN push_enabled = true THEN 1 END')), 'push_enabled'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN email_enabled = true THEN 1 END')), 'email_enabled'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN sms_enabled = true THEN 1 END')), 'sms_enabled'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN in_app_enabled = true THEN 1 END')), 'in_app_enabled']
      ],
      raw: true
    });
  };

  // Associations
  NotificationPreference.associate = (models) => {
    NotificationPreference.hasMany(models.UserNotificationSetting, {
      foreignKey: 'userId',
      sourceKey: 'userId',
      as: 'settings'
    });
  };

  return NotificationPreference;
};