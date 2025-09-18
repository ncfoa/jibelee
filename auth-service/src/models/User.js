const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      len: [5, 255]
    }
  },
  emailVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'email_verified_at'
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number',
    validate: {
      is: /^\+[1-9]\d{1,14}$/ // E.164 format
    }
  },
  phoneVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'phone_verified_at'
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'first_name',
    validate: {
      len: [2, 100]
    }
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'last_name',
    validate: {
      len: [2, 100]
    }
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'date_of_birth'
  },
  profilePictureUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'profile_picture_url'
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userType: {
    type: DataTypes.ENUM('customer', 'traveler', 'both', 'admin', 'super_admin'),
    allowNull: false,
    defaultValue: 'customer',
    field: 'user_type'
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'suspended', 'banned', 'deactivated'),
    allowNull: false,
    defaultValue: 'pending'
  },
  verificationLevel: {
    type: DataTypes.ENUM('unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified'),
    allowNull: false,
    defaultValue: 'unverified',
    field: 'verification_level'
  },
  preferredLanguage: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: 'en',
    field: 'preferred_language'
  },
  timezone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'UTC'
  },
  preferredCurrency: {
    type: DataTypes.STRING(3),
    allowNull: true,
    defaultValue: 'USD',
    field: 'preferred_currency'
  },
  referralCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    field: 'referral_code'
  },
  referredByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'referred_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  termsAcceptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'terms_accepted_at'
  },
  privacyAcceptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'privacy_accepted_at'
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
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deleted_at'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at',
  indexes: [
    {
      fields: ['email']
    },
    {
      fields: ['phone_number']
    },
    {
      fields: ['status']
    },
    {
      fields: ['user_type']
    },
    {
      fields: ['verification_level']
    },
    {
      fields: ['referral_code']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Instance methods
User.prototype.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

User.prototype.isEmailVerified = function() {
  return this.emailVerifiedAt !== null;
};

User.prototype.isPhoneVerified = function() {
  return this.phoneVerifiedAt !== null;
};

User.prototype.isActive = function() {
  return this.status === 'active';
};

User.prototype.canLogin = function() {
  return this.isActive() && this.isEmailVerified();
};

User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.passwordHash;
  return values;
};

User.prototype.getPublicProfile = function() {
  return {
    id: this.id,
    firstName: this.firstName,
    lastName: this.lastName,
    profilePictureUrl: this.profilePictureUrl,
    bio: this.bio,
    userType: this.userType,
    verificationLevel: this.verificationLevel,
    createdAt: this.createdAt
  };
};

// Static methods
User.hashPassword = async function(password) {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return bcrypt.hash(password, saltRounds);
};

User.generateReferralCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Hooks
User.beforeCreate(async (user) => {
  if (user.passwordHash && !user.passwordHash.startsWith('$2b$')) {
    user.passwordHash = await User.hashPassword(user.passwordHash);
  }
  
  if (!user.referralCode) {
    let code;
    let exists = true;
    while (exists) {
      code = User.generateReferralCode();
      const existingUser = await User.findOne({ where: { referralCode: code } });
      exists = !!existingUser;
    }
    user.referralCode = code;
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('passwordHash') && user.passwordHash && !user.passwordHash.startsWith('$2b$')) {
    user.passwordHash = await User.hashPassword(user.passwordHash);
  }
});

module.exports = User;