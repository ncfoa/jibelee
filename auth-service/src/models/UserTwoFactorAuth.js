const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserTwoFactorAuth = sequelize.define('UserTwoFactorAuth', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  secretKey: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'secret_key'
  },
  backupCodes: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    defaultValue: [],
    field: 'backup_codes'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  enabledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'enabled_at'
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
  tableName: 'user_two_factor_auth',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id'],
      unique: true
    }
  ]
});

// Instance methods
UserTwoFactorAuth.prototype.enable = async function() {
  this.enabled = true;
  this.enabledAt = new Date();
  return this.save();
};

UserTwoFactorAuth.prototype.disable = async function() {
  this.enabled = false;
  this.enabledAt = null;
  return this.save();
};

UserTwoFactorAuth.prototype.useBackupCode = async function(code) {
  const codeIndex = this.backupCodes.indexOf(code);
  if (codeIndex === -1) {
    return false;
  }

  // Remove the used backup code
  this.backupCodes.splice(codeIndex, 1);
  await this.save();
  return true;
};

UserTwoFactorAuth.prototype.regenerateBackupCodes = function() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(this.generateBackupCode());
  }
  this.backupCodes = codes;
  return codes;
};

UserTwoFactorAuth.prototype.generateBackupCode = function() {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

UserTwoFactorAuth.prototype.hasBackupCodes = function() {
  return this.backupCodes && this.backupCodes.length > 0;
};

UserTwoFactorAuth.prototype.getBackupCodesCount = function() {
  return this.backupCodes ? this.backupCodes.length : 0;
};

UserTwoFactorAuth.prototype.toJSON = function() {
  const values = { ...this.get() };
  // Don't expose the secret key in JSON
  delete values.secretKey;
  return values;
};

// Static methods
UserTwoFactorAuth.findByUserId = function(userId) {
  return this.findOne({
    where: { userId }
  });
};

UserTwoFactorAuth.isEnabledForUser = async function(userId) {
  const twoFA = await this.findByUserId(userId);
  return twoFA && twoFA.enabled;
};

module.exports = UserTwoFactorAuth;