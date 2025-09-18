const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TripTemplate = sequelize.define('TripTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to user who created the template'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Template data stored as JSON
    trip_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Template configuration for creating trips',
      validate: {
        isValidTripData(value) {
          // Validate required fields in trip_data
          const required = ['title', 'trip_type', 'origin', 'destination', 'capacity', 'pricing'];
          for (const field of required) {
            if (!value[field]) {
              throw new Error(`Template trip_data must include ${field}`);
            }
          }
          
          // Validate origin and destination
          if (!value.origin.address) {
            throw new Error('Template origin must include address');
          }
          if (!value.destination.address) {
            throw new Error('Template destination must include address');
          }
          
          // Validate capacity
          const capacity = value.capacity;
          if (!capacity.weight || !capacity.volume || !capacity.items) {
            throw new Error('Template capacity must include weight, volume, and items');
          }
          
          // Validate pricing
          const pricing = value.pricing;
          if (pricing.base_price === undefined || pricing.base_price < 0) {
            throw new Error('Template pricing must include valid base_price');
          }
        }
      }
    },
    
    // Usage statistics
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Template settings
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether template can be used by other users'
    },
    
    // Categorization
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Template category (business, leisure, regular, etc.)'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    
    // Template metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional template metadata'
    },
    
    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'trip_templates',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      // Basic indexes
      { fields: ['user_id'] },
      { fields: ['is_active'] },
      { fields: ['is_public'] },
      { fields: ['category'] },
      { fields: ['usage_count'] },
      { fields: ['last_used_at'] },
      
      // Composite indexes for common queries
      { fields: ['user_id', 'is_active'] },
      { fields: ['is_public', 'is_active'] },
      { fields: ['usage_count', 'last_used_at'] },
      
      // Performance indexes
      { fields: ['created_at'] },
      { fields: ['updated_at'] },
      
      // Full-text search on name and tags
      {
        fields: ['name'],
        using: 'gin',
        operator: 'gin_trgm_ops'
      }
    ],
    hooks: {
      beforeCreate: (template) => {
        // Ensure trip_data has required structure
        if (!template.trip_data.restrictions) {
          template.trip_data.restrictions = {};
        }
        if (!template.trip_data.preferences) {
          template.trip_data.preferences = {};
        }
        if (!template.trip_data.tags) {
          template.trip_data.tags = [];
        }
      },
      
      beforeUpdate: (template) => {
        // Update last_used_at when usage_count changes
        if (template.changed('usage_count') && template.usage_count > template._previousDataValues.usage_count) {
          template.last_used_at = new Date();
        }
      }
    }
  });

  // Instance methods
  TripTemplate.prototype.incrementUsage = async function() {
    await this.increment('usage_count');
    await this.update({ last_used_at: new Date() });
    return this;
  };

  TripTemplate.prototype.createTripFromTemplate = function(overrides = {}) {
    const tripData = { ...this.trip_data };
    
    // Apply overrides
    Object.keys(overrides).forEach(key => {
      if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
        tripData[key] = { ...tripData[key], ...overrides[key] };
      } else {
        tripData[key] = overrides[key];
      }
    });
    
    // Add template reference
    tripData.template_id = this.id;
    
    return tripData;
  };

  TripTemplate.prototype.validateTripData = function() {
    try {
      // Validate the trip_data structure
      const data = this.trip_data;
      
      const errors = [];
      
      // Check required fields
      if (!data.title) errors.push('Title is required');
      if (!data.trip_type) errors.push('Trip type is required');
      if (!data.origin?.address) errors.push('Origin address is required');
      if (!data.destination?.address) errors.push('Destination address is required');
      if (!data.capacity) errors.push('Capacity is required');
      if (!data.pricing) errors.push('Pricing is required');
      
      // Validate capacity
      if (data.capacity) {
        if (!data.capacity.weight || data.capacity.weight <= 0) {
          errors.push('Weight capacity must be greater than 0');
        }
        if (!data.capacity.volume || data.capacity.volume <= 0) {
          errors.push('Volume capacity must be greater than 0');
        }
        if (!data.capacity.items || data.capacity.items <= 0) {
          errors.push('Item capacity must be greater than 0');
        }
      }
      
      // Validate pricing
      if (data.pricing) {
        if (data.pricing.base_price === undefined || data.pricing.base_price < 0) {
          errors.push('Base price must be 0 or greater');
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Invalid trip data structure: ${error.message}`]
      };
    }
  };

  TripTemplate.prototype.getRouteInfo = function() {
    const data = this.trip_data;
    return {
      origin: data.origin?.address || 'Unknown',
      destination: data.destination?.address || 'Unknown',
      trip_type: data.trip_type,
      estimated_duration: data.estimated_duration
    };
  };

  TripTemplate.prototype.getCapacityInfo = function() {
    const capacity = this.trip_data.capacity || {};
    return {
      weight: capacity.weight || 0,
      volume: capacity.volume || 0,
      items: capacity.items || 0
    };
  };

  TripTemplate.prototype.getPricingInfo = function() {
    const pricing = this.trip_data.pricing || {};
    return {
      base_price: pricing.base_price || 0,
      price_per_kg: pricing.price_per_kg || 0,
      price_per_km: pricing.price_per_km || 0
    };
  };

  TripTemplate.prototype.toPublicJSON = function() {
    const template = this.toJSON();
    
    // Remove sensitive information for public templates
    if (!this.is_public) {
      delete template.user_id;
    }
    
    // Add computed fields
    template.route_info = this.getRouteInfo();
    template.capacity_info = this.getCapacityInfo();
    template.pricing_info = this.getPricingInfo();
    template.validation = this.validateTripData();
    
    // Remove deleted_at for public view
    delete template.deleted_at;
    
    return template;
  };

  // Class methods
  TripTemplate.findByUser = function(userId, options = {}) {
    return this.findAll({
      where: { 
        user_id: userId,
        is_active: true
      },
      order: [['usage_count', 'DESC'], ['last_used_at', 'DESC']],
      ...options
    });
  };

  TripTemplate.findPublic = function(options = {}) {
    return this.findAll({
      where: { 
        is_public: true,
        is_active: true
      },
      order: [['usage_count', 'DESC'], ['created_at', 'DESC']],
      ...options
    });
  };

  TripTemplate.findPopular = function(limit = 10, options = {}) {
    return this.findAll({
      where: { 
        is_active: true,
        usage_count: {
          [sequelize.Sequelize.Op.gt]: 0
        }
      },
      order: [['usage_count', 'DESC'], ['last_used_at', 'DESC']],
      limit,
      ...options
    });
  };

  TripTemplate.findByRoute = function(origin, destination, options = {}) {
    const { Op } = sequelize.Sequelize;
    
    return this.findAll({
      where: {
        is_active: true,
        [Op.and]: [
          sequelize.where(
            sequelize.fn('lower', sequelize.json('trip_data.origin.address')),
            {
              [Op.iLike]: `%${origin.toLowerCase()}%`
            }
          ),
          sequelize.where(
            sequelize.fn('lower', sequelize.json('trip_data.destination.address')),
            {
              [Op.iLike]: `%${destination.toLowerCase()}%`
            }
          )
        ]
      },
      order: [['usage_count', 'DESC']],
      ...options
    });
  };

  TripTemplate.searchByName = function(query, options = {}) {
    const { Op } = sequelize.Sequelize;
    
    return this.findAll({
      where: {
        is_active: true,
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
          { tags: { [Op.contains]: [query] } }
        ]
      },
      order: [['usage_count', 'DESC'], ['created_at', 'DESC']],
      ...options
    });
  };

  TripTemplate.findByCategory = function(category, options = {}) {
    return this.findAll({
      where: { 
        category,
        is_active: true
      },
      order: [['usage_count', 'DESC']],
      ...options
    });
  };

  return TripTemplate;
};