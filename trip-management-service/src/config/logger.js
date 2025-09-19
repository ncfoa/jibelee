require('dotenv').config();
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Ensure logs directory exists
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
];

// File transports for production
if (process.env.NODE_ENV === 'production') {
  // General log file
  transports.push(new DailyRotateFile({
    filename: path.join(logsDir, 'trip-service-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    format: logFormat,
    level: 'info'
  }));

  // Error log file
  transports.push(new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '30d',
    format: logFormat,
    level: 'error'
  }));
}

// Main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

// Security logger for security-related events
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        type: 'security',
        message,
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console({
      level: 'warn'
    }),
    ...(process.env.NODE_ENV === 'production' ? [
      new DailyRotateFile({
        filename: path.join(logsDir, 'security-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '30d',
        level: 'info'
      })
    ] : [])
  ]
});

// Auth logger for authentication events
const authLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        type: 'auth',
        message,
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console({
      level: 'info'
    }),
    ...(process.env.NODE_ENV === 'production' ? [
      new DailyRotateFile({
        filename: path.join(logsDir, 'auth-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '30d',
        level: 'info'
      })
    ] : [])
  ]
});

// Performance logger for monitoring
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    ...(process.env.NODE_ENV === 'production' ? [
      new DailyRotateFile({
        filename: path.join(logsDir, 'performance-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '7d',
        level: 'info'
      })
    ] : [])
  ]
});

// Request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    userId: req.user?.id,
    requestId: req.requestId
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Log response
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
      requestId: req.requestId
    });

    // Performance logging for slow requests
    if (duration > 1000) {
      performanceLogger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id,
        requestId: req.requestId
      });
    }

    originalEnd.apply(this, args);
  };

  next();
};

// Error logger helper
const logError = (error, context = {}) => {
  logger.error(error.message, {
    error: error.name,
    stack: error.stack,
    ...context
  });
};

// Security event logger
const logSecurityEvent = (event, details = {}) => {
  securityLogger.warn(`Security event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Auth event logger
const logAuthEvent = (event, userId, details = {}) => {
  authLogger.info(`Auth event: ${event}`, {
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Performance metrics logger
const logPerformance = (operation, duration, details = {}) => {
  performanceLogger.info(`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Database query logger
const logDatabaseQuery = (query, duration, results = null) => {
  if (process.env.DB_LOGGING === 'true') {
    logger.debug('Database query executed', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration: `${duration}ms`,
      resultCount: results ? (Array.isArray(results) ? results.length : 1) : 0
    });
  }
};

// API call logger
const logApiCall = (service, endpoint, method, duration, statusCode) => {
  logger.info('External API call', {
    service,
    endpoint,
    method,
    duration: `${duration}ms`,
    statusCode
  });
};

// Cache operation logger
const logCacheOperation = (operation, key, hit = null, duration = null) => {
  logger.debug('Cache operation', {
    operation,
    key,
    hit,
    duration: duration ? `${duration}ms` : undefined
  });
};

// Business logic logger
const logBusinessEvent = (event, details = {}) => {
  logger.info(`Business event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Cleanup old log files (called on startup)
const cleanupLogs = () => {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Log cleanup completed');
  }
};

module.exports = {
  logger,
  securityLogger,
  authLogger,
  performanceLogger,
  requestLogger,
  logError,
  logSecurityEvent,
  logAuthEvent,
  logPerformance,
  logDatabaseQuery,
  logApiCall,
  logCacheOperation,
  logBusinessEvent,
  cleanupLogs
};