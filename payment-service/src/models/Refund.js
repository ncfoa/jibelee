const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Refund extends Model {
    static associate(models) {
      // Refund belongs to PaymentIntent
      Refund.belongsTo(models.PaymentIntent, {
        foreignKey: 'paymentIntentId',
        as: 'paymentIntent'
      });
      
      // Refund has many TransactionLogs
      Refund.hasMany(models.TransactionLog, {
        foreignKey: 'refundId',
        as: 'transactionLogs'
      });
    }
    
    // Instance methods
    isSuccessful() {
      return this.status === 'succeeded';
    }
    
    isPending() {
      return this.status === 'pending';
    }
    
    isFailed() {
      return this.status === 'failed';
    }
    
    isPartial() {
      return this.refundType === 'partial';
    }
    
    isFull() {
      return this.refundType === 'full';
    }
    
    getBreakdown() {
      return {
        customerRefund: this.customerRefund,
        travelerCompensation: this.travelerCompensation,
        platformFeeRefund: this.platformFeeRefund,
        total: this.amount
      };
    }
  }

  Refund.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentIntentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payment_intents',
        key: 'id'
      }
    },
    stripeRefundId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
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
    reason: {
      type: DataTypes.ENUM(
        'delivery_cancelled',
        'item_damaged',
        'service_not_provided',
        'customer_request',
        'dispute_resolution',
        'duplicate',
        'fraudulent',
        'requested_by_customer'
      ),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    
    // Refund type
    refundType: {
      type: DataTypes.ENUM('full', 'partial'),
      allowNull: false,
      defaultValue: 'full'
    },
    
    // Refund breakdown
    customerRefund: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        isInt: true
      }
    },
    travelerCompensation: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    platformFeeRefund: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    
    // Description and notes
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Requester information
    requestedBy: {
      type: DataTypes.UUID,
      allowNull: false
    },
    requestedByType: {
      type: DataTypes.ENUM('customer', 'traveler', 'admin', 'system'),
      allowNull: false,
      defaultValue: 'customer'
    },
    
    // Approval workflow
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    approvalNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Related entities
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    disputeId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Receipt information
    receiptUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    receiptNumber: {
      type: DataTypes.STRING(100),
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
    processedAt: {
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
    }
  }, {
    sequelize,
    modelName: 'Refund',
    tableName: 'refunds',
    timestamps: true,
    indexes: [
      {
        fields: ['paymentIntentId']
      },
      {
        fields: ['stripeRefundId'],
        unique: true
      },
      {
        fields: ['status', 'reason']
      },
      {
        fields: ['requestedBy', 'requestedByType']
      },
      {
        fields: ['deliveryId']
      },
      {
        fields: ['disputeId']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return Refund;
};