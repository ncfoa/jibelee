const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { logger, securityLogger } = require('../config/logger');
const { cacheService } = require('../config/redis');

class SecurityMiddleware {
  constructor() {
    this.logger = logger;
    this.securityLogger = securityLogger;
  }

  // Generate request ID for tracking
  generateRequestId = (req, res, next) => {
    req.requestId = uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  };

  // Security headers using Helmet
  securityHeaders = helmet({
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
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  // API-specific security headers
  apiSecurityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    next();
  };

  // CORS configuration
  corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
      
      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        this.securityLogger.warn('CORS origin blocked', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 
      'Authorization', 'X-Request-ID', 'X-Forwarded-For'
    ]
  };

  // Request logging middleware
  requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request
    this.logger.info('Request received', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      contentLength: req.get('Content-Length')
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      
      this.logger[logLevel]('Request completed', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('Content-Length'),
        userId: req.user?.id
      });
    });

    next();
  };

  // Rate limiting
  createRateLimit = (options = {}) => {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // limit each IP to 100 requests per windowMs
      message = 'Too many requests, please try again later',
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return rateLimit({
      windowMs,
      max,
      message: {
        success: false,
        message,
        errors: [message]
      },
      skipSuccessfulRequests,
      skipFailedRequests,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.securityLogger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          userId: req.user?.id
        });

        res.status(429).json({
          success: false,
          message,
          errors: [message],
          retryAfter: Math.round(windowMs / 1000)
        });
      }
    });
  };

  // API rate limiting
  apiRateLimit = this.createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes
    message: 'API rate limit exceeded'
  });

  // Strict rate limiting for sensitive endpoints
  strictRateLimit = this.createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    message: 'Too many attempts, please try again later'
  });

  // File upload rate limiting
  fileUploadRateLimit = this.createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 file uploads per hour
    message: 'File upload limit exceeded'
  });

  // Content type validation
  validateContentType = (allowedTypes = ['application/json']) => {
    return (req, res, next) => {
      // Skip validation for GET requests and requests without body
      if (req.method === 'GET' || !req.body || Object.keys(req.body).length === 0) {
        return next();
      }

      const contentType = req.get('Content-Type');
      
      if (!contentType) {
        return res.status(400).json({
          success: false,
          message: 'Content-Type header is required',
          errors: ['Missing Content-Type header']
        });
      }

      const isAllowed = allowedTypes.some(type => contentType.includes(type));
      
      if (!isAllowed) {
        this.securityLogger.warn('Invalid content type', {
          contentType,
          allowedTypes,
          ip: req.ip,
          url: req.originalUrl
        });

        return res.status(415).json({
          success: false,
          message: 'Unsupported Media Type',
          errors: [`Content-Type must be one of: ${allowedTypes.join(', ')}`]
        });
      }

      next();
    };
  };

  // Request size limiting
  requestSizeLimit = (maxSize = '10mb') => {
    return (req, res, next) => {
      const contentLength = req.get('Content-Length');
      
      if (contentLength) {
        const maxSizeBytes = this.parseSize(maxSize);
        
        if (parseInt(contentLength) > maxSizeBytes) {
          this.securityLogger.warn('Request size limit exceeded', {
            contentLength,
            maxSize,
            ip: req.ip,
            url: req.originalUrl
          });

          return res.status(413).json({
            success: false,
            message: 'Request entity too large',
            errors: [`Request size exceeds ${maxSize} limit`]
          });
        }
      }

      next();
    };
  };

  // Suspicious activity detection
  suspiciousActivityDetector = async (req, res, next) => {
    try {
      const ip = req.ip;
      const userAgent = req.get('User-Agent');
      const url = req.originalUrl;

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /\.\./,  // Path traversal
        /<script/i,  // XSS attempts
        /union.*select/i,  // SQL injection
        /javascript:/i,  // JavaScript injection
        /eval\(/i,  // Code injection
        /base64/i,  // Base64 encoding (often used in attacks)
        /vbscript:/i,  // VBScript injection
        /onload=/i,  // Event handler injection
        /onerror=/i,  // Event handler injection
      ];

      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(url) || 
        pattern.test(JSON.stringify(req.body)) ||
        pattern.test(JSON.stringify(req.query))
      );

      if (isSuspicious) {
        this.securityLogger.error('Suspicious activity detected', {
          ip,
          userAgent,
          url,
          body: req.body,
          query: req.query,
          userId: req.user?.id
        });

        // Optionally block the request
        if (process.env.BLOCK_SUSPICIOUS_REQUESTS === 'true') {
          return res.status(403).json({
            success: false,
            message: 'Forbidden',
            errors: ['Suspicious activity detected']
          });
        }
      }

      // Check for unusual request frequency from same IP
      await this.checkRequestFrequency(ip, req);

      next();
    } catch (error) {
      this.logger.error('Error in suspicious activity detector', { error: error.message });
      next(); // Continue on error
    }
  };

  // Remove sensitive headers from response
  removeSensitiveHeaders = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Remove sensitive headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // Call original send
      originalSend.call(this, data);
    };

    next();
  };

  // Secure health check endpoint
  secureHealthCheck = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const healthCheckToken = process.env.HEALTH_CHECK_TOKEN;

    // If health check token is configured, require it
    if (healthCheckToken && authHeader !== `Bearer ${healthCheckToken}`) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
        errors: ['Invalid health check token']
      });
    }

    next();
  };

  // IP whitelist middleware
  ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
      const clientIP = req.ip;
      
      if (allowedIPs.length === 0) {
        return next(); // No whitelist configured
      }

      if (!allowedIPs.includes(clientIP)) {
        this.securityLogger.warn('IP not in whitelist', {
          ip: clientIP,
          allowedIPs,
          url: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errors: ['IP address not allowed']
        });
      }

      next();
    };
  };

  // Helper methods
  parseSize(size) {
    const units = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
    
    if (!match) {
      throw new Error('Invalid size format');
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';
    
    return value * units[unit];
  }

  async checkRequestFrequency(ip, req) {
    try {
      const key = `freq:${ip}`;
      const window = 60; // 1 minute window
      const maxRequests = 1000; // Max requests per minute

      const current = await cacheService.client.get(key);
      
      if (current === null) {
        await cacheService.client.setEx(key, window, 1);
        return;
      }

      const requests = parseInt(current);
      
      if (requests > maxRequests) {
        this.securityLogger.warn('Unusual request frequency detected', {
          ip,
          requests,
          maxRequests,
          url: req.originalUrl,
          userAgent: req.get('User-Agent')
        });
      }

      await cacheService.client.incr(key);
    } catch (error) {
      this.logger.debug('Error checking request frequency', { error: error.message });
    }
  }
}

module.exports = new SecurityMiddleware();