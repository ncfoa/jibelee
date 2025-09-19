const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../config/logger');

/**
 * Security Headers Middleware
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * Rate Limiting Configurations
 */
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        userId: req.user?.id
      });
      
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

/**
 * General API Rate Limiting
 */
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  'Too many requests from this IP, please try again later'
);

/**
 * Strict Rate Limiting for Sensitive Operations
 */
const strictRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  20, // Much lower limit
  'Too many sensitive operations, please try again later'
);

/**
 * QR Code Generation Rate Limiting
 */
const qrGenerationRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // 10 QR codes per minute
  'QR code generation rate limit exceeded'
);

/**
 * QR Code Validation Rate Limiting
 */
const qrValidationRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  30, // 30 validations per minute
  'QR code validation rate limit exceeded',
  true // Skip successful requests in count
);

/**
 * Emergency Override Rate Limiting
 */
const emergencyRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  5, // 5 emergency requests per hour
  'Emergency override request limit exceeded'
);

/**
 * Admin Operations Rate Limiting
 */
const adminRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  50, // 50 admin operations per minute
  'Admin operation rate limit exceeded'
);

/**
 * IP Whitelist Middleware
 */
const ipWhitelist = (whitelist = []) => {
  return (req, res, next) => {
    if (whitelist.length === 0) {
      return next(); // No whitelist configured
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!whitelist.includes(clientIP)) {
      logger.warn('IP not in whitelist:', {
        ip: clientIP,
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied from this IP address'
      });
    }

    next();
  };
};

/**
 * Request Size Limiting
 */
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxBytes = typeof maxSize === 'string' ? 
      parseInt(maxSize.replace(/mb/i, '')) * 1024 * 1024 : maxSize;

    if (contentLength > maxBytes) {
      logger.warn('Request size limit exceeded:', {
        contentLength,
        maxBytes,
        ip: req.ip,
        endpoint: req.path
      });

      return res.status(413).json({
        success: false,
        error: 'Request entity too large'
      });
    }

    next();
  };
};

/**
 * Security Audit Logging
 */
const auditLogger = (req, res, next) => {
  // Log security-relevant events
  const securityEvents = [
    'POST /api/v1/qr/pickup/generate',
    'POST /api/v1/qr/delivery/generate',
    'POST /api/v1/qr/validate',
    'POST /api/v1/qr/emergency-override',
    'POST /api/v1/qr/*/revoke'
  ];

  const endpoint = `${req.method} ${req.path}`;
  const shouldLog = securityEvents.some(pattern => 
    new RegExp(pattern.replace('*', '.*')).test(endpoint)
  );

  if (shouldLog) {
    logger.info('Security audit log:', {
      endpoint,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      headers: {
        authorization: req.get('Authorization') ? 'Bearer [REDACTED]' : undefined,
        'x-api-key': req.get('X-API-Key') ? '[REDACTED]' : undefined
      }
    });
  }

  next();
};

/**
 * Suspicious Activity Detection
 */
const suspiciousActivityDetector = (req, res, next) => {
  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /<.*>/,
    /union.*select/i,
    /drop.*table/i,
    /exec\(/i
  ];

  const checkSuspicious = (obj, path = '') => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkSuspicious(value, `${path}.${key}`)) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Check request body and query parameters
  const suspicious = checkSuspicious(req.body) || checkSuspicious(req.query);

  if (suspicious) {
    logger.warn('Suspicious activity detected:', {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      body: req.body,
      query: req.query
    });

    // You might want to block the request or flag for review
    // For now, just logging and continuing
  }

  next();
};

/**
 * CORS Configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',');
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    logger.warn('CORS origin not allowed:', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400 // 24 hours
};

/**
 * Request Timeout Middleware
 */
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout:', {
          endpoint: req.path,
          ip: req.ip,
          userId: req.user?.id,
          timeout: timeoutMs
        });

        res.status(408).json({
          success: false,
          error: 'Request timeout'
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
};

/**
 * Honeypot Field Detection
 */
const honeypotDetection = (fieldName = 'website') => {
  return (req, res, next) => {
    if (req.body && req.body[fieldName]) {
      logger.warn('Honeypot field filled (likely bot):', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        honeypotValue: req.body[fieldName]
      });

      // Silently reject or delay response
      return setTimeout(() => {
        res.status(400).json({
          success: false,
          error: 'Invalid request'
        });
      }, 3000); // 3 second delay
    }

    next();
  };
};

/**
 * User-Agent Validation
 */
const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent || userAgent.length < 10) {
    logger.warn('Suspicious or missing User-Agent:', {
      userAgent,
      ip: req.ip,
      endpoint: req.path
    });

    // You might want to block these requests
    // For now, just logging
  }

  // Check for known bot patterns
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i
  ];

  if (userAgent && botPatterns.some(pattern => pattern.test(userAgent))) {
    logger.info('Bot detected:', {
      userAgent,
      ip: req.ip,
      endpoint: req.path
    });

    // You might want to apply different rate limits for bots
  }

  next();
};

/**
 * Security Response Headers
 */
const addSecurityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'X-Service-Name': 'QR-Code-Service',
    'X-Rate-Limit-Policy': 'standard'
  });

  next();
};

module.exports = {
  securityHeaders,
  generalRateLimit,
  strictRateLimit,
  qrGenerationRateLimit,
  qrValidationRateLimit,
  emergencyRateLimit,
  adminRateLimit,
  ipWhitelist,
  requestSizeLimit,
  auditLogger,
  suspiciousActivityDetector,
  corsOptions,
  requestTimeout,
  honeypotDetection,
  validateUserAgent,
  addSecurityHeaders
};