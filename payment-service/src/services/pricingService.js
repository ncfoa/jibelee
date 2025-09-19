const { logger } = require('../config/logger');
const DynamicPricingEngine = require('../pricing/engines/dynamicPricingEngine');
const MarketAnalysisEngine = require('../pricing/engines/marketAnalysisEngine');
const DemandForecastEngine = require('../pricing/engines/demandForecastEngine');
const { PricingFactor, CurrencyExchange } = require('../models');
const { createRedisClient, cacheUtils } = require('../config/redis');

class PricingService {
  constructor() {
    this.pricingEngine = new DynamicPricingEngine();
    this.marketAnalysis = new MarketAnalysisEngine();
    this.demandForecast = new DemandForecastEngine();
    this.redis = createRedisClient();
    
    // Initialize Redis connection
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      await this.redis.connect();
      logger.info('Pricing service connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
    }
  }

  /**
   * Calculate dynamic price for a delivery request
   * @param {Object} deliveryRequest - Delivery request details
   * @param {Object} options - Pricing options
   * @returns {Object} Pricing calculation result
   */
  async calculatePrice(deliveryRequest, options = {}) {
    try {
      const startTime = Date.now();
      
      // Generate cache key
      const cacheKey = this.generatePricingCacheKey(deliveryRequest, options);
      
      // Check cache first
      if (!options.skipCache) {
        const cachedResult = await this.getCachedPricing(cacheKey);
        if (cachedResult) {
          logger.debug(`Pricing cache hit for key: ${cacheKey}`);
          return {
            ...cachedResult,
            cached: true,
            cacheKey
          };
        }
      }

      // Calculate price using dynamic pricing engine
      const pricingResult = await this.pricingEngine.calculatePrice(deliveryRequest, options);
      
      // Add service metadata
      pricingResult.metadata = {
        ...pricingResult.metadata,
        serviceVersion: '1.0.0',
        calculationTime: Date.now() - startTime,
        cacheKey,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      await this.cachePricingResult(cacheKey, pricingResult);

      // Update pricing factors if needed
      await this.updatePricingFactors(deliveryRequest, pricingResult);

      return pricingResult;

    } catch (error) {
      logger.error('Error calculating price:', error);
      throw new Error(`Price calculation failed: ${error.message}`);
    }
  }

  /**
   * Get market analysis for a route
   * @param {Object} params - Analysis parameters
   * @returns {Object} Market analysis result
   */
  async getMarketAnalysis(params) {
    try {
      const cacheKey = this.generateMarketCacheKey(params);
      
      // Check cache
      const cachedResult = await this.getCachedMarketData(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true
        };
      }

      // Get fresh market analysis
      const analysis = await this.marketAnalysis.getMarketAnalysis(params);
      
      // Cache the result
      await this.cacheMarketData(cacheKey, analysis);

      return analysis;

    } catch (error) {
      logger.error('Error getting market analysis:', error);
      throw new Error(`Market analysis failed: ${error.message}`);
    }
  }

  /**
   * Get demand forecast for a route
   * @param {Object} params - Forecast parameters
   * @returns {Object} Demand forecast result
   */
  async getDemandForecast(params) {
    try {
      const forecast = await this.demandForecast.generateForecast(params);
      return forecast;
    } catch (error) {
      logger.error('Error getting demand forecast:', error);
      throw new Error(`Demand forecast failed: ${error.message}`);
    }
  }

  /**
   * Get real-time demand indicators
   * @param {Object} route - Route information
   * @returns {Object} Real-time demand data
   */
  async getRealTimeDemand(route) {
    try {
      return await this.demandForecast.getRealTimeDemand(route);
    } catch (error) {
      logger.error('Error getting real-time demand:', error);
      throw new Error(`Real-time demand analysis failed: ${error.message}`);
    }
  }

  /**
   * Optimize pricing for maximum acceptance or revenue
   * @param {Object} optimizationRequest - Optimization parameters
   * @returns {Object} Optimization recommendations
   */
  async optimizePricing(optimizationRequest) {
    try {
      const {
        route,
        itemCategory,
        currentPrice,
        goals = {},
        constraints = {}
      } = optimizationRequest;

      // Get market data for the route
      const marketData = await this.getMarketAnalysis({
        origin: route.origin,
        destination: route.destination,
        category: itemCategory
      });

      // Calculate alternative prices
      const alternatives = await this.generatePriceAlternatives(
        currentPrice,
        marketData,
        goals,
        constraints
      );

      // Analyze current price position
      const currentAnalysis = this.analyzePricePosition(currentPrice, marketData);

      // Generate recommendations
      const recommendations = this.generateOptimizationRecommendations(
        currentPrice,
        alternatives,
        marketData,
        goals
      );

      return {
        currentPrice,
        recommendations: {
          optimizedPrice: recommendations.bestPrice,
          priceChange: recommendations.bestPrice - currentPrice,
          expectedOutcome: recommendations.expectedOutcome
        },
        analysis: {
          currentPrice: currentAnalysis,
          alternatives
        },
        factors: {
          seasonality: marketData.trends?.seasonalFactor || 'neutral',
          demand: this.categorizeDemandLevel(marketData.marketData?.totalDeliveries || 0),
          competition: marketData.competitorAnalysis?.totalCompetitors > 20 ? 'high' : 'medium',
          routePopularity: marketData.marketData?.totalDeliveries > 100 ? 'very_high' : 'medium'
        }
      };

    } catch (error) {
      logger.error('Error optimizing pricing:', error);
      throw new Error(`Pricing optimization failed: ${error.message}`);
    }
  }

  /**
   * Get currency exchange rates
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @param {number} amount - Amount to convert
   * @returns {Object} Exchange rate information
   */
  async getExchangeRates(fromCurrency, toCurrency, amount = 100) {
    try {
      // Check cache first
      const cacheKey = `exchange_${fromCurrency}_${toCurrency}`;
      const cachedRate = await this.getCachedExchangeRate(cacheKey);
      
      if (cachedRate) {
        return this.formatExchangeResponse(fromCurrency, toCurrency, amount, cachedRate);
      }

      // Get from database
      let exchangeRate = await CurrencyExchange.findOne({
        where: {
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase()
        },
        order: [['validFrom', 'DESC']]
      });

      // If not found, try reverse rate
      if (!exchangeRate) {
        exchangeRate = await CurrencyExchange.findOne({
          where: {
            fromCurrency: toCurrency.toUpperCase(),
            toCurrency: fromCurrency.toUpperCase()
          },
          order: [['validFrom', 'DESC']]
        });
        
        if (exchangeRate) {
          // Use inverse rate
          exchangeRate.rate = 1 / exchangeRate.rate;
        }
      }

      // If still not found, fetch from external API
      if (!exchangeRate) {
        exchangeRate = await this.fetchExchangeRateFromAPI(fromCurrency, toCurrency);
      }

      if (!exchangeRate) {
        throw new Error(`Exchange rate not available for ${fromCurrency} to ${toCurrency}`);
      }

      // Cache the rate
      await this.cacheExchangeRate(cacheKey, exchangeRate);

      return this.formatExchangeResponse(fromCurrency, toCurrency, amount, exchangeRate);

    } catch (error) {
      logger.error('Error getting exchange rates:', error);
      throw new Error(`Exchange rate lookup failed: ${error.message}`);
    }
  }

  /**
   * Update pricing factors based on market conditions
   * @param {Object} deliveryRequest - Delivery request
   * @param {Object} pricingResult - Pricing calculation result
   */
  async updatePricingFactors(deliveryRequest, pricingResult) {
    try {
      const routeHash = this.generateRouteHash(deliveryRequest.route);
      
      // Check if we should update pricing factors
      const shouldUpdate = await this.shouldUpdatePricingFactors(routeHash);
      if (!shouldUpdate) {
        return;
      }

      // Create or update pricing factors
      const factorData = {
        routeHash,
        itemCategory: deliveryRequest.item?.category,
        urgency: deliveryRequest.urgency,
        basePrice: pricingResult.pricing.basePrice,
        distanceMultiplier: pricingResult.factors.distance.multiplier,
        weightMultiplier: pricingResult.factors.weight.multiplier,
        urgencyMultiplier: pricingResult.factors.urgency.multiplier,
        categoryMultiplier: pricingResult.factors.item.multiplier,
        demandMultiplier: pricingResult.factors.timing.multiplier,
        confidence: pricingResult.confidence,
        sampleSize: 1,
        effectiveFrom: new Date(),
        createdBy: 'system',
        source: 'dynamic_pricing_engine'
      };

      await PricingFactor.upsert(factorData);
      
      logger.debug(`Updated pricing factors for route ${routeHash}`);

    } catch (error) {
      logger.error('Error updating pricing factors:', error);
    }
  }

  // Cache management methods
  async getCachedPricing(cacheKey) {
    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Error getting cached pricing:', error);
      return null;
    }
  }

  async cachePricingResult(cacheKey, result) {
    try {
      await this.redis.setEx(
        cacheKey,
        cacheUtils.ttl.pricingData,
        JSON.stringify(result)
      );
    } catch (error) {
      logger.warn('Error caching pricing result:', error);
    }
  }

  async getCachedMarketData(cacheKey) {
    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Error getting cached market data:', error);
      return null;
    }
  }

  async cacheMarketData(cacheKey, data) {
    try {
      await this.redis.setEx(
        cacheKey,
        cacheUtils.ttl.marketData,
        JSON.stringify(data)
      );
    } catch (error) {
      logger.warn('Error caching market data:', error);
    }
  }

  async getCachedExchangeRate(cacheKey) {
    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Error getting cached exchange rate:', error);
      return null;
    }
  }

  async cacheExchangeRate(cacheKey, rate) {
    try {
      await this.redis.setEx(
        cacheKey,
        cacheUtils.ttl.exchangeRates,
        JSON.stringify(rate)
      );
    } catch (error) {
      logger.warn('Error caching exchange rate:', error);
    }
  }

  // Helper methods
  generatePricingCacheKey(deliveryRequest, options) {
    const crypto = require('crypto');
    const keyData = {
      route: deliveryRequest.route,
      item: deliveryRequest.item,
      urgency: deliveryRequest.urgency,
      timeWindow: deliveryRequest.timeWindow,
      traveler: deliveryRequest.traveler,
      options
    };
    
    const keyString = JSON.stringify(keyData);
    return `pricing:${crypto.createHash('md5').update(keyString).digest('hex')}`;
  }

  generateMarketCacheKey(params) {
    const crypto = require('crypto');
    const keyString = JSON.stringify(params);
    return `market:${crypto.createHash('md5').update(keyString).digest('hex')}`;
  }

  generateRouteHash(route) {
    const crypto = require('crypto');
    const routeString = `${route.origin.lat},${route.origin.lng}-${route.destination.lat},${route.destination.lng}`;
    return crypto.createHash('md5').update(routeString).digest('hex');
  }

  async shouldUpdatePricingFactors(routeHash) {
    // Update factors every 100 pricing calculations or daily
    const updateKey = `pricing_update:${routeHash}`;
    try {
      const count = await this.redis.incr(updateKey);
      if (count === 1) {
        await this.redis.expire(updateKey, 86400); // 24 hours
      }
      return count % 100 === 0; // Update every 100 calculations
    } catch (error) {
      return false;
    }
  }

  async generatePriceAlternatives(currentPrice, marketData, goals, constraints) {
    const alternatives = [];
    const { minPrice = currentPrice * 0.7, maxPrice = currentPrice * 1.3 } = constraints;
    const avgMarketPrice = marketData.marketData?.averagePrice || currentPrice;
    
    // Budget option
    const budgetPrice = Math.max(minPrice, avgMarketPrice * 0.85);
    alternatives.push({
      price: budgetPrice,
      acceptanceProbability: this.estimateAcceptanceProbability(budgetPrice, avgMarketPrice),
      revenue: budgetPrice * this.estimateAcceptanceProbability(budgetPrice, avgMarketPrice) / 100,
      description: 'Budget-friendly option'
    });

    // Market average option
    alternatives.push({
      price: avgMarketPrice,
      acceptanceProbability: this.estimateAcceptanceProbability(avgMarketPrice, avgMarketPrice),
      revenue: avgMarketPrice * this.estimateAcceptanceProbability(avgMarketPrice, avgMarketPrice) / 100,
      description: 'Market average'
    });

    // Premium option
    const premiumPrice = Math.min(maxPrice, avgMarketPrice * 1.15);
    alternatives.push({
      price: premiumPrice,
      acceptanceProbability: this.estimateAcceptanceProbability(premiumPrice, avgMarketPrice),
      revenue: premiumPrice * this.estimateAcceptanceProbability(premiumPrice, avgMarketPrice) / 100,
      description: 'Premium pricing'
    });

    return alternatives;
  }

  estimateAcceptanceProbability(price, marketAverage) {
    // Simplified acceptance probability model
    const ratio = price / marketAverage;
    
    if (ratio <= 0.8) return 95;
    if (ratio <= 0.9) return 88;
    if (ratio <= 1.0) return 80;
    if (ratio <= 1.1) return 70;
    if (ratio <= 1.2) return 60;
    if (ratio <= 1.3) return 45;
    return 30;
  }

  analyzePricePosition(currentPrice, marketData) {
    const avgPrice = marketData.marketData?.averagePrice || currentPrice;
    const ratio = currentPrice / avgPrice;
    
    let position = 'average';
    if (ratio <= 0.85) position = 'below_average';
    else if (ratio >= 1.15) position = 'above_average';
    
    return {
      acceptanceProbability: this.estimateAcceptanceProbability(currentPrice, avgPrice),
      marketPosition: position,
      competitorComparison: `${((ratio - 1) * 100).toFixed(1)}%`
    };
  }

  generateOptimizationRecommendations(currentPrice, alternatives, marketData, goals) {
    let bestAlternative = alternatives[0];
    
    if (goals.maximizeAcceptance) {
      bestAlternative = alternatives.reduce((best, alt) => 
        alt.acceptanceProbability > best.acceptanceProbability ? alt : best
      );
    } else if (goals.maximizeRevenue) {
      bestAlternative = alternatives.reduce((best, alt) => 
        alt.revenue > best.revenue ? alt : best
      );
    }

    return {
      bestPrice: bestAlternative.price,
      expectedOutcome: {
        acceptanceProbability: bestAlternative.acceptanceProbability,
        expectedRevenue: bestAlternative.revenue,
        marketPosition: bestAlternative.price > marketData.marketData?.averagePrice ? 'above_average' : 'competitive'
      }
    };
  }

  categorizeDemandLevel(deliveryCount) {
    if (deliveryCount > 100) return 'high';
    if (deliveryCount > 50) return 'medium';
    return 'low';
  }

  async fetchExchangeRateFromAPI(fromCurrency, toCurrency) {
    // Simplified external API call
    // In production, use a real currency API like Fixer.io, CurrencyLayer, etc.
    try {
      // Mock API response
      const mockRates = {
        'USD-EUR': 0.85,
        'USD-GBP': 0.73,
        'EUR-USD': 1.18,
        'GBP-USD': 1.37
      };
      
      const key = `${fromCurrency}-${toCurrency}`;
      const rate = mockRates[key];
      
      if (rate) {
        return {
          rate,
          source: 'api',
          provider: 'mock_api',
          feeRate: 0.025,
          minimumFee: 0.50,
          confidence: 0.95,
          dataAge: 0
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching exchange rate from API:', error);
      return null;
    }
  }

  formatExchangeResponse(fromCurrency, toCurrency, amount, exchangeRate) {
    const convertedAmount = amount * exchangeRate.rate;
    const fee = exchangeRate.calculateFee ? exchangeRate.calculateFee(convertedAmount) : convertedAmount * (exchangeRate.feeRate || 0.025);
    const netAmount = convertedAmount - fee;

    return {
      from: fromCurrency.toUpperCase(),
      to: toCurrency.toUpperCase(),
      rate: exchangeRate.rate,
      amount,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      timestamp: new Date().toISOString(),
      validUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      provider: exchangeRate.provider || 'internal',
      confidence: exchangeRate.confidence || 0.95
    };
  }
}

module.exports = PricingService;