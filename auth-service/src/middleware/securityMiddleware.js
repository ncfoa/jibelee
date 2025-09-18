const helmet = require('helmet');
const cors = require('cors');
const { logger, logSecurityEvent } = require('../config/logger');

class SecurityMiddleware {
  constructor() {
    this.corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'];
  }

  // Helmet security headers
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
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' }
  });

  // CORS configuration
  corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (this.corsOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logSecurityEvent('cors_violation', 'medium', { origin }, null);
        callback(new Error('Not allowed by CORS'));
      }
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
      'X-Device-ID',
      'X-App-Version'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400 // 24 hours
  };

  // Request logging middleware
  requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request
    logger.http('Incoming request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin'),
      timestamp: new Date().toISOString()
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      
      logger.http('Request completed', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Log security events for suspicious status codes
      if (res.statusCode === 401 || res.statusCode === 403) {
        logSecurityEvent('unauthorized_access_attempt', 'medium', {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent')
        }, req);
      }

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };

  // IP whitelist middleware
  ipWhitelist(allowedIPs = []) {
    return (req, res, next) => {
      if (allowedIPs.length === 0) {
        return next();
      }

      const clientIP = req.ip;
      
      if (!allowedIPs.includes(clientIP)) {
        logSecurityEvent('ip_not_whitelisted', 'high', {
          ip: clientIP,
          allowedIPs
        }, req);

        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errors: ['Your IP address is not allowed to access this resource']
        });
      }

      next();
    };
  }

  // Request size limiter
  requestSizeLimit(maxSize = '10mb') {
    return (req, res, next) => {
      const contentLength = parseInt(req.get('Content-Length') || '0');
      const maxBytes = this.parseSize(maxSize);

      if (contentLength > maxBytes) {
        logSecurityEvent('request_too_large', 'medium', {
          contentLength,
          maxSize: maxBytes
        }, req);

        return res.status(413).json({
          success: false,
          message: 'Request too large',
          errors: ['Request body exceeds maximum size limit']
        });
      }

      next();
    };
  }

  // Suspicious activity detector
  suspiciousActivityDetector = (req, res, next) => {
    const suspicious = [];

    // Check for suspicious headers
    const userAgent = req.get('User-Agent') || '';
    if (!userAgent || userAgent.length < 10) {
      suspicious.push('missing_or_short_user_agent');
    }

    // Check for suspicious patterns in URL
    const url = req.originalUrl.toLowerCase();
    const suspiciousPatterns = [
      /\.\./,  // Directory traversal
      /script/i,  // Script injection
      /union.*select/i,  // SQL injection
      /exec\(/i,  // Code execution
      /<.*>/  // HTML/XML tags
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        suspicious.push(`suspicious_url_pattern_${pattern.source}`);
      }
    }

    // Check for suspicious request body patterns
    if (req.body && typeof req.body === 'object') {
      const bodyString = JSON.stringify(req.body).toLowerCase();
      
      if (bodyString.includes('<script')) {
        suspicious.push('script_in_body');
      }
      
      if (/union.*select/i.test(bodyString)) {
        suspicious.push('sql_injection_attempt');
      }
    }

    // Check for rapid requests from same IP
    this.checkRapidRequests(req.ip).then(isRapid => {
      if (isRapid) {
        suspicious.push('rapid_requests');
      }

      if (suspicious.length > 0) {
        logSecurityEvent('suspicious_activity_detected', 'high', {
          ip: req.ip,
          url: req.originalUrl,
          method: req.method,
          userAgent,
          suspicious,
          body: req.body
        }, req);

        // Don't block the request, just log it
        // In production, you might want to implement blocking for severe cases
      }

      next();
    });
  };

  // Check for rapid requests (simple implementation)
  async checkRapidRequests(ip) {
    // This is a simplified implementation
    // In production, you'd use Redis or similar for tracking
    const key = `rapid_check_${ip}`;
    const now = Date.now();
    
    // This would typically be stored in Redis
    // For now, we'll use a simple in-memory approach
    if (!this.requestTimes) {
      this.requestTimes = new Map();
    }

    const requests = this.requestTimes.get(ip) || [];
    
    // Remove requests older than 1 minute
    const recentRequests = requests.filter(time => now - time < 60000);
    
    // Add current request
    recentRequests.push(now);
    this.requestTimes.set(ip, recentRequests);

    // Consider it rapid if more than 100 requests in 1 minute
    return recentRequests.length > 100;
  }

  // API key validation (for internal services)
  validateAPIKey(req, res, next) {
    const apiKey = req.get('X-API-Key');
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey) {
      return next(); // No API key configured, skip validation
    }

    if (!apiKey || apiKey !== expectedKey) {
      logSecurityEvent('invalid_api_key', 'high', {
        providedKey: apiKey ? apiKey.substring(0, 10) + '...' : 'none'
      }, req);

      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
        errors: ['Valid API key required for this endpoint']
      });
    }

    next();
  }

  // Prevent timing attacks
  constantTimeComparison(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  // Content type validation
  validateContentType(allowedTypes = ['application/json']) {
    return (req, res, next) => {
      if (['GET', 'DELETE'].includes(req.method)) {
        return next();
      }

      const contentType = req.get('Content-Type');
      
      if (!contentType) {
        return res.status(400).json({
          success: false,
          message: 'Content-Type header required',
          errors: ['Please specify Content-Type header']
        });
      }

      const isValidType = allowedTypes.some(type => 
        contentType.toLowerCase().startsWith(type.toLowerCase())
      );

      if (!isValidType) {
        logSecurityEvent('invalid_content_type', 'low', {
          contentType,
          allowedTypes
        }, req);

        return res.status(415).json({
          success: false,
          message: 'Unsupported content type',
          errors: [`Content-Type must be one of: ${allowedTypes.join(', ')}`]
        });
      }

      next();
    };
  }

  // Request ID generator
  generateRequestId = (req, res, next) => {
    req.requestId = require('crypto').randomUUID();
    res.set('X-Request-ID', req.requestId);
    next();
  };

  // Security headers for API responses
  apiSecurityHeaders = (req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    next();
  };

  // Remove sensitive headers from responses
  removeSensitiveHeaders = (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(body) {
      // Remove sensitive information from error responses
      if (body && body.errors && Array.isArray(body.errors)) {
        body.errors = body.errors.map(error => {
          if (typeof error === 'string') {
            return error.replace(/password/gi, '[REDACTED]');
          }
          return error;
        });
      }

      return originalJson.call(this, body);
    };

    next();
  };

  // Parse size string to bytes
  parseSize(size) {
    if (typeof size === 'number') return size;
    
    const units = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return Math.floor(value * units[unit]);
  }

  // Health check endpoint security
  secureHealthCheck = (req, res, next) => {
    // Only allow health checks from internal networks or with proper authentication
    const ip = req.ip;
    const isInternal = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.');
    
    if (!isInternal && !req.get('X-API-Key')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
}

module.exports = new SecurityMiddleware();