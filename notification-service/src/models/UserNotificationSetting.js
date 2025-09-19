module.exports = (sequelize, DataTypes) => {
  const UserNotificationSetting = sequelize.define('UserNotificationSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      validate: {
        isUUID: 4
      }
    },
    settingKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'setting_key',
      validate: {
        len: [1, 100]
      }
    },
    settingValue: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'setting_value'
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
    tableName: 'user_notification_settings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['user_id', 'setting_key'],
        unique: true
      },
      {
        fields: ['setting_key']
      }
    ],
    hooks: {
      beforeUpdate: (setting) => {
        setting.updatedAt = new Date();
      }
    }
  });

  // Instance methods
  UserNotificationSetting.prototype.getValue = function() {
    return this.settingValue;
  };

  UserNotificationSetting.prototype.setValue = function(value) {
    this.settingValue = value;
    return this.save();
  };

  UserNotificationSetting.prototype.updateValue = function(updates) {
    if (typeof this.settingValue === 'object' && this.settingValue !== null) {
      this.settingValue = { ...this.settingValue, ...updates };
    } else {
      this.settingValue = updates;
    }
    return this.save();
  };

  UserNotificationSetting.prototype.isEnabled = function() {
    if (typeof this.settingValue === 'boolean') {
      return this.settingValue;
    }
    if (typeof this.settingValue === 'object' && this.settingValue !== null) {
      return this.settingValue.enabled !== false;
    }
    return true;
  };

  UserNotificationSetting.prototype.getNestedValue = function(path) {
    if (typeof this.settingValue !== 'object' || this.settingValue === null) {
      return null;
    }
    
    const keys = path.split('.');
    let value = this.settingValue;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }
    
    return value;
  };

  UserNotificationSetting.prototype.setNestedValue = function(path, value) {
    if (typeof this.settingValue !== 'object' || this.settingValue === null) {
      this.settingValue = {};
    }
    
    const keys = path.split('.');
    let current = this.settingValue;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return this.save();
  };

  UserNotificationSetting.prototype.deleteNestedValue = function(path) {
    if (typeof this.settingValue !== 'object' || this.settingValue === null) {
      return this.save();
    }
    
    const keys = path.split('.');
    let current = this.settingValue;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        return this.save(); // Path doesn't exist
      }
      current = current[key];
    }
    
    delete current[keys[keys.length - 1]];
    return this.save();
  };

  // Class methods
  UserNotificationSetting.findByUser = function(userId) {
    return this.findAll({
      where: { userId },
      order: [['setting_key', 'ASC']]
    });
  };

  UserNotificationSetting.findByUserAndKey = function(userId, settingKey) {
    return this.findOne({
      where: { userId, settingKey }
    });
  };

  UserNotificationSetting.getUserSetting = function(userId, settingKey, defaultValue = null) {
    return this.findOne({
      where: { userId, settingKey }
    }).then(setting => {
      return setting ? setting.settingValue : defaultValue;
    });
  };

  UserNotificationSetting.setUserSetting = function(userId, settingKey, settingValue) {
    return this.upsert({
      userId,
      settingKey,
      settingValue
    });
  };

  UserNotificationSetting.updateUserSetting = function(userId, settingKey, updates) {
    return this.findOne({
      where: { userId, settingKey }
    }).then(setting => {
      if (setting) {
        return setting.updateValue(updates);
      } else {
        return this.create({
          userId,
          settingKey,
          settingValue: updates
        });
      }
    });
  };

  UserNotificationSetting.deleteUserSetting = function(userId, settingKey) {
    return this.destroy({
      where: { userId, settingKey }
    });
  };

  UserNotificationSetting.getUserSettings = function(userId, settingKeys = null) {
    const where = { userId };
    if (settingKeys && Array.isArray(settingKeys)) {
      where.settingKey = { [sequelize.Sequelize.Op.in]: settingKeys };
    }
    
    return this.findAll({
      where,
      order: [['setting_key', 'ASC']]
    }).then(settings => {
      const result = {};
      settings.forEach(setting => {
        result[setting.settingKey] = setting.settingValue;
      });
      return result;
    });
  };

  UserNotificationSetting.bulkSetUserSettings = function(userId, settings) {
    const promises = Object.entries(settings).map(([key, value]) => {
      return this.setUserSetting(userId, key, value);
    });
    
    return Promise.all(promises);
  };

  UserNotificationSetting.getSettingStatistics = function(settingKey) {
    return this.findAll({
      where: { settingKey },
      attributes: [
        'setting_value',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['setting_value'],
      raw: true
    });
  };

  UserNotificationSetting.getUsersWithSetting = function(settingKey, settingValue = null) {
    const where = { settingKey };
    if (settingValue !== null) {
      where.settingValue = settingValue;
    }
    
    return this.findAll({
      where,
      attributes: ['user_id', 'setting_value'],
      order: [['user_id', 'ASC']]
    });
  };

  UserNotificationSetting.getPopularSettings = function(limit = 10) {
    return this.findAll({
      attributes: [
        'setting_key',
        [sequelize.fn('COUNT', sequelize.col('id')), 'user_count'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN setting_value = \'true\' OR (setting_value->>\'enabled\')::boolean = true THEN 1 END')), 'enabled_count']
      ],
      group: ['setting_key'],
      order: [[sequelize.literal('user_count'), 'DESC']],
      limit,
      raw: true
    });
  };

  UserNotificationSetting.cleanupOldSettings = function(daysOld = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    return this.destroy({
      where: {
        updatedAt: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
  };

  UserNotificationSetting.migrateSettings = function(oldKey, newKey) {
    return this.update(
      { settingKey: newKey },
      { where: { settingKey: oldKey } }
    );
  };

  UserNotificationSetting.findDuplicateSettings = function() {
    return this.findAll({
      attributes: [
        'user_id',
        'setting_key',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['user_id', 'setting_key'],
      having: sequelize.literal('COUNT(id) > 1'),
      raw: true
    });
  };

  UserNotificationSetting.getSettingsOverview = function() {
    return this.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'total_users'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('setting_key'))), 'total_settings'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_records'],
        [sequelize.fn('AVG', sequelize.literal('(SELECT COUNT(*) FROM user_notification_settings uns WHERE uns.user_id = user_notification_settings.user_id)')), 'avg_settings_per_user']
      ],
      raw: true
    });
  };

  UserNotificationSetting.exportUserSettings = function(userId) {
    return this.findAll({
      where: { userId },
      attributes: ['setting_key', 'setting_value', 'updated_at'],
      order: [['setting_key', 'ASC']]
    }).then(settings => {
      const exported = {};
      settings.forEach(setting => {
        exported[setting.settingKey] = {
          value: setting.settingValue,
          lastUpdated: setting.updatedAt
        };
      });
      return exported;
    });
  };

  UserNotificationSetting.importUserSettings = function(userId, settings) {
    const promises = Object.entries(settings).map(([key, data]) => {
      const value = typeof data === 'object' && data.value !== undefined ? data.value : data;
      return this.setUserSetting(userId, key, value);
    });
    
    return Promise.all(promises);
  };

  UserNotificationSetting.validateSettingKey = function(settingKey) {
    const validKeys = [
      'email_digest_frequency',
      'push_sound_enabled',
      'quiet_hours',
      'marketing_emails',
      'security_alerts',
      'delivery_updates',
      'price_alerts',
      'new_features',
      'weekly_summary',
      'emergency_contacts',
      'location_sharing',
      'data_usage_alerts'
    ];
    
    return validKeys.includes(settingKey) || settingKey.startsWith('custom_');
  };

  UserNotificationSetting.getDefaultSettings = function() {
    return {
      email_digest_frequency: 'daily',
      push_sound_enabled: true,
      quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      marketing_emails: false,
      security_alerts: true,
      delivery_updates: true,
      price_alerts: true,
      new_features: true,
      weekly_summary: true,
      emergency_contacts: [],
      location_sharing: {
        enabled: true,
        precision: 'city'
      },
      data_usage_alerts: true
    };
  };

  UserNotificationSetting.initializeUserDefaults = function(userId) {
    const defaultSettings = this.getDefaultSettings();
    return this.bulkSetUserSettings(userId, defaultSettings);
  };

  // Associations
  UserNotificationSetting.associate = (models) => {
    UserNotificationSetting.belongsTo(models.NotificationPreference, {
      foreignKey: 'userId',
      targetKey: 'userId',
      as: 'notificationPreference'
    });
  };

  return UserNotificationSetting;
};