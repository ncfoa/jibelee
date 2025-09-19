const moment = require('moment');
const { logger } = require('../config/logger');
const { PaymentIntent, FraudAnalysis } = require('../models');
const { Op } = require('sequelize');

class FraudDetectionService {
  constructor() {
    this.riskScoreThreshold = {
      low: 0.3,
      medium: 0.6,
      high: 0.8
    };
    
    // Risk factor weights
    this.weights = {
      paymentMethodRisk: 0.25,
      userBehaviorRisk: 0.20,
      amountRisk: 0.15,
      geographicRisk: 0.15,
      velocityRisk: 0.15,
      deviceRisk: 0.10
    };
    
    // Velocity limits
    this.velocityLimits = {
      maxPaymentsPerHour: 5,
      maxPaymentsPerDay: 20,
      maxAmountPerHour: 50000, // $500 in cents
      maxAmountPerDay: 200000  // $2000 in cents
    };
  }

  /**
   * Analyze payment for fraud risk
   * @param {Object} paymentData - Payment data to analyze
   * @returns {Object} Fraud analysis results
   */
  async analyzePayment(paymentData) {
    try {
      const startTime = Date.now();
      
      // Calculate individual risk factors
      const riskFactors = await this.calculateRiskFactors(paymentData);
      
      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(riskFactors);
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(riskScore);
      
      // Generate recommendation
      const recommendation = this.getRecommendation(riskLevel, riskFactors);
      
      // Check if manual review is required
      const requiresManualReview = this.requiresManualReview(riskLevel, riskFactors);
      
      const analysis = {
        riskScore,
        riskLevel,
        riskFactors: this.formatRiskFactors(riskFactors),
        recommendation,
        requiresManualReview,
        ...riskFactors, // Include individual scores
        analysisTime: Date.now() - startTime,
        modelVersion: '1.0.0',
        timestamp: new Date().toISOString()
      };

      // Log high-risk transactions
      if (riskLevel === 'high') {
        logger.warn('High fraud risk detected:', {
          userId: paymentData.customerId,
          amount: paymentData.amount,
          riskScore,
          topFactors: this.getTopRiskFactors(riskFactors)
        });
      }

      return analysis;

    } catch (error) {
      logger.error('Error in fraud analysis:', error);
      
      // Return safe default for errors
      return {
        riskScore: 0.5,
        riskLevel: 'medium',
        riskFactors: {},
        recommendation: 'review',
        requiresManualReview: true,
        paymentMethodRisk: 0.5,
        userBehaviorRisk: 0.5,
        amountRisk: 0.5,
        geographicRisk: 0.5,
        velocityRisk: 0.5,
        deviceRisk: 0.5,
        error: error.message
      };
    }
  }

  /**
   * Calculate individual risk factors
   */
  async calculateRiskFactors(paymentData) {
    const [
      paymentMethodRisk,
      userBehaviorRisk,
      amountRisk,
      geographicRisk,
      velocityRisk,
      deviceRisk
    ] = await Promise.all([
      this.analyzePaymentMethod(paymentData),
      this.analyzeUserBehavior(paymentData.customerId),
      this.analyzeAmount(paymentData.amount, paymentData.customerId),
      this.analyzeGeography(paymentData),
      this.analyzeVelocity(paymentData.customerId),
      this.analyzeDevice(paymentData)
    ]);

    return {
      paymentMethodRisk,
      userBehaviorRisk,
      amountRisk,
      geographicRisk,
      velocityRisk,
      deviceRisk
    };
  }

  /**
   * Analyze payment method risk
   */
  async analyzePaymentMethod(paymentData) {
    let riskScore = 0.0;
    
    const { paymentMethodType, paymentMethodId } = paymentData;
    
    // Base risk by payment method type
    const methodRisks = {
      card: 0.2,
      bank_transfer: 0.1,
      wallet: 0.15,
      crypto: 0.4
    };
    
    riskScore += methodRisks[paymentMethodType] || 0.3;
    
    // Check if payment method has been used before
    if (paymentMethodId) {
      const previousUse = await this.checkPreviousPaymentMethodUse(paymentMethodId);
      if (!previousUse) {
        riskScore += 0.2; // New payment method increases risk
      }
    }
    
    // Check for stolen card patterns (simplified)
    if (paymentMethodType === 'card') {
      const cardRisk = await this.analyzeCardRisk(paymentData);
      riskScore += cardRisk;
    }
    
    return Math.min(1.0, riskScore);
  }

  /**
   * Analyze user behavior risk
   */
  async analyzeUserBehavior(userId) {
    try {
      const userHistory = await this.getUserPaymentHistory(userId);
      let riskScore = 0.0;
      
      // New user risk
      if (userHistory.totalPayments === 0) {
        riskScore += 0.3;
      }
      
      // Account age risk
      const accountAge = userHistory.accountAge || 0;
      if (accountAge < 7) { // Less than 7 days old
        riskScore += 0.2;
      } else if (accountAge < 30) { // Less than 30 days old
        riskScore += 0.1;
      }
      
      // Failed payment history
      const failureRate = userHistory.totalPayments > 0 
        ? userHistory.failedPayments / userHistory.totalPayments 
        : 0;
      
      if (failureRate > 0.5) {
        riskScore += 0.4;
      } else if (failureRate > 0.2) {
        riskScore += 0.2;
      }
      
      // Chargeback/dispute history
      if (userHistory.chargebacks > 0) {
        riskScore += 0.5;
      }
      
      // Unusual behavior patterns
      if (userHistory.unusualPatterns) {
        riskScore += 0.3;
      }
      
      return Math.min(1.0, riskScore);
      
    } catch (error) {
      logger.error('Error analyzing user behavior:', error);
      return 0.5; // Default medium risk
    }
  }

  /**
   * Analyze amount risk
   */
  analyzeAmount(amount, userId) {
    let riskScore = 0.0;
    
    // High amount risk
    if (amount > 100000) { // > $1000
      riskScore += 0.4;
    } else if (amount > 50000) { // > $500
      riskScore += 0.2;
    } else if (amount > 20000) { // > $200
      riskScore += 0.1;
    }
    
    // Very low amount (potential testing)
    if (amount < 100) { // < $1
      riskScore += 0.3;
    }
    
    // Round number patterns (potential fraud testing)
    if (amount % 1000 === 0 && amount > 1000) {
      riskScore += 0.1;
    }
    
    return Math.min(1.0, riskScore);
  }

  /**
   * Analyze geographic risk
   */
  async analyzeGeography(paymentData) {
    let riskScore = 0.0;
    
    const { ipAddress, country, region } = paymentData;
    
    if (!ipAddress) {
      riskScore += 0.2; // Missing IP is suspicious
      return Math.min(1.0, riskScore);
    }
    
    try {
      // Get IP geolocation (simplified)
      const ipLocation = await this.getIPLocation(ipAddress);
      
      // High-risk countries
      const highRiskCountries = ['XX', 'YY']; // Example country codes
      if (highRiskCountries.includes(ipLocation.country)) {
        riskScore += 0.4;
      }
      
      // VPN/Proxy detection
      if (ipLocation.isProxy || ipLocation.isVPN) {
        riskScore += 0.3;
      }
      
      // Geographic mismatch
      if (country && country !== ipLocation.country) {
        riskScore += 0.2;
      }
      
      // Tor network detection
      if (ipLocation.isTor) {
        riskScore += 0.5;
      }
      
    } catch (error) {
      logger.warn('Error in geographic analysis:', error);
      riskScore += 0.1; // Small penalty for analysis failure
    }
    
    return Math.min(1.0, riskScore);
  }

  /**
   * Analyze velocity risk
   */
  async analyzeVelocity(userId) {
    try {
      const now = moment();
      const oneHourAgo = now.clone().subtract(1, 'hour').toDate();
      const oneDayAgo = now.clone().subtract(1, 'day').toDate();
      
      // Get recent payments
      const [hourlyPayments, dailyPayments] = await Promise.all([
        this.getRecentPayments(userId, oneHourAgo),
        this.getRecentPayments(userId, oneDayAgo)
      ]);
      
      let riskScore = 0.0;
      
      // Check payment count velocity
      if (hourlyPayments.length > this.velocityLimits.maxPaymentsPerHour) {
        riskScore += 0.5;
      } else if (hourlyPayments.length > this.velocityLimits.maxPaymentsPerHour * 0.7) {
        riskScore += 0.3;
      }
      
      if (dailyPayments.length > this.velocityLimits.maxPaymentsPerDay) {
        riskScore += 0.4;
      } else if (dailyPayments.length > this.velocityLimits.maxPaymentsPerDay * 0.7) {
        riskScore += 0.2;
      }
      
      // Check amount velocity
      const hourlyAmount = hourlyPayments.reduce((sum, p) => sum + p.amount, 0);
      const dailyAmount = dailyPayments.reduce((sum, p) => sum + p.amount, 0);
      
      if (hourlyAmount > this.velocityLimits.maxAmountPerHour) {
        riskScore += 0.4;
      } else if (hourlyAmount > this.velocityLimits.maxAmountPerHour * 0.7) {
        riskScore += 0.2;
      }
      
      if (dailyAmount > this.velocityLimits.maxAmountPerDay) {
        riskScore += 0.3;
      } else if (dailyAmount > this.velocityLimits.maxAmountPerDay * 0.7) {
        riskScore += 0.1;
      }
      
      // Unusual patterns (same amounts, rapid succession)
      const amounts = hourlyPayments.map(p => p.amount);
      const uniqueAmounts = new Set(amounts);
      
      if (amounts.length > 3 && uniqueAmounts.size === 1) {
        riskScore += 0.3; // Same amount multiple times
      }
      
      return Math.min(1.0, riskScore);
      
    } catch (error) {
      logger.error('Error analyzing velocity:', error);
      return 0.2; // Default low risk
    }
  }

  /**
   * Analyze device risk
   */
  async analyzeDevice(paymentData) {
    let riskScore = 0.0;
    
    const { deviceFingerprint, userAgent, ipAddress } = paymentData;
    
    // Missing device information
    if (!deviceFingerprint) {
      riskScore += 0.2;
    }
    
    if (!userAgent) {
      riskScore += 0.1;
    }
    
    // Check device history
    if (deviceFingerprint) {
      const deviceHistory = await this.getDeviceHistory(deviceFingerprint);
      
      // New device
      if (deviceHistory.firstSeen) {
        const daysSinceFirstSeen = moment().diff(deviceHistory.firstSeen, 'days');
        if (daysSinceFirstSeen === 0) {
          riskScore += 0.2; // Brand new device
        }
      }
      
      // Device used by multiple users
      if (deviceHistory.userCount > 5) {
        riskScore += 0.3;
      } else if (deviceHistory.userCount > 2) {
        riskScore += 0.1;
      }
      
      // High failure rate on device
      if (deviceHistory.failureRate > 0.5) {
        riskScore += 0.3;
      }
    }
    
    // Suspicious user agent patterns
    if (userAgent) {
      if (this.isSuspiciousUserAgent(userAgent)) {
        riskScore += 0.2;
      }
    }
    
    return Math.min(1.0, riskScore);
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(riskFactors) {
    let totalScore = 0;
    
    for (const [factor, score] of Object.entries(riskFactors)) {
      const weight = this.weights[factor] || 0;
      totalScore += score * weight;
    }
    
    return Math.min(1.0, Math.max(0.0, totalScore));
  }

  /**
   * Determine risk level from score
   */
  determineRiskLevel(riskScore) {
    if (riskScore >= this.riskScoreThreshold.high) return 'high';
    if (riskScore >= this.riskScoreThreshold.medium) return 'medium';
    return 'low';
  }

  /**
   * Get recommendation based on risk analysis
   */
  getRecommendation(riskLevel, riskFactors) {
    if (riskLevel === 'high') {
      // Check if it's an extreme case that should be blocked
      if (riskFactors.velocityRisk > 0.8 || riskFactors.geographicRisk > 0.8) {
        return 'block';
      }
      return 'review';
    }
    
    if (riskLevel === 'medium') {
      // Additional checks for medium risk
      if (riskFactors.userBehaviorRisk > 0.7 || riskFactors.paymentMethodRisk > 0.7) {
        return 'review';
      }
      return 'approve';
    }
    
    return 'approve';
  }

  /**
   * Check if manual review is required
   */
  requiresManualReview(riskLevel, riskFactors) {
    if (riskLevel === 'high') return true;
    
    // Additional manual review triggers
    if (riskFactors.userBehaviorRisk > 0.8) return true;
    if (riskFactors.velocityRisk > 0.8) return true;
    if (riskFactors.geographicRisk > 0.7 && riskFactors.paymentMethodRisk > 0.5) return true;
    
    return false;
  }

  // Helper methods
  formatRiskFactors(riskFactors) {
    const formatted = {};
    for (const [factor, score] of Object.entries(riskFactors)) {
      formatted[factor] = {
        score: Math.round(score * 100) / 100,
        level: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low'
      };
    }
    return formatted;
  }

  getTopRiskFactors(riskFactors) {
    return Object.entries(riskFactors)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([factor, score]) => ({ factor, score }));
  }

  // Data retrieval methods (simplified implementations)
  async checkPreviousPaymentMethodUse(paymentMethodId) {
    try {
      const count = await PaymentIntent.count({
        where: {
          paymentMethodId,
          status: 'succeeded'
        }
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking payment method history:', error);
      return false;
    }
  }

  async analyzeCardRisk(paymentData) {
    // Simplified card risk analysis
    // In production, this would check against stolen card databases
    let risk = 0.0;
    
    // Check for card testing patterns
    if (paymentData.amount < 200) { // Small amounts often used for testing
      risk += 0.1;
    }
    
    return risk;
  }

  async getUserPaymentHistory(userId) {
    try {
      const payments = await PaymentIntent.findAll({
        where: {
          [Op.or]: [
            { customerId: userId },
            { travelerId: userId }
          ]
        },
        order: [['createdAt', 'DESC']]
      });

      const totalPayments = payments.length;
      const failedPayments = payments.filter(p => p.status === 'failed').length;
      const succeededPayments = payments.filter(p => p.status === 'succeeded').length;
      
      // Calculate account age (simplified)
      const oldestPayment = payments[payments.length - 1];
      const accountAge = oldestPayment 
        ? moment().diff(moment(oldestPayment.createdAt), 'days')
        : 0;

      return {
        totalPayments,
        failedPayments,
        succeededPayments,
        chargebacks: 0, // Would be calculated from disputes/chargebacks
        accountAge,
        unusualPatterns: this.detectUnusualPatterns(payments)
      };
    } catch (error) {
      logger.error('Error getting user payment history:', error);
      return {
        totalPayments: 0,
        failedPayments: 0,
        succeededPayments: 0,
        chargebacks: 0,
        accountAge: 0,
        unusualPatterns: false
      };
    }
  }

  async getIPLocation(ipAddress) {
    // Simplified IP geolocation
    // In production, use a real IP geolocation service
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      isProxy: false,
      isVPN: false,
      isTor: false
    };
  }

  async getRecentPayments(userId, since) {
    try {
      return await PaymentIntent.findAll({
        where: {
          [Op.or]: [
            { customerId: userId },
            { travelerId: userId }
          ],
          createdAt: {
            [Op.gte]: since
          }
        }
      });
    } catch (error) {
      logger.error('Error getting recent payments:', error);
      return [];
    }
  }

  async getDeviceHistory(deviceFingerprint) {
    // Simplified device history
    // In production, this would track device usage across users
    return {
      firstSeen: moment().subtract(Math.floor(Math.random() * 30), 'days').toDate(),
      userCount: Math.floor(Math.random() * 3) + 1,
      failureRate: Math.random() * 0.3
    };
  }

  isSuspiciousUserAgent(userAgent) {
    // Check for suspicious patterns in user agent
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /headless/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  detectUnusualPatterns(payments) {
    if (payments.length < 5) return false;
    
    // Check for rapid succession payments
    const recent = payments.slice(0, 5);
    const timeDiffs = [];
    
    for (let i = 1; i < recent.length; i++) {
      const diff = moment(recent[i-1].createdAt).diff(moment(recent[i].createdAt), 'minutes');
      timeDiffs.push(diff);
    }
    
    // If multiple payments within 5 minutes
    return timeDiffs.filter(diff => diff < 5).length > 2;
  }
}

module.exports = FraudDetectionService;