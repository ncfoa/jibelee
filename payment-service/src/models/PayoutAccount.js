const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PayoutAccount extends Model {
    static associate(models) {
      // PayoutAccount has many Payouts
      PayoutAccount.hasMany(models.Payout, {
        foreignKey: 'payoutAccountId',
        as: 'payouts'
      });
    }
    
    // Instance methods
    isActive() {
      return this.status === 'active';
    }
    
    canReceivePayouts() {
      return this.status === 'active' && this.capabilities.transfers === 'active';
    }
    
    hasRequiredDocuments() {
      return this.requirements.currently_due.length === 0;
    }
    
    getAvailableBalance() {
      return this.balanceAvailable || 0;
    }
    
    getPendingBalance() {
      return this.balancePending || 0;
    }
    
    getTotalBalance() {
      return this.getAvailableBalance() + this.getPendingBalance();
    }
  }

  PayoutAccount.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    stripeAccountId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    accountType: {
      type: DataTypes.ENUM('express', 'standard', 'custom'),
      allowNull: false,
      defaultValue: 'express'
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        len: [2, 2],
        isAlpha: true,
        isUppercase: true
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
      validate: {
        isIn: [['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']]
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'restricted', 'inactive'),
      allowNull: false,
      defaultValue: 'pending'
    },
    
    // Stripe Connect capabilities
    capabilities: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Verification requirements
    requirements: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        currently_due: [],
        eventually_due: [],
        past_due: []
      }
    },
    
    // Verification status
    verificationStatus: {
      type: DataTypes.ENUM('unverified', 'pending', 'verified'),
      allowNull: false,
      defaultValue: 'unverified'
    },
    verificationDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Balance information (in cents)
    balanceAvailable: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    balancePending: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    
    // Payout schedule
    payoutSchedule: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        interval: 'daily',
        monthly_anchor: null,
        weekly_anchor: null,
        delay_days: 2
      }
    },
    
    // Account holder information
    accountHolderType: {
      type: DataTypes.ENUM('individual', 'company'),
      allowNull: false,
      defaultValue: 'individual'
    },
    businessProfile: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Banking details (encrypted)
    bankingDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Terms of Service acceptance
    tosAcceptance: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Settings
    settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        branding: {},
        card_payments: {},
        dashboard: {},
        payments: {}
      }
    },
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Timestamps
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PayoutAccount',
    tableName: 'payout_accounts',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
        unique: true
      },
      {
        fields: ['stripeAccountId'],
        unique: true
      },
      {
        fields: ['status']
      },
      {
        fields: ['verificationStatus']
      },
      {
        fields: ['country']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return PayoutAccount;
};