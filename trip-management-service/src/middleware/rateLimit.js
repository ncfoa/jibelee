const rateLimit = require('express-rate-limit');
const { logger, logSecurityEvent } = require('../config/logger');
const { cache } = require('../config/redis');

/**
 * Rate limiting middleware
 */
class RateLimitMiddleware {
  /**
   * Create a Redis store for rate limiting
   */
  static createRedisStore() {
    return {
      incr: async (key) => {
        try {
          return await cache.incr(key, 3600); // 1 hour expiry
        } catch (error) {
          logger.error('Rate limit Redis error:', error);
          return 1; // Fallback to allow request
        }
      },
      decrement: async (key) => {
        try {
          const current = await cache.get(key);
          if (current && current > 0) {
            await cache.set(key, current - 1, 3600);
          }
        } catch (error) {
          logger.error('Rate limit decrement error:', error);
        }
      },
      resetKey: async (key) => {
        try {
          await cache.del(key);
        } catch (error) {
          logger.error('Rate limit reset error:', error);
        }
      }
    };
  }

  /**
   * Generate rate limit key
   */
  static generateKey(req, suffix = '') {
    const userId = req.user?.id || 'anonymous';
    const ip = req.ip || 'unknown';
    return `rate_limit:${userId}:${ip}${suffix ? ':' + suffix : ''}`;
  }

  /**
   * Custom rate limit handler
   */
  static rateLimitHandler(req, res) {
    const userId = req.user?.id;
    const endpoint = req.originalUrl;

    logSecurityEvent('rate_limit_exceeded', {
      userId,
      ip: req.ip,
      endpoint,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
      error: 'RATE_LIMIT_EXCEEDED',
      data: {
        retryAfter: res.get('Retry-After'),
        endpoint
      }
    });
  }

  /**
   * Skip rate limiting for certain conditions
   */
  static skipRateLimit(req) {
    // Skip for admin users
    if (req.user && ['admin', 'super_admin'].includes(req.user.userType)) {
      return true;
    }

    // Skip for health checks from localhost
    if (req.originalUrl === '/health' && req.ip === '127.0.0.1') {
      return true;
    }

    return false;
  }

  /**
   * API rate limiting (general)
   */
  static get apiRateLimit() {
    return rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        error: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateKey(req),
      skip: this.skipRateLimit,
      handler: this.rateLimitHandler,
      store: this.createRedisStore()
    });
  }

  /**
   * Strict rate limiting for sensitive endpoints
   */
  static get strictRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // Much lower limit
      message: {
        success: false,
        message: 'Too many requests to sensitive endpoint',
        error: 'STRICT_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateKey(req, 'strict'),
      skip: this.skipRateLimit,
      handler: this.rateLimitHandler,
      store: this.createRedisStore()
    });
  }

  /**
   * Create trip rate limiting
   */
  static get createTripRateLimit() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 trips per hour
      message: {
        success: false,
        message: 'Too many trips created, please try again later',
        error: 'CREATE_TRIP_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateKey(req, 'create_trip'),
      skip: this.skipRateLimit,
      handler: this.rateLimitHandler,
      store: this.createRedisStore()
    });
  }

  /**
   * Search rate limiting
   */
  static get searchRateLimit() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 searches per minute
      message: {
        success: false,
        message: 'Too many search requests, please try again later',
        error: 'SEARCH_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateKey(req, 'search'),
      skip: this.skipRateLimit,
      handler: this.rateLimitHandler,
      store: this.createRedisStore()
    });
  }

  /**
   * Update rate limiting
   */
  static get updateRateLimit() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 updates per 5 minutes
      message: {
        success: false,
        message: 'Too many update requests, please try again later',
        error: 'UPDATE_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateKey(req, 'update'),
      skip: this.skipRateLimit,
      handler: this.rateLimitHandler,
      store: this.createRedisStore()
    });
  }

  /**
   * Progressive delay middleware (simplified implementation)
   */
  static progressiveDelay() {
    const delays = new Map();
    
    return async (req, res, next) => {
      try {
        const key = this.generateKey(req, 'delay');
        const current = await cache.incr(key, 900); // 15 minutes
        
        if (current > 50) {
          const delayMs = Math.min((current - 50) * 100, 5000); // Max 5 second delay
          
          logSecurityEvent('progressive_delay_applied', {
            userId: req.user?.id,
            ip: req.ip,
            endpoint: req.originalUrl,
            delay: delayMs,
            requestCount: current,
            requestId: req.requestId
          });
          
          setTimeout(next, delayMs);
        } else {
          next();
        }
      } catch (error) {
        logger.error('Progressive delay error:', error);
        next(); // Continue on error
      }
    };
  }

  /**
   * Per-user rate limiting (authenticated users)
   */
  static userRateLimit(maxRequests = 1000, windowMs = 60 * 60 * 1000) {
    return async (req, res, next) => {
      try {
        if (!req.user || this.skipRateLimit(req)) {
          return next();
        }

        const key = `user_rate_limit:${req.user.id}`;
        const current = await cache.incr(key, Math.ceil(windowMs / 1000));

        if (current === 1) {
          await cache.expire(key, Math.ceil(windowMs / 1000));
        }

        if (current > maxRequests) {
          logSecurityEvent('user_rate_limit_exceeded', {
            userId: req.user.id,
            requests: current,
            limit: maxRequests,
            window: windowMs,
            endpoint: req.originalUrl,
            ip: req.ip,
            requestId: req.requestId
          });

          return res.status(429).json({
            success: false,
            message: 'User rate limit exceeded',
            error: 'USER_RATE_LIMIT_EXCEEDED',
            data: {
              limit: maxRequests,
              window: windowMs,
              current,
              resetTime: new Date(Date.now() + windowMs).toISOString()
            }
          });
        }

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
        });

        next();
      } catch (error) {
        logger.error('User rate limit error:', error);
        next(); // Continue on error
      }
    };
  }

  /**
   * Endpoint-specific rate limiting
   */
  static endpointRateLimit(endpoint, maxRequests, windowMs) {
    return rateLimit({
      windowMs,
      max: maxRequests,
      message: {
        success: false,
        message: `Too many requests to ${endpoint}`,
        error: 'ENDPOINT_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateKey(req, `endpoint:${endpoint}`),
      skip: this.skipRateLimit,
      handler: this.rateLimitHandler,
      store: this.createRedisStore()
    });
  }

  /**
   * Burst rate limiting (short bursts allowed)
   */
  static get burstRateLimit() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20, // 20 requests per minute
      message: {
        success: false,
        message: 'Burst rate limit exceeded',
        error: 'BURST_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateKey(req, 'burst'),
      skip: this.skipRateLimit,
      handler: this.rateLimitHandler,
      store: this.createRedisStore()
    });
  }

  /**
   * Dynamic rate limiting based on user type
   */
  static dynamicRateLimit() {
    return (req, res, next) => {
      if (!req.user) {
        // Anonymous users get basic rate limiting
        return this.apiRateLimit(req, res, next);
      }

      // Determine limits based on user type
      let maxRequests, windowMs;
      
      switch (req.user.userType) {
        case 'super_admin':
          return next(); // No limits for super admin
        case 'admin':
          maxRequests = 1000;
          windowMs = 15 * 60 * 1000;
          break;
        case 'traveler':
        case 'both':
          maxRequests = 500;
          windowMs = 15 * 60 * 1000;
          break;
        case 'customer':
        default:
          maxRequests = 200;
          windowMs = 15 * 60 * 1000;
          break;
      }

      // Apply user-specific rate limiting
      return this.userRateLimit(maxRequests, windowMs)(req, res, next);
    };
  }

  /**
   * Geographic rate limiting (by IP location)
   */
  static geoRateLimit(countryLimits = {}) {
    return async (req, res, next) => {
      try {
        // This would require a GeoIP service
        // For now, we'll use a simplified version
        const country = req.get('CF-IPCountry') || 'UNKNOWN';
        const limit = countryLimits[country] || countryLimits['DEFAULT'] || 100;

        const key = `geo_rate_limit:${country}:${req.ip}`;
        const current = await cache.incr(key, 3600); // 1 hour window

        if (current > limit) {
          logSecurityEvent('geographic_rate_limit_exceeded', {
            country,
            ip: req.ip,
            current,
            limit,
            endpoint: req.originalUrl,
            requestId: req.requestId
          });

          return res.status(429).json({
            success: false,
            message: 'Geographic rate limit exceeded',
            error: 'GEO_RATE_LIMIT_EXCEEDED',
            data: { country, limit }
          });
        }

        next();
      } catch (error) {
        logger.error('Geographic rate limit error:', error);
        next(); // Continue on error
      }
    };
  }
}

module.exports = RateLimitMiddleware;