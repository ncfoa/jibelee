const jwt = require('jsonwebtoken');
const { logger, logSecurityEvent } = require('../config/logger');
const { cache } = require('../config/redis');

/**
 * Authentication middleware
 */
class AuthMiddleware {
  /**
   * Verify JWT token
   */
  static async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        logSecurityEvent('missing_auth_header', { 
          ip: req.ip, 
          url: req.originalUrl 
        });
        return res.status(401).json({
          success: false,
          message: 'Authorization header is required',
          error: 'MISSING_AUTH_HEADER'
        });
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (!token) {
        logSecurityEvent('missing_token', { 
          ip: req.ip, 
          url: req.originalUrl 
        });
        return res.status(401).json({
          success: false,
          message: 'Access token is required',
          error: 'MISSING_TOKEN'
        });
      }

      // Check if token is blacklisted
      const isBlacklisted = await cache.get(`blacklist:${token}`);
      if (isBlacklisted) {
        logSecurityEvent('blacklisted_token_used', { 
          ip: req.ip, 
          url: req.originalUrl 
        });
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked',
          error: 'TOKEN_REVOKED'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check token expiration
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        logSecurityEvent('expired_token_used', { 
          ip: req.ip, 
          url: req.originalUrl,
          userId: decoded.userId 
        });
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          error: 'TOKEN_EXPIRED'
        });
      }

      // Add user info to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        userType: decoded.userType,
        verificationLevel: decoded.verificationLevel,
        iat: decoded.iat,
        exp: decoded.exp
      };

      req.token = token;
      
      logger.debug('Token verified successfully', {
        userId: req.user.id,
        userType: req.user.userType,
        url: req.originalUrl
      });

      next();
    } catch (error) {
      logSecurityEvent('token_verification_failed', { 
        ip: req.ip, 
        url: req.originalUrl,
        error: error.message 
      });

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: 'INVALID_TOKEN'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          error: 'TOKEN_EXPIRED'
        });
      }

      logger.error('Token verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: 'AUTH_ERROR'
      });
    }
  }

  /**
   * Optional authentication - doesn't fail if no token
   */
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return next();
      }

      // Use the main auth middleware but catch errors
      await AuthMiddleware.verifyToken(req, res, next);
    } catch (error) {
      // Continue without authentication
      logger.debug('Optional auth failed, continuing without user', {
        error: error.message,
        url: req.originalUrl
      });
      next();
    }
  }

  /**
   * Check if user has required user type
   */
  static requireUserType(...allowedTypes) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
      }

      if (!allowedTypes.includes(req.user.userType)) {
        logSecurityEvent('insufficient_user_type', {
          userId: req.user.id,
          userType: req.user.userType,
          requiredTypes: allowedTypes,
          url: req.originalUrl,
          ip: req.ip
        });

        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    };
  }

  /**
   * Check if user is verified
   */
  static requireVerification(level = 'email_verified') {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
      }

      const verificationLevels = {
        'unverified': 0,
        'email_verified': 1,
        'phone_verified': 2,
        'id_verified': 3,
        'fully_verified': 4
      };

      const userLevel = verificationLevels[req.user.verificationLevel] || 0;
      const requiredLevel = verificationLevels[level] || 1;

      if (userLevel < requiredLevel) {
        logSecurityEvent('insufficient_verification', {
          userId: req.user.id,
          userLevel: req.user.verificationLevel,
          requiredLevel: level,
          url: req.originalUrl,
          ip: req.ip
        });

        return res.status(403).json({
          success: false,
          message: `Verification level '${level}' required`,
          error: 'INSUFFICIENT_VERIFICATION',
          data: {
            currentLevel: req.user.verificationLevel,
            requiredLevel: level
          }
        });
      }

      next();
    };
  }

  /**
   * Check if user owns the resource or is admin
   */
  static requireOwnership(resourceUserIdField = 'traveler_id') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: 'AUTH_REQUIRED'
          });
        }

        // Admin users can access any resource
        if (['admin', 'super_admin'].includes(req.user.userType)) {
          return next();
        }

        // Get resource from params or body
        const resourceId = req.params.id || req.params.tripId;
        
        if (!resourceId) {
          return res.status(400).json({
            success: false,
            message: 'Resource ID required',
            error: 'MISSING_RESOURCE_ID'
          });
        }

        // Check ownership based on the resource
        // This will be implemented when we have the models
        // For now, we'll add the check to the controllers
        req.requiresOwnershipCheck = {
          resourceId,
          field: resourceUserIdField
        };

        next();
      } catch (error) {
        logger.error('Ownership check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Authorization error',
          error: 'AUTH_ERROR'
        });
      }
    };
  }

  /**
   * Rate limiting per user
   */
  static userRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return next();
        }

        const key = `rate_limit:user:${req.user.id}`;
        const current = await cache.incr(key, Math.ceil(windowMs / 1000));

        if (current === 1) {
          await cache.expire(key, Math.ceil(windowMs / 1000));
        }

        if (current > maxRequests) {
          logSecurityEvent('rate_limit_exceeded', {
            userId: req.user.id,
            requests: current,
            limit: maxRequests,
            window: windowMs,
            url: req.originalUrl,
            ip: req.ip
          });

          return res.status(429).json({
            success: false,
            message: 'Rate limit exceeded',
            error: 'RATE_LIMIT_EXCEEDED',
            data: {
              limit: maxRequests,
              window: windowMs,
              current
            }
          });
        }

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': Math.max(0, maxRequests - current),
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
   * Extract user ID from various sources
   */
  static extractUserId(req) {
    // From authenticated user
    if (req.user && req.user.id) {
      return req.user.id;
    }

    // From params
    if (req.params.userId) {
      return req.params.userId;
    }

    // From query
    if (req.query.userId) {
      return req.query.userId;
    }

    // From body
    if (req.body.userId || req.body.traveler_id) {
      return req.body.userId || req.body.traveler_id;
    }

    return null;
  }
}

module.exports = AuthMiddleware;