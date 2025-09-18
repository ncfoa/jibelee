const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

const EmailVerificationToken = sequelize.define('EmailVerificationToken', {
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
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true
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
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'verified_at'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'email_verification_tokens',
  timestamps: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['email']
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
EmailVerificationToken.prototype.isValid = function() {
  return this.verifiedAt === null && this.expiresAt > new Date();
};

EmailVerificationToken.prototype.isExpired = function() {
  return this.expiresAt <= new Date();
};

EmailVerificationToken.prototype.markAsVerified = async function() {
  this.verifiedAt = new Date();
  return this.save();
};

// Static methods
EmailVerificationToken.generateCode = function() {
  // Generate 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

EmailVerificationToken.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

EmailVerificationToken.createForUser = async function(userId, email, expiryMinutes = 30) {
  const code = this.generateCode();
  const tokenHash = this.hashToken(code);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Invalidate any existing tokens for this user and email
  await this.update(
    { verifiedAt: new Date() },
    { 
      where: { 
        userId,
        email,
        verifiedAt: null,
        expiresAt: { [sequelize.Op.gt]: new Date() }
      } 
    }
  );

  const verificationToken = await this.create({
    userId,
    email,
    tokenHash,
    expiresAt
  });

  return { code, verificationToken };
};

EmailVerificationToken.findValidToken = function(email, code) {
  const tokenHash = this.hashToken(code);
  return this.findOne({
    where: {
      email,
      tokenHash,
      verifiedAt: null,
      expiresAt: { [sequelize.Op.gt]: new Date() }
    }
  });
};

EmailVerificationToken.cleanupExpired = function() {
  return this.destroy({
    where: {
      expiresAt: { [sequelize.Op.lt]: new Date() },
      verifiedAt: null
    }
  });
};

EmailVerificationToken.revokeAllForUser = function(userId) {
  return this.update(
    { verifiedAt: new Date() },
    {
      where: {
        userId,
        verifiedAt: null
      }
    }
  );
};

EmailVerificationToken.getRecentAttemptsCount = async function(email, minutes = 60) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  return this.count({
    where: {
      email,
      createdAt: { [sequelize.Op.gte]: since }
    }
  });
};

module.exports = EmailVerificationToken;