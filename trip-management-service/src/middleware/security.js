const crypto = require('crypto');
const { logger, logSecurityEvent } = require('../config/logger');

/**
 * Security middleware
 */
class SecurityMiddleware {
  /**
   * Generate request ID for tracking
   */
  static generateRequestId(req, res, next) {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  }

  /**
   * Security headers
   */
  static securityHeaders(req, res, next) {
    // Remove server identification
    res.removeHeader('X-Powered-By');
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // HSTS in production
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    next();
  }

  /**
   * Request logging for security monitoring
   */
  static requestLogger(req, res, next) {
    const startTime = Date.now();
    
    // Log request details
    logger.info('Incoming request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: req.get('Content-Length'),
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
        requestId: req.requestId
      });

      originalEnd.apply(this, args);
    };

    next();
  }

  /**
   * CORS options
   */
  static get corsOptions() {
    return {
      origin: function (origin, callback) {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3004',
          'http://localhost:3005'
        ];
        
        if (process.env.NODE_ENV === 'development') {
          allowedOrigins.push('http://localhost:3000');
        }
        
        if (process.env.CORS_ORIGIN) {
          allowedOrigins.push(process.env.CORS_ORIGIN);
        }
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logSecurityEvent('cors_violation', { origin, ip: 'unknown' });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      maxAge: 86400 // 24 hours
    };
  }

  /**
   * API security headers
   */
  static apiSecurityHeaders(req, res, next) {
    // API specific headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    next();
  }

  /**
   * Content type validation
   */
  static validateContentType(allowedTypes = ['application/json']) {
    return (req, res, next) => {
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        
        if (!contentType) {
          logSecurityEvent('missing_content_type', {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            requestId: req.requestId
          });
          
          return res.status(400).json({
            success: false,
            message: 'Content-Type header is required',
            error: 'MISSING_CONTENT_TYPE'
          });
        }

        const isAllowed = allowedTypes.some(type => 
          contentType.toLowerCase().includes(type.toLowerCase())
        );

        if (!isAllowed) {
          logSecurityEvent('invalid_content_type', {
            contentType,
            allowedTypes,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            requestId: req.requestId
          });

          return res.status(415).json({
            success: false,
            message: 'Unsupported content type',
            error: 'UNSUPPORTED_MEDIA_TYPE',
            data: {
              received: contentType,
              allowed: allowedTypes
            }
          });
        }
      }

      next();
    };
  }

  /**
   * Suspicious activity detection
   */
  static suspiciousActivityDetector(req, res, next) {
    const suspiciousPatterns = [
      /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
      /(union|select|insert|delete|update|drop|create|alter)\s/i, // SQL injection
      /<script|javascript:|vbscript:|onload=|onerror=/i, // XSS
      /(\$\{|\#\{|<%=)/i, // Template injection
      /(exec|eval|system|shell_exec)/i, // Code injection
    ];

    const checkForSuspiciousContent = (obj, path = '') => {
      if (typeof obj === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(obj)) {
            return { found: true, pattern: pattern.toString(), path, content: obj.substring(0, 100) };
          }
        }
      } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const result = checkForSuspiciousContent(obj[i], `${path}[${i}]`);
          if (result.found) return result;
        }
      } else if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const result = checkForSuspiciousContent(obj[key], `${path}.${key}`);
            if (result.found) return result;
          }
        }
      }
      return { found: false };
    };

    // Check URL
    const urlCheck = checkForSuspiciousContent(req.originalUrl, 'url');
    if (urlCheck.found) {
      logSecurityEvent('suspicious_url_detected', {
        url: req.originalUrl,
        pattern: urlCheck.pattern,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });

      return res.status(400).json({
        success: false,
        message: 'Suspicious request detected',
        error: 'SUSPICIOUS_REQUEST'
      });
    }

    // Check request body
    if (req.body) {
      const bodyCheck = checkForSuspiciousContent(req.body, 'body');
      if (bodyCheck.found) {
        logSecurityEvent('suspicious_payload_detected', {
          url: req.originalUrl,
          pattern: bodyCheck.pattern,
          path: bodyCheck.path,
          content: bodyCheck.content,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: req.requestId
        });

        return res.status(400).json({
          success: false,
          message: 'Suspicious request payload detected',
          error: 'SUSPICIOUS_PAYLOAD'
        });
      }
    }

    next();
  }

  /**
   * Remove sensitive headers from requests
   */
  static removeSensitiveHeaders(req, res, next) {
    // Remove potentially sensitive headers
    const sensitiveHeaders = [
      'x-real-ip',
      'x-original-forwarded-for',
      'x-forwarded-server',
      'x-forwarded-host'
    ];

    sensitiveHeaders.forEach(header => {
      delete req.headers[header];
    });

    next();
  }

  /**
   * Request size limiting
   */
  static requestSizeLimit(maxSize = '10mb') {
    return (req, res, next) => {
      const contentLength = parseInt(req.get('Content-Length') || '0');
      const maxBytes = this.parseSize(maxSize);

      if (contentLength > maxBytes) {
        logSecurityEvent('request_size_exceeded', {
          contentLength,
          maxSize: maxBytes,
          url: req.originalUrl,
          ip: req.ip,
          requestId: req.requestId
        });

        return res.status(413).json({
          success: false,
          message: 'Request entity too large',
          error: 'PAYLOAD_TOO_LARGE',
          data: {
            received: contentLength,
            maximum: maxBytes
          }
        });
      }

      next();
    };
  }

  /**
   * Secure health check endpoint
   */
  static secureHealthCheck(req, res, next) {
    // Add basic security for health check endpoint
    const allowedIPs = [
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ];

    const clientIP = req.ip;
    const isAllowed = allowedIPs.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation - simplified check
        return clientIP.startsWith(allowedIP.split('/')[0].split('.').slice(0, -1).join('.'));
      }
      return clientIP === allowedIP;
    });

    if (!isAllowed && process.env.NODE_ENV === 'production') {
      logSecurityEvent('unauthorized_health_check_access', {
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
        error: 'FORBIDDEN'
      });
    }

    next();
  }

  /**
   * Parse size string to bytes
   */
  static parseSize(size) {
    if (typeof size === 'number') return size;
    
    const units = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return Math.floor(value * (units[unit] || 1));
  }

  /**
   * IP whitelist middleware
   */
  static ipWhitelist(allowedIPs = []) {
    return (req, res, next) => {
      if (allowedIPs.length === 0) {
        return next(); // No whitelist configured
      }

      const clientIP = req.ip;
      const isAllowed = allowedIPs.includes(clientIP);

      if (!isAllowed) {
        logSecurityEvent('ip_not_whitelisted', {
          ip: clientIP,
          allowedIPs,
          url: req.originalUrl,
          requestId: req.requestId
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied from this IP address',
          error: 'IP_NOT_ALLOWED'
        });
      }

      next();
    };
  }

  /**
   * API key validation (for service-to-service communication)
   */
  static validateApiKey(req, res, next) {
    const apiKey = req.get('X-API-Key');
    const expectedApiKey = process.env.API_KEY;

    if (!expectedApiKey) {
      return next(); // No API key configured
    }

    if (!apiKey) {
      logSecurityEvent('missing_api_key', {
        url: req.originalUrl,
        ip: req.ip,
        requestId: req.requestId
      });

      return res.status(401).json({
        success: false,
        message: 'API key is required',
        error: 'MISSING_API_KEY'
      });
    }

    if (apiKey !== expectedApiKey) {
      logSecurityEvent('invalid_api_key', {
        providedKey: apiKey.substring(0, 8) + '...',
        url: req.originalUrl,
        ip: req.ip,
        requestId: req.requestId
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
        error: 'INVALID_API_KEY'
      });
    }

    next();
  }
}

module.exports = SecurityMiddleware;