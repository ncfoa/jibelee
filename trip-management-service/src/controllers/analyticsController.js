const { logger, logBusinessEvent } = require('../config/logger');
const { cache, generateCacheKey } = require('../config/redis');
const { TimeUtils, CommonUtils, CapacityUtils } = require('../utils');

/**
 * Analytics controller for trip performance and statistics
 */
class AnalyticsController {
  constructor() {
    this.cacheTimeout = 1800; // 30 minutes for analytics
  }

  /**
   * Get trip analytics for user
   * GET /api/v1/trips/analytics
   */
  async getTripAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const { period = 'month', startDate, endDate, groupBy } = req.query;

      const cacheKey = generateCacheKey.tripAnalytics(userId, { period, startDate, endDate, groupBy });
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Get date range
      const dateRange = this.getDateRange(period, startDate, endDate);

      // Get analytics data
      const analytics = await this.calculateTripAnalytics(userId, dateRange, groupBy);

      // Cache results
      await cache.set(cacheKey, analytics, this.cacheTimeout);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Get trip analytics controller error:', {
        userId: req.user?.id,
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get trip analytics',
        error: 'GET_ANALYTICS_ERROR'
      });
    }
  }

  /**
   * Get specific trip analytics
   * GET /api/v1/trips/:id/analytics
   */
  async getTripPerformance(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user?.id;

      const cacheKey = generateCacheKey.tripPerformance(tripId);
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Get trip performance data
      const performance = await this.calculateTripPerformance(tripId, userId);

      // Cache results
      await cache.set(cacheKey, performance, this.cacheTimeout);

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      logger.error('Get trip performance controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get trip performance',
        error: 'GET_PERFORMANCE_ERROR'
      });
    }
  }

  /**
   * Get trip statistics
   * GET /api/v1/trips/statistics
   */
  async getTripStatistics(req, res) {
    try {
      const userId = req.user.id;
      const { period = 'month', groupBy = 'day' } = req.query;

      const cacheKey = generateCacheKey.tripStatistics(userId, period, groupBy);
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Calculate statistics
      const statistics = await this.calculateTripStatistics(userId, period, groupBy);

      // Cache results
      await cache.set(cacheKey, statistics, this.cacheTimeout);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Get trip statistics controller error:', {
        userId: req.user?.id,
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get trip statistics',
        error: 'GET_STATISTICS_ERROR'
      });
    }
  }

  /**
   * Get popular routes
   * GET /api/v1/trips/popular-routes
   */
  async getPopularRoutes(req, res) {
    try {
      const { period = 'month', limit = 10 } = req.query;

      const cacheKey = generateCacheKey.popularRoutes(period, limit);
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Calculate popular routes
      const routes = await this.calculatePopularRoutes(period, parseInt(limit));

      // Cache results for longer (1 hour)
      await cache.set(cacheKey, routes, 3600);

      res.json({
        success: true,
        data: routes
      });
    } catch (error) {
      logger.error('Get popular routes controller error:', {
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get popular routes',
        error: 'GET_POPULAR_ROUTES_ERROR'
      });
    }
  }

  /**
   * Get trip recommendations
   * GET /api/v1/trips/recommendations
   */
  async getTripRecommendations(req, res) {
    try {
      const userId = req.user.id;
      const { origin, destination, type } = req.query;

      const cacheKey = generateCacheKey.tripRecommendations(userId, { origin, destination, type });
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Generate recommendations
      const recommendations = await this.generateTripRecommendations(userId, { origin, destination, type });

      // Cache results
      await cache.set(cacheKey, recommendations, this.cacheTimeout);

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      logger.error('Get trip recommendations controller error:', {
        userId: req.user?.id,
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get trip recommendations',
        error: 'GET_RECOMMENDATIONS_ERROR'
      });
    }
  }

  /**
   * Calculate trip analytics
   * @private
   */
  async calculateTripAnalytics(userId, dateRange, groupBy) {
    try {
      const { Trip, Sequelize } = require('../models');
      const { Op } = Sequelize;

      // Get user trips in date range
      const trips = await Trip.findAll({
        where: {
          traveler_id: userId,
          created_at: {
            [Op.between]: [dateRange.start, dateRange.end]
          }
        },
        order: [['created_at', 'ASC']]
      });

      // Calculate summary metrics
      const summary = {
        totalTrips: trips.length,
        completedTrips: trips.filter(t => t.status === 'completed').length,
        cancelledTrips: trips.filter(t => t.status === 'cancelled').length,
        upcomingTrips: trips.filter(t => t.status === 'upcoming').length,
        activeTrips: trips.filter(t => t.status === 'active').length,
        totalDistance: trips.reduce((sum, t) => sum + (t.distance || 0), 0),
        totalEarnings: trips.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.base_price || 0), 0),
        averageRating: 4.5, // Would be calculated from reviews
        completionRate: trips.length > 0 ? (trips.filter(t => t.status === 'completed').length / trips.length) * 100 : 0
      };

      // Calculate trends if groupBy is specified
      let trends = [];
      if (groupBy && trips.length > 0) {
        trends = this.calculateTrends(trips, groupBy);
      }

      // Get top routes
      const topRoutes = this.calculateTopRoutes(trips);

      // Calculate capacity utilization
      const capacityUtilization = this.calculateCapacityUtilization(trips);

      return {
        period: dateRange,
        summary,
        trends,
        topRoutes,
        capacityUtilization,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Calculate trip analytics error:', {
        userId,
        dateRange,
        groupBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate trip performance
   * @private
   */
  async calculateTripPerformance(tripId, userId) {
    try {
      const { Trip } = require('../models');

      const trip = await Trip.findByPk(tripId);

      if (!trip) {
        throw new Error('Trip not found');
      }

      // Check access
      if (trip.traveler_id !== userId && userId) {
        throw new Error('Access denied');
      }

      // Calculate performance metrics
      const performance = {
        tripId: trip.id,
        status: trip.status,
        onTimePerformance: this.calculateOnTimePerformance(trip),
        capacityUtilization: this.calculateSingleTripCapacityUtilization(trip),
        financialPerformance: this.calculateFinancialPerformance(trip),
        timeline: this.generateTripTimeline(trip)
      };

      return performance;
    } catch (error) {
      logger.error('Calculate trip performance error:', {
        tripId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate trip statistics
   * @private
   */
  async calculateTripStatistics(userId, period, groupBy) {
    try {
      const { Trip, Sequelize } = require('../models');
      const { Op } = Sequelize;

      const dateRange = this.getDateRange(period);

      // Get aggregated statistics
      const stats = await Trip.findAll({
        where: {
          traveler_id: userId,
          created_at: {
            [Op.between]: [dateRange.start, dateRange.end]
          }
        },
        attributes: [
          [Sequelize.fn('DATE_TRUNC', groupBy, Sequelize.col('created_at')), 'period'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'total_trips'],
          [Sequelize.fn('COUNT', Sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")), 'completed_trips'],
          [Sequelize.fn('COUNT', Sequelize.literal("CASE WHEN status = 'cancelled' THEN 1 END")), 'cancelled_trips'],
          [Sequelize.fn('AVG', Sequelize.col('base_price')), 'avg_price'],
          [Sequelize.fn('SUM', Sequelize.col('distance')), 'total_distance'],
          [Sequelize.fn('AVG', Sequelize.col('available_weight')), 'avg_available_weight'],
          [Sequelize.fn('AVG', Sequelize.col('available_volume')), 'avg_available_volume']
        ],
        group: [Sequelize.fn('DATE_TRUNC', groupBy, Sequelize.col('created_at'))],
        order: [[Sequelize.fn('DATE_TRUNC', groupBy, Sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      return {
        period: dateRange,
        groupBy,
        statistics: stats.map(stat => ({
          period: stat.period,
          totalTrips: parseInt(stat.total_trips),
          completedTrips: parseInt(stat.completed_trips),
          cancelledTrips: parseInt(stat.cancelled_trips),
          averagePrice: parseFloat(stat.avg_price) || 0,
          totalDistance: parseFloat(stat.total_distance) || 0,
          averageAvailableWeight: parseFloat(stat.avg_available_weight) || 0,
          averageAvailableVolume: parseFloat(stat.avg_available_volume) || 0,
          completionRate: parseInt(stat.total_trips) > 0 
            ? (parseInt(stat.completed_trips) / parseInt(stat.total_trips)) * 100 
            : 0
        })),
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Calculate trip statistics error:', {
        userId,
        period,
        groupBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate popular routes
   * @private
   */
  async calculatePopularRoutes(period, limit) {
    try {
      const { Trip, Sequelize } = require('../models');
      const { Op } = Sequelize;

      const dateRange = this.getDateRange(period);

      const routes = await Trip.findAll({
        where: {
          created_at: {
            [Op.between]: [dateRange.start, dateRange.end]
          },
          status: { [Op.ne]: 'cancelled' }
        },
        attributes: [
          'origin_address',
          'destination_address',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'trip_count'],
          [Sequelize.fn('AVG', Sequelize.col('base_price')), 'average_price'],
          [Sequelize.fn('AVG', Sequelize.col('distance')), 'average_distance'],
          [Sequelize.fn('COUNT', Sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")), 'completed_count']
        ],
        group: ['origin_address', 'destination_address'],
        having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col('id')), Op.gt, 1),
        order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
        limit,
        raw: true
      });

      return routes.map(route => ({
        route: {
          origin: route.origin_address,
          destination: route.destination_address
        },
        tripCount: parseInt(route.trip_count),
        averagePrice: parseFloat(route.average_price) || 0,
        averageDistance: parseFloat(route.average_distance) || 0,
        completedCount: parseInt(route.completed_count),
        completionRate: parseInt(route.trip_count) > 0 
          ? (parseInt(route.completed_count) / parseInt(route.trip_count)) * 100 
          : 0,
        demand: this.calculateDemandLevel(parseInt(route.trip_count))
      }));
    } catch (error) {
      logger.error('Calculate popular routes error:', {
        period,
        limit,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate trip recommendations
   * @private
   */
  async generateTripRecommendations(userId, preferences) {
    try {
      const { Trip, Sequelize } = require('../models');
      const { Op } = Sequelize;

      // Get user's historical trips for pattern analysis
      const userTrips = await Trip.findAll({
        where: {
          traveler_id: userId,
          status: 'completed',
          created_at: {
            [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          }
        },
        order: [['created_at', 'DESC']],
        limit: 50
      });

      const recommendations = [];

      // Analyze patterns
      if (userTrips.length > 0) {
        // Find frequent routes
        const routeFrequency = this.analyzeRouteFrequency(userTrips);
        
        // Recommend based on successful routes
        routeFrequency.forEach(route => {
          if (route.count >= 2 && route.completionRate > 80) {
            recommendations.push({
              type: 'frequent_route',
              route: {
                origin: route.origin,
                destination: route.destination
              },
              reason: `You've successfully completed this route ${route.count} times`,
              suggestedTimes: this.suggestOptimalTimes(route.trips),
              estimatedEarnings: route.averageEarnings * 1.1 // 10% optimistic estimate
            });
          }
        });

        // Recommend capacity optimization
        const capacityAnalysis = this.analyzeCapacityPatterns(userTrips);
        if (capacityAnalysis.recommendations.length > 0) {
          recommendations.push(...capacityAnalysis.recommendations);
        }
      }

      // Market-based recommendations
      const marketRecommendations = await this.getMarketRecommendations(preferences);
      recommendations.push(...marketRecommendations);

      return {
        recommendations: recommendations.slice(0, 10), // Limit to 10 recommendations
        basedOn: {
          historicalTrips: userTrips.length,
          preferences,
          marketData: true
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Generate trip recommendations error:', {
        userId,
        preferences,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get date range for analytics
   * @private
   */
  getDateRange(period, startDate = null, endDate = null) {
    const now = new Date();
    
    if (startDate && endDate) {
      return {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }

    switch (period) {
      case 'week':
        return TimeUtils.getWeekBounds(now);
      case 'month':
        return TimeUtils.getMonthBounds(now);
      case 'quarter':
        return {
          start: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
          end: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
        };
      case 'year':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31)
        };
      default:
        return TimeUtils.getMonthBounds(now);
    }
  }

  /**
   * Calculate trends
   * @private
   */
  calculateTrends(trips, groupBy) {
    const grouped = {};

    trips.forEach(trip => {
      let key;
      const date = new Date(trip.created_at);

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          key = `${date.getFullYear()}-W${TimeUtils.getWeekNumber(date)}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          trips: [],
          totalTrips: 0,
          completedTrips: 0,
          cancelledTrips: 0,
          totalEarnings: 0,
          totalDistance: 0
        };
      }

      grouped[key].trips.push(trip);
      grouped[key].totalTrips++;
      
      if (trip.status === 'completed') {
        grouped[key].completedTrips++;
        grouped[key].totalEarnings += trip.base_price || 0;
      } else if (trip.status === 'cancelled') {
        grouped[key].cancelledTrips++;
      }
      
      grouped[key].totalDistance += trip.distance || 0;
    });

    return Object.values(grouped).map(group => ({
      period: group.period,
      totalTrips: group.totalTrips,
      completedTrips: group.completedTrips,
      cancelledTrips: group.cancelledTrips,
      totalEarnings: Math.round(group.totalEarnings * 100) / 100,
      totalDistance: Math.round(group.totalDistance * 100) / 100,
      completionRate: group.totalTrips > 0 ? (group.completedTrips / group.totalTrips) * 100 : 0,
      averageEarnings: group.completedTrips > 0 ? group.totalEarnings / group.completedTrips : 0
    }));
  }

  /**
   * Calculate top routes for user
   * @private
   */
  calculateTopRoutes(trips) {
    const routes = {};

    trips.forEach(trip => {
      const routeKey = `${trip.origin_address} -> ${trip.destination_address}`;
      
      if (!routes[routeKey]) {
        routes[routeKey] = {
          origin: trip.origin_address,
          destination: trip.destination_address,
          count: 0,
          completedCount: 0,
          totalEarnings: 0,
          totalDistance: 0,
          trips: []
        };
      }

      routes[routeKey].count++;
      routes[routeKey].trips.push(trip);
      
      if (trip.status === 'completed') {
        routes[routeKey].completedCount++;
        routes[routeKey].totalEarnings += trip.base_price || 0;
      }
      
      routes[routeKey].totalDistance += trip.distance || 0;
    });

    return Object.values(routes)
      .filter(route => route.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(route => ({
        route: {
          origin: route.origin,
          destination: route.destination
        },
        count: route.count,
        completedCount: route.completedCount,
        totalEarnings: Math.round(route.totalEarnings * 100) / 100,
        averageDistance: route.totalDistance / route.count,
        completionRate: (route.completedCount / route.count) * 100,
        averageEarnings: route.completedCount > 0 ? route.totalEarnings / route.completedCount : 0
      }));
  }

  /**
   * Calculate capacity utilization
   * @private
   */
  calculateCapacityUtilization(trips) {
    if (trips.length === 0) {
      return {
        averageWeightUtilization: 0,
        averageVolumeUtilization: 0,
        averageItemUtilization: 0,
        overallUtilization: 0
      };
    }

    const utilizations = trips.map(trip => {
      const totalCapacity = {
        weight: trip.weight_capacity,
        volume: trip.volume_capacity,
        items: trip.item_capacity
      };
      
      const availableCapacity = {
        weight: trip.available_weight,
        volume: trip.available_volume,
        items: trip.available_items
      };

      return CapacityUtils.calculateUtilization(totalCapacity, availableCapacity);
    });

    return {
      averageWeightUtilization: utilizations.reduce((sum, u) => sum + u.weight, 0) / utilizations.length,
      averageVolumeUtilization: utilizations.reduce((sum, u) => sum + u.volume, 0) / utilizations.length,
      averageItemUtilization: utilizations.reduce((sum, u) => sum + u.items, 0) / utilizations.length,
      overallUtilization: utilizations.reduce((sum, u) => sum + u.overall, 0) / utilizations.length
    };
  }

  /**
   * Calculate on-time performance
   * @private
   */
  calculateOnTimePerformance(trip) {
    if (trip.status !== 'completed' || !trip.actual_departure_time || !trip.actual_arrival_time) {
      return null;
    }

    const scheduledDeparture = new Date(trip.departure_time);
    const actualDeparture = new Date(trip.actual_departure_time);
    const scheduledArrival = new Date(trip.arrival_time);
    const actualArrival = new Date(trip.actual_arrival_time);

    const departureDelay = (actualDeparture - scheduledDeparture) / (1000 * 60); // minutes
    const arrivalDelay = (actualArrival - scheduledArrival) / (1000 * 60); // minutes

    return {
      departureDelay: Math.round(departureDelay),
      arrivalDelay: Math.round(arrivalDelay),
      onTimeThreshold: 15, // 15 minutes threshold
      departureOnTime: Math.abs(departureDelay) <= 15,
      arrivalOnTime: Math.abs(arrivalDelay) <= 15,
      overallOnTime: Math.abs(departureDelay) <= 15 && Math.abs(arrivalDelay) <= 15
    };
  }

  /**
   * Calculate single trip capacity utilization
   * @private
   */
  calculateSingleTripCapacityUtilization(trip) {
    const totalCapacity = {
      weight: trip.weight_capacity,
      volume: trip.volume_capacity,
      items: trip.item_capacity
    };
    
    const availableCapacity = {
      weight: trip.available_weight,
      volume: trip.available_volume,
      items: trip.available_items
    };

    return CapacityUtils.calculateUtilization(totalCapacity, availableCapacity);
  }

  /**
   * Calculate financial performance
   * @private
   */
  calculateFinancialPerformance(trip) {
    // This would integrate with payment service for actual earnings
    return {
      basePrice: trip.base_price,
      estimatedEarnings: trip.base_price * 0.9, // Assuming 10% platform fee
      actualEarnings: trip.status === 'completed' ? trip.base_price * 0.9 : 0,
      currency: 'USD'
    };
  }

  /**
   * Generate trip timeline
   * @private
   */
  generateTripTimeline(trip) {
    const timeline = [];

    timeline.push({
      event: 'trip_created',
      timestamp: trip.created_at,
      description: 'Trip was created'
    });

    if (trip.actual_departure_time) {
      timeline.push({
        event: 'trip_started',
        timestamp: trip.actual_departure_time,
        description: 'Trip started'
      });
    }

    if (trip.actual_arrival_time) {
      timeline.push({
        event: 'trip_completed',
        timestamp: trip.actual_arrival_time,
        description: 'Trip completed'
      });
    }

    if (trip.cancelled_at) {
      timeline.push({
        event: 'trip_cancelled',
        timestamp: trip.cancelled_at,
        description: `Trip cancelled: ${trip.cancellation_reason || 'No reason provided'}`
      });
    }

    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Calculate demand level
   * @private
   */
  calculateDemandLevel(tripCount) {
    if (tripCount >= 20) return 'very_high';
    if (tripCount >= 10) return 'high';
    if (tripCount >= 5) return 'medium';
    if (tripCount >= 2) return 'low';
    return 'very_low';
  }

  /**
   * Analyze route frequency
   * @private
   */
  analyzeRouteFrequency(trips) {
    const routes = {};

    trips.forEach(trip => {
      const routeKey = `${trip.origin_address} -> ${trip.destination_address}`;
      
      if (!routes[routeKey]) {
        routes[routeKey] = {
          origin: trip.origin_address,
          destination: trip.destination_address,
          count: 0,
          completedCount: 0,
          totalEarnings: 0,
          trips: []
        };
      }

      routes[routeKey].count++;
      routes[routeKey].trips.push(trip);
      
      if (trip.status === 'completed') {
        routes[routeKey].completedCount++;
        routes[routeKey].totalEarnings += trip.base_price || 0;
      }
    });

    return Object.values(routes).map(route => ({
      ...route,
      completionRate: (route.completedCount / route.count) * 100,
      averageEarnings: route.completedCount > 0 ? route.totalEarnings / route.completedCount : 0
    }));
  }

  /**
   * Analyze capacity patterns
   * @private
   */
  analyzeCapacityPatterns(trips) {
    const recommendations = [];
    
    if (trips.length < 5) {
      return { recommendations };
    }

    const utilizationData = trips.map(trip => 
      this.calculateSingleTripCapacityUtilization(trip)
    );

    const avgUtilization = {
      weight: utilizationData.reduce((sum, u) => sum + u.weight, 0) / utilizationData.length,
      volume: utilizationData.reduce((sum, u) => sum + u.volume, 0) / utilizationData.length,
      items: utilizationData.reduce((sum, u) => sum + u.items, 0) / utilizationData.length,
      overall: utilizationData.reduce((sum, u) => sum + u.overall, 0) / utilizationData.length
    };

    if (avgUtilization.overall < 30) {
      recommendations.push({
        type: 'capacity_optimization',
        message: 'Your trips are typically underutilized',
        suggestion: 'Consider reducing capacity or accepting more deliveries',
        data: { averageUtilization: avgUtilization.overall }
      });
    } else if (avgUtilization.overall > 90) {
      recommendations.push({
        type: 'capacity_increase',
        message: 'Your trips are typically at high utilization',
        suggestion: 'Consider increasing capacity to accommodate more deliveries',
        data: { averageUtilization: avgUtilization.overall }
      });
    }

    return { recommendations };
  }

  /**
   * Suggest optimal times
   * @private
   */
  suggestOptimalTimes(trips) {
    // Analyze successful trip times
    const successfulTrips = trips.filter(t => t.status === 'completed');
    
    if (successfulTrips.length === 0) {
      return [];
    }

    // Group by day of week and hour
    const timePatterns = {};
    
    successfulTrips.forEach(trip => {
      const departureTime = new Date(trip.departure_time);
      const dayOfWeek = departureTime.getDay();
      const hour = departureTime.getHours();
      const key = `${dayOfWeek}-${hour}`;
      
      if (!timePatterns[key]) {
        timePatterns[key] = {
          dayOfWeek,
          hour,
          count: 0,
          totalEarnings: 0
        };
      }
      
      timePatterns[key].count++;
      timePatterns[key].totalEarnings += trip.base_price || 0;
    });

    // Return top 3 time slots
    return Object.values(timePatterns)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(pattern => ({
        dayOfWeek: pattern.dayOfWeek,
        hour: pattern.hour,
        frequency: pattern.count,
        averageEarnings: pattern.totalEarnings / pattern.count,
        recommendation: `${this.getDayName(pattern.dayOfWeek)} at ${pattern.hour}:00`
      }));
  }

  /**
   * Get market recommendations
   * @private
   */
  async getMarketRecommendations(preferences) {
    // This would integrate with market analysis
    // For now, return basic recommendations
    return [
      {
        type: 'market_opportunity',
        route: {
          origin: 'New York, NY',
          destination: 'Boston, MA'
        },
        reason: 'High demand route with good earnings potential',
        estimatedEarnings: 150,
        demand: 'high'
      }
    ];
  }

  /**
   * Get day name from day number
   * @private
   */
  getDayName(dayNumber) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  }
}

// Extend cache key generation for analytics
Object.assign(generateCacheKey, {
  tripAnalytics: (userId, params) => {
    const paramsStr = Buffer.from(JSON.stringify(params)).toString('base64');
    return `trip-analytics:${userId}:${paramsStr}`;
  },
  tripPerformance: (tripId) => `trip-performance:${tripId}`,
  tripStatistics: (userId, period, groupBy) => `trip-statistics:${userId}:${period}:${groupBy}`,
  popularRoutes: (period, limit) => `popular-routes:${period}:${limit}`,
  tripRecommendations: (userId, preferences) => {
    const prefStr = Buffer.from(JSON.stringify(preferences)).toString('base64');
    return `trip-recommendations:${userId}:${prefStr}`;
  }
});

module.exports = new AnalyticsController();