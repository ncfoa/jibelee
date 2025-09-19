const logger = require('../config/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    adminUser: req.adminUser ? req.adminUser.id : null
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details || error.message,
      code: 'VALIDATION_ERROR'
    });
  }

  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Database validation error',
      details: error.errors.map(e => ({ field: e.path, message: e.message })),
      code: 'DB_VALIDATION_ERROR'
    });
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      details: error.errors.map(e => ({ field: e.path, message: e.message })),
      code: 'DUPLICATE_RESOURCE'
    });
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      error: 'Foreign key constraint error',
      code: 'FOREIGN_KEY_ERROR'
    });
  }

  if (error.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'File not found',
      code: 'FILE_NOT_FOUND'
    });
  }

  // Handle JWT errors
  if (error.message && error.message.includes('jwt')) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  // Handle Redis errors
  if (error.message && error.message.includes('Redis')) {
    logger.error('Redis error:', error);
    // Don't expose Redis errors to client
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }

  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

/**
 * 404 handler middleware
 */
const notFoundHandler = (req, res) => {
  logger.warn('Route not found:', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method
  });
};

/**
 * Request timeout middleware
 */
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout:', {
          path: req.path,
          method: req.method,
          timeout: timeoutMs,
          ip: req.ip
        });

        res.status(408).json({
          success: false,
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT'
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Request size limiter middleware
 */
const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = typeof maxSize === 'string' 
        ? parseSize(maxSize) 
        : maxSize;

      if (sizeInBytes > maxSizeInBytes) {
        logger.warn('Request too large:', {
          path: req.path,
          method: req.method,
          size: sizeInBytes,
          maxSize: maxSizeInBytes,
          ip: req.ip
        });

        return res.status(413).json({
          success: false,
          error: 'Request entity too large',
          code: 'REQUEST_TOO_LARGE',
          maxSize: maxSize
        });
      }
    }

    next();
  };
};

/**
 * Parse size string to bytes
 */
const parseSize = (sizeStr) => {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };

  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
  if (!match) return 0;

  const [, size, unit] = match;
  return Math.floor(parseFloat(size) * units[unit]);
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/**
 * Request ID middleware
 */
const requestId = (req, res, next) => {
  const { v4: uuidv4 } = require('uuid');
  const requestId = req.get('X-Request-ID') || uuidv4();
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Response time middleware
 */
const responseTime = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    // Log slow requests
    if (duration > 1000) { // Log requests taking more than 1 second
      logger.warn('Slow request:', {
        path: req.path,
        method: req.method,
        duration: `${duration.toFixed(2)}ms`,
        ip: req.ip,
        adminUser: req.adminUser ? req.adminUser.id : null
      });
    }
  });
  
  next();
};

/**
 * API versioning middleware
 */
const apiVersioning = (req, res, next) => {
  const version = req.get('API-Version') || 'v1';
  req.apiVersion = version;
  res.setHeader('API-Version', version);
  next();
};

/**
 * Cache control middleware
 */
const cacheControl = (options = {}) => {
  const {
    maxAge = 0,
    noCache = true,
    noStore = false,
    mustRevalidate = true
  } = options;

  return (req, res, next) => {
    let cacheControlValue = '';

    if (noCache) cacheControlValue += 'no-cache, ';
    if (noStore) cacheControlValue += 'no-store, ';
    if (mustRevalidate) cacheControlValue += 'must-revalidate, ';
    
    cacheControlValue += `max-age=${maxAge}`;

    res.setHeader('Cache-Control', cacheControlValue);
    next();
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  requestTimeout,
  requestSizeLimiter,
  securityHeaders,
  requestId,
  responseTime,
  apiVersioning,
  cacheControl
};