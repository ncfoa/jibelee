const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserSession = sequelize.define('UserSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  deviceId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'device_id'
  },
  deviceType: {
    type: DataTypes.ENUM('mobile', 'web', 'tablet', 'desktop'),
    allowNull: true,
    field: 'device_type'
  },
  platform: {
    type: DataTypes.ENUM('ios', 'android', 'web', 'windows', 'macos', 'linux'),
    allowNull: true
  },
  appVersion: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'app_version'
  },
  pushToken: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'push_token'
  },
  ipAddress: {
    type: DataTypes.INET,
    allowNull: true,
    field: 'ip_address'
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  refreshTokenHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'refresh_token_hash'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  lastActiveAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'last_active_at'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'revoked_at'
  }
}, {
  tableName: 'user_sessions',
  timestamps: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['device_id']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['user_id'],
      where: {
        revoked_at: null
      },
      name: 'idx_user_sessions_active'
    },
    {
      fields: ['refresh_token_hash']
    }
  ]
});

// Instance methods
UserSession.prototype.isActive = function() {
  return this.revokedAt === null && this.expiresAt > new Date();
};

UserSession.prototype.isExpired = function() {
  return this.expiresAt <= new Date();
};

UserSession.prototype.revoke = async function() {
  this.revokedAt = new Date();
  return this.save();
};

UserSession.prototype.updateLastActive = async function() {
  this.lastActiveAt = new Date();
  return this.save();
};

UserSession.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.refreshTokenHash;
  return values;
};

// Static methods
UserSession.findActiveByUserId = function(userId) {
  return this.findAll({
    where: {
      userId,
      revokedAt: null,
      expiresAt: {
        [sequelize.Op.gt]: new Date()
      }
    },
    order: [['lastActiveAt', 'DESC']]
  });
};

UserSession.findByRefreshTokenHash = function(tokenHash) {
  return this.findOne({
    where: {
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: {
        [sequelize.Op.gt]: new Date()
      }
    }
  });
};

UserSession.revokeAllByUserId = async function(userId, excludeSessionId = null) {
  const where = {
    userId,
    revokedAt: null
  };

  if (excludeSessionId) {
    where.id = { [sequelize.Op.ne]: excludeSessionId };
  }

  return this.update(
    { revokedAt: new Date() },
    { where }
  );
};

UserSession.cleanupExpired = function() {
  return this.destroy({
    where: {
      expiresAt: {
        [sequelize.Op.lt]: new Date()
      }
    }
  });
};

module.exports = UserSession;