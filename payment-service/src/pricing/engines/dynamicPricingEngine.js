const geolib = require('geolib');
const moment = require('moment');
const { logger, paymentLogger } = require('../../config/logger');
const { PricingFactor } = require('../../models');
const MarketAnalysisEngine = require('./marketAnalysisEngine');
const DemandForecastEngine = require('./demandForecastEngine');

class DynamicPricingEngine {
  constructor() {
    this.marketAnalysis = new MarketAnalysisEngine();
    this.demandForecast = new DemandForecastEngine();
    
    // Base pricing configuration
    this.config = {
      baseFee: parseFloat(process.env.BASE_FEE) || 15.00,
      distanceRate: parseFloat(process.env.DISTANCE_RATE) || 0.05, // per km
      weightRate: parseFloat(process.env.WEIGHT_RATE) || 5.00, // per kg
      
      // Multiplier limits
      maxUrgencyMultiplier: 2.0,
      maxCategoryMultiplier: 1.5,
      maxDemandMultiplier: 1.5,
      maxTimeMultiplier: 1.3,
      
      // Minimum and maximum prices
      minimumPrice: 10.00,
      maximumPrice: 500.00,
      
      // Model confidence thresholds
      minConfidenceForML: 0.7,
      fallbackToRules: true
    };
  }

  /**
   * Calculate dynamic price for a delivery request
   * @param {Object} deliveryRequest - The delivery request details
   * @param {Object} options - Additional pricing options
   * @returns {Object} Pricing breakdown and recommendations
   */
  async calculatePrice(deliveryRequest, options = {}) {
    try {
      const startTime = Date.now();
      
      // Extract and validate pricing features
      const features = await this.extractPricingFeatures(deliveryRequest);
      
      // Get or create pricing factors
      const pricingFactors = await this.getPricingFactors(features);
      
      // Calculate base price using ML model or rules
      const basePrice = await this.calculateBasePrice(features, pricingFactors);
      
      // Apply dynamic multipliers
      const multipliers = await this.calculateMultipliers(deliveryRequest, features);
      
      // Calculate final price
      const finalPrice = this.applyMultipliers(basePrice, multipliers);
      
      // Get market adjustments
      const marketAdjustment = await this.getMarketAdjustment(deliveryRequest, features);
      const adjustedPrice = finalPrice * marketAdjustment;
      
      // Apply constraints
      const constrainedPrice = this.applyPriceConstraints(adjustedPrice, deliveryRequest);
      
      // Generate price alternatives
      const alternatives = await this.generatePriceAlternatives(constrainedPrice, deliveryRequest);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(features, pricingFactors);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(constrainedPrice, deliveryRequest, features);
      
      const result = {
        pricing: {
          basePrice: Math.round(basePrice * 100) / 100,
          breakdown: {
            baseFee: this.config.baseFee,
            distanceFee: features.distance * this.config.distanceRate,
            weightFee: features.weight * this.config.weightRate,
            urgencyMultiplier: (multipliers.urgency - 1) * basePrice,
            fragileMultiplier: features.isFragile ? (multipliers.category - 1) * basePrice : 0,
            categoryFee: this.calculateCategoryFee(features.category),
            timingFee: this.calculateTimingFee(features),
            travelerExperienceFee: this.calculateExperienceFee(deliveryRequest.traveler),
            insuranceFee: options.includeInsurance ? this.calculateInsuranceFee(features.value) : 0,
            serviceFeesTotal: this.calculateServiceFees(deliveryRequest.options || {}),
            platformFee: Math.round(constrainedPrice * 0.10 * 100) / 100
          },
          subtotal: Math.round(constrainedPrice * 100) / 100,
          platformFee: Math.round(constrainedPrice * 0.10 * 100) / 100,
          total: Math.round(constrainedPrice * 1.10 * 100) / 100,
          currency: 'USD'
        },
        priceRange: {
          minimum: Math.round(constrainedPrice * 0.7 * 100) / 100,
          maximum: Math.round(constrainedPrice * 1.3 * 100) / 100,
          recommended: Math.round(constrainedPrice * 100) / 100,
          marketAverage: features.marketAverage || constrainedPrice
        },
        factors: {
          distance: {
            km: features.distance,
            impact: this.getImpactLevel(multipliers.distance),
            multiplier: multipliers.distance
          },
          weight: {
            kg: features.weight,
            impact: this.getImpactLevel(multipliers.weight),
            multiplier: multipliers.weight
          },
          urgency: {
            level: deliveryRequest.urgency,
            impact: this.getImpactLevel(multipliers.urgency),
            multiplier: multipliers.urgency
          },
          timing: {
            isPeakTime: features.isPeakTime,
            demandLevel: features.demandLevel,
            multiplier: multipliers.time
          },
          route: {
            popularity: features.routePopularity,
            competition: features.competition,
            multiplier: marketAdjustment
          },
          item: {
            category: features.category,
            fragile: features.isFragile,
            riskLevel: features.riskLevel,
            multiplier: multipliers.category
          }
        },
        recommendations,
        alternatives,
        confidence,
        metadata: {
          calculationTime: Date.now() - startTime,
          modelVersion: '1.0.0',
          features: features
        }
      };

      // Log pricing calculation
      paymentLogger.priceCalculated(
        features.routeHash,
        basePrice,
        constrainedPrice,
        multipliers
      );

      return result;

    } catch (error) {
      logger.error('Error calculating dynamic price:', error);
      throw new Error(`Pricing calculation failed: ${error.message}`);
    }
  }

  /**
   * Extract pricing features from delivery request
   */
  async extractPricingFeatures(deliveryRequest) {
    const route = deliveryRequest.route;
    const item = deliveryRequest.item;
    
    // Calculate distance
    const distance = geolib.getDistance(
      { latitude: route.origin.lat, longitude: route.origin.lng },
      { latitude: route.destination.lat, longitude: route.destination.lng }
    ) / 1000; // Convert to kilometers
    
    // Generate route hash
    const routeHash = this.generateRouteHash(route);
    
    // Get historical data for this route
    const routeHistory = await this.getRouteHistory(routeHash);
    
    // Get market conditions
    const marketConditions = await this.marketAnalysis.getCurrentConditions(route);
    
    // Extract time-based features
    const timeFeatures = this.extractTimeFeatures(deliveryRequest.timeWindow);
    
    return {
      // Route features
      distance,
      routeHash,
      routePopularity: routeHistory.requestCount || 0,
      marketAverage: routeHistory.averagePrice || null,
      
      // Item features
      weight: item.weight || 1,
      volume: this.calculateVolume(item.dimensions || {}),
      value: item.value || 0,
      category: item.category || 'other',
      isFragile: item.fragile || false,
      isHazardous: item.hazardous || false,
      riskLevel: this.calculateRiskLevel(item),
      
      // Urgency features
      urgency: deliveryRequest.urgency || 'standard',
      timeFlexibility: timeFeatures.flexibility,
      
      // Market features
      supply: marketConditions.availableCapacity || 50,
      demand: marketConditions.pendingRequests || 10,
      competition: marketConditions.competition || 'medium',
      demandLevel: this.calculateDemandLevel(marketConditions),
      
      // Time features
      dayOfWeek: timeFeatures.dayOfWeek,
      hourOfDay: timeFeatures.hourOfDay,
      isWeekend: timeFeatures.isWeekend,
      isHoliday: timeFeatures.isHoliday,
      isPeakTime: timeFeatures.isPeakTime,
      
      // Economic features
      seasonalityFactor: marketConditions.seasonalityFactor || 1.0,
      fuelPrice: marketConditions.fuelPrice || 1.0
    };
  }

  /**
   * Calculate multipliers for different factors
   */
  async calculateMultipliers(deliveryRequest, features) {
    return {
      distance: this.calculateDistanceMultiplier(features.distance),
      weight: this.calculateWeightMultiplier(features.weight),
      urgency: this.calculateUrgencyMultiplier(features.urgency),
      category: this.calculateCategoryMultiplier(features.category, features.isFragile),
      demand: this.calculateDemandMultiplier(features),
      time: this.calculateTimeMultiplier(features),
      value: this.calculateValueMultiplier(features.value),
      complexity: this.calculateComplexityMultiplier(features)
    };
  }

  calculateDistanceMultiplier(distance) {
    // Logarithmic scaling for distance to avoid extreme prices for long distances
    const baseMultiplier = 1.0;
    const scalingFactor = Math.log(1 + distance / 100) * 0.1;
    return Math.min(baseMultiplier + scalingFactor, 2.0);
  }

  calculateWeightMultiplier(weight) {
    if (weight <= 1) return 1.0;
    if (weight <= 5) return 1.1;
    if (weight <= 10) return 1.25;
    if (weight <= 20) return 1.5;
    return 1.8;
  }

  calculateUrgencyMultiplier(urgency) {
    const multipliers = {
      standard: 1.0,
      express: 1.5,
      urgent: 2.0
    };
    return Math.min(multipliers[urgency] || 1.0, this.config.maxUrgencyMultiplier);
  }

  calculateCategoryMultiplier(category, isFragile = false) {
    const baseMultipliers = {
      electronics: 1.3,
      documents: 1.0,
      clothing: 1.0,
      fragile: 1.4,
      food: 1.2,
      medical: 1.5,
      books: 1.0,
      gifts: 1.1,
      other: 1.0
    };
    
    let multiplier = baseMultipliers[category] || 1.0;
    
    // Additional fragile multiplier
    if (isFragile && category !== 'fragile') {
      multiplier *= 1.2;
    }
    
    return Math.min(multiplier, this.config.maxCategoryMultiplier);
  }

  calculateDemandMultiplier(features) {
    const supplyDemandRatio = features.supply / Math.max(features.demand, 1);
    
    let multiplier = 1.0;
    
    if (supplyDemandRatio < 0.5) {
      multiplier = 1.4; // High demand, low supply
    } else if (supplyDemandRatio < 1.0) {
      multiplier = 1.2; // Medium-high demand
    } else if (supplyDemandRatio > 2.0) {
      multiplier = 0.9; // Low demand, high supply
    }
    
    return Math.min(multiplier, this.config.maxDemandMultiplier);
  }

  calculateTimeMultiplier(features) {
    let multiplier = 1.0;
    
    // Peak time adjustment
    if (features.isPeakTime) {
      multiplier *= 1.2;
    }
    
    // Weekend adjustment
    if (features.isWeekend) {
      multiplier *= 1.1;
    }
    
    // Holiday adjustment
    if (features.isHoliday) {
      multiplier *= 1.15;
    }
    
    return Math.min(multiplier, this.config.maxTimeMultiplier);
  }

  calculateValueMultiplier(value) {
    if (value <= 100) return 1.0;
    if (value <= 500) return 1.05;
    if (value <= 1000) return 1.1;
    if (value <= 5000) return 1.2;
    return 1.3;
  }

  calculateComplexityMultiplier(features) {
    let complexity = 1.0;
    
    if (features.isHazardous) complexity += 0.3;
    if (features.isFragile) complexity += 0.2;
    if (features.urgency === 'urgent') complexity += 0.1;
    if (features.weight > 20) complexity += 0.1;
    
    return Math.min(complexity, 1.5);
  }

  /**
   * Apply price constraints and limits
   */
  applyPriceConstraints(price, deliveryRequest) {
    // Apply minimum and maximum constraints
    let constrainedPrice = Math.max(price, this.config.minimumPrice);
    constrainedPrice = Math.min(constrainedPrice, this.config.maximumPrice);
    
    // Round to reasonable precision
    return Math.round(constrainedPrice * 100) / 100;
  }

  /**
   * Generate price alternatives
   */
  async generatePriceAlternatives(basePrice, deliveryRequest) {
    return [
      {
        price: Math.round(basePrice * 0.85 * 100) / 100,
        acceptanceProbability: 92,
        revenue: Math.round(basePrice * 0.85 * 0.92 * 100) / 100,
        description: 'Budget-friendly option'
      },
      {
        price: Math.round(basePrice * 100) / 100,
        acceptanceProbability: 78,
        revenue: Math.round(basePrice * 0.78 * 100) / 100,
        description: 'Recommended price'
      },
      {
        price: Math.round(basePrice * 1.15 * 100) / 100,
        acceptanceProbability: 65,
        revenue: Math.round(basePrice * 1.15 * 0.65 * 100) / 100,
        description: 'Premium pricing'
      }
    ];
  }

  /**
   * Generate pricing recommendations
   */
  async generateRecommendations(price, deliveryRequest, features) {
    const recommendations = {
      suggestedPrice: price,
      competitiveRange: {
        min: Math.round(price * 0.9 * 100) / 100,
        max: Math.round(price * 1.1 * 100) / 100
      },
      demandForecast: features.demandLevel,
      tips: []
    };

    // Add contextual tips
    if (features.isFragile) {
      recommendations.tips.push('Consider offering photo updates for fragile items');
    }
    
    if (features.routePopularity > 50) {
      recommendations.tips.push('This is a popular route with good acceptance rates');
    }
    
    if (features.category === 'electronics') {
      recommendations.tips.push('Electronics delivery typically has higher acceptance rates');
    }

    return recommendations;
  }

  // Helper methods
  generateRouteHash(route) {
    const crypto = require('crypto');
    const routeString = `${route.origin.lat},${route.origin.lng}-${route.destination.lat},${route.destination.lng}`;
    return crypto.createHash('md5').update(routeString).digest('hex');
  }

  calculateVolume(dimensions) {
    const { length = 10, width = 10, height = 10 } = dimensions;
    return (length * width * height) / 1000; // Convert to liters
  }

  calculateRiskLevel(item) {
    let risk = 0;
    if (item.fragile) risk += 0.3;
    if (item.hazardous) risk += 0.5;
    if (item.value > 1000) risk += 0.2;
    
    if (risk >= 0.7) return 'high';
    if (risk >= 0.4) return 'medium';
    return 'low';
  }

  extractTimeFeatures(timeWindow) {
    const now = moment();
    const pickup = timeWindow?.pickup?.start ? moment(timeWindow.pickup.start) : now;
    
    return {
      dayOfWeek: pickup.day(),
      hourOfDay: pickup.hour(),
      isWeekend: pickup.day() === 0 || pickup.day() === 6,
      isHoliday: this.isHoliday(pickup),
      isPeakTime: this.isPeakTime(pickup),
      flexibility: this.calculateTimeFlexibility(timeWindow)
    };
  }

  isPeakTime(moment) {
    const hour = moment.hour();
    const day = moment.day();
    
    // Weekday rush hours
    if (day >= 1 && day <= 5) {
      return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    }
    
    // Weekend peak times
    return hour >= 10 && hour <= 16;
  }

  isHoliday(moment) {
    // Simplified holiday detection - in production, use a proper holiday library
    const month = moment.month() + 1;
    const date = moment.date();
    
    // Major US holidays (simplified)
    const holidays = [
      { month: 1, date: 1 },   // New Year's Day
      { month: 7, date: 4 },   // Independence Day
      { month: 12, date: 25 }  // Christmas
    ];
    
    return holidays.some(h => h.month === month && h.date === date);
  }

  calculateTimeFlexibility(timeWindow) {
    if (!timeWindow?.pickup || !timeWindow?.delivery) return 0.5;
    
    const pickupWindow = moment(timeWindow.pickup.end).diff(moment(timeWindow.pickup.start), 'hours');
    const deliveryWindow = moment(timeWindow.delivery.end).diff(moment(timeWindow.delivery.start), 'hours');
    
    const totalFlexibility = (pickupWindow + deliveryWindow) / 24; // Normalize to 0-1
    return Math.min(totalFlexibility, 1.0);
  }

  calculateDemandLevel(marketConditions) {
    const ratio = marketConditions.pendingRequests / Math.max(marketConditions.availableCapacity, 1);
    
    if (ratio >= 2.0) return 'very_high';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.0) return 'medium';
    if (ratio >= 0.5) return 'low';
    return 'very_low';
  }

  getImpactLevel(multiplier) {
    if (multiplier >= 1.3) return 'high';
    if (multiplier >= 1.1) return 'medium';
    if (multiplier <= 0.9) return 'negative';
    return 'low';
  }

  calculateCategoryFee(category) {
    const fees = {
      electronics: 5.00,
      documents: 0.00,
      clothing: 0.00,
      fragile: 7.50,
      food: 3.00,
      medical: 10.00,
      books: 0.00,
      gifts: 2.50,
      other: 0.00
    };
    
    return fees[category] || 0.00;
  }

  calculateTimingFee(features) {
    let fee = 0;
    
    if (features.isPeakTime) fee += 2.50;
    if (features.isWeekend) fee += 1.50;
    if (features.isHoliday) fee += 3.00;
    
    return fee;
  }

  calculateExperienceFee(traveler) {
    if (!traveler) return 0;
    
    const rating = traveler.rating || 0;
    const experience = traveler.experienceLevel || 'novice';
    
    let fee = 0;
    
    if (rating >= 4.8) fee += 2.00;
    else if (rating >= 4.5) fee += 1.00;
    
    if (experience === 'expert') fee += 1.50;
    else if (experience === 'experienced') fee += 0.75;
    
    return fee;
  }

  calculateInsuranceFee(value) {
    if (value <= 100) return 2.50;
    if (value <= 500) return 5.00;
    if (value <= 1000) return 7.50;
    return Math.min(value * 0.01, 25.00);
  }

  calculateServiceFees(options) {
    let total = 0;
    
    if (options.whiteGloveService) total += 15.00;
    if (options.photoUpdates) total += 2.50;
    if (options.signatureRequired) total += 1.50;
    if (options.expeditedService) total += 10.00;
    
    return total;
  }

  // Placeholder methods for external data
  async getRouteHistory(routeHash) {
    // In production, this would query the database for historical pricing data
    return {
      requestCount: Math.floor(Math.random() * 100),
      averagePrice: 50 + Math.random() * 30
    };
  }

  async getPricingFactors(features) {
    try {
      return await PricingFactor.findOne({
        where: {
          routeHash: features.routeHash,
          itemCategory: features.category,
          urgency: features.urgency
        },
        order: [['effectiveFrom', 'DESC']]
      });
    } catch (error) {
      logger.warn('Could not fetch pricing factors:', error);
      return null;
    }
  }

  async calculateBasePrice(features, pricingFactors) {
    if (pricingFactors && pricingFactors.confidence >= this.config.minConfidenceForML) {
      return pricingFactors.calculatePrice(features);
    }
    
    // Fallback to rule-based pricing
    return this.config.baseFee + 
           (features.distance * this.config.distanceRate) + 
           (features.weight * this.config.weightRate);
  }

  calculateConfidence(features, pricingFactors) {
    let confidence = 0.7; // Base confidence
    
    if (pricingFactors) {
      confidence = Math.max(confidence, pricingFactors.confidence || 0.5);
    }
    
    // Adjust based on data availability
    if (features.routePopularity > 10) confidence += 0.1;
    if (features.marketAverage) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  async getMarketAdjustment(deliveryRequest, features) {
    // Simplified market adjustment - in production, this would use more sophisticated analysis
    const competitionLevel = features.competition;
    
    const adjustments = {
      low: 1.1,      // Less competition = higher prices
      medium: 1.0,   // Normal competition
      high: 0.95     // High competition = lower prices
    };
    
    return adjustments[competitionLevel] || 1.0;
  }
}

module.exports = DynamicPricingEngine;