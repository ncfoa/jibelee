const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payout extends Model {
    static associate(models) {
      // Payout belongs to PayoutAccount
      Payout.belongsTo(models.PayoutAccount, {
        foreignKey: 'payoutAccountId',
        as: 'payoutAccount'
      });
      
      // Payout has many TransactionLogs
      Payout.hasMany(models.TransactionLog, {
        foreignKey: 'payoutId',
        as: 'transactionLogs'
      });
    }
    
    // Instance methods
    isPending() {
      return this.status === 'pending';
    }
    
    isInTransit() {
      return this.status === 'in_transit';
    }
    
    isPaid() {
      return this.status === 'paid';
    }
    
    isFailed() {
      return this.status === 'failed';
    }
    
    isInstant() {
      return this.type === 'instant';
    }
    
    getNetAmount() {
      return this.amount - this.fee;
    }
    
    getExpectedArrival() {
      if (this.isInstant()) {
        return new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      } else {
        return new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
      }
    }
  }

  Payout.init({
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
    payoutAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payout_accounts',
        key: 'id'
      }
    },
    stripePayoutId: {
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
    type: {
      type: DataTypes.ENUM('standard', 'instant'),
      allowNull: false,
      defaultValue: 'standard'
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_transit', 'paid', 'failed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    
    // Fee information
    fee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    netAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        isInt: true
      }
    },
    
    // Description and metadata
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Source information
    sourceType: {
      type: DataTypes.ENUM('delivery_earnings', 'bonus', 'adjustment', 'referral', 'other'),
      allowNull: false,
      defaultValue: 'delivery_earnings'
    },
    sourceId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Destination information
    destination: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Timing information
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paidAt: {
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
    
    // Expected arrival
    arrivalDate: {
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
    
    // Cancellation information
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Receipt information
    receiptUrl: {
      type: DataTypes.TEXT,
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
    modelName: 'Payout',
    tableName: 'payouts',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['payoutAccountId']
      },
      {
        fields: ['stripePayoutId'],
        unique: true
      },
      {
        fields: ['status', 'type']
      },
      {
        fields: ['userId', 'status', 'createdAt']
      },
      {
        fields: ['sourceType', 'sourceId']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return Payout;
};