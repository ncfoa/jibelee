const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EscrowAccount extends Model {
    static associate(models) {
      // EscrowAccount belongs to PaymentIntent
      EscrowAccount.belongsTo(models.PaymentIntent, {
        foreignKey: 'paymentIntentId',
        as: 'paymentIntent'
      });
      
      // EscrowAccount has many TransactionLogs
      EscrowAccount.hasMany(models.TransactionLog, {
        foreignKey: 'escrowAccountId',
        as: 'transactionLogs'
      });
    }
    
    // Instance methods
    isHeld() {
      return this.status === 'held';
    }
    
    canBeReleased() {
      return this.status === 'held' && !this.isExpired();
    }
    
    isExpired() {
      return new Date() > this.holdUntil;
    }
    
    getRemainingHoldTime() {
      const now = new Date();
      const holdUntil = new Date(this.holdUntil);
      return Math.max(0, holdUntil.getTime() - now.getTime());
    }
    
    calculateReleasableAmount() {
      if (this.status !== 'held') return 0;
      return this.amount - (this.deductedAmount || 0);
    }
  }

  EscrowAccount.init({
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
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
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
    status: {
      type: DataTypes.ENUM('pending', 'held', 'released', 'disputed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending'
    },
    
    // Hold configuration
    holdUntil: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isAfter: new Date().toISOString()
      }
    },
    releaseCondition: {
      type: DataTypes.ENUM(
        'delivery_confirmed',
        'qr_scanned',
        'manual_release',
        'dispute_resolved',
        'timeout'
      ),
      allowNull: false,
      defaultValue: 'delivery_confirmed'
    },
    autoReleaseEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    
    // Release information
    releasedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    releasedAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        isInt: true
      }
    },
    releaseReason: {
      type: DataTypes.ENUM(
        'delivery_confirmed',
        'qr_scanned',
        'manual_approval',
        'dispute_resolved',
        'auto_release_timeout'
      ),
      allowNull: true
    },
    releaseNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Deduction information
    deductedAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      }
    },
    deductionReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Dispute information
    disputedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    disputeReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    disputeResolution: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // QR code verification
    qrScanId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    qrScanTimestamp: {
      type: DataTypes.DATE,
      allowNull: true
    },
    qrScanLocation: {
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
    modelName: 'EscrowAccount',
    tableName: 'escrow_accounts',
    timestamps: true,
    indexes: [
      {
        fields: ['paymentIntentId']
      },
      {
        fields: ['deliveryId']
      },
      {
        fields: ['status', 'holdUntil']
      },
      {
        fields: ['status', 'autoReleaseEnabled', 'holdUntil']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return EscrowAccount;
};