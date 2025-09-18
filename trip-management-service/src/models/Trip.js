const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Trip = sequelize.define('Trip', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    traveler_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to user who created the trip'
    },
    template_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to trip template if created from template'
    },
    title: {
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
    trip_type: {
      type: DataTypes.ENUM('flight', 'train', 'bus', 'car', 'ship', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    status: {
      type: DataTypes.ENUM('upcoming', 'active', 'completed', 'cancelled', 'delayed'),
      allowNull: false,
      defaultValue: 'upcoming'
    },
    
    // Origin information
    origin_address: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    origin_coordinates: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: true
    },
    origin_airport: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    origin_terminal: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    origin_details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Destination information
    destination_address: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    destination_coordinates: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: true
    },
    destination_airport: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    destination_terminal: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    destination_details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Timing information
    departure_time: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        isAfter: new Date().toISOString()
      }
    },
    arrival_time: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        isAfterDeparture(value) {
          if (value <= this.departure_time) {
            throw new Error('Arrival time must be after departure time');
          }
        }
      }
    },
    estimated_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in minutes'
    },
    actual_departure_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    actual_arrival_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Capacity information
    weight_capacity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 50
      },
      comment: 'Weight capacity in kg'
    },
    volume_capacity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 200
      },
      comment: 'Volume capacity in liters'
    },
    item_capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 50
      },
      comment: 'Maximum number of items'
    },
    available_weight: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Currently available weight capacity in kg'
    },
    available_volume: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Currently available volume capacity in liters'
    },
    available_items: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Currently available item slots'
    },
    
    // Pricing information
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Base price for delivery'
    },
    price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.00,
      validate: {
        min: 0
      },
      comment: 'Additional price per kg'
    },
    price_per_km: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.00,
      validate: {
        min: 0
      },
      comment: 'Additional price per km'
    },
    express_multiplier: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 1.0,
      validate: {
        min: 1.0,
        max: 5.0
      },
      comment: 'Multiplier for express deliveries'
    },
    fragile_multiplier: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 1.0,
      validate: {
        min: 1.0,
        max: 3.0
      },
      comment: 'Multiplier for fragile items'
    },
    
    // Restrictions and preferences (JSON fields)
    restrictions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Item restrictions (no_fragile, no_liquids, etc.)'
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Traveler preferences (meeting_preference, communication, etc.)'
    },
    
    // Recurring trip information
    is_recurring: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    recurring_pattern: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Recurring pattern configuration'
    },
    parent_trip_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to parent trip for recurring trips'
    },
    
    // Visibility and automation
    visibility: {
      type: DataTypes.ENUM('public', 'private', 'friends_only'),
      allowNull: false,
      defaultValue: 'public'
    },
    auto_accept: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    auto_accept_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Maximum price for auto-accept'
    },
    
    // Additional metadata
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Total trip distance in km'
    },
    route_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Cached route information'
    },
    
    // Cancellation information
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true
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
    tableName: 'trips',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      // Basic indexes
      { fields: ['traveler_id'] },
      { fields: ['status'] },
      { fields: ['departure_time'] },
      { fields: ['trip_type'] },
      { fields: ['visibility'] },
      { fields: ['is_recurring'] },
      { fields: ['parent_trip_id'] },
      { fields: ['template_id'] },
      
      // Geospatial indexes
      { fields: ['origin_coordinates'], using: 'gist' },
      { fields: ['destination_coordinates'], using: 'gist' },
      
      // Composite indexes for common queries
      { fields: ['status', 'departure_time'] },
      { fields: ['traveler_id', 'status'] },
      { fields: ['status', 'visibility'] },
      { fields: ['trip_type', 'status'] },
      
      // Search optimization indexes
      {
        fields: ['status', 'departure_time', 'origin_coordinates', 'destination_coordinates'],
        where: {
          status: ['upcoming', 'active']
        }
      },
      
      // Capacity search indexes
      { fields: ['available_weight', 'available_volume', 'available_items'] },
      
      // Performance indexes
      { fields: ['created_at'] },
      { fields: ['updated_at'] }
    ],
    hooks: {
      beforeCreate: (trip) => {
        // Set available capacity equal to total capacity for new trips
        trip.available_weight = trip.weight_capacity;
        trip.available_volume = trip.volume_capacity;
        trip.available_items = trip.item_capacity;
        
        // Calculate estimated duration if not provided
        if (!trip.estimated_duration && trip.departure_time && trip.arrival_time) {
          const duration = new Date(trip.arrival_time) - new Date(trip.departure_time);
          trip.estimated_duration = Math.round(duration / (1000 * 60)); // Convert to minutes
        }
      },
      
      beforeUpdate: (trip) => {
        // Validate capacity constraints
        if (trip.changed('available_weight') && trip.available_weight > trip.weight_capacity) {
          throw new Error('Available weight cannot exceed total weight capacity');
        }
        if (trip.changed('available_volume') && trip.available_volume > trip.volume_capacity) {
          throw new Error('Available volume cannot exceed total volume capacity');
        }
        if (trip.changed('available_items') && trip.available_items > trip.item_capacity) {
          throw new Error('Available items cannot exceed total item capacity');
        }
      }
    }
  });

  // Instance methods
  Trip.prototype.calculateDistance = function() {
    if (this.origin_coordinates && this.destination_coordinates) {
      const { getDistance } = require('geolib');
      const distance = getDistance(
        {
          latitude: this.origin_coordinates.coordinates[1],
          longitude: this.origin_coordinates.coordinates[0]
        },
        {
          latitude: this.destination_coordinates.coordinates[1],
          longitude: this.destination_coordinates.coordinates[0]
        }
      );
      return distance / 1000; // Convert to kilometers
    }
    return null;
  };

  Trip.prototype.getAvailableCapacityPercentage = function() {
    return {
      weight: (this.available_weight / this.weight_capacity) * 100,
      volume: (this.available_volume / this.volume_capacity) * 100,
      items: (this.available_items / this.item_capacity) * 100
    };
  };

  Trip.prototype.isCapacityAvailable = function(requiredCapacity) {
    return (
      this.available_weight >= requiredCapacity.weight &&
      this.available_volume >= requiredCapacity.volume &&
      this.available_items >= requiredCapacity.items
    );
  };

  Trip.prototype.getDurationInMinutes = function() {
    if (this.departure_time && this.arrival_time) {
      const duration = new Date(this.arrival_time) - new Date(this.departure_time);
      return Math.round(duration / (1000 * 60));
    }
    return this.estimated_duration || 0;
  };

  Trip.prototype.isUpcoming = function() {
    return this.status === 'upcoming' && new Date(this.departure_time) > new Date();
  };

  Trip.prototype.isActive = function() {
    return this.status === 'active' || (
      this.status === 'upcoming' &&
      new Date() >= new Date(this.departure_time) &&
      new Date() <= new Date(this.arrival_time)
    );
  };

  Trip.prototype.isCompleted = function() {
    return this.status === 'completed' || (
      this.status === 'active' &&
      new Date() > new Date(this.arrival_time)
    );
  };

  Trip.prototype.canAcceptDelivery = function() {
    return (
      this.status === 'upcoming' &&
      this.visibility === 'public' &&
      (this.available_weight > 0 || this.available_volume > 0 || this.available_items > 0)
    );
  };

  Trip.prototype.toPublicJSON = function() {
    const trip = this.toJSON();
    
    // Remove sensitive information
    delete trip.auto_accept_price;
    delete trip.deleted_at;
    
    // Add computed fields
    trip.duration_minutes = this.getDurationInMinutes();
    trip.capacity_utilization = this.getAvailableCapacityPercentage();
    trip.can_accept_delivery = this.canAcceptDelivery();
    
    if (this.origin_coordinates && this.destination_coordinates) {
      trip.distance_km = this.calculateDistance();
    }
    
    return trip;
  };

  // Class methods
  Trip.findByTraveler = function(travelerId, options = {}) {
    return this.findAll({
      where: { traveler_id: travelerId },
      order: [['departure_time', 'DESC']],
      ...options
    });
  };

  Trip.findUpcoming = function(options = {}) {
    return this.findAll({
      where: {
        status: 'upcoming',
        departure_time: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      order: [['departure_time', 'ASC']],
      ...options
    });
  };

  Trip.findPublicTrips = function(options = {}) {
    return this.findAll({
      where: {
        visibility: 'public',
        status: 'upcoming'
      },
      order: [['departure_time', 'ASC']],
      ...options
    });
  };

  Trip.searchByLocation = function(origin, destination, radius = 50, options = {}) {
    const { Op } = sequelize.Sequelize;
    
    return this.findAll({
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.fn(
              'ST_DWithin',
              sequelize.col('origin_coordinates'),
              sequelize.fn('ST_GeomFromText', `POINT(${origin.lng} ${origin.lat})`, 4326),
              radius * 1000 // Convert km to meters
            ),
            true
          ),
          sequelize.where(
            sequelize.fn(
              'ST_DWithin',
              sequelize.col('destination_coordinates'),
              sequelize.fn('ST_GeomFromText', `POINT(${destination.lng} ${destination.lat})`, 4326),
              radius * 1000
            ),
            true
          )
        ],
        status: 'upcoming',
        visibility: 'public'
      },
      order: [['departure_time', 'ASC']],
      ...options
    });
  };

  return Trip;
};