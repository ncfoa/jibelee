const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeliveryOffer = sequelize.define('DeliveryOffer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  deliveryRequestId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'delivery_request_id',
    references: {
      model: 'delivery_requests',
      key: 'id'
    }
  },
  travelerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'traveler_id'
  },
  tripId: {
    type: DataTypes.UUID,
    field: 'trip_id'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT
  },
  estimatedPickupTime: {
    type: DataTypes.DATE,
    field: 'estimated_pickup_time'
  },
  estimatedDeliveryTime: {
    type: DataTypes.DATE,
    field: 'estimated_delivery_time'
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined', 'expired', 'withdrawn'),
    allowNull: false,
    defaultValue: 'pending'
  },
  
  // Guarantees and services
  guarantees: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  specialServices: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'special_services'
  },
  
  validUntil: {
    type: DataTypes.DATE,
    field: 'valid_until'
  },
  acceptedAt: {
    type: DataTypes.DATE,
    field: 'accepted_at'
  },
  declinedAt: {
    type: DataTypes.DATE,
    field: 'declined_at'
  },
  declinedReason: {
    type: DataTypes.TEXT,
    field: 'declined_reason'
  }
}, {
  tableName: 'delivery_offers',
  timestamps: true,
  paranoid: false,
  indexes: [
    {
      fields: ['delivery_request_id', 'status']
    },
    {
      fields: ['traveler_id', 'status', 'created_at']
    },
    {
      fields: ['trip_id']
    },
    {
      fields: ['valid_until']
    },
    {
      fields: ['price']
    }
  ]
});

// Instance methods
DeliveryOffer.prototype.isExpired = function() {
  return this.validUntil && new Date() > this.validUntil;
};

DeliveryOffer.prototype.isValid = function() {
  return this.status === 'pending' && !this.isExpired();
};

DeliveryOffer.prototype.canBeAccepted = function() {
  return this.status === 'pending' && !this.isExpired();
};

DeliveryOffer.prototype.canBeWithdrawn = function() {
  return this.status === 'pending';
};

DeliveryOffer.prototype.accept = async function(transaction = null) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  return await this.save({ transaction });
};

DeliveryOffer.prototype.decline = async function(reason = null, transaction = null) {
  this.status = 'declined';
  this.declinedAt = new Date();
  if (reason) {
    this.declinedReason = reason;
  }
  return await this.save({ transaction });
};

DeliveryOffer.prototype.withdraw = async function(transaction = null) {
  this.status = 'withdrawn';
  return await this.save({ transaction });
};

// Class methods
DeliveryOffer.findByRequest = function(deliveryRequestId, options = {}) {
  return this.findAll({
    where: {
      delivery_request_id: deliveryRequestId,
      ...options.where
    },
    order: [['price', 'ASC'], ['created_at', 'ASC']],
    ...options
  });
};

DeliveryOffer.findByTraveler = function(travelerId, options = {}) {
  return this.findAll({
    where: {
      traveler_id: travelerId,
      ...options.where
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

DeliveryOffer.findPendingOffers = function(options = {}) {
  return this.findAll({
    where: {
      status: 'pending',
      [sequelize.Sequelize.Op.or]: [
        { valid_until: null },
        { valid_until: { [sequelize.Sequelize.Op.gt]: new Date() } }
      ],
      ...options.where
    },
    ...options
  });
};

DeliveryOffer.findExpiredOffers = function() {
  return this.findAll({
    where: {
      status: 'pending',
      valid_until: {
        [sequelize.Sequelize.Op.lt]: new Date()
      }
    }
  });
};

DeliveryOffer.declineOtherOffers = async function(deliveryRequestId, acceptedOfferId, transaction = null) {
  return await this.update(
    {
      status: 'declined',
      declined_at: new Date(),
      declined_reason: 'Another offer was accepted'
    },
    {
      where: {
        delivery_request_id: deliveryRequestId,
        id: { [sequelize.Sequelize.Op.ne]: acceptedOfferId },
        status: 'pending'
      },
      transaction
    }
  );
};

DeliveryOffer.getOfferStatistics = async function(deliveryRequestId) {
  const offers = await this.findAll({
    where: { delivery_request_id: deliveryRequestId },
    attributes: [
      'status',
      [sequelize.fn('COUNT', '*'), 'count'],
      [sequelize.fn('AVG', sequelize.col('price')), 'averagePrice'],
      [sequelize.fn('MIN', sequelize.col('price')), 'minPrice'],
      [sequelize.fn('MAX', sequelize.col('price')), 'maxPrice']
    ],
    group: ['status'],
    raw: true
  });

  const stats = {
    total: 0,
    pending: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
    withdrawn: 0,
    averagePrice: 0,
    minPrice: null,
    maxPrice: null
  };

  offers.forEach(offer => {
    stats[offer.status] = parseInt(offer.count);
    stats.total += parseInt(offer.count);
    
    if (offer.averagePrice) {
      stats.averagePrice = parseFloat(offer.averagePrice);
    }
    if (offer.minPrice) {
      stats.minPrice = parseFloat(offer.minPrice);
    }
    if (offer.maxPrice) {
      stats.maxPrice = parseFloat(offer.maxPrice);
    }
  });

  return stats;
};

module.exports = DeliveryOffer;