const express = require('express');
const router = express.Router();
const PricingService = require('../services/pricingService');
const {
  authenticateToken,
  validateCalculatePrice,
  validateMarketAnalysisQuery,
  validateOptimizePricing,
  validateExchangeRatesQuery,
  rateLimitConfigs
} = require('../middleware');

const pricingService = new PricingService();

// Apply pricing-specific rate limiting
router.use(rateLimitConfigs.pricing);

/**
 * @route POST /api/v1/payments/calculate-price
 * @desc Calculate delivery price
 * @access Private
 */
router.post('/calculate-price', 
  authenticateToken,
  validateCalculatePrice,
  async (req, res) => {
    const pricing = await pricingService.calculatePrice(req.body.deliveryRequest, req.body.options);
    
    res.json({
      success: true,
      data: pricing
    });
  }
);

/**
 * @route GET /api/v1/payments/market-analysis
 * @desc Get market pricing analysis
 * @access Private
 */
router.get('/market-analysis',
  authenticateToken,
  validateMarketAnalysisQuery,
  async (req, res) => {
    const analysis = await pricingService.getMarketAnalysis(req.query);
    
    res.json({
      success: true,
      data: analysis
    });
  }
);

/**
 * @route POST /api/v1/payments/optimize-pricing
 * @desc Optimize pricing for maximum acceptance or revenue
 * @access Private
 */
router.post('/optimize-pricing',
  authenticateToken,
  validateOptimizePricing,
  async (req, res) => {
    const optimization = await pricingService.optimizePricing(req.body);
    
    res.json({
      success: true,
      data: optimization
    });
  }
);

/**
 * @route GET /api/v1/payments/exchange-rates
 * @desc Get currency exchange rates
 * @access Private
 */
router.get('/exchange-rates',
  authenticateToken,
  validateExchangeRatesQuery,
  async (req, res) => {
    const { from, to, amount } = req.query;
    const rates = await pricingService.getExchangeRates(from, to, amount);
    
    res.json({
      success: true,
      data: rates
    });
  }
);

module.exports = router;