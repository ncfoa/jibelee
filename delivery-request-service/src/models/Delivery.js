const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Delivery = sequelize.define('Delivery', {
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
  offerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'offer_id',
    references: {
      model: 'delivery_offers',
      key: 'id'
    }
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'customer_id'
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
  
  deliveryNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    field: 'delivery_number'
  },
  status: {
    type: DataTypes.ENUM('accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivery_scheduled', 'delivered', 'cancelled', 'disputed'),
    allowNull: false,
    defaultValue: 'accepted'
  },
  
  // Final agreed terms
  finalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'final_price'
  },
  specialRequests: {
    type: DataTypes.TEXT,
    field: 'special_requests'
  },
  
  // Timeline tracking
  acceptedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'accepted_at'
  },
  pickupScheduledAt: {
    type: DataTypes.DATE,
    field: 'pickup_scheduled_at'
  },
  pickupCompletedAt: {
    type: DataTypes.DATE,
    field: 'pickup_completed_at'
  },
  inTransitAt: {
    type: DataTypes.DATE,
    field: 'in_transit_at'
  },
  deliveryScheduledAt: {
    type: DataTypes.DATE,
    field: 'delivery_scheduled_at'
  },
  deliveryCompletedAt: {
    type: DataTypes.DATE,
    field: 'delivery_completed_at'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    field: 'cancelled_at'
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    field: 'cancellation_reason'
  },
  cancelledBy: {
    type: DataTypes.UUID,
    field: 'cancelled_by'
  },
  
  // Completion details
  pickupVerification: {
    type: DataTypes.JSONB,
    field: 'pickup_verification'
  },
  deliveryVerification: {
    type: DataTypes.JSONB,
    field: 'delivery_verification'
  },
  recipientSignatureUrl: {
    type: DataTypes.STRING(500),
    field: 'recipient_signature_url'
  },
  deliveryPhotoUrl: {
    type: DataTypes.STRING(500),
    field: 'delivery_photo_url'
  },
  deliveryNotes: {
    type: DataTypes.TEXT,
    field: 'delivery_notes'
  }
}, {
  tableName: 'deliveries',
  timestamps: true,
  paranoid: false,
  indexes: [
    {
      fields: ['delivery_number'],
      unique: true
    },
    {
      fields: ['customer_id', 'status']
    },
    {
      fields: ['traveler_id', 'status']
    },
    {
      fields: ['trip_id']
    },
    {
      fields: ['status', 'updated_at']
    },
    {
      fields: ['delivery_request_id']
    },
    {
      fields: ['offer_id']
    }
  ]
});

// Instance methods
Delivery.prototype.isActive = function() {
  return ['accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivery_scheduled'].includes(this.status);
};

Delivery.prototype.isCompleted = function() {
  return this.status === 'delivered';
};

Delivery.prototype.isCancelled = function() {
  return this.status === 'cancelled';
};

Delivery.prototype.canBePickedUp = function() {
  return this.status === 'accepted' || this.status === 'pickup_scheduled';
};

Delivery.prototype.canBeDelivered = function() {
  return this.status === 'in_transit' || this.status === 'delivery_scheduled';
};

Delivery.prototype.canBeCancelled = function() {
  return this.isActive() && this.status !== 'in_transit';
};

Delivery.prototype.updateStatus = async function(newStatus, details = {}, transaction = null) {
  const now = new Date();
  const updates = { status: newStatus };
  
  // Set appropriate timestamp based on status
  switch (newStatus) {
    case 'pickup_scheduled':
      updates.pickupScheduledAt = now;
      break;
    case 'picked_up':
      updates.pickupCompletedAt = now;
      updates.inTransitAt = now;
      if (details.pickupVerification) {
        updates.pickupVerification = details.pickupVerification;
      }
      break;
    case 'in_transit':
      if (!this.inTransitAt) {
        updates.inTransitAt = now;
      }
      break;
    case 'delivery_scheduled':
      updates.deliveryScheduledAt = now;
      break;
    case 'delivered':
      updates.deliveryCompletedAt = now;
      if (details.deliveryVerification) {
        updates.deliveryVerification = details.deliveryVerification;
      }
      if (details.recipientSignatureUrl) {
        updates.recipientSignatureUrl = details.recipientSignatureUrl;
      }
      if (details.deliveryPhotoUrl) {
        updates.deliveryPhotoUrl = details.deliveryPhotoUrl;
      }
      if (details.deliveryNotes) {
        updates.deliveryNotes = details.deliveryNotes;
      }
      break;
    case 'cancelled':
      updates.cancelledAt = now;
      if (details.cancellationReason) {
        updates.cancellationReason = details.cancellationReason;
      }
      if (details.cancelledBy) {
        updates.cancelledBy = details.cancelledBy;
      }
      break;
  }
  
  Object.assign(this, updates);
  return await this.save({ transaction });
};

Delivery.prototype.getDuration = function() {
  if (!this.acceptedAt || !this.deliveryCompletedAt) {
    return null;
  }
  
  return Math.floor((this.deliveryCompletedAt - this.acceptedAt) / (1000 * 60 * 60)); // Hours
};

Delivery.prototype.getTimeline = function() {
  const timeline = [];
  
  if (this.acceptedAt) {
    timeline.push({
      event: 'accepted',
      timestamp: this.acceptedAt,
      description: 'Delivery accepted'
    });
  }
  
  if (this.pickupScheduledAt) {
    timeline.push({
      event: 'pickup_scheduled',
      timestamp: this.pickupScheduledAt,
      description: 'Pickup scheduled'
    });
  }
  
  if (this.pickupCompletedAt) {
    timeline.push({
      event: 'picked_up',
      timestamp: this.pickupCompletedAt,
      description: 'Item picked up'
    });
  }
  
  if (this.inTransitAt) {
    timeline.push({
      event: 'in_transit',
      timestamp: this.inTransitAt,
      description: 'In transit'
    });
  }
  
  if (this.deliveryScheduledAt) {
    timeline.push({
      event: 'delivery_scheduled',
      timestamp: this.deliveryScheduledAt,
      description: 'Delivery scheduled'
    });
  }
  
  if (this.deliveryCompletedAt) {
    timeline.push({
      event: 'delivered',
      timestamp: this.deliveryCompletedAt,
      description: 'Delivered successfully'
    });
  }
  
  if (this.cancelledAt) {
    timeline.push({
      event: 'cancelled',
      timestamp: this.cancelledAt,
      description: `Cancelled: ${this.cancellationReason || 'No reason provided'}`
    });
  }
  
  return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

// Class methods
Delivery.findActiveDeliveries = function(options = {}) {
  return this.findAll({
    where: {
      status: ['accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 'delivery_scheduled'],
      ...options.where
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

Delivery.findByCustomer = function(customerId, options = {}) {
  return this.findAll({
    where: {
      customer_id: customerId,
      ...options.where
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

Delivery.findByTraveler = function(travelerId, options = {}) {
  return this.findAll({
    where: {
      traveler_id: travelerId,
      ...options.where
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

Delivery.findByTrip = function(tripId, options = {}) {
  return this.findAll({
    where: {
      trip_id: tripId,
      ...options.where
    },
    order: [['created_at', 'ASC']],
    ...options
  });
};

Delivery.generateDeliveryNumber = async function() {
  const prefix = 'DEL';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  let deliveryNumber;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    deliveryNumber = `${prefix}-${timestamp}${random}${attempts.toString().padStart(2, '0')}`;
    const existing = await this.findOne({ where: { delivery_number: deliveryNumber } });
    if (!existing) {
      break;
    }
    attempts++;
  } while (attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    throw new Error('Unable to generate unique delivery number');
  }
  
  return deliveryNumber;
};

Delivery.getDeliveryStatistics = async function(filters = {}) {
  const where = {};
  
  if (filters.customerId) {
    where.customer_id = filters.customerId;
  }
  
  if (filters.travelerId) {
    where.traveler_id = filters.travelerId;
  }
  
  if (filters.dateFrom) {
    where.created_at = {
      [sequelize.Sequelize.Op.gte]: filters.dateFrom
    };
  }
  
  if (filters.dateTo) {
    where.created_at = {
      ...where.created_at,
      [sequelize.Sequelize.Op.lte]: filters.dateTo
    };
  }
  
  const deliveries = await this.findAll({
    where,
    attributes: [
      'status',
      [sequelize.fn('COUNT', '*'), 'count'],
      [sequelize.fn('AVG', sequelize.col('final_price')), 'averagePrice'],
      [sequelize.fn('SUM', sequelize.col('final_price')), 'totalValue']
    ],
    group: ['status'],
    raw: true
  });
  
  const stats = {
    total: 0,
    accepted: 0,
    picked_up: 0,
    in_transit: 0,
    delivered: 0,
    cancelled: 0,
    disputed: 0,
    averagePrice: 0,
    totalValue: 0,
    completionRate: 0
  };
  
  deliveries.forEach(delivery => {
    const status = delivery.status;
    const count = parseInt(delivery.count);
    
    stats[status] = count;
    stats.total += count;
    
    if (delivery.averagePrice) {
      stats.averagePrice = parseFloat(delivery.averagePrice);
    }
    
    if (delivery.totalValue) {
      stats.totalValue += parseFloat(delivery.totalValue);
    }
  });
  
  if (stats.total > 0) {
    stats.completionRate = ((stats.delivered / stats.total) * 100).toFixed(2);
  }
  
  return stats;
};

module.exports = Delivery;