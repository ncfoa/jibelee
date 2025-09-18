const jwt = require('jsonwebtoken');
const { logger, securityLogger } = require('../config/logger');
const { User } = require('../models');
const { cacheService } = require('../config/redis');

class AuthMiddleware {
  constructor() {
    this.logger = logger;
    this.securityLogger = securityLogger;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  }

  // Verify JWT token and authenticate user
  authenticateToken = async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        this.securityLogger.warn('Authentication attempted without token', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl
        });
        
        return res.status(401).json({
          success: false,
          message: 'Access token required',
          errors: ['No access token provided']
        });
      }

      // Verify token
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check if token is blacklisted (optional)
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        this.securityLogger.warn('Blacklisted token used', {
          userId: decoded.userId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(401).json({
          success: false,
          message: 'Token is invalid',
          errors: ['Token has been revoked']
        });
      }

      // Get user from cache or database
      let user = await this.getUserFromCache(decoded.userId);
      
      if (!user) {
        user = await User.findByPk(decoded.userId);
        if (user) {
          await this.cacheUser(user);
        }
      }

      if (!user || user.status !== 'active') {
        this.securityLogger.warn('Authentication with invalid user', {
          userId: decoded.userId,
          userExists: !!user,
          userStatus: user?.status,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive',
          errors: ['Invalid user credentials']
        });
      }

      // Add user to request
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        verificationLevel: user.verificationLevel,
        status: user.status
      };

      // Update last active timestamp
      await this.updateLastActive(user.id);

      this.logger.debug('User authenticated successfully', {
        userId: user.id,
        userType: user.userType,
        verificationLevel: user.verificationLevel
      });

      next();
    } catch (error) {
      this.securityLogger.warn('Token verification failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          errors: ['Access token has expired']
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          errors: ['Access token is invalid']
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        errors: ['Internal authentication error']
      });
    }
  };

  // Optional authentication - doesn't fail if no token
  optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    // Use the main auth middleware but don't fail on errors
    try {
      await this.authenticateToken(req, res, next);
    } catch (error) {
      req.user = null;
      next();
    }
  };

  // Require specific user types
  requireUserType = (allowedTypes) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        });
      }

      const userTypes = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
      
      if (!userTypes.includes(req.user.userType)) {
        this.securityLogger.warn('User type access denied', {
          userId: req.user.id,
          userType: req.user.userType,
          requiredTypes: userTypes,
          url: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          errors: [`User type must be one of: ${userTypes.join(', ')}`]
        });
      }

      next();
    };
  };

  // Require specific verification level
  requireVerificationLevel = (minLevel) => {
    const verificationLevels = {
      'unverified': 0,
      'email_verified': 1,
      'phone_verified': 2,
      'id_verified': 3,
      'fully_verified': 4
    };

    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        });
      }

      const userLevel = verificationLevels[req.user.verificationLevel] || 0;
      const requiredLevel = verificationLevels[minLevel] || 0;

      if (userLevel < requiredLevel) {
        this.securityLogger.warn('Verification level access denied', {
          userId: req.user.id,
          userLevel: req.user.verificationLevel,
          requiredLevel: minLevel,
          url: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'Insufficient verification level',
          errors: [`Verification level '${minLevel}' or higher required`]
        });
      }

      next();
    };
  };

  // Require user to be the owner of the resource
  requireOwnership = (userIdParam = 'userId') => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        });
      }

      const resourceUserId = req.params[userIdParam];
      
      if (req.user.id !== resourceUserId) {
        this.securityLogger.warn('Resource ownership access denied', {
          userId: req.user.id,
          resourceUserId,
          url: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errors: ['You can only access your own resources']
        });
      }

      next();
    };
  };

  // Admin or owner access
  requireAdminOrOwnership = (userIdParam = 'userId') => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        });
      }

      const resourceUserId = req.params[userIdParam];
      const isOwner = req.user.id === resourceUserId;
      const isAdmin = req.user.userType === 'admin' || req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        this.securityLogger.warn('Admin or ownership access denied', {
          userId: req.user.id,
          resourceUserId,
          isAdmin,
          url: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errors: ['Admin privileges or resource ownership required']
        });
      }

      next();
    };
  };

  // Rate limiting based on user
  userRateLimit = (maxRequests = 100, windowMinutes = 15) => {
    return async (req, res, next) => {
      if (!req.user) {
        return next();
      }

      const key = `rate_limit:user:${req.user.id}`;
      const window = windowMinutes * 60; // Convert to seconds

      try {
        const current = await cacheService.client.get(key);
        
        if (current === null) {
          await cacheService.client.setEx(key, window, 1);
          return next();
        }

        const requests = parseInt(current);
        
        if (requests >= maxRequests) {
          this.securityLogger.warn('User rate limit exceeded', {
            userId: req.user.id,
            requests,
            maxRequests,
            windowMinutes,
            ip: req.ip
          });

          return res.status(429).json({
            success: false,
            message: 'Rate limit exceeded',
            errors: [`Too many requests. Limit: ${maxRequests} per ${windowMinutes} minutes`],
            retryAfter: window
          });
        }

        await cacheService.client.incr(key);
        next();
      } catch (error) {
        this.logger.error('Rate limiting error', {
          userId: req.user.id,
          error: error.message
        });
        next(); // Continue on cache errors
      }
    };
  };

  // Helper methods
  async getUserFromCache(userId) {
    try {
      const cacheKey = `auth:user:${userId}`;
      const cachedUser = await cacheService.get(cacheKey);
      return cachedUser;
    } catch (error) {
      this.logger.debug('Cache error in getUserFromCache', { error: error.message });
      return null;
    }
  }

  async cacheUser(user) {
    try {
      const cacheKey = `auth:user:${user.id}`;
      const userData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        verificationLevel: user.verificationLevel,
        status: user.status
      };
      
      await cacheService.set(cacheKey, userData, 900); // 15 minutes
    } catch (error) {
      this.logger.debug('Cache error in cacheUser', { error: error.message });
    }
  }

  async isTokenBlacklisted(token) {
    try {
      const blacklistKey = `blacklist:token:${token}`;
      const isBlacklisted = await cacheService.client.exists(blacklistKey);
      return isBlacklisted === 1;
    } catch (error) {
      this.logger.debug('Cache error in isTokenBlacklisted', { error: error.message });
      return false; // Fail open
    }
  }

  async updateLastActive(userId) {
    try {
      // Update user's last active timestamp (async, don't wait)
      User.update(
        { lastActiveAt: new Date() },
        { where: { id: userId } }
      ).catch(error => {
        this.logger.debug('Error updating last active', { userId, error: error.message });
      });
    } catch (error) {
      // Ignore errors in this non-critical operation
    }
  }

  // Blacklist token (for logout)
  async blacklistToken(token, expiresIn = 3600) {
    try {
      const blacklistKey = `blacklist:token:${token}`;
      await cacheService.client.setEx(blacklistKey, expiresIn, '1');
      return true;
    } catch (error) {
      this.logger.error('Error blacklisting token', { error: error.message });
      return false;
    }
  }
}

module.exports = new AuthMiddleware();