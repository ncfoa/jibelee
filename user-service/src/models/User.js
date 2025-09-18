const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name',
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name',
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'phone_number',
      validate: {
        is: /^\+?[1-9]\d{1,14}$/ // E.164 format
      }
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'date_of_birth',
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0], // Must be in the past
        isAfter: '1900-01-01'
      }
    },
    profilePictureUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'profile_picture_url',
      validate: {
        isUrl: true
      }
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    userType: {
      type: DataTypes.ENUM('customer', 'traveler', 'both'),
      allowNull: false,
      defaultValue: 'customer',
      field: 'user_type'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending', 'deleted'),
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
      allowNull: false,
      defaultValue: 'en',
      field: 'preferred_language',
      validate: {
        isIn: [['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh']]
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
    preferredCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
      field: 'preferred_currency',
      validate: {
        len: [3, 3],
        isUppercase: true
      }
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
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_active_at'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    paranoid: true, // Enables soft deletes
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['user_type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['verification_level']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['last_active_at']
      },
      {
        unique: true,
        fields: ['referral_code'],
        where: {
          referral_code: { [sequelize.Sequelize.Op.ne]: null }
        }
      }
    ],
    scopes: {
      active: {
        where: {
          status: 'active',
          deleted_at: null
        }
      },
      verified: {
        where: {
          verification_level: ['id_verified', 'fully_verified']
        }
      },
      public: {
        attributes: {
          exclude: ['deleted_at']
        }
      }
    },
    hooks: {
      beforeCreate: (user) => {
        // Generate referral code if not provided
        if (!user.referralCode) {
          user.referralCode = generateReferralCode();
        }
        
        // Set initial verification level based on email
        if (user.email && !user.verificationLevel) {
          user.verificationLevel = 'email_verified';
        }
      },
      beforeUpdate: (user) => {
        // Update last active timestamp on certain changes
        if (user.changed('status') && user.status === 'active') {
          user.lastActiveAt = new Date();
        }
      }
    }
  });

  // Instance methods
  User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
  };

  User.prototype.getPublicProfile = function() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      profilePictureUrl: this.profilePictureUrl,
      userType: this.userType,
      verificationLevel: this.verificationLevel,
      createdAt: this.createdAt
    };
  };

  User.prototype.isVerified = function() {
    return ['id_verified', 'fully_verified'].includes(this.verificationLevel);
  };

  User.prototype.canReceiveDeliveries = function() {
    return ['traveler', 'both'].includes(this.userType) && this.status === 'active';
  };

  User.prototype.canRequestDeliveries = function() {
    return ['customer', 'both'].includes(this.userType) && this.status === 'active';
  };

  // Class methods
  User.findByEmail = function(email) {
    return this.findOne({
      where: { email: email.toLowerCase() }
    });
  };

  User.findByReferralCode = function(referralCode) {
    return this.findOne({
      where: { referralCode }
    });
  };

  // Associations
  User.associate = function(models) {
    // Self-referential association for referrals
    User.belongsTo(models.User, {
      as: 'ReferredBy',
      foreignKey: 'referred_by_user_id'
    });
    
    User.hasMany(models.User, {
      as: 'Referrals',
      foreignKey: 'referred_by_user_id'
    });

    // One-to-many associations
    User.hasMany(models.UserAddress, {
      as: 'Addresses',
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });

    User.hasMany(models.UserVerificationDocument, {
      as: 'VerificationDocuments',
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });

    User.hasMany(models.Review, {
      as: 'ReviewsGiven',
      foreignKey: 'reviewer_id'
    });

    User.hasMany(models.Review, {
      as: 'ReviewsReceived',
      foreignKey: 'reviewee_id'
    });

    User.hasMany(models.UserBlock, {
      as: 'BlocksInitiated',
      foreignKey: 'blocker_id'
    });

    User.hasMany(models.UserBlock, {
      as: 'BlocksReceived',
      foreignKey: 'blocked_id'
    });

    User.hasMany(models.UserFavorite, {
      as: 'FavoritesAsCustomer',
      foreignKey: 'customer_id'
    });

    User.hasMany(models.UserFavorite, {
      as: 'FavoritesAsTraveler',
      foreignKey: 'traveler_id'
    });

    // One-to-one associations
    User.hasOne(models.UserPreferences, {
      as: 'Preferences',
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });

    User.hasOne(models.UserStatistics, {
      as: 'Statistics',
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
  };

  return User;
};

// Helper function to generate referral code
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}