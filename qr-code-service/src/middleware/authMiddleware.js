const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * JWT Authentication Middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Verify JWT token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        logger.warn('JWT verification failed:', {
          error: err.message,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Token expired'
          });
        }

        return res.status(403).json({
          success: false,
          error: 'Invalid token'
        });
      }

      // Add user info to request
      req.user = user;
      next();
    });

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Optional Authentication Middleware (for public endpoints that benefit from user context)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (!err) {
          req.user = user;
        }
        // Continue regardless of token validity for optional auth
        next();
      });
    } else {
      next();
    }
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

/**
 * Role-based Authorization Middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.warn('Insufficient permissions:', {
        userId: req.user.id,
        userRoles,
        requiredRoles: roles,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Admin Authorization Middleware
 */
const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * User Context Middleware (adds user info to all authenticated requests)
 */
const addUserContext = async (req, res, next) => {
  if (req.user) {
    // Add additional user context if needed
    req.userContext = {
      id: req.user.id,
      email: req.user.email,
      roles: req.user.roles || [],
      permissions: req.user.permissions || [],
      isAdmin: (req.user.roles || []).some(role => ['admin', 'super_admin'].includes(role))
    };
  }
  next();
};

/**
 * API Key Authentication (for service-to-service communication)
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('qr_') || apiKey.length < 20) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format'
      });
    }

    // In production, this would validate against a database of API keys
    // For now, check against environment variable
    const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
    
    if (!validApiKeys.includes(apiKey)) {
      logger.warn('Invalid API key attempted:', {
        apiKey: apiKey.substring(0, 10) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Add API key context to request
    req.apiKey = {
      key: apiKey,
      type: 'service'
    };

    next();

  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Resource Ownership Middleware (ensures user can access their own resources)
 */
const requireOwnership = (resourceIdParam = 'id', userIdField = 'createdBy') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Admin users can access any resource
      if (req.userContext?.isAdmin) {
        return next();
      }

      const resourceId = req.params[resourceIdParam];
      
      // This would typically query the database to check ownership
      // For now, implementing basic check
      // In a real implementation, you'd query the specific resource
      
      // Example: const resource = await Model.findByPk(resourceId);
      // if (resource[userIdField] !== req.user.id) { ... }

      next();

    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization error'
      });
    }
  };
};

/**
 * Delivery Access Middleware (ensures user has access to delivery-related resources)
 */
const requireDeliveryAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admin users can access any delivery
    if (req.userContext?.isAdmin) {
      return next();
    }

    const deliveryId = req.params.deliveryId || req.body.deliveryId;
    
    if (!deliveryId) {
      return res.status(400).json({
        success: false,
        error: 'Delivery ID required'
      });
    }

    // This would integrate with delivery service to check access
    // For now, allowing access (placeholder)
    
    // Example integration:
    // const hasAccess = await deliveryService.checkUserAccess(req.user.id, deliveryId);
    // if (!hasAccess) { return res.status(403)... }

    next();

  } catch (error) {
    logger.error('Delivery access check error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization error'
    });
  }
};

/**
 * Rate Limiting by User
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter(time => time > windowStart);
      requests.set(userId, userRequests);
    }

    // Check current request count
    const userRequests = requests.get(userId) || [];
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(userId, userRequests);

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireAdmin,
  addUserContext,
  authenticateApiKey,
  requireOwnership,
  requireDeliveryAccess,
  userRateLimit
};