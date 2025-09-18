const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserFavorite = sequelize.define('UserFavorite', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'customer_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    travelerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'traveler_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'added_at'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 5
      },
      comment: '1 = highest priority, 5 = lowest priority'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    // Interaction statistics
    totalDeliveries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_deliveries'
    },
    successfulDeliveries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'successful_deliveries'
    },
    totalSpent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'total_spent'
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'average_rating',
      validate: {
        min: 0,
        max: 5
      }
    },
    lastDeliveryAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_delivery_at'
    },
    // Notification preferences for this favorite
    notifyOnNewTrip: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'notify_on_new_trip'
    },
    notifyOnPriceChange: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'notify_on_price_change'
    },
    maxNotificationDistance: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'max_notification_distance',
      comment: 'Maximum distance in km to receive notifications'
    }
  }, {
    tableName: 'user_favorites',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['customer_id']
      },
      {
        fields: ['traveler_id']
      },
      {
        fields: ['customer_id', 'traveler_id'],
        unique: true
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['added_at']
      },
      {
        fields: ['last_delivery_at']
      }
    ],
    validate: {
      // Prevent users from favoriting themselves
      cannotFavoriteSelf() {
        if (this.customerId === this.travelerId) {
          throw new Error('Users cannot favorite themselves');
        }
      }
    }
  });

  // Instance methods
  UserFavorite.prototype.updateDeliveryStats = function(deliveryData) {
    this.totalDeliveries += 1;
    
    if (deliveryData.status === 'completed') {
      this.successfulDeliveries += 1;
      this.lastDeliveryAt = new Date();
      
      if (deliveryData.amount) {
        this.totalSpent = parseFloat(this.totalSpent) + parseFloat(deliveryData.amount);
      }
      
      if (deliveryData.rating) {
        // Update running average rating
        const totalRatings = this.successfulDeliveries;
        const currentTotal = parseFloat(this.averageRating) * (totalRatings - 1);
        this.averageRating = (currentTotal + deliveryData.rating) / totalRatings;
      }
    }
    
    return this;
  };

  UserFavorite.prototype.getSuccessRate = function() {
    if (this.totalDeliveries === 0) return 0;
    return (this.successfulDeliveries / this.totalDeliveries) * 100;
  };

  UserFavorite.prototype.getRelationshipDuration = function() {
    return Math.floor((new Date() - this.addedAt) / (1000 * 60 * 60 * 24)); // days
  };

  UserFavorite.prototype.shouldNotify = function(tripData) {
    if (!this.isActive || !this.notifyOnNewTrip) return false;
    
    // Check distance restriction if set
    if (this.maxNotificationDistance && tripData.distance > this.maxNotificationDistance) {
      return false;
    }
    
    return true;
  };

  UserFavorite.prototype.deactivate = function(reason = null) {
    this.isActive = false;
    if (reason) {
      this.notes = (this.notes || '') + `\nDeactivated: ${reason}`;
    }
    return this;
  };

  UserFavorite.prototype.reactivate = function() {
    this.isActive = true;
    return this;
  };

  UserFavorite.prototype.updatePriority = function(newPriority) {
    this.priority = Math.max(1, Math.min(5, newPriority));
    return this;
  };

  // Class methods
  UserFavorite.findByCustomerId = function(customerId, activeOnly = true) {
    const where = { customerId };
    if (activeOnly) {
      where.isActive = true;
    }

    return this.findAll({
      where,
      order: [['priority', 'ASC'], ['addedAt', 'DESC']],
      include: [{
        model: sequelize.models.User,
        as: 'Traveler',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl', 'averageRating', 'totalDeliveries']
      }]
    });
  };

  UserFavorite.findByTravelerId = function(travelerId, activeOnly = true) {
    const where = { travelerId };
    if (activeOnly) {
      where.isActive = true;
    }

    return this.findAll({
      where,
      order: [['addedAt', 'DESC']],
      include: [{
        model: sequelize.models.User,
        as: 'Customer',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });
  };

  UserFavorite.isFavorite = async function(customerId, travelerId) {
    const favorite = await this.findOne({
      where: {
        customerId,
        travelerId,
        isActive: true
      }
    });
    
    return !!favorite;
  };

  UserFavorite.addFavorite = async function(customerId, travelerId, options = {}) {
    const { notes = null, priority = 1, notificationSettings = {} } = options;
    
    // Check if favorite already exists
    const existingFavorite = await this.findOne({
      where: { customerId, travelerId }
    });

    if (existingFavorite) {
      if (existingFavorite.isActive) {
        throw new Error('Traveler is already in favorites');
      } else {
        // Reactivate existing favorite
        existingFavorite.reactivate();
        if (notes) existingFavorite.notes = notes;
        existingFavorite.priority = priority;
        
        // Update notification settings
        if (notificationSettings.notifyOnNewTrip !== undefined) {
          existingFavorite.notifyOnNewTrip = notificationSettings.notifyOnNewTrip;
        }
        if (notificationSettings.notifyOnPriceChange !== undefined) {
          existingFavorite.notifyOnPriceChange = notificationSettings.notifyOnPriceChange;
        }
        if (notificationSettings.maxNotificationDistance !== undefined) {
          existingFavorite.maxNotificationDistance = notificationSettings.maxNotificationDistance;
        }
        
        await existingFavorite.save();
        return existingFavorite;
      }
    }

    // Create new favorite
    return this.create({
      customerId,
      travelerId,
      notes,
      priority,
      notifyOnNewTrip: notificationSettings.notifyOnNewTrip !== undefined ? 
        notificationSettings.notifyOnNewTrip : true,
      notifyOnPriceChange: notificationSettings.notifyOnPriceChange !== undefined ? 
        notificationSettings.notifyOnPriceChange : false,
      maxNotificationDistance: notificationSettings.maxNotificationDistance || null
    });
  };

  UserFavorite.removeFavorite = async function(customerId, travelerId) {
    const favorite = await this.findOne({
      where: {
        customerId,
        travelerId,
        isActive: true
      }
    });

    if (!favorite) {
      throw new Error('Favorite relationship not found');
    }

    favorite.deactivate('Removed by user');
    await favorite.save();
    return favorite;
  };

  UserFavorite.getMutualFavorites = function(userId1, userId2) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { customerId: userId1, travelerId: userId2 },
          { customerId: userId2, travelerId: userId1 }
        ],
        isActive: true
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'Customer',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: sequelize.models.User,
          as: 'Traveler',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });
  };

  UserFavorite.getTopFavorites = function(customerId, limit = 5) {
    return this.findAll({
      where: {
        customerId,
        isActive: true
      },
      order: [
        ['priority', 'ASC'],
        ['averageRating', 'DESC'],
        ['totalDeliveries', 'DESC']
      ],
      limit,
      include: [{
        model: sequelize.models.User,
        as: 'Traveler',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });
  };

  UserFavorite.getFavoriteStats = function(userId, asCustomer = true) {
    const field = asCustomer ? 'customerId' : 'travelerId';
    const where = { [field]: userId, isActive: true };

    return this.findAll({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalFavorites'],
        [sequelize.fn('SUM', sequelize.col('total_deliveries')), 'totalDeliveries'],
        [sequelize.fn('SUM', sequelize.col('successful_deliveries')), 'successfulDeliveries'],
        [sequelize.fn('SUM', sequelize.col('total_spent')), 'totalSpent'],
        [sequelize.fn('AVG', sequelize.col('average_rating')), 'averageRating']
      ],
      raw: true
    });
  };

  UserFavorite.cleanupInactiveFavorites = async function(daysOld = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.destroy({
      where: {
        isActive: false,
        updatedAt: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });

    return result;
  };

  // Associations
  UserFavorite.associate = function(models) {
    UserFavorite.belongsTo(models.User, {
      foreignKey: 'customer_id',
      as: 'Customer'
    });

    UserFavorite.belongsTo(models.User, {
      foreignKey: 'traveler_id',
      as: 'Traveler'
    });
  };

  return UserFavorite;
};