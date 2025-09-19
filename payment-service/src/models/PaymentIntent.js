const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PaymentIntent extends Model {
    static associate(models) {
      // PaymentIntent has one EscrowAccount
      PaymentIntent.hasOne(models.EscrowAccount, {
        foreignKey: 'paymentIntentId',
        as: 'escrow'
      });
      
      // PaymentIntent has many Refunds
      PaymentIntent.hasMany(models.Refund, {
        foreignKey: 'paymentIntentId',
        as: 'refunds'
      });
      
      // PaymentIntent has many TransactionLogs
      PaymentIntent.hasMany(models.TransactionLog, {
        foreignKey: 'paymentIntentId',
        as: 'transactionLogs'
      });
      
      // PaymentIntent has one FraudAnalysis
      PaymentIntent.hasOne(models.FraudAnalysis, {
        foreignKey: 'paymentIntentId',
        as: 'fraudAnalysis'
      });
    }
    
    // Instance methods
    calculateNetAmount() {
      return this.amount - this.totalFees;
    }
    
    isSuccessful() {
      return this.status === 'succeeded';
    }
    
    canBeRefunded() {
      return this.status === 'succeeded' && !this.refundedAt;
    }
    
    getFeeBreakdown() {
      return {
        platformFee: this.platformFee,
        processingFee: this.processingFee,
        insuranceFee: this.insuranceFee,
        total: this.totalFees
      };
    }
  }

  PaymentIntent.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    stripePaymentIntentId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 50, // Minimum $0.50
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
    status: {
      type: DataTypes.ENUM(
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
        'succeeded',
        'failed',
        'canceled'
      ),
      allowNull: false,
      defaultValue: 'requires_payment_method'
    },
    paymentMethodId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    clientSecret: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    
    // Customer information
    customerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    customerEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    
    // Traveler information
    travelerId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Fee breakdown
    platformFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    processingFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    insuranceFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    totalFees: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    
    // Billing details
    billingDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Receipt information
    receiptEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    receiptUrl: {
      type: DataTypes.TEXT,
      allowNull: true
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
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    canceledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Failure information
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    failureCode: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    
    // Risk assessment
    riskScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    riskLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PaymentIntent',
    tableName: 'payment_intents',
    timestamps: true,
    indexes: [
      {
        fields: ['deliveryId']
      },
      {
        fields: ['customerId']
      },
      {
        fields: ['travelerId']
      },
      {
        fields: ['stripePaymentIntentId'],
        unique: true
      },
      {
        fields: ['status', 'createdAt']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return PaymentIntent;
};