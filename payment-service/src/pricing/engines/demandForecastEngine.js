const moment = require('moment');
const { logger } = require('../../config/logger');

class DemandForecastEngine {
  constructor() {
    this.historicalDataWindow = 90; // days
    this.forecastHorizon = 7; // days
    
    // Seasonal patterns
    this.seasonalPatterns = {
      monthly: [1.0, 0.9, 1.0, 1.05, 1.1, 1.15, 1.2, 1.15, 1.05, 1.0, 1.1, 1.3], // Jan-Dec
      weekly: [0.8, 1.0, 1.05, 1.1, 1.15, 1.3, 1.2], // Sun-Sat
      hourly: [
        0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.2, 1.5, 1.3, 1.1, 1.0,
        1.0, 0.9, 0.8, 0.9, 1.0, 1.4, 1.6, 1.3, 1.0, 0.8, 0.6, 0.4
      ] // 0-23 hours
    };

    // Holiday impact factors
    this.holidayImpacts = {
      'new-years': 1.8,
      'valentines': 1.4,
      'mothers-day': 1.6,
      'fathers-day': 1.3,
      'independence-day': 1.2,
      'thanksgiving': 2.0,
      'black-friday': 2.5,
      'cyber-monday': 2.2,
      'christmas': 2.8
    };
  }

  /**
   * Generate demand forecast for a specific route and time period
   * @param {Object} params - Forecast parameters
   * @returns {Object} Demand forecast with confidence intervals
   */
  async generateForecast(params) {
    const {
      route,
      category,
      timeHorizon = 7, // days
      granularity = 'daily' // hourly, daily, weekly
    } = params;

    try {
      const historicalData = await this.getHistoricalDemand(route, category);
      const forecast = await this.calculateForecast(historicalData, timeHorizon, granularity);
      
      return {
        route: this.formatRoute(route),
        category,
        timeHorizon,
        granularity,
        forecast: forecast.predictions,
        confidence: forecast.confidence,
        trends: forecast.trends,
        seasonalFactors: forecast.seasonalFactors,
        events: await this.getUpcomingEvents(timeHorizon),
        recommendations: this.generateRecommendations(forecast),
        metadata: {
          modelVersion: '1.0.0',
          generatedAt: new Date().toISOString(),
          dataPoints: historicalData.length,
          accuracy: forecast.accuracy
        }
      };
    } catch (error) {
      logger.error('Error generating demand forecast:', error);
      throw new Error(`Demand forecast failed: ${error.message}`);
    }
  }

  /**
   * Get real-time demand indicators
   * @param {Object} route - Route information
   * @returns {Object} Current demand indicators
   */
  async getRealTimeDemand(route) {
    try {
      const now = moment();
      const routeHash = this.generateRouteHash(route);
      
      const [
        currentRequests,
        recentActivity,
        competitorActivity,
        socialTrends
      ] = await Promise.all([
        this.getCurrentRequests(routeHash),
        this.getRecentActivity(routeHash, 24), // last 24 hours
        this.getCompetitorActivity(routeHash),
        this.getSocialTrends(route)
      ]);

      const demandScore = this.calculateDemandScore({
        currentRequests: currentRequests.length,
        recentActivity: recentActivity.length,
        competitorActivity,
        socialTrends,
        timeOfDay: now.hour(),
        dayOfWeek: now.day(),
        seasonalFactor: this.getSeasonalFactor(now)
      });

      return {
        demandScore,
        level: this.categorizeDemandLevel(demandScore),
        indicators: {
          activeRequests: currentRequests.length,
          recentActivity: recentActivity.length,
          competitorActivity,
          socialTrend: socialTrends.trend,
          seasonalFactor: this.getSeasonalFactor(now)
        },
        shortTermForecast: await this.getShortTermForecast(route, 6), // next 6 hours
        recommendations: this.generateRealTimeRecommendations(demandScore)
      };
    } catch (error) {
      logger.error('Error getting real-time demand:', error);
      return this.getDefaultRealTimeDemand();
    }
  }

  /**
   * Calculate demand forecast using time series analysis
   */
  async calculateForecast(historicalData, timeHorizon, granularity) {
    const predictions = [];
    const confidence = [];
    
    // Simple moving average with seasonal adjustment
    const windowSize = this.getWindowSize(granularity);
    const now = moment();

    for (let i = 0; i < timeHorizon; i++) {
      const forecastDate = now.clone().add(i, granularity === 'hourly' ? 'hours' : 'days');
      
      // Base prediction using moving average
      const basePrediction = this.calculateMovingAverage(historicalData, windowSize);
      
      // Apply seasonal adjustments
      const seasonalAdjustment = this.getSeasonalAdjustment(forecastDate, granularity);
      
      // Apply trend adjustment
      const trendAdjustment = this.calculateTrend(historicalData);
      
      // Apply event adjustments
      const eventAdjustment = await this.getEventAdjustment(forecastDate);
      
      const prediction = basePrediction * seasonalAdjustment * trendAdjustment * eventAdjustment;
      const confidenceLevel = this.calculateConfidence(historicalData, i);
      
      predictions.push({
        date: forecastDate.toISOString(),
        value: Math.max(0, Math.round(prediction * 100) / 100),
        confidence: confidenceLevel
      });
      
      confidence.push(confidenceLevel);
    }

    return {
      predictions,
      confidence: this.calculateAverageConfidence(confidence),
      trends: this.analyzeTrends(historicalData),
      seasonalFactors: this.getSeasonalFactors(now, timeHorizon, granularity),
      accuracy: this.estimateAccuracy(historicalData)
    };
  }

  /**
   * Get historical demand data
   */
  async getHistoricalDemand(route, category) {
    const routeHash = this.generateRouteHash(route);
    const endDate = moment();
    const startDate = endDate.clone().subtract(this.historicalDataWindow, 'days');
    
    // In production, this would query actual historical data
    // For now, we'll generate synthetic data with realistic patterns
    return this.generateSyntheticHistoricalData(startDate, endDate, category);
  }

  /**
   * Generate synthetic historical data for testing
   */
  generateSyntheticHistoricalData(startDate, endDate, category) {
    const data = [];
    const current = startDate.clone();
    
    // Base demand varies by category
    const baseDemand = this.getCategoryBaseDemand(category);
    
    while (current.isBefore(endDate)) {
      const dayOfWeek = current.day();
      const month = current.month();
      const hour = Math.floor(Math.random() * 24);
      
      // Apply seasonal patterns
      let demand = baseDemand;
      demand *= this.seasonalPatterns.monthly[month];
      demand *= this.seasonalPatterns.weekly[dayOfWeek];
      demand *= this.seasonalPatterns.hourly[hour];
      
      // Add some randomness
      demand *= (0.8 + Math.random() * 0.4);
      
      // Check for holidays
      const holidayFactor = this.getHolidayFactor(current);
      demand *= holidayFactor;
      
      data.push({
        date: current.toISOString(),
        value: Math.max(0, Math.round(demand)),
        category,
        dayOfWeek,
        hour,
        isHoliday: holidayFactor > 1.1
      });
      
      current.add(1, 'day');
    }
    
    return data;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(data, windowSize) {
    if (data.length < windowSize) {
      return data.reduce((sum, d) => sum + d.value, 0) / data.length;
    }
    
    const recent = data.slice(-windowSize);
    return recent.reduce((sum, d) => sum + d.value, 0) / windowSize;
  }

  /**
   * Get seasonal adjustment factor
   */
  getSeasonalAdjustment(date, granularity) {
    let adjustment = 1.0;
    
    if (granularity === 'hourly') {
      adjustment *= this.seasonalPatterns.hourly[date.hour()];
    }
    
    adjustment *= this.seasonalPatterns.weekly[date.day()];
    adjustment *= this.seasonalPatterns.monthly[date.month()];
    
    return adjustment;
  }

  /**
   * Calculate trend adjustment
   */
  calculateTrend(historicalData) {
    if (historicalData.length < 14) return 1.0;
    
    const recent = historicalData.slice(-7);
    const previous = historicalData.slice(-14, -7);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const previousAvg = previous.reduce((sum, d) => sum + d.value, 0) / previous.length;
    
    if (previousAvg === 0) return 1.0;
    
    const trendFactor = recentAvg / previousAvg;
    
    // Limit trend impact to prevent extreme adjustments
    return Math.max(0.5, Math.min(2.0, trendFactor));
  }

  /**
   * Get event-based adjustments
   */
  async getEventAdjustment(date) {
    const holiday = this.identifyHoliday(date);
    if (holiday) {
      return this.holidayImpacts[holiday] || 1.0;
    }
    
    // Check for other events (weather, local events, etc.)
    const weatherImpact = await this.getWeatherImpact(date);
    const eventImpact = await this.getLocalEventImpact(date);
    
    return weatherImpact * eventImpact;
  }

  /**
   * Calculate confidence level for prediction
   */
  calculateConfidence(historicalData, daysAhead) {
    let baseConfidence = 0.85;
    
    // Confidence decreases with forecast horizon
    baseConfidence -= (daysAhead * 0.05);
    
    // Confidence increases with more historical data
    const dataQuality = Math.min(historicalData.length / 90, 1.0);
    baseConfidence *= (0.7 + 0.3 * dataQuality);
    
    // Confidence decreases with data variance
    const variance = this.calculateVariance(historicalData);
    const stabilityFactor = Math.max(0.5, 1.0 - variance / 100);
    baseConfidence *= stabilityFactor;
    
    return Math.max(0.3, Math.min(0.95, baseConfidence));
  }

  /**
   * Analyze trends in historical data
   */
  analyzeTrends(historicalData) {
    if (historicalData.length < 30) {
      return {
        overall: 'insufficient_data',
        shortTerm: 'stable',
        seasonal: 'unknown'
      };
    }

    const recent30 = historicalData.slice(-30);
    const previous30 = historicalData.slice(-60, -30);
    
    const recentAvg = recent30.reduce((sum, d) => sum + d.value, 0) / recent30.length;
    const previousAvg = previous30.reduce((sum, d) => sum + d.value, 0) / previous30.length;
    
    const change = (recentAvg - previousAvg) / previousAvg;
    
    let overall = 'stable';
    if (change > 0.15) overall = 'increasing';
    else if (change < -0.15) overall = 'decreasing';
    
    return {
      overall,
      shortTerm: this.analyzeShortTermTrend(historicalData.slice(-7)),
      seasonal: this.analyzeSeasonalTrend(historicalData),
      changePercent: Math.round(change * 100)
    };
  }

  analyzeShortTermTrend(recentData) {
    if (recentData.length < 3) return 'stable';
    
    const values = recentData.map(d => d.value);
    let increasing = 0, decreasing = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i-1]) increasing++;
      else if (values[i] < values[i-1]) decreasing++;
    }
    
    if (increasing > decreasing + 1) return 'increasing';
    if (decreasing > increasing + 1) return 'decreasing';
    return 'stable';
  }

  analyzeSeasonalTrend(historicalData) {
    // Simple seasonal analysis - in production, use more sophisticated methods
    const weeklyAvgs = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);
    
    historicalData.forEach(d => {
      const dayOfWeek = moment(d.date).day();
      weeklyAvgs[dayOfWeek] += d.value;
      weeklyCounts[dayOfWeek]++;
    });
    
    for (let i = 0; i < 7; i++) {
      if (weeklyCounts[i] > 0) {
        weeklyAvgs[i] /= weeklyCounts[i];
      }
    }
    
    const maxDay = weeklyAvgs.indexOf(Math.max(...weeklyAvgs));
    const minDay = weeklyAvgs.indexOf(Math.min(...weeklyAvgs));
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      pattern: 'weekly',
      peakDay: dayNames[maxDay],
      lowDay: dayNames[minDay],
      variance: this.calculateVariance(weeklyAvgs)
    };
  }

  /**
   * Generate recommendations based on forecast
   */
  generateRecommendations(forecast) {
    const recommendations = [];
    
    // Analyze forecast patterns
    const avgDemand = forecast.predictions.reduce((sum, p) => sum + p.value, 0) / forecast.predictions.length;
    const maxDemand = Math.max(...forecast.predictions.map(p => p.value));
    const minDemand = Math.min(...forecast.predictions.map(p => p.value));
    
    if (maxDemand > avgDemand * 1.5) {
      recommendations.push({
        type: 'pricing',
        message: 'Consider increasing prices during peak demand periods',
        impact: 'high',
        timeframe: 'short-term'
      });
    }
    
    if (minDemand < avgDemand * 0.5) {
      recommendations.push({
        type: 'promotion',
        message: 'Consider promotional pricing during low demand periods',
        impact: 'medium',
        timeframe: 'short-term'
      });
    }
    
    if (forecast.confidence < 0.7) {
      recommendations.push({
        type: 'data',
        message: 'Collect more historical data to improve forecast accuracy',
        impact: 'medium',
        timeframe: 'long-term'
      });
    }
    
    return recommendations;
  }

  // Helper methods
  generateRouteHash(route) {
    const crypto = require('crypto');
    const routeString = `${route.origin.lat},${route.origin.lng}-${route.destination.lat},${route.destination.lng}`;
    return crypto.createHash('md5').update(routeString).digest('hex').substring(0, 16);
  }

  formatRoute(route) {
    return {
      origin: route.origin.address || `${route.origin.lat}, ${route.origin.lng}`,
      destination: route.destination.address || `${route.destination.lat}, ${route.destination.lng}`
    };
  }

  getCategoryBaseDemand(category) {
    const baseDemands = {
      electronics: 15,
      documents: 25,
      clothing: 10,
      fragile: 8,
      food: 12,
      medical: 5,
      books: 8,
      gifts: 20,
      other: 12
    };
    
    return baseDemands[category] || 12;
  }

  getSeasonalFactor(date) {
    const month = date.month();
    const dayOfWeek = date.day();
    const hour = date.hour();
    
    return this.seasonalPatterns.monthly[month] * 
           this.seasonalPatterns.weekly[dayOfWeek] * 
           this.seasonalPatterns.hourly[hour];
  }

  getHolidayFactor(date) {
    const holiday = this.identifyHoliday(date);
    return holiday ? (this.holidayImpacts[holiday] || 1.0) : 1.0;
  }

  identifyHoliday(date) {
    const month = date.month() + 1;
    const day = date.date();
    
    // Simplified holiday detection
    if (month === 1 && day === 1) return 'new-years';
    if (month === 2 && day === 14) return 'valentines';
    if (month === 7 && day === 4) return 'independence-day';
    if (month === 12 && day === 25) return 'christmas';
    
    return null;
  }

  calculateVariance(data) {
    if (data.length === 0) return 0;
    
    const values = Array.isArray(data[0]) ? data : data.map(d => d.value || d);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }

  calculateAverageConfidence(confidenceArray) {
    return confidenceArray.reduce((sum, c) => sum + c, 0) / confidenceArray.length;
  }

  getWindowSize(granularity) {
    switch (granularity) {
      case 'hourly': return 24;
      case 'daily': return 7;
      case 'weekly': return 4;
      default: return 7;
    }
  }

  estimateAccuracy(historicalData) {
    // Simple accuracy estimation based on data consistency
    if (historicalData.length < 30) return 0.6;
    
    const variance = this.calculateVariance(historicalData);
    const mean = historicalData.reduce((sum, d) => sum + d.value, 0) / historicalData.length;
    
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    // Lower coefficient of variation = higher accuracy
    return Math.max(0.5, Math.min(0.9, 1.0 - coefficientOfVariation));
  }

  // Placeholder methods for external data
  async getCurrentRequests(routeHash) {
    return Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, i) => ({ id: i }));
  }

  async getRecentActivity(routeHash, hours) {
    return Array.from({ length: Math.floor(Math.random() * 10) + 2 }, (_, i) => ({ id: i }));
  }

  async getCompetitorActivity(routeHash) {
    return Math.floor(Math.random() * 10) + 5;
  }

  async getSocialTrends(route) {
    return { trend: Math.random() > 0.5 ? 'positive' : 'neutral' };
  }

  async getUpcomingEvents(days) {
    return []; // Placeholder for upcoming events
  }

  async getWeatherImpact(date) {
    return 0.95 + Math.random() * 0.1; // 0.95 - 1.05
  }

  async getLocalEventImpact(date) {
    return 0.98 + Math.random() * 0.04; // 0.98 - 1.02
  }

  calculateDemandScore(indicators) {
    let score = 50; // Base score
    
    score += indicators.currentRequests * 2;
    score += indicators.recentActivity * 1.5;
    score += indicators.competitorActivity * 0.5;
    score += (indicators.seasonalFactor - 1) * 20;
    
    // Time-based adjustments
    if (indicators.timeOfDay >= 8 && indicators.timeOfDay <= 18) {
      score += 10; // Business hours
    }
    
    if (indicators.dayOfWeek >= 1 && indicators.dayOfWeek <= 5) {
      score += 5; // Weekdays
    }
    
    return Math.max(0, Math.min(100, score));
  }

  categorizeDemandLevel(score) {
    if (score >= 80) return 'very_high';
    if (score >= 65) return 'high';
    if (score >= 45) return 'medium';
    if (score >= 25) return 'low';
    return 'very_low';
  }

  async getShortTermForecast(route, hours) {
    // Simplified short-term forecast
    const predictions = [];
    const now = moment();
    
    for (let i = 0; i < hours; i++) {
      const hour = now.clone().add(i, 'hours');
      const seasonalFactor = this.getSeasonalFactor(hour);
      const baseDemand = 10;
      
      predictions.push({
        hour: hour.format('HH:00'),
        demand: Math.round(baseDemand * seasonalFactor),
        confidence: 0.8 - (i * 0.05)
      });
    }
    
    return predictions;
  }

  generateRealTimeRecommendations(demandScore) {
    const recommendations = [];
    
    if (demandScore >= 80) {
      recommendations.push('Consider increasing prices due to high demand');
      recommendations.push('Prioritize high-value deliveries');
    } else if (demandScore <= 30) {
      recommendations.push('Consider promotional pricing to stimulate demand');
      recommendations.push('Focus on customer acquisition');
    }
    
    return recommendations;
  }

  getDefaultRealTimeDemand() {
    return {
      demandScore: 50,
      level: 'medium',
      indicators: {
        activeRequests: 10,
        recentActivity: 5,
        competitorActivity: 8,
        socialTrend: 'neutral',
        seasonalFactor: 1.0
      },
      shortTermForecast: [],
      recommendations: ['Monitor demand patterns closely']
    };
  }

  getSeasonalFactors(startDate, timeHorizon, granularity) {
    const factors = [];
    const current = startDate.clone();
    
    for (let i = 0; i < timeHorizon; i++) {
      factors.push({
        date: current.toISOString(),
        factor: this.getSeasonalFactor(current)
      });
      
      current.add(1, granularity === 'hourly' ? 'hours' : 'days');
    }
    
    return factors;
  }
}

module.exports = DemandForecastEngine;