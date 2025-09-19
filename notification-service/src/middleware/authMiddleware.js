const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        logger.warn('Invalid token attempt', { 
          token: token.substring(0, 20) + '...', 
          error: err.message 
        });
        
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      req.user = user;
      next();
    });

  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Admin Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  try {
    const adminToken = req.headers['x-admin-token'];

    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: 'Admin token required'
      });
    }

    jwt.verify(adminToken, process.env.JWT_SECRET, (err, admin) => {
      if (err) {
        logger.warn('Invalid admin token attempt', { 
          token: adminToken.substring(0, 20) + '...', 
          error: err.message 
        });
        
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired admin token'
        });
      }

      // Check if user has admin role
      if (!admin.roles || !admin.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      req.admin = admin;
      next();
    });

  } catch (error) {
    logger.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Optional Authentication Middleware (for public endpoints that can benefit from user context)
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        req.user = null;
      } else {
        req.user = user;
      }
      next();
    });

  } catch (error) {
    req.user = null;
    next();
  }
};

// User Authorization Middleware (check if user can access resource)
const authorizeUser = (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    // Admin can access any user's data
    if (requestingUser.roles && requestingUser.roles.includes('admin')) {
      return next();
    }

    // Users can only access their own data
    if (requestingUser.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own notifications.'
      });
    }

    next();

  } catch (error) {
    logger.error('Authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
};

// Service-to-Service Authentication
const authenticateService = (req, res, next) => {
  try {
    const serviceToken = req.headers['x-service-token'];
    
    if (!serviceToken) {
      return res.status(401).json({
        success: false,
        message: 'Service token required'
      });
    }

    // In production, use proper service authentication
    const expectedServiceToken = process.env.SERVICE_TOKEN;
    
    if (serviceToken !== expectedServiceToken) {
      logger.warn('Invalid service token attempt', {
        token: serviceToken.substring(0, 10) + '...',
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'Invalid service token'
      });
    }

    req.serviceAuth = true;
    next();

  } catch (error) {
    logger.error('Service authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Service authentication error'
    });
  }
};

// Rate limiting by user
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    try {
      const userId = req.user?.userId || req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      if (requests.has(userId)) {
        const userRequests = requests.get(userId);
        const validRequests = userRequests.filter(time => time > windowStart);
        requests.set(userId, validRequests);
      }

      // Check current request count
      const currentRequests = requests.get(userId) || [];
      
      if (currentRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((currentRequests[0] - windowStart) / 1000)
        });
      }

      // Add current request
      currentRequests.push(now);
      requests.set(userId, currentRequests);

      next();

    } catch (error) {
      logger.error('Rate limiting error:', error);
      next(); // Continue on error
    }
  };
};

// API Key Authentication (for webhook endpoints)
const authenticateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required'
      });
    }

    // In production, validate against database
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!validApiKeys.includes(apiKey)) {
      logger.warn('Invalid API key attempt', {
        key: apiKey.substring(0, 10) + '...',
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    req.apiKeyAuth = true;
    next();

  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'API key authentication error'
    });
  }
};

// Webhook signature verification
const verifyWebhookSignature = (secret) => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-webhook-signature'] || req.headers['x-hub-signature-256'];
      
      if (!signature) {
        return res.status(401).json({
          success: false,
          message: 'Webhook signature required'
        });
      }

      const crypto = require('crypto');
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');

      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      )) {
        logger.warn('Invalid webhook signature', {
          expected: expectedSignature.substring(0, 10) + '...',
          provided: providedSignature.substring(0, 10) + '...'
        });
        
        return res.status(403).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      next();

    } catch (error) {
      logger.error('Webhook signature verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook signature verification error'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  optionalAuth,
  authorizeUser,
  authenticateService,
  rateLimitByUser,
  authenticateApiKey,
  verifyWebhookSignature
};