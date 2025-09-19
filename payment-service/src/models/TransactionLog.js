const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TransactionLog extends Model {
    static associate(models) {
      // TransactionLog belongs to PaymentIntent
      TransactionLog.belongsTo(models.PaymentIntent, {
        foreignKey: 'paymentIntentId',
        as: 'paymentIntent'
      });
      
      // TransactionLog belongs to EscrowAccount
      TransactionLog.belongsTo(models.EscrowAccount, {
        foreignKey: 'escrowAccountId',
        as: 'escrowAccount'
      });
      
      // TransactionLog belongs to Payout
      TransactionLog.belongsTo(models.Payout, {
        foreignKey: 'payoutId',
        as: 'payout'
      });
      
      // TransactionLog belongs to Refund
      TransactionLog.belongsTo(models.Refund, {
        foreignKey: 'refundId',
        as: 'refund'
      });
      
      // TransactionLog belongs to Subscription
      TransactionLog.belongsTo(models.Subscription, {
        foreignKey: 'subscriptionId',
        as: 'subscription'
      });
    }
    
    // Instance methods
    isCredit() {
      return this.type === 'credit';
    }
    
    isDebit() {
      return this.type === 'debit';
    }
    
    isSuccessful() {
      return this.status === 'completed';
    }
    
    isFailed() {
      return this.status === 'failed';
    }
    
    getFormattedAmount() {
      const amount = this.amount / 100; // Convert from cents
      return `${this.isDebit() ? '-' : '+'}$${amount.toFixed(2)}`;
    }
  }

  TransactionLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Related entity IDs
    paymentIntentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'payment_intents',
        key: 'id'
      }
    },
    escrowAccountId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'escrow_accounts',
        key: 'id'
      }
    },
    payoutId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'payouts',
        key: 'id'
      }
    },
    refundId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'refunds',
        key: 'id'
      }
    },
    subscriptionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'subscriptions',
        key: 'id'
      }
    },
    
    // Transaction details
    transactionId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    externalTransactionId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('credit', 'debit'),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM(
        'payment',
        'refund',
        'payout',
        'fee',
        'adjustment',
        'chargeback',
        'dispute',
        'subscription',
        'bonus',
        'penalty'
      ),
      allowNull: false
    },
    subcategory: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    
    // Amount information
    amount: {
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
    
    // Status and timing
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Parties involved
    fromUserId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    toUserId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    fromAccountType: {
      type: DataTypes.ENUM('customer', 'traveler', 'platform', 'external'),
      allowNull: true
    },
    toAccountType: {
      type: DataTypes.ENUM('customer', 'traveler', 'platform', 'external'),
      allowNull: true
    },
    
    // Description and notes
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Provider information
    provider: {
      type: DataTypes.ENUM('stripe', 'paypal', 'bank', 'internal'),
      allowNull: false,
      defaultValue: 'stripe'
    },
    providerTransactionId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    providerFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    
    // Balance tracking
    balanceBefore: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    balanceAfter: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    
    // Reconciliation
    reconciled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    reconciledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reconciledBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Error information
    errorCode: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Audit trail
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true
    },
    userAgent: {
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
    }
  }, {
    sequelize,
    modelName: 'TransactionLog',
    tableName: 'transaction_logs',
    timestamps: true,
    indexes: [
      {
        fields: ['paymentIntentId']
      },
      {
        fields: ['escrowAccountId']
      },
      {
        fields: ['payoutId']
      },
      {
        fields: ['refundId']
      },
      {
        fields: ['subscriptionId']
      },
      {
        fields: ['transactionId'],
        unique: true
      },
      {
        fields: ['type', 'category', 'status']
      },
      {
        fields: ['fromUserId', 'toUserId']
      },
      {
        fields: ['provider', 'providerTransactionId']
      },
      {
        fields: ['reconciled', 'reconciledAt']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return TransactionLog;
};