module.exports = (sequelize, DataTypes) => {
  const DeviceToken = sequelize.define('DeviceToken', {
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
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 500]
      }
    },
    platform: {
      type: DataTypes.ENUM('ios', 'android', 'web', 'windows', 'macos', 'linux'),
      allowNull: false
    },
    deviceId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'device_id'
    },
    appVersion: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'app_version'
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_used_at'
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
    tableName: 'device_tokens',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id', 'active'],
        where: {
          active: true
        }
      },
      {
        fields: ['platform']
      },
      {
        fields: ['token'],
        unique: true
      },
      {
        fields: ['device_id']
      },
      {
        fields: ['last_used_at']
      }
    ],
    hooks: {
      beforeUpdate: (deviceToken) => {
        deviceToken.updatedAt = new Date();
      }
    }
  });

  // Instance methods
  DeviceToken.prototype.markAsUsed = function() {
    this.lastUsedAt = new Date();
    return this.save();
  };

  DeviceToken.prototype.deactivate = function() {
    this.active = false;
    return this.save();
  };

  DeviceToken.prototype.activate = function() {
    this.active = true;
    this.lastUsedAt = new Date();
    return this.save();
  };

  DeviceToken.prototype.isExpired = function(expirationDays = 90) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - expirationDays);
    return this.lastUsedAt < expirationDate;
  };

  DeviceToken.prototype.updateToken = function(newToken) {
    this.token = newToken;
    this.lastUsedAt = new Date();
    this.active = true;
    return this.save();
  };

  DeviceToken.prototype.isMobile = function() {
    return ['ios', 'android'].includes(this.platform);
  };

  DeviceToken.prototype.isDesktop = function() {
    return ['windows', 'macos', 'linux'].includes(this.platform);
  };

  DeviceToken.prototype.isWeb = function() {
    return this.platform === 'web';
  };

  // Class methods
  DeviceToken.findActiveByUserId = function(userId) {
    return this.findAll({
      where: {
        userId,
        active: true
      },
      order: [['last_used_at', 'DESC']]
    });
  };

  DeviceToken.findByUserIdAndPlatform = function(userId, platform) {
    return this.findAll({
      where: {
        userId,
        platform,
        active: true
      },
      order: [['last_used_at', 'DESC']]
    });
  };

  DeviceToken.findByToken = function(token) {
    return this.findOne({
      where: { token }
    });
  };

  DeviceToken.registerToken = function(userId, token, platform, deviceId = null, appVersion = null) {
    return this.findOrCreate({
      where: { token },
      defaults: {
        userId,
        token,
        platform,
        deviceId,
        appVersion,
        active: true,
        lastUsedAt: new Date()
      }
    }).then(([deviceToken, created]) => {
      if (!created) {
        // Update existing token
        deviceToken.userId = userId;
        deviceToken.platform = platform;
        deviceToken.deviceId = deviceId;
        deviceToken.appVersion = appVersion;
        deviceToken.active = true;
        deviceToken.lastUsedAt = new Date();
        return deviceToken.save();
      }
      return deviceToken;
    });
  };

  DeviceToken.deactivateToken = function(token) {
    return this.update(
      { active: false },
      { where: { token } }
    );
  };

  DeviceToken.deactivateUserTokens = function(userId, platform = null) {
    const where = { userId };
    if (platform) {
      where.platform = platform;
    }

    return this.update(
      { active: false },
      { where }
    );
  };

  DeviceToken.cleanupExpiredTokens = function(expirationDays = 90) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - expirationDays);

    return this.update(
      { active: false },
      {
        where: {
          lastUsedAt: {
            [sequelize.Sequelize.Op.lt]: expirationDate
          },
          active: true
        }
      }
    );
  };

  DeviceToken.getTokenStats = function() {
    return this.findAll({
      attributes: [
        'platform',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN active = true THEN 1 END')), 'active']
      ],
      group: ['platform'],
      raw: true
    });
  };

  DeviceToken.getUserDeviceCount = function(userId) {
    return this.count({
      where: {
        userId,
        active: true
      }
    });
  };

  DeviceToken.getMostActiveTokens = function(limit = 100) {
    return this.findAll({
      where: { active: true },
      order: [['last_used_at', 'DESC']],
      limit,
      attributes: ['id', 'user_id', 'platform', 'last_used_at', 'created_at']
    });
  };

  DeviceToken.getTokensByTimeRange = function(startDate, endDate) {
    return this.findAll({
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'platform',
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['platform', sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [['date', 'ASC']],
      raw: true
    });
  };

  DeviceToken.validateToken = function(token, platform) {
    // Basic validation based on platform
    switch (platform) {
      case 'ios':
        // iOS tokens are typically 64 characters
        return /^[a-f0-9]{64}$/i.test(token);
      case 'android':
        // Android FCM tokens are typically longer and contain various characters
        return token.length > 100 && /^[a-zA-Z0-9_:-]+$/.test(token);
      case 'web':
        // Web push tokens are base64 encoded
        return token.length > 100;
      default:
        return token.length > 10;
    }
  };

  DeviceToken.bulkUpdateLastUsed = function(tokens) {
    const updates = tokens.map(token => ({
      token,
      lastUsedAt: new Date()
    }));

    return sequelize.transaction(async (transaction) => {
      const promises = updates.map(update =>
        this.update(
          { lastUsedAt: update.lastUsedAt },
          {
            where: { token: update.token },
            transaction
          }
        )
      );
      
      return Promise.all(promises);
    });
  };

  // Associations
  DeviceToken.associate = (models) => {
    // DeviceToken belongs to User (if you have a User model)
    // DeviceToken.belongsTo(models.User, {
    //   foreignKey: 'userId',
    //   as: 'user'
    // });
  };

  return DeviceToken;
};