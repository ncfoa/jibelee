const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

/**
 * Authentication middleware for JWT tokens
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Access token is required'
      }
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'payment-service-secret', (err, user) => {
    if (err) {
      logger.warn('Invalid token attempt:', { 
        token: token.substring(0, 10) + '...', 
        error: err.message,
        ip: req.ip 
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired access token'
        }
      });
    }

    req.user = user;
    next();
  });
};

/**
 * Service-to-service authentication middleware
 */
const authenticateService = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const serviceToken = process.env.SERVICE_TOKEN || 'payment-service-token';

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_SERVICE_TOKEN',
        message: 'Service token is required'
      }
    });
  }

  if (token !== serviceToken) {
    logger.warn('Invalid service token attempt:', { 
      token: token.substring(0, 10) + '...', 
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid service token'
      }
    });
  }

  req.service = {
    name: 'payment-service',
    authenticated: true
  };
  
  next();
};

/**
 * Role-based authorization middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required'
        }
      });
    }

    const userRoles = req.user.roles || [];
    const hasPermission = allowedRoles.some(role => userRoles.includes(role));

    if (!hasPermission) {
      logger.warn('Unauthorized access attempt:', {
        userId: req.user.id,
        userRoles,
        requiredRoles: allowedRoles,
        endpoint: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to access this resource'
        }
      });
    }

    next();
  };
};

/**
 * Resource ownership middleware
 * Ensures users can only access their own resources
 */
const requireOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required'
        }
      });
    }

    // Admin users can access any resource
    if (req.user.roles && req.user.roles.includes('admin')) {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RESOURCE_ID',
          message: 'Resource user ID is required'
        }
      });
    }

    if (req.user.id !== resourceUserId) {
      logger.warn('Ownership violation attempt:', {
        userId: req.user.id,
        attemptedResourceUserId: resourceUserId,
        endpoint: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'RESOURCE_ACCESS_DENIED',
          message: 'You can only access your own resources'
        }
      });
    }

    next();
  };
};

/**
 * Payment-specific authorization middleware
 * Checks if user can perform payment operations
 */
const authorizePaymentOperation = (operation) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required'
        }
      });
    }

    const { user } = req;
    const isAdmin = user.roles && user.roles.includes('admin');
    
    // Admin can perform any operation
    if (isAdmin) {
      return next();
    }

    // Check operation-specific permissions
    switch (operation) {
      case 'create_payment':
        // Users can create payments for themselves
        if (req.body.customerId && req.body.customerId !== user.id) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INVALID_CUSTOMER_ID',
              message: 'You can only create payments for yourself'
            }
          });
        }
        break;

      case 'confirm_payment':
      case 'cancel_payment':
        // Users can only modify their own payments
        // This would typically require a database lookup to verify ownership
        // For now, we'll allow it and let the service layer handle the check
        break;

      case 'create_payout_account':
      case 'request_payout':
        // Only travelers can create payout accounts and request payouts
        if (!user.roles || !user.roles.includes('traveler')) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'TRAVELER_ROLE_REQUIRED',
              message: 'Only travelers can perform payout operations'
            }
          });
        }
        break;

      case 'release_escrow':
      case 'dispute_escrow':
        // Only admin or involved parties can perform escrow operations
        // This requires database lookup to verify involvement
        break;

      default:
        logger.warn(`Unknown payment operation: ${operation}`);
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNKNOWN_OPERATION',
            message: 'Unknown payment operation'
          }
        });
    }

    next();
  };
};

/**
 * API key authentication middleware (for external integrations)
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKeys = process.env.VALID_API_KEYS ? 
    process.env.VALID_API_KEYS.split(',') : [];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required'
      }
    });
  }

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt:', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      }
    });
  }

  req.apiKey = {
    key: apiKey,
    authenticated: true
  };

  next();
};

/**
 * Webhook signature verification middleware
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'Webhook signature is required'
      }
    });
  }

  if (!webhookSecret) {
    logger.error('Webhook secret not configured');
    return res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_NOT_CONFIGURED',
        message: 'Webhook signature verification not configured'
      }
    });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

    req.stripeEvent = event;
    next();
  } catch (err) {
    logger.warn('Invalid webhook signature:', {
      signature: signature.substring(0, 20) + '...',
      error: err.message
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid webhook signature'
      }
    });
  }
};

/**
 * User context middleware
 * Adds user context information to requests
 */
const addUserContext = (req, res, next) => {
  if (req.user) {
    req.userContext = {
      id: req.user.id,
      email: req.user.email,
      roles: req.user.roles || [],
      isAdmin: req.user.roles && req.user.roles.includes('admin'),
      isCustomer: req.user.roles && req.user.roles.includes('customer'),
      isTraveler: req.user.roles && req.user.roles.includes('traveler'),
      permissions: req.user.permissions || []
    };
  }

  next();
};

module.exports = {
  authenticateToken,
  authenticateService,
  authorize,
  requireOwnership,
  authorizePaymentOperation,
  authenticateApiKey,
  verifyWebhookSignature,
  addUserContext
};