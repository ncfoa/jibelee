const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FraudAnalysis extends Model {
    static associate(models) {
      // FraudAnalysis belongs to PaymentIntent
      FraudAnalysis.belongsTo(models.PaymentIntent, {
        foreignKey: 'paymentIntentId',
        as: 'paymentIntent'
      });
    }
    
    // Instance methods
    isHighRisk() {
      return this.riskLevel === 'high';
    }
    
    isMediumRisk() {
      return this.riskLevel === 'medium';
    }
    
    isLowRisk() {
      return this.riskLevel === 'low';
    }
    
    requiresManualReview() {
      return this.requiresReview || this.isHighRisk();
    }
    
    getTopRiskFactors() {
      if (!this.riskFactors) return [];
      
      return Object.entries(this.riskFactors)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([factor, score]) => ({ factor, score }));
    }
    
    shouldBlockPayment() {
      return this.recommendation === 'block' || (this.riskScore >= 0.9 && this.isHighRisk());
    }
  }

  FraudAnalysis.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentIntentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'payment_intents',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    
    // Risk assessment
    riskScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    riskLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false
    },
    
    // Risk factors breakdown
    riskFactors: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Individual risk scores
    paymentMethodRisk: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    userBehaviorRisk: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    amountRisk: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    geographicRisk: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    velocityRisk: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    deviceRisk: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    
    // Recommendation and action
    recommendation: {
      type: DataTypes.ENUM('approve', 'review', 'block'),
      allowNull: false,
      defaultValue: 'approve'
    },
    requiresReview: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    actionTaken: {
      type: DataTypes.ENUM('approved', 'blocked', 'flagged', 'reviewed'),
      allowNull: true
    },
    
    // Context information
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deviceFingerprint: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    
    // Geographic information
    country: {
      type: DataTypes.STRING(2),
      allowNull: true
    },
    region: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    
    // Payment details
    paymentAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        isInt: true
      }
    },
    paymentCurrency: {
      type: DataTypes.STRING(3),
      allowNull: true
    },
    paymentMethodType: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    
    // Historical data
    userPaymentHistory: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    userAccountAge: {
      type: DataTypes.INTEGER,
      allowNull: true // Age in days
    },
    previousFraudCases: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Model information
    modelVersion: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    modelConfidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    
    // Review information
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reviewDecision: {
      type: DataTypes.ENUM('approved', 'rejected', 'requires_more_info'),
      allowNull: true
    },
    
    // False positive tracking
    isFalsePositive: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    falsePositiveReportedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    falsePositiveReportedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Additional metadata
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
    modelName: 'FraudAnalysis',
    tableName: 'fraud_analyses',
    timestamps: true,
    indexes: [
      {
        fields: ['paymentIntentId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['riskScore', 'riskLevel']
      },
      {
        fields: ['recommendation', 'requiresReview']
      },
      {
        fields: ['ipAddress']
      },
      {
        fields: ['deviceFingerprint']
      },
      {
        fields: ['country', 'region']
      },
      {
        fields: ['reviewedBy', 'reviewedAt']
      },
      {
        fields: ['isFalsePositive']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return FraudAnalysis;
};