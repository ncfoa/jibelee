const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeliveryRequest = sequelize.define('DeliveryRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'customer_id'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.ENUM('documents', 'electronics', 'clothing', 'food', 'fragile', 'books', 'gifts', 'other'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'matched', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired'),
    allowNull: false,
    defaultValue: 'pending'
  },
  urgency: {
    type: DataTypes.ENUM('standard', 'express', 'urgent'),
    allowNull: false,
    defaultValue: 'standard'
  },
  
  // Item details
  itemName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'item_name'
  },
  itemDescription: {
    type: DataTypes.TEXT,
    field: 'item_description'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  weight: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false
  },
  dimensions: {
    type: DataTypes.JSONB
  },
  value: {
    type: DataTypes.DECIMAL(12, 2)
  },
  isFragile: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_fragile'
  },
  isPerishable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_perishable'
  },
  isHazardous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_hazardous'
  },
  requiresSignature: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'requires_signature'
  },
  itemImages: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    field: 'item_images'
  },

  // Pickup location
  pickupAddress: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'pickup_address'
  },
  pickupCoordinates: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    field: 'pickup_coordinates'
  },
  pickupContactName: {
    type: DataTypes.STRING(255),
    field: 'pickup_contact_name'
  },
  pickupContactPhone: {
    type: DataTypes.STRING(20),
    field: 'pickup_contact_phone'
  },
  pickupInstructions: {
    type: DataTypes.TEXT,
    field: 'pickup_instructions'
  },
  pickupTimeStart: {
    type: DataTypes.DATE,
    field: 'pickup_time_start'
  },
  pickupTimeEnd: {
    type: DataTypes.DATE,
    field: 'pickup_time_end'
  },
  flexiblePickupTiming: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'flexible_pickup_timing'
  },
  preferredPickupDays: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    field: 'preferred_pickup_days'
  },

  // Delivery location
  deliveryAddress: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'delivery_address'
  },
  deliveryCoordinates: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    field: 'delivery_coordinates'
  },
  deliveryContactName: {
    type: DataTypes.STRING(255),
    field: 'delivery_contact_name'
  },
  deliveryContactPhone: {
    type: DataTypes.STRING(20),
    field: 'delivery_contact_phone'
  },
  deliveryInstructions: {
    type: DataTypes.TEXT,
    field: 'delivery_instructions'
  },
  deliveryTimeStart: {
    type: DataTypes.DATE,
    field: 'delivery_time_start'
  },
  deliveryTimeEnd: {
    type: DataTypes.DATE,
    field: 'delivery_time_end'
  },
  requiresRecipientPresence: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'requires_recipient_presence'
  },

  // Pricing
  maxPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'max_price'
  },
  autoAcceptPrice: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'auto_accept_price'
  },
  estimatedPrice: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'estimated_price'
  },

  // Preferences and restrictions
  preferredTravelers: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    field: 'preferred_travelers'
  },
  blacklistedTravelers: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    field: 'blacklisted_travelers'
  },
  minTravelerRating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.00,
    field: 'min_traveler_rating'
  },
  verificationRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'verification_required'
  },
  insuranceRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'insurance_required'
  },
  backgroundCheckRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'background_check_required'
  },

  // Notifications and metadata
  notificationPreferences: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'notification_preferences'
  },
  specialInstructions: {
    type: DataTypes.TEXT,
    field: 'special_instructions'
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.TEXT)
  },

  expiresAt: {
    type: DataTypes.DATE,
    field: 'expires_at'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    field: 'cancelled_at'
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    field: 'cancellation_reason'
  }
}, {
  tableName: 'delivery_requests',
  timestamps: true,
  paranoid: false,
  indexes: [
    {
      fields: ['customer_id']
    },
    {
      fields: ['status', 'created_at']
    },
    {
      fields: ['category', 'urgency']
    },
    {
      fields: ['pickup_coordinates'],
      using: 'gist'
    },
    {
      fields: ['delivery_coordinates'],
      using: 'gist'
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Instance methods
DeliveryRequest.prototype.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

DeliveryRequest.prototype.canReceiveOffers = function() {
  return this.status === 'pending' && !this.isExpired();
};

DeliveryRequest.prototype.calculateDistance = function() {
  if (!this.pickupCoordinates || !this.deliveryCoordinates) {
    return null;
  }
  
  const geolib = require('geolib');
  return geolib.getDistance(
    {
      latitude: this.pickupCoordinates.coordinates[1],
      longitude: this.pickupCoordinates.coordinates[0]
    },
    {
      latitude: this.deliveryCoordinates.coordinates[1],
      longitude: this.deliveryCoordinates.coordinates[0]
    }
  ) / 1000; // Convert to kilometers
};

// Class methods
DeliveryRequest.findActiveRequests = function(options = {}) {
  return this.findAll({
    where: {
      status: ['pending', 'matched', 'accepted'],
      expires_at: {
        [sequelize.Sequelize.Op.gt]: new Date()
      },
      ...options.where
    },
    ...options
  });
};

DeliveryRequest.findByCustomer = function(customerId, options = {}) {
  return this.findAll({
    where: {
      customer_id: customerId,
      ...options.where
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

module.exports = DeliveryRequest;