const moment = require('moment');
const { logger } = require('../../config/logger');
const { PaymentIntent, EscrowAccount } = require('../../models');
const { Op } = require('sequelize');

class MarketAnalysisEngine {
  constructor() {
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    this.cache = new Map();
  }

  /**
   * Get current market conditions for a route
   * @param {Object} route - Origin and destination information
   * @returns {Object} Market conditions and analysis
   */
  async getCurrentConditions(route) {
    const cacheKey = this.generateCacheKey(route);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const conditions = await this.analyzeMarketConditions(route);
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: conditions,
        timestamp: Date.now()
      });

      return conditions;
    } catch (error) {
      logger.error('Error analyzing market conditions:', error);
      return this.getDefaultConditions();
    }
  }

  /**
   * Get comprehensive market analysis for a route
   * @param {Object} params - Analysis parameters
   * @returns {Object} Detailed market analysis
   */
  async getMarketAnalysis(params) {
    const {
      origin,
      destination,
      category,
      weight,
      urgency,
      period = 'month'
    } = params;

    try {
      const route = { origin, destination };
      const routeHash = this.generateRouteHash(route);
      
      const [
        routeData,
        marketData,
        trends,
        categoryBreakdown,
        competitorAnalysis
      ] = await Promise.all([
        this.getRouteData(routeHash),
        this.getMarketData(routeHash, period),
        this.getTrends(routeHash, period),
        this.getCategoryBreakdown(routeHash, category, period),
        this.getCompetitorAnalysis(routeHash, period)
      ]);

      return {
        route: {
          origin: origin.address || `${origin.lat}, ${origin.lng}`,
          destination: destination.address || `${destination.lat}, ${destination.lng}`,
          distance: this.calculateDistance(origin, destination)
        },
        marketData,
        trends,
        categoryBreakdown,
        competitorAnalysis
      };
    } catch (error) {
      logger.error('Error generating market analysis:', error);
      throw new Error(`Market analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze current market conditions
   */
  async analyzeMarketConditions(route) {
    const routeHash = this.generateRouteHash(route);
    const now = moment();
    
    // Get data from last 30 days
    const thirtyDaysAgo = now.clone().subtract(30, 'days').toDate();
    
    const [
      recentDeliveries,
      activeRequests,
      availableTravelers,
      seasonalData
    ] = await Promise.all([
      this.getRecentDeliveries(routeHash, thirtyDaysAgo),
      this.getActiveRequests(routeHash),
      this.getAvailableTravelers(route),
      this.getSeasonalData(now)
    ]);

    const supply = availableTravelers.length;
    const demand = activeRequests.length;
    const competition = this.calculateCompetitionLevel(supply, demand);

    return {
      availableCapacity: supply,
      pendingRequests: demand,
      competition,
      recentVolume: recentDeliveries.length,
      averagePrice: this.calculateAveragePrice(recentDeliveries),
      successRate: this.calculateSuccessRate(recentDeliveries),
      seasonalityFactor: seasonalData.factor,
      fuelPrice: await this.getFuelPriceIndex(),
      economicIndex: await this.getEconomicIndex(),
      demandTrend: this.calculateDemandTrend(recentDeliveries),
      supplyTrend: this.calculateSupplyTrend(availableTravelers)
    };
  }

  /**
   * Get market data for analysis
   */
  async getMarketData(routeHash, period) {
    const endDate = moment();
    const startDate = this.getStartDateForPeriod(endDate, period);
    
    const deliveries = await this.getDeliveriesInPeriod(routeHash, startDate, endDate);
    
    if (deliveries.length === 0) {
      return this.getDefaultMarketData();
    }

    const prices = deliveries.map(d => d.amount / 100); // Convert from cents
    const successful = deliveries.filter(d => d.status === 'succeeded');

    return {
      averagePrice: this.calculateAverage(prices),
      medianPrice: this.calculateMedian(prices),
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices),
        q25: this.calculatePercentile(prices, 25),
        q75: this.calculatePercentile(prices, 75)
      },
      totalDeliveries: deliveries.length,
      successRate: (successful.length / deliveries.length) * 100,
      averageRating: this.calculateAverageRating(successful)
    };
  }

  /**
   * Calculate market trends
   */
  async getTrends(routeHash, period) {
    const currentPeriod = await this.getMarketData(routeHash, period);
    const previousPeriod = await this.getPreviousPeriodData(routeHash, period);

    const priceChange = this.calculatePercentageChange(
      previousPeriod.averagePrice,
      currentPeriod.averagePrice
    );

    const demandChange = this.calculatePercentageChange(
      previousPeriod.totalDeliveries,
      currentPeriod.totalDeliveries
    );

    return {
      priceChange: `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}%`,
      demandChange: `${demandChange > 0 ? '+' : ''}${demandChange.toFixed(1)}%`,
      competitionLevel: this.assessCompetitionLevel(currentPeriod),
      seasonalFactor: await this.getSeasonalFactor()
    };
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(routeHash, targetCategory, period) {
    const endDate = moment();
    const startDate = this.getStartDateForPeriod(endDate, period);
    
    // In a real implementation, this would query delivery requests by category
    // For now, we'll return sample data
    const categories = [
      {
        category: 'electronics',
        averagePrice: 75.50,
        volume: 45,
        successRate: 96.2
      },
      {
        category: 'documents',
        averagePrice: 45.20,
        volume: 67,
        successRate: 98.1
      },
      {
        category: 'clothing',
        averagePrice: 38.75,
        volume: 23,
        successRate: 94.8
      },
      {
        category: 'fragile',
        averagePrice: 82.30,
        volume: 34,
        successRate: 91.2
      }
    ];

    return categories.filter(c => !targetCategory || c.category === targetCategory);
  }

  /**
   * Get competitor analysis
   */
  async getCompetitorAnalysis(routeHash, period) {
    // In a real implementation, this would analyze competitor data
    // For now, we'll return estimated data
    const totalCompetitors = Math.floor(Math.random() * 30) + 10;
    
    return {
      totalCompetitors,
      averageRating: 4.3 + Math.random() * 0.4,
      priceDistribution: {
        budget: Math.floor(totalCompetitors * 0.3),
        'mid-range': Math.floor(totalCompetitors * 0.5),
        premium: Math.floor(totalCompetitors * 0.2)
      },
      marketShare: {
        top3: 45 + Math.random() * 20,
        top10: 75 + Math.random() * 15
      }
    };
  }

  // Helper methods
  generateCacheKey(route) {
    return `market_${this.generateRouteHash(route)}`;
  }

  generateRouteHash(route) {
    const crypto = require('crypto');
    const routeString = `${route.origin.lat},${route.origin.lng}-${route.destination.lat},${route.destination.lng}`;
    return crypto.createHash('md5').update(routeString).digest('hex').substring(0, 16);
  }

  calculateDistance(origin, destination) {
    const geolib = require('geolib');
    return geolib.getDistance(
      { latitude: origin.lat, longitude: origin.lng },
      { latitude: destination.lat, longitude: destination.lng }
    ) / 1000; // Convert to kilometers
  }

  async getRecentDeliveries(routeHash, since) {
    try {
      // In a real implementation, this would query actual delivery data
      // For now, we'll simulate data
      const count = Math.floor(Math.random() * 50) + 10;
      return Array.from({ length: count }, (_, i) => ({
        id: `delivery_${i}`,
        amount: Math.floor(Math.random() * 5000) + 2000, // 20-70 USD in cents
        status: Math.random() > 0.1 ? 'succeeded' : 'failed',
        rating: 3.5 + Math.random() * 1.5,
        createdAt: moment(since).add(Math.random() * 30, 'days').toDate()
      }));
    } catch (error) {
      logger.warn('Error fetching recent deliveries:', error);
      return [];
    }
  }

  async getActiveRequests(routeHash) {
    // Simulate active delivery requests
    const count = Math.floor(Math.random() * 20) + 5;
    return Array.from({ length: count }, (_, i) => ({
      id: `request_${i}`,
      routeHash
    }));
  }

  async getAvailableTravelers(route) {
    // Simulate available travelers
    const count = Math.floor(Math.random() * 30) + 10;
    return Array.from({ length: count }, (_, i) => ({
      id: `traveler_${i}`,
      rating: 3.0 + Math.random() * 2.0
    }));
  }

  async getSeasonalData(date) {
    const month = date.month() + 1;
    
    // Seasonal factors (1.0 = normal, >1.0 = higher demand/prices)
    const seasonalFactors = {
      12: 1.2, // December (holidays)
      11: 1.1, // November (Thanksgiving)
      1: 1.05,  // January (New Year)
      6: 1.05,  // June (summer start)
      7: 1.1,   // July (summer peak)
      8: 1.05   // August (back to school)
    };

    return {
      factor: seasonalFactors[month] || 1.0,
      reason: this.getSeasonalReason(month)
    };
  }

  getSeasonalReason(month) {
    const reasons = {
      12: 'Holiday season',
      11: 'Thanksgiving period',
      1: 'New Year period',
      6: 'Summer season begins',
      7: 'Summer peak',
      8: 'Back to school season'
    };
    
    return reasons[month] || 'Normal seasonal demand';
  }

  async getFuelPriceIndex() {
    // In production, this would fetch real fuel price data
    return 0.95 + Math.random() * 0.1; // 0.95 - 1.05
  }

  async getEconomicIndex() {
    // In production, this would fetch economic indicators
    return 0.98 + Math.random() * 0.04; // 0.98 - 1.02
  }

  calculateCompetitionLevel(supply, demand) {
    const ratio = supply / Math.max(demand, 1);
    
    if (ratio >= 2.0) return 'low';
    if (ratio >= 1.0) return 'medium';
    return 'high';
  }

  calculateAveragePrice(deliveries) {
    if (deliveries.length === 0) return 0;
    
    const total = deliveries.reduce((sum, d) => sum + d.amount, 0);
    return total / deliveries.length / 100; // Convert from cents
  }

  calculateSuccessRate(deliveries) {
    if (deliveries.length === 0) return 0;
    
    const successful = deliveries.filter(d => d.status === 'succeeded').length;
    return (successful / deliveries.length) * 100;
  }

  calculateDemandTrend(recentDeliveries) {
    // Simplified trend calculation
    if (recentDeliveries.length < 7) return 'stable';
    
    const recent = recentDeliveries.slice(-7).length;
    const previous = recentDeliveries.slice(-14, -7).length;
    
    const change = (recent - previous) / previous;
    
    if (change > 0.2) return 'increasing';
    if (change < -0.2) return 'decreasing';
    return 'stable';
  }

  calculateSupplyTrend(availableTravelers) {
    // Simplified supply trend - in production, this would analyze historical data
    const count = availableTravelers.length;
    
    if (count > 25) return 'high';
    if (count > 15) return 'medium';
    return 'low';
  }

  getStartDateForPeriod(endDate, period) {
    switch (period) {
      case 'week': return endDate.clone().subtract(1, 'week');
      case 'month': return endDate.clone().subtract(1, 'month');
      case 'quarter': return endDate.clone().subtract(3, 'months');
      case 'year': return endDate.clone().subtract(1, 'year');
      default: return endDate.clone().subtract(1, 'month');
    }
  }

  async getDeliveriesInPeriod(routeHash, startDate, endDate) {
    // In production, this would query the database
    return this.getRecentDeliveries(routeHash, startDate.toDate());
  }

  async getPreviousPeriodData(routeHash, period) {
    // Return default data for previous period
    return this.getDefaultMarketData();
  }

  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  calculateMedian(numbers) {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  calculatePercentile(numbers, percentile) {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (index === Math.floor(index)) {
      return sorted[index];
    }
    
    const lower = sorted[Math.floor(index)];
    const upper = sorted[Math.ceil(index)];
    return lower + (upper - lower) * (index - Math.floor(index));
  }

  calculateAverageRating(deliveries) {
    const rated = deliveries.filter(d => d.rating);
    if (rated.length === 0) return 0;
    
    return rated.reduce((sum, d) => sum + d.rating, 0) / rated.length;
  }

  calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  assessCompetitionLevel(marketData) {
    // Simple competition assessment based on delivery volume
    if (marketData.totalDeliveries > 100) return 'high';
    if (marketData.totalDeliveries > 50) return 'medium';
    return 'low';
  }

  async getSeasonalFactor() {
    const seasonalData = await this.getSeasonalData(moment());
    return seasonalData.factor;
  }

  getDefaultConditions() {
    return {
      availableCapacity: 25,
      pendingRequests: 15,
      competition: 'medium',
      recentVolume: 30,
      averagePrice: 55.00,
      successRate: 94.5,
      seasonalityFactor: 1.0,
      fuelPrice: 1.0,
      economicIndex: 1.0,
      demandTrend: 'stable',
      supplyTrend: 'medium'
    };
  }

  getDefaultMarketData() {
    return {
      averagePrice: 55.00,
      medianPrice: 52.00,
      priceRange: {
        min: 25.00,
        max: 120.00,
        q25: 45.00,
        q75: 68.00
      },
      totalDeliveries: 50,
      successRate: 94.5,
      averageRating: 4.4
    };
  }
}

module.exports = MarketAnalysisEngine;