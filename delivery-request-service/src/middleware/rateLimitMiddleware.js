const rateLimit = require('express-rate-limit');
const { cache } = require('../config/redis');

class RateLimitMiddleware {
  // General API rate limiting
  general() {
    return rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
      message: {
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(this.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip;
      },
      skip: (req) => {
        // Skip rate limiting for admin users
        return req.user?.role === 'admin';
      }
    });
  }

  // Strict rate limiting for resource creation
  creation() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 creations per 5 minutes
      message: {
        success: false,
        message: 'Too many creation requests, please slow down',
        retryAfter: 300
      },
      keyGenerator: (req) => {
        return `create:${req.user?.id || req.ip}`;
      },
      skip: (req) => {
        return req.user?.role === 'admin';
      }
    });
  }

  // Rate limiting for offers
  offers() {
    return rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 20, // 20 offers per 10 minutes
      message: {
        success: false,
        message: 'Too many offer requests, please wait before making more offers',
        retryAfter: 600
      },
      keyGenerator: (req) => {
        return `offers:${req.user?.id || req.ip}`;
      },
      skip: (req) => {
        return req.user?.role === 'admin';
      }
    });
  }

  // Rate limiting for search operations
  search() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 searches per minute
      message: {
        success: false,
        message: 'Too many search requests, please wait',
        retryAfter: 60
      },
      keyGenerator: (req) => {
        return `search:${req.user?.id || req.ip}`;
      }
    });
  }

  // Custom rate limiter using Redis
  custom(options = {}) {
    const {
      windowMs = 15 * 60 * 1000,
      max = 100,
      keyPrefix = 'custom',
      message = 'Rate limit exceeded'
    } = options;

    return async (req, res, next) => {
      try {
        const key = `${keyPrefix}:${req.user?.id || req.ip}`;
        const current = await cache.get(key) || 0;
        
        if (current >= max) {
          return res.status(429).json({
            success: false,
            message,
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }

        // Increment counter
        await cache.set(key, current + 1, Math.ceil(windowMs / 1000));
        
        next();
      } catch (error) {
        console.error('Custom rate limit error:', error);
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  // Per-user rate limiting for specific actions
  perUser(options = {}) {
    const {
      windowMs = 60 * 1000, // 1 minute
      max = 10,
      action = 'action',
      message = 'Too many requests for this action'
    } = options;

    return async (req, res, next) => {
      try {
        if (!req.user) {
          return next();
        }

        const key = `${action}:${req.user.id}`;
        const current = await cache.get(key) || 0;
        
        if (current >= max) {
          return res.status(429).json({
            success: false,
            message,
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }

        // Increment counter
        await cache.set(key, current + 1, Math.ceil(windowMs / 1000));
        
        next();
      } catch (error) {
        console.error('Per-user rate limit error:', error);
        next();
      }
    };
  }

  // Burst protection for expensive operations
  burst(options = {}) {
    const {
      windowMs = 1000, // 1 second
      max = 1, // 1 request per second
      keyPrefix = 'burst'
    } = options;

    return async (req, res, next) => {
      try {
        const key = `${keyPrefix}:${req.user?.id || req.ip}`;
        const lastRequest = await cache.get(key);
        
        if (lastRequest) {
          const timeDiff = Date.now() - parseInt(lastRequest);
          if (timeDiff < windowMs) {
            return res.status(429).json({
              success: false,
              message: 'Request too soon, please wait',
              retryAfter: Math.ceil((windowMs - timeDiff) / 1000)
            });
          }
        }

        // Store current timestamp
        await cache.set(key, Date.now().toString(), Math.ceil(windowMs / 1000));
        
        next();
      } catch (error) {
        console.error('Burst protection error:', error);
        next();
      }
    };
  }

  // Adaptive rate limiting based on system load
  adaptive() {
    return async (req, res, next) => {
      try {
        // Get system metrics (simplified)
        const memoryUsage = process.memoryUsage();
        const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        
        let maxRequests = 100;
        let windowMs = 15 * 60 * 1000;
        
        // Reduce limits if system is under stress
        if (heapUsedPercent > 0.8) {
          maxRequests = 20;
          windowMs = 60 * 1000;
        } else if (heapUsedPercent > 0.6) {
          maxRequests = 50;
          windowMs = 5 * 60 * 1000;
        }

        const key = `adaptive:${req.user?.id || req.ip}`;
        const current = await cache.get(key) || 0;
        
        if (current >= maxRequests) {
          return res.status(429).json({
            success: false,
            message: 'System is under high load, please try again later',
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }

        await cache.set(key, current + 1, Math.ceil(windowMs / 1000));
        
        next();
      } catch (error) {
        console.error('Adaptive rate limit error:', error);
        next();
      }
    };
  }
}

module.exports = new RateLimitMiddleware();