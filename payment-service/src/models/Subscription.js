const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    static associate(models) {
      // Subscription has many TransactionLogs
      Subscription.hasMany(models.TransactionLog, {
        foreignKey: 'subscriptionId',
        as: 'transactionLogs'
      });
    }
    
    // Instance methods
    isActive() {
      return this.status === 'active';
    }
    
    isCanceled() {
      return this.status === 'canceled';
    }
    
    isTrialing() {
      return this.status === 'trialing';
    }
    
    isPastDue() {
      return this.status === 'past_due';
    }
    
    isInTrial() {
      const now = new Date();
      return this.trialStart && this.trialEnd && now >= this.trialStart && now <= this.trialEnd;
    }
    
    getDaysUntilRenewal() {
      const now = new Date();
      const renewalDate = new Date(this.currentPeriodEnd);
      const diffTime = renewalDate.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    getFeatures() {
      const planFeatures = {
        basic: [
          'Standard platform fees',
          'Basic support'
        ],
        pro: [
          'Reduced fees (7%)',
          'Priority support',
          'Advanced analytics'
        ],
        premium: [
          'Reduced platform fees (5% instead of 10%)',
          'Priority matching',
          'Advanced analytics',
          'Instant payouts included',
          '24/7 premium support'
        ]
      };
      
      return planFeatures[this.planId] || [];
    }
  }

  Subscription.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    planId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isIn: [['basic', 'pro', 'premium', 'enterprise']]
      }
    },
    planName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(
        'active',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'past_due',
        'trialing',
        'unpaid'
      ),
      allowNull: false,
      defaultValue: 'active'
    },
    
    // Billing period
    currentPeriodStart: {
      type: DataTypes.DATE,
      allowNull: false
    },
    currentPeriodEnd: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    // Pricing
    price: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        isInt: true
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
    interval: {
      type: DataTypes.ENUM('month', 'year'),
      allowNull: false,
      defaultValue: 'month'
    },
    intervalCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 12
      }
    },
    
    // Trial information
    trialStart: {
      type: DataTypes.DATE,
      allowNull: true
    },
    trialEnd: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Discount information
    discountId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    discountAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    discountType: {
      type: DataTypes.ENUM('amount_off', 'percent_off'),
      allowNull: true
    },
    
    // Cancellation information
    canceledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelAtPeriodEnd: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    canceledBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Usage tracking
    usageThisMonth: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        deliveries: 0,
        priorityMatches: 0,
        instantPayouts: 0,
        supportTickets: 0
      }
    },
    
    // Benefits applied
    benefitsApplied: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        reducedFees: false,
        priorityMatching: false,
        instantPayoutsIncluded: false,
        premiumSupport: false
      }
    },
    
    // Payment method
    paymentMethodId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    
    // Next billing
    nextBillingDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    nextBillingAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        isInt: true
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
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Subscription',
    tableName: 'subscriptions',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['stripeSubscriptionId'],
        unique: true
      },
      {
        fields: ['status']
      },
      {
        fields: ['planId']
      },
      {
        fields: ['currentPeriodEnd']
      },
      {
        fields: ['cancelAtPeriodEnd', 'currentPeriodEnd']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return Subscription;
};