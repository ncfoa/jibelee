const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

const PasswordResetToken = sequelize.define('PasswordResetToken', {
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
  tokenHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'token_hash'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'password_reset_tokens',
  timestamps: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['token_hash']
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Instance methods
PasswordResetToken.prototype.isValid = function() {
  return this.usedAt === null && this.expiresAt > new Date();
};

PasswordResetToken.prototype.isExpired = function() {
  return this.expiresAt <= new Date();
};

PasswordResetToken.prototype.markAsUsed = async function() {
  this.usedAt = new Date();
  return this.save();
};

// Static methods
PasswordResetToken.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

PasswordResetToken.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

PasswordResetToken.createForUser = async function(userId, expiryMinutes = 60) {
  const token = this.generateToken();
  const tokenHash = this.hashToken(token);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Invalidate any existing tokens for this user
  await this.update(
    { usedAt: new Date() },
    { 
      where: { 
        userId,
        usedAt: null,
        expiresAt: { [sequelize.Op.gt]: new Date() }
      } 
    }
  );

  const resetToken = await this.create({
    userId,
    tokenHash,
    expiresAt
  });

  return { token, resetToken };
};

PasswordResetToken.findValidToken = function(token) {
  const tokenHash = this.hashToken(token);
  return this.findOne({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { [sequelize.Op.gt]: new Date() }
    }
  });
};

PasswordResetToken.cleanupExpired = function() {
  return this.destroy({
    where: {
      expiresAt: { [sequelize.Op.lt]: new Date() }
    }
  });
};

PasswordResetToken.revokeAllForUser = function(userId) {
  return this.update(
    { usedAt: new Date() },
    {
      where: {
        userId,
        usedAt: null
      }
    }
  );
};

module.exports = PasswordResetToken;