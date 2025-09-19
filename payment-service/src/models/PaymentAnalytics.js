const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PaymentAnalytics extends Model {
    static associate(models) {
      // No direct associations, this is an analytics table
    }
    
    // Instance methods
    getConversionRate() {
      return this.totalTransactions > 0 ? 
        (this.successfulTransactions / this.totalTransactions) * 100 : 0;
    }
    
    getAverageTransactionValue() {
      return this.successfulTransactions > 0 ? 
        this.totalRevenue / this.successfulTransactions : 0;
    }
    
    getRefundRate() {
      return this.totalTransactions > 0 ? 
        (this.totalRefunds / this.totalTransactions) * 100 : 0;
    }
    
    getChargebackRate() {
      return this.totalTransactions > 0 ? 
        (this.totalChargebacks / this.totalTransactions) * 100 : 0;
    }
    
    getFraudRate() {
      return this.totalTransactions > 0 ? 
        (this.fraudulentTransactions / this.totalTransactions) * 100 : 0;
    }
  }

  PaymentAnalytics.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Time period
    periodType: {
      type: DataTypes.ENUM('hour', 'day', 'week', 'month', 'quarter', 'year'),
      allowNull: false
    },
    periodStart: {
      type: DataTypes.DATE,
      allowNull: false
    },
    periodEnd: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    // Segmentation
    segmentType: {
      type: DataTypes.ENUM('global', 'user', 'route', 'category', 'country', 'currency'),
      allowNull: false,
      defaultValue: 'global'
    },
    segmentValue: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    
    // Transaction metrics
    totalTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    successfulTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    failedTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    canceledTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Revenue metrics (in cents)
    totalRevenue: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    platformRevenue: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    processingFees: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Refund metrics
    totalRefunds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    totalRefundAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Chargeback metrics
    totalChargebacks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    totalChargebackAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Fraud metrics
    fraudulentTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    fraudulentAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Payout metrics
    totalPayouts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    totalPayoutAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    instantPayouts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    instantPayoutAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // User metrics
    uniqueCustomers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    uniqueTravelers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    newCustomers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Payment method breakdown
    paymentMethods: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Currency breakdown
    currencies: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Geographic breakdown
    countries: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Category breakdown
    categories: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Performance metrics
    averageProcessingTime: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Average processing time in seconds'
    },
    medianTransactionValue: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    
    // Risk metrics
    highRiskTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    mediumRiskTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    lowRiskTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Subscription metrics
    activeSubscriptions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    subscriptionRevenue: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Additional metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Computation metadata
    computedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    computationDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Computation duration in milliseconds'
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
    }
  }, {
    sequelize,
    modelName: 'PaymentAnalytics',
    tableName: 'payment_analytics',
    timestamps: true,
    indexes: [
      {
        fields: ['periodType', 'periodStart', 'periodEnd']
      },
      {
        fields: ['segmentType', 'segmentValue']
      },
      {
        fields: ['periodStart', 'periodEnd']
      },
      {
        fields: ['computedAt']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return PaymentAnalytics;
};