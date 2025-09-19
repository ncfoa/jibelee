const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const compression = require('compression');
const { logger } = require('../config/logger');

/**
 * Security headers middleware
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Request compression middleware
 */
const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
});

/**
 * Rate limiting configurations
 */
const rateLimitConfigs = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later'
        }
      });
    }
  }),

  // Stricter rate limit for payment operations
  payment: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 payment requests per windowMs
    message: {
      success: false,
      error: {
        code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
        message: 'Too many payment attempts from this IP'
      }
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.id || req.ip;
    },
    handler: (req, res) => {
      logger.warn('Payment rate limit exceeded:', {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
          message: 'Too many payment attempts. Please wait before trying again.'
        }
      });
    }
  }),

  // Very strict rate limit for sensitive operations
  sensitive: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each user to 10 sensitive operations per hour
    keyGenerator: (req) => req.user?.id || req.ip,
    message: {
      success: false,
      error: {
        code: 'SENSITIVE_OPERATION_LIMIT_EXCEEDED',
        message: 'Too many sensitive operations. Please try again later.'
      }
    }
  }),

  // Rate limit for webhook endpoints
  webhook: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Allow up to 100 webhook calls per minute
    keyGenerator: (req) => {
      // Use a combination of IP and webhook source
      return `${req.ip}_webhook`;
    }
  }),

  // Rate limit for pricing calculations
  pricing: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 pricing calculations per minute
    keyGenerator: (req) => req.user?.id || req.ip
  })
};

/**
 * Slow down middleware for repeated requests
 */
const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // Allow 100 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 10000, // Maximum delay of 10 seconds
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Recursively sanitize object properties
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  };

  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

/**
 * Request size limiting middleware
 */
const requestSizeLimit = (limit = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const limitInBytes = parseLimit(limit);
      
      if (sizeInBytes > limitInBytes) {
        logger.warn('Request size limit exceeded:', {
          contentLength: sizeInBytes,
          limit: limitInBytes,
          ip: req.ip,
          endpoint: req.path
        });
        
        return res.status(413).json({
          success: false,
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: `Request size exceeds limit of ${limit}`
          }
        });
      }
    }
    
    next();
  };
};

/**
 * IP whitelist/blacklist middleware
 */
const ipFilter = (options = {}) => {
  const { whitelist = [], blacklist = [] } = options;
  
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(clientIP)) {
      logger.warn('Blocked request from blacklisted IP:', {
        ip: clientIP,
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied'
        }
      });
    }
    
    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      logger.warn('Blocked request from non-whitelisted IP:', {
        ip: clientIP,
        endpoint: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied'
        }
      });
    }
    
    next();
  };
};

/**
 * Suspicious activity detection middleware
 */
const suspiciousActivityDetector = (req, res, next) => {
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\b(union|select|insert|delete|update|drop|create|alter|exec|execute)\b)/i,
    // XSS patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    // Path traversal patterns
    /\.\.\//g,
    // Command injection patterns
    /[;&|`$(){}]/g
  ];

  const checkForSuspiciousContent = (obj, path = '') => {
    if (typeof obj === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          return `${path}: ${pattern}`;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const result = checkForSuspiciousContent(value, path ? `${path}.${key}` : key);
        if (result) return result;
      }
    }
    return null;
  };

  // Check request body, query, and params
  const suspiciousContent = 
    checkForSuspiciousContent(req.body, 'body') ||
    checkForSuspiciousContent(req.query, 'query') ||
    checkForSuspiciousContent(req.params, 'params');

  if (suspiciousContent) {
    logger.warn('Suspicious activity detected:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      pattern: suspiciousContent,
      userId: req.user?.id
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'SUSPICIOUS_ACTIVITY_DETECTED',
        message: 'Request contains suspicious content'
      }
    });
  }

  next();
};

/**
 * CORS configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://app.p2pdelivery.com'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    logger.warn('CORS blocked request from origin:', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'Stripe-Signature'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

/**
 * Request timeout middleware
 */
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
      logger.warn('Request timeout:', {
        ip: req.ip,
        endpoint: req.path,
        method: req.method,
        timeout
      });
      
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timed out'
          }
        });
      }
    });
    
    next();
  };
};

/**
 * Helper function to parse size limits
 */
function parseLimit(limit) {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = limit.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b?)$/);
  if (!match) return 0;
  
  const [, size, unit] = match;
  return parseFloat(size) * (units[unit] || 1);
}

module.exports = {
  securityHeaders,
  compressionMiddleware,
  rateLimitConfigs,
  slowDownMiddleware,
  sanitizeInput,
  requestSizeLimit,
  ipFilter,
  suspiciousActivityDetector,
  corsOptions,
  requestTimeout
};