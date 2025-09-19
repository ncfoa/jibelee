const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CurrencyExchange extends Model {
    static associate(models) {
      // No direct associations
    }
    
    // Instance methods
    isActive() {
      const now = new Date();
      return now >= this.validFrom && (!this.validUntil || now <= this.validUntil);
    }
    
    isExpired() {
      const now = new Date();
      return this.validUntil && now > this.validUntil;
    }
    
    convert(amount) {
      return Math.round(amount * this.rate * 100) / 100;
    }
    
    getInverseRate() {
      return 1 / this.rate;
    }
    
    calculateFee(amount) {
      const feeAmount = amount * (this.feeRate || 0);
      return Math.max(feeAmount, this.minimumFee || 0);
    }
  }

  CurrencyExchange.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    fromCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: {
        len: [3, 3],
        isAlpha: true,
        isUppercase: true
      }
    },
    toCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: {
        len: [3, 3],
        isAlpha: true,
        isUppercase: true
      }
    },
    rate: {
      type: DataTypes.DECIMAL(15, 8),
      allowNull: false,
      validate: {
        min: 0.00000001
      }
    },
    
    // Rate metadata
    source: {
      type: DataTypes.ENUM('manual', 'api', 'bank', 'market'),
      allowNull: false,
      defaultValue: 'api'
    },
    provider: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    
    // Validity period
    validFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    validUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Fee structure
    feeRate: {
      type: DataTypes.DECIMAL(6, 4),
      allowNull: false,
      defaultValue: 0.0250, // 2.5%
      validate: {
        min: 0.0000,
        max: 1.0000
      }
    },
    minimumFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.50,
      validate: {
        min: 0.00
      }
    },
    maximumFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0.00
      }
    },
    
    // Market data
    bid: {
      type: DataTypes.DECIMAL(15, 8),
      allowNull: true
    },
    ask: {
      type: DataTypes.DECIMAL(15, 8),
      allowNull: true
    },
    spread: {
      type: DataTypes.DECIMAL(15, 8),
      allowNull: true
    },
    
    // Volume and liquidity
    dailyVolume: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true
    },
    volatility: {
      type: DataTypes.DECIMAL(6, 4),
      allowNull: true
    },
    
    // Historical tracking
    previousRate: {
      type: DataTypes.DECIMAL(15, 8),
      allowNull: true
    },
    changePercent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true
    },
    changeAbsolute: {
      type: DataTypes.DECIMAL(15, 8),
      allowNull: true
    },
    
    // Quality indicators
    confidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.95,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    dataAge: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Age of the rate data in seconds'
    },
    
    // Usage statistics
    usageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    
    // Audit information
    createdBy: {
      type: DataTypes.ENUM('system', 'admin', 'api', 'scheduler'),
      allowNull: false,
      defaultValue: 'system'
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
    modelName: 'CurrencyExchange',
    tableName: 'currency_exchanges',
    timestamps: true,
    indexes: [
      {
        fields: ['fromCurrency', 'toCurrency', 'validFrom'],
        unique: true
      },
      {
        fields: ['fromCurrency', 'toCurrency']
      },
      {
        fields: ['validFrom', 'validUntil']
      },
      {
        fields: ['source', 'provider']
      },
      {
        fields: ['confidence', 'dataAge']
      },
      {
        fields: ['usageCount', 'lastUsedAt']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return CurrencyExchange;
};