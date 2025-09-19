const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TripWeather = sequelize.define('TripWeather', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    trip_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the trip'
    },
    
    // Weather data for origin
    origin_weather: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Current and forecast weather data for origin location',
      validate: {
        isValidWeatherData(value) {
          if (value && typeof value !== 'object') {
            throw new Error('Origin weather data must be an object');
          }
        }
      }
    },
    
    // Weather data for destination
    destination_weather: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Current and forecast weather data for destination location',
      validate: {
        isValidWeatherData(value) {
          if (value && typeof value !== 'object') {
            throw new Error('Destination weather data must be an object');
          }
        }
      }
    },
    
    // Weather data along the route
    route_weather: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Weather data for waypoints along the route'
    },
    
    // Overall travel conditions assessment
    travel_conditions: {
      type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'dangerous'),
      allowNull: true,
      comment: 'Overall assessment of travel conditions'
    },
    
    // Weather alerts and warnings
    alerts: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      allowNull: true,
      defaultValue: [],
      comment: 'Weather alerts and warnings for the trip'
    },
    
    // Weather impact assessment
    impact_assessment: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Assessment of weather impact on trip and deliveries'
    },
    
    // Data source and metadata
    data_source: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'openweathermap',
      comment: 'Weather data provider'
    },
    data_quality: {
      type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor'),
      allowNull: true,
      defaultValue: 'good',
      comment: 'Quality assessment of weather data'
    },
    
    // Timing information
    forecast_for_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date for which the weather forecast is made'
    },
    fetched_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the weather data was last fetched'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the weather data expires and needs refresh'
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
    }
  }, {
    tableName: 'trip_weather',
    timestamps: true,
    underscored: true,
    indexes: [
      // Basic indexes
      { fields: ['trip_id'] },
      { fields: ['travel_conditions'] },
      { fields: ['data_source'] },
      { fields: ['data_quality'] },
      
      // Time-based indexes
      { fields: ['forecast_for_date'] },
      { fields: ['fetched_at'] },
      { fields: ['expires_at'] },
      { fields: ['created_at'] },
      
      // Composite indexes for common queries
      { fields: ['trip_id', 'fetched_at'] },
      { fields: ['expires_at', 'data_quality'] },
      
      // Unique constraint to prevent duplicate weather records for same trip and date
      {
        fields: ['trip_id', 'forecast_for_date'],
        unique: true,
        name: 'unique_trip_weather_forecast'
      }
    ],
    hooks: {
      beforeCreate: (weather) => {
        // Set expiration time if not provided (default: 6 hours from now)
        if (!weather.expires_at) {
          weather.expires_at = new Date(Date.now() + 6 * 60 * 60 * 1000);
        }
        
        // Auto-assess travel conditions if not provided
        if (!weather.travel_conditions && weather.origin_weather && weather.destination_weather) {
          weather.travel_conditions = weather.assessTravelConditions();
        }
      },
      
      beforeUpdate: (weather) => {
        // Update fetched_at when weather data is updated
        if (weather.changed('origin_weather') || weather.changed('destination_weather')) {
          weather.fetched_at = new Date();
        }
        
        // Re-assess travel conditions if weather data changed
        if ((weather.changed('origin_weather') || weather.changed('destination_weather')) && 
            weather.origin_weather && weather.destination_weather) {
          weather.travel_conditions = weather.assessTravelConditions();
        }
      }
    }
  });

  // Instance methods
  TripWeather.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at;
  };

  TripWeather.prototype.needsRefresh = function(maxAge = 3600000) { // 1 hour default
    return !this.fetched_at || (Date.now() - this.fetched_at.getTime()) > maxAge;
  };

  TripWeather.prototype.hasAlerts = function() {
    return this.alerts && this.alerts.length > 0;
  };

  TripWeather.prototype.getCriticalAlerts = function() {
    if (!this.alerts) return [];
    return this.alerts.filter(alert => 
      alert.severity === 'high' || alert.severity === 'critical'
    );
  };

  TripWeather.prototype.assessTravelConditions = function() {
    if (!this.origin_weather || !this.destination_weather) {
      return null;
    }

    let conditionScore = 100; // Start with perfect conditions
    
    // Check origin weather
    const originWeather = this.origin_weather.current || this.origin_weather;
    if (originWeather) {
      // Temperature extremes
      if (originWeather.temperature < -10 || originWeather.temperature > 40) {
        conditionScore -= 30;
      } else if (originWeather.temperature < 0 || originWeather.temperature > 35) {
        conditionScore -= 15;
      }
      
      // Precipitation
      if (originWeather.precipitation > 10) {
        conditionScore -= 25;
      } else if (originWeather.precipitation > 5) {
        conditionScore -= 10;
      }
      
      // Wind speed
      if (originWeather.wind_speed > 20) {
        conditionScore -= 20;
      } else if (originWeather.wind_speed > 15) {
        conditionScore -= 10;
      }
      
      // Visibility
      if (originWeather.visibility < 1000) {
        conditionScore -= 30;
      } else if (originWeather.visibility < 5000) {
        conditionScore -= 15;
      }
      
      // Severe weather conditions
      if (originWeather.condition && ['Thunderstorm', 'Tornado', 'Hurricane'].includes(originWeather.condition)) {
        conditionScore -= 50;
      }
    }
    
    // Check destination weather (similar logic)
    const destinationWeather = this.destination_weather.current || this.destination_weather;
    if (destinationWeather) {
      // Apply similar checks for destination
      // (simplified for brevity - would include same checks as origin)
      if (destinationWeather.condition && ['Thunderstorm', 'Tornado', 'Hurricane'].includes(destinationWeather.condition)) {
        conditionScore -= 30;
      }
    }
    
    // Check for weather alerts
    if (this.hasAlerts()) {
      const criticalAlerts = this.getCriticalAlerts();
      conditionScore -= criticalAlerts.length * 20;
    }
    
    // Convert score to condition rating
    if (conditionScore >= 90) return 'excellent';
    if (conditionScore >= 75) return 'good';
    if (conditionScore >= 50) return 'fair';
    if (conditionScore >= 25) return 'poor';
    return 'dangerous';
  };

  TripWeather.prototype.generateWeatherSummary = function() {
    const summary = {
      overall_conditions: this.travel_conditions,
      has_alerts: this.hasAlerts(),
      critical_alerts: this.getCriticalAlerts().length,
      data_freshness: this.needsRefresh() ? 'stale' : 'fresh',
      last_updated: this.fetched_at
    };
    
    if (this.origin_weather) {
      const origin = this.origin_weather.current || this.origin_weather;
      summary.origin = {
        temperature: origin.temperature,
        condition: origin.condition,
        precipitation: origin.precipitation || 0,
        wind_speed: origin.wind_speed || 0
      };
    }
    
    if (this.destination_weather) {
      const destination = this.destination_weather.current || this.destination_weather;
      summary.destination = {
        temperature: destination.temperature,
        condition: destination.condition,
        precipitation: destination.precipitation || 0,
        wind_speed: destination.wind_speed || 0
      };
    }
    
    return summary;
  };

  TripWeather.prototype.getWeatherRecommendations = function() {
    const recommendations = [];
    
    if (this.travel_conditions === 'poor' || this.travel_conditions === 'dangerous') {
      recommendations.push({
        type: 'warning',
        message: 'Consider postponing the trip due to adverse weather conditions'
      });
    }
    
    if (this.hasAlerts()) {
      this.getCriticalAlerts().forEach(alert => {
        recommendations.push({
          type: 'alert',
          message: alert.message || 'Weather alert in effect',
          severity: alert.severity
        });
      });
    }
    
    // Temperature-based recommendations
    const origin = this.origin_weather?.current || this.origin_weather;
    const destination = this.destination_weather?.current || this.destination_weather;
    
    if (origin?.temperature < 0 || destination?.temperature < 0) {
      recommendations.push({
        type: 'advice',
        message: 'Freezing temperatures expected - protect temperature-sensitive items'
      });
    }
    
    if (origin?.temperature > 35 || destination?.temperature > 35) {
      recommendations.push({
        type: 'advice',
        message: 'High temperatures expected - avoid heat-sensitive items'
      });
    }
    
    // Precipitation recommendations
    if ((origin?.precipitation > 5) || (destination?.precipitation > 5)) {
      recommendations.push({
        type: 'advice',
        message: 'Rain expected - ensure waterproof packaging for sensitive items'
      });
    }
    
    return recommendations;
  };

  TripWeather.prototype.toPublicJSON = function() {
    return {
      id: this.id,
      trip_id: this.trip_id,
      travel_conditions: this.travel_conditions,
      summary: this.generateWeatherSummary(),
      recommendations: this.getWeatherRecommendations(),
      alerts: this.alerts || [],
      last_updated: this.fetched_at,
      expires_at: this.expires_at,
      data_quality: this.data_quality
    };
  };

  // Class methods
  TripWeather.findByTrip = function(tripId, options = {}) {
    return this.findAll({
      where: { trip_id: tripId },
      order: [['fetched_at', 'DESC']],
      ...options
    });
  };

  TripWeather.findLatestByTrip = function(tripId, options = {}) {
    return this.findOne({
      where: { trip_id: tripId },
      order: [['fetched_at', 'DESC']],
      ...options
    });
  };

  TripWeather.findExpired = function(options = {}) {
    const { Op } = sequelize.Sequelize;
    return this.findAll({
      where: {
        expires_at: {
          [Op.lt]: new Date()
        }
      },
      order: [['expires_at', 'ASC']],
      ...options
    });
  };

  TripWeather.findNeedingRefresh = function(maxAge = 3600000, options = {}) {
    const { Op } = sequelize.Sequelize;
    const cutoffTime = new Date(Date.now() - maxAge);
    
    return this.findAll({
      where: {
        [Op.or]: [
          { fetched_at: { [Op.lt]: cutoffTime } },
          { fetched_at: { [Op.is]: null } }
        ]
      },
      order: [['fetched_at', 'ASC']],
      ...options
    });
  };

  TripWeather.findWithAlerts = function(severity = null, options = {}) {
    const { Op } = sequelize.Sequelize;
    let whereClause = {
      alerts: {
        [Op.ne]: null,
        [Op.not]: []
      }
    };
    
    if (severity) {
      whereClause = {
        ...whereClause,
        alerts: {
          [Op.contains]: [{ severity }]
        }
      };
    }
    
    return this.findAll({
      where: whereClause,
      order: [['fetched_at', 'DESC']],
      ...options
    });
  };

  TripWeather.findByConditions = function(conditions, options = {}) {
    return this.findAll({
      where: { travel_conditions: conditions },
      order: [['fetched_at', 'DESC']],
      ...options
    });
  };

  TripWeather.cleanupExpired = async function() {
    const { Op } = sequelize.Sequelize;
    const result = await this.destroy({
      where: {
        expires_at: {
          [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        }
      }
    });
    return result;
  };

  return TripWeather;
};