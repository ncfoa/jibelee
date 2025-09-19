const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PricingFactor extends Model {
    static associate(models) {
      // No direct associations, but used for pricing calculations
    }
    
    // Instance methods
    isActive() {
      const now = new Date();
      return (!this.effectiveFrom || now >= this.effectiveFrom) &&
             (!this.effectiveUntil || now <= this.effectiveUntil);
    }
    
    isExpired() {
      const now = new Date();
      return this.effectiveUntil && now > this.effectiveUntil;
    }
    
    getMultipliers() {
      return {
        distance: this.distanceMultiplier,
        weight: this.weightMultiplier,
        urgency: this.urgencyMultiplier,
        category: this.categoryMultiplier,
        demand: this.demandMultiplier,
        seasonal: this.seasonalMultiplier,
        time: this.timeMultiplier
      };
    }
    
    calculatePrice(baseFactors) {
      let price = this.basePrice;
      
      // Apply distance multiplier
      if (baseFactors.distance) {
        price += baseFactors.distance * this.distanceRate;
      }
      
      // Apply weight multiplier
      if (baseFactors.weight) {
        price += baseFactors.weight * this.weightRate;
      }
      
      // Apply all multipliers
      price *= this.distanceMultiplier;
      price *= this.weightMultiplier;
      price *= this.urgencyMultiplier;
      price *= this.categoryMultiplier;
      price *= this.demandMultiplier;
      price *= this.seasonalMultiplier;
      price *= this.timeMultiplier;
      
      return Math.round(price * 100) / 100; // Round to 2 decimal places
    }
  }

  PricingFactor.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    routeHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      validate: {
        len: [1, 64]
      }
    },
    
    // Route information
    originCity: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    destinationCity: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    
    // Item category
    itemCategory: {
      type: DataTypes.ENUM(
        'electronics',
        'documents',
        'clothing',
        'fragile',
        'food',
        'medical',
        'books',
        'gifts',
        'other'
      ),
      allowNull: true
    },
    
    // Urgency level
    urgency: {
      type: DataTypes.ENUM('standard', 'express', 'urgent'),
      allowNull: true
    },
    
    // Base pricing
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    
    // Rate components
    distanceRate: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 0.05, // per km
      validate: {
        min: 0
      }
    },
    weightRate: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 5.00, // per kg
      validate: {
        min: 0
      }
    },
    
    // Multipliers
    distanceMultiplier: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 1.0000,
      validate: {
        min: 0.1,
        max: 10.0
      }
    },
    weightMultiplier: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 1.0000,
      validate: {
        min: 0.1,
        max: 10.0
      }
    },
    urgencyMultiplier: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 1.0000,
      validate: {
        min: 0.1,
        max: 5.0
      }
    },
    categoryMultiplier: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 1.0000,
      validate: {
        min: 0.1,
        max: 5.0
      }
    },
    demandMultiplier: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 1.0000,
      validate: {
        min: 0.5,
        max: 3.0
      }
    },
    seasonalMultiplier: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 1.0000,
      validate: {
        min: 0.5,
        max: 2.0
      }
    },
    timeMultiplier: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      defaultValue: 1.0000,
      validate: {
        min: 0.8,
        max: 2.0
      }
    },
    
    // Market data
    marketData: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        averagePrice: null,
        competitorCount: 0,
        demandLevel: 'medium',
        supplyLevel: 'medium',
        successRate: null,
        averageRating: null
      }
    },
    
    // Confidence and reliability
    confidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.80,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    sampleSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    
    // Validity period
    effectiveFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    effectiveUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Version control
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    previousVersionId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Creation metadata
    createdBy: {
      type: DataTypes.ENUM('system', 'ml_model', 'admin', 'api'),
      allowNull: false,
      defaultValue: 'system'
    },
    source: {
      type: DataTypes.STRING(100),
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
    modelName: 'PricingFactor',
    tableName: 'pricing_factors',
    timestamps: true,
    indexes: [
      {
        fields: ['routeHash', 'effectiveFrom']
      },
      {
        fields: ['itemCategory', 'urgency']
      },
      {
        fields: ['effectiveFrom', 'effectiveUntil']
      },
      {
        fields: ['createdBy', 'source']
      },
      {
        fields: ['version']
      },
      {
        fields: ['confidence', 'sampleSize']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return PricingFactor;
};