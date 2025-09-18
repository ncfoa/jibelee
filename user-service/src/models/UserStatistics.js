const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserStatistics = sequelize.define('UserStatistics', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    totalTrips: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_trips',
      validate: {
        min: 0
      }
    },
    totalDeliveries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_deliveries',
      validate: {
        min: 0
      }
    },
    successfulDeliveries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'successful_deliveries',
      validate: {
        min: 0
      }
    },
    cancelledDeliveries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'cancelled_deliveries',
      validate: {
        min: 0
      }
    },
    totalEarnings: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'total_earnings',
      validate: {
        min: 0
      }
    },
    totalSpent: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'total_spent',
      validate: {
        min: 0
      }
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
    totalRatings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_ratings',
      validate: {
        min: 0
      }
    },
    ratingBreakdown: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'rating_breakdown',
      defaultValue: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0
      }
    },
    responseTimeMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'response_time_minutes',
      validate: {
        min: 0
      }
    },
    completionRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'completion_rate',
      validate: {
        min: 0,
        max: 100
      }
    },
    onTimeRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'on_time_rate',
      validate: {
        min: 0,
        max: 100
      }
    },
    repeatCustomers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'repeat_customers',
      validate: {
        min: 0
      }
    },
    distanceTraveled: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'distance_traveled',
      validate: {
        min: 0
      }
    },
    itemsDelivered: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'items_delivered',
      validate: {
        min: 0
      }
    },
    weightDelivered: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'weight_delivered',
      validate: {
        min: 0
      }
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_active_at'
    },
    // Performance metrics
    averagePickupTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'average_pickup_time',
      comment: 'Average time to pickup in minutes'
    },
    averageDeliveryTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'average_delivery_time',
      comment: 'Average delivery duration in minutes'
    },
    // Monthly/yearly breakdowns
    monthlyStats: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'monthly_stats',
      defaultValue: {},
      comment: 'Monthly statistics breakdown'
    },
    yearlyStats: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'yearly_stats',
      defaultValue: {},
      comment: 'Yearly statistics breakdown'
    }
  }, {
    tableName: 'user_statistics',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      },
      {
        fields: ['average_rating']
      },
      {
        fields: ['total_deliveries']
      },
      {
        fields: ['completion_rate']
      },
      {
        fields: ['last_active_at']
      }
    ]
  });

  // Instance methods
  UserStatistics.prototype.updateRating = function(newRating) {
    // Update rating breakdown
    const breakdown = { ...this.ratingBreakdown };
    breakdown[newRating] = (breakdown[newRating] || 0) + 1;
    this.ratingBreakdown = breakdown;

    // Update total ratings
    this.totalRatings += 1;

    // Recalculate average rating
    let totalPoints = 0;
    let totalRatings = 0;
    
    for (let rating = 1; rating <= 5; rating++) {
      const count = breakdown[rating] || 0;
      totalPoints += rating * count;
      totalRatings += count;
    }
    
    this.averageRating = totalRatings > 0 ? (totalPoints / totalRatings) : 0;
    
    return this;
  };

  UserStatistics.prototype.updateCompletionRate = function() {
    const total = this.totalDeliveries;
    if (total === 0) {
      this.completionRate = 0;
    } else {
      this.completionRate = (this.successfulDeliveries / total) * 100;
    }
    return this;
  };

  UserStatistics.prototype.addDelivery = function(deliveryData) {
    this.totalDeliveries += 1;
    
    if (deliveryData.status === 'completed') {
      this.successfulDeliveries += 1;
      
      if (deliveryData.earnings) {
        this.totalEarnings = parseFloat(this.totalEarnings) + parseFloat(deliveryData.earnings);
      }
      
      if (deliveryData.distance) {
        this.distanceTraveled = parseFloat(this.distanceTraveled) + parseFloat(deliveryData.distance);
      }
      
      if (deliveryData.itemCount) {
        this.itemsDelivered += deliveryData.itemCount;
      }
      
      if (deliveryData.weight) {
        this.weightDelivered = parseFloat(this.weightDelivered) + parseFloat(deliveryData.weight);
      }
    } else if (deliveryData.status === 'cancelled') {
      this.cancelledDeliveries += 1;
    }
    
    this.updateCompletionRate();
    this.updateMonthlyStats(deliveryData);
    
    return this;
  };

  UserStatistics.prototype.addSpending = function(amount) {
    this.totalSpent = parseFloat(this.totalSpent) + parseFloat(amount);
    return this;
  };

  UserStatistics.prototype.updateResponseTime = function(responseTimeMinutes) {
    // Calculate running average
    const currentAvg = this.responseTimeMinutes;
    const totalDeliveries = this.totalDeliveries;
    
    if (totalDeliveries <= 1) {
      this.responseTimeMinutes = responseTimeMinutes;
    } else {
      this.responseTimeMinutes = Math.round(
        ((currentAvg * (totalDeliveries - 1)) + responseTimeMinutes) / totalDeliveries
      );
    }
    
    return this;
  };

  UserStatistics.prototype.updateMonthlyStats = function(deliveryData) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const monthlyStats = { ...this.monthlyStats };
    if (!monthlyStats[yearMonth]) {
      monthlyStats[yearMonth] = {
        deliveries: 0,
        earnings: 0,
        distance: 0,
        items: 0
      };
    }
    
    const monthStats = monthlyStats[yearMonth];
    monthStats.deliveries += 1;
    
    if (deliveryData.status === 'completed') {
      if (deliveryData.earnings) {
        monthStats.earnings += parseFloat(deliveryData.earnings);
      }
      if (deliveryData.distance) {
        monthStats.distance += parseFloat(deliveryData.distance);
      }
      if (deliveryData.itemCount) {
        monthStats.items += deliveryData.itemCount;
      }
    }
    
    this.monthlyStats = monthlyStats;
    
    // Update yearly stats
    this.updateYearlyStats(deliveryData);
    
    return this;
  };

  UserStatistics.prototype.updateYearlyStats = function(deliveryData) {
    const year = new Date().getFullYear().toString();
    
    const yearlyStats = { ...this.yearlyStats };
    if (!yearlyStats[year]) {
      yearlyStats[year] = {
        deliveries: 0,
        earnings: 0,
        distance: 0,
        items: 0
      };
    }
    
    const yearStats = yearlyStats[year];
    yearStats.deliveries += 1;
    
    if (deliveryData.status === 'completed') {
      if (deliveryData.earnings) {
        yearStats.earnings += parseFloat(deliveryData.earnings);
      }
      if (deliveryData.distance) {
        yearStats.distance += parseFloat(deliveryData.distance);
      }
      if (deliveryData.itemCount) {
        yearStats.items += deliveryData.itemCount;
      }
    }
    
    this.yearlyStats = yearlyStats;
    
    return this;
  };

  UserStatistics.prototype.getPerformanceScore = function() {
    // Calculate overall performance score (0-100)
    const ratingScore = (this.averageRating / 5) * 30; // 30% weight
    const completionScore = (this.completionRate / 100) * 25; // 25% weight
    const onTimeScore = (this.onTimeRate / 100) * 20; // 20% weight
    const experienceScore = Math.min(this.totalDeliveries / 100, 1) * 15; // 15% weight
    const responseScore = this.responseTimeMinutes > 0 ? 
      Math.max(0, (1 - (this.responseTimeMinutes / 1440))) * 10 : 0; // 10% weight
    
    return Math.round(ratingScore + completionScore + onTimeScore + experienceScore + responseScore);
  };

  UserStatistics.prototype.getMonthlyStats = function(year, month) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    return this.monthlyStats[yearMonth] || {
      deliveries: 0,
      earnings: 0,
      distance: 0,
      items: 0
    };
  };

  UserStatistics.prototype.getYearlyStats = function(year) {
    return this.yearlyStats[year.toString()] || {
      deliveries: 0,
      earnings: 0,
      distance: 0,
      items: 0
    };
  };

  UserStatistics.prototype.getTrends = function(months = 6) {
    const trends = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      trends.push({
        month: monthName,
        yearMonth: yearMonth,
        stats: this.monthlyStats[yearMonth] || { deliveries: 0, earnings: 0, distance: 0, items: 0 }
      });
    }
    
    return trends;
  };

  // Class methods
  UserStatistics.createDefault = function(userId) {
    return this.create({ userId });
  };

  UserStatistics.findByUserId = function(userId) {
    return this.findOne({ where: { userId } });
  };

  UserStatistics.getTopPerformers = function(limit = 10, metric = 'averageRating') {
    const orderField = metric === 'averageRating' ? 'average_rating' : 
                      metric === 'totalDeliveries' ? 'total_deliveries' :
                      metric === 'completionRate' ? 'completion_rate' : 'average_rating';
    
    return this.findAll({
      limit,
      order: [[orderField, 'DESC']],
      include: [{
        model: sequelize.models.User,
        as: 'User',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });
  };

  // Associations
  UserStatistics.associate = function(models) {
    UserStatistics.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
  };

  return UserStatistics;
};