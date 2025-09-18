const rateLimit = require('express-rate-limit');
const { redisUtils } = require('../config/redis');
const { logger, logSecurityEvent } = require('../config/logger');

class RateLimitMiddleware {
  constructor() {
    this.defaultWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000; // 15 minutes
    this.defaultMax = parseInt(process.env.RATE_LIMIT_MAX) || 5;
  }

  // Create a Redis-based rate limiter
  createRedisRateLimit(options = {}) {
    const {
      windowMs = this.defaultWindowMs,
      max = this.defaultMax,
      keyGenerator = (req) => req.ip,
      message = 'Too many requests, please try again later',
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return async (req, res, next) => {
      try {
        const key = `rate_limit:${keyGenerator(req)}`;
        const window = Math.floor(Date.now() / windowMs);
        const windowKey = `${key}:${window}`;

        // Get current count
        const current = await redisUtils.get(windowKey) || 0;

        if (current >= max) {
          logSecurityEvent('rate_limit_exceeded', 'medium', {
            key: keyGenerator(req),
            current,
            max,
            windowMs
          }, req);

          return res.status(429).json({
            success: false,
            message,
            errors: ['Rate limit exceeded'],
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }

        // Increment counter
        await redisUtils.incr(windowKey, Math.ceil(windowMs / 1000));

        // Add headers
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': Math.max(0, max - current - 1),
          'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
        });

        next();
      } catch (error) {
        logger.error('Rate limiting error:', error);
        // If Redis is down, fall back to allowing the request
        next();
      }
    };
  }

  // General API rate limiting
  apiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      success: false,
      message: 'Too many API requests',
      errors: ['Rate limit exceeded. Please try again later.']
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/metrics';
    }
  });

  // Authentication endpoints rate limiting
  authRateLimit = this.createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    keyGenerator: (req) => req.ip,
    message: 'Too many authentication attempts'
  });

  // Login specific rate limiting (stricter)
  loginRateLimit = this.createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
    keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
    message: 'Too many login attempts for this account'
  });

  // Password reset rate limiting
  passwordResetRateLimit = this.createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    keyGenerator: (req) => `password_reset:${req.body?.email || req.ip}`,
    message: 'Too many password reset attempts'
  });

  // Email verification rate limiting
  emailVerificationRateLimit = this.createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 verification emails per hour
    keyGenerator: (req) => `email_verification:${req.body?.email || req.ip}`,
    message: 'Too many email verification requests'
  });

  // Registration rate limiting
  registrationRateLimit = this.createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    keyGenerator: (req) => `registration:${req.ip}`,
    message: 'Too many registration attempts'
  });

  // 2FA setup rate limiting
  twoFactorSetupRateLimit = this.createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 2FA setup attempts per hour
    keyGenerator: (req) => `2fa_setup:${req.user?.id || req.ip}`,
    message: 'Too many 2FA setup attempts'
  });

  // 2FA verification rate limiting
  twoFactorVerifyRateLimit = this.createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 verification attempts per window
    keyGenerator: (req) => `2fa_verify:${req.user?.id || req.body?.email || req.ip}`,
    message: 'Too many 2FA verification attempts'
  });

  // Session management rate limiting
  sessionRateLimit = this.createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 session operations per window
    keyGenerator: (req) => `session:${req.user?.id || req.ip}`,
    message: 'Too many session management requests'
  });

  // Account management rate limiting (password change, email change, etc.)
  accountManagementRateLimit = this.createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 account changes per hour
    keyGenerator: (req) => `account_mgmt:${req.user?.id || req.ip}`,
    message: 'Too many account management requests'
  });

  // Stricter rate limiting for failed authentication attempts
  createFailedAttemptLimiter(maxAttempts = 5, blockDurationMs = 30 * 60 * 1000) {
    return async (req, res, next) => {
      const identifier = req.body?.email || req.ip;
      const key = `failed_attempts:${identifier}`;

      try {
        const attempts = await redisUtils.get(key) || 0;

        if (attempts >= maxAttempts) {
          logSecurityEvent('account_locked', 'high', {
            identifier,
            attempts,
            maxAttempts
          }, req);

          return res.status(429).json({
            success: false,
            message: 'Account temporarily locked',
            errors: ['Too many failed attempts. Please try again later.'],
            retryAfter: Math.ceil(blockDurationMs / 1000)
          });
        }

        // Store original end function
        const originalEnd = res.end;
        
        // Override end function to track failed attempts
        res.end = function(chunk, encoding) {
          if (res.statusCode === 401 || res.statusCode === 403) {
            // Failed authentication attempt
            redisUtils.incr(key, Math.ceil(blockDurationMs / 1000))
              .catch(err => logger.error('Error tracking failed attempt:', err));
          } else if (res.statusCode >= 200 && res.statusCode < 300) {
            // Successful authentication - clear failed attempts
            redisUtils.del(key)
              .catch(err => logger.error('Error clearing failed attempts:', err));
          }

          originalEnd.call(this, chunk, encoding);
        };

        next();
      } catch (error) {
        logger.error('Failed attempt limiter error:', error);
        next();
      }
    };
  }

  // Progressive rate limiting (increases restrictions with failed attempts)
  createProgressiveRateLimit(baseMax = 5, maxMultiplier = 4) {
    return async (req, res, next) => {
      const identifier = req.body?.email || req.ip;
      const failedKey = `failed_attempts:${identifier}`;
      const rateLimitKey = `progressive_rate:${identifier}`;

      try {
        const failedAttempts = await redisUtils.get(failedKey) || 0;
        const multiplier = Math.min(Math.floor(failedAttempts / 3) + 1, maxMultiplier);
        const currentMax = Math.floor(baseMax / multiplier);

        // Apply rate limiting with adjusted max
        const rateLimit = this.createRedisRateLimit({
          windowMs: 15 * 60 * 1000,
          max: currentMax,
          keyGenerator: () => rateLimitKey,
          message: `Too many attempts. Limit reduced due to previous failures.`
        });

        rateLimit(req, res, next);
      } catch (error) {
        logger.error('Progressive rate limit error:', error);
        next();
      }
    };
  }

  // IP-based rate limiting with whitelist
  createIPRateLimit(whitelist = []) {
    return (req, res, next) => {
      const clientIP = req.ip;

      // Check if IP is whitelisted
      if (whitelist.includes(clientIP)) {
        return next();
      }

      // Apply standard rate limiting
      this.apiRateLimit(req, res, next);
    };
  }

  // User-based rate limiting (after authentication)
  createUserRateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000,
      max = 100,
      premiumMultiplier = 2
    } = options;

    return this.createRedisRateLimit({
      windowMs,
      max: (req) => {
        // Premium users get higher limits
        if (req.user?.userType === 'premium') {
          return max * premiumMultiplier;
        }
        return max;
      },
      keyGenerator: (req) => `user_rate:${req.user?.id || req.ip}`,
      message: 'User rate limit exceeded'
    });
  }

  // Endpoint-specific rate limiting
  createEndpointRateLimit(endpoint, options = {}) {
    return this.createRedisRateLimit({
      ...options,
      keyGenerator: (req) => `endpoint_rate:${endpoint}:${req.user?.id || req.ip}`
    });
  }

  // Clean up expired rate limit keys (utility function)
  async cleanupExpiredKeys() {
    try {
      // This would typically be implemented with Redis SCAN and TTL commands
      // For now, we rely on Redis's automatic expiration
      logger.info('Rate limit cleanup completed');
    } catch (error) {
      logger.error('Rate limit cleanup error:', error);
    }
  }

  // Get rate limit status for a key
  async getRateLimitStatus(key) {
    try {
      const current = await redisUtils.get(key) || 0;
      return {
        current,
        remaining: Math.max(0, this.defaultMax - current),
        resetTime: new Date(Date.now() + this.defaultWindowMs)
      };
    } catch (error) {
      logger.error('Error getting rate limit status:', error);
      return null;
    }
  }
}

module.exports = new RateLimitMiddleware();