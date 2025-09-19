const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which logs to print based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...args } = info;
    const ts = timestamp.slice(0, 19).replace('T', ' ');
    return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
  })
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      format
    )
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 10485760, // 10MB
    maxFiles: 10
  })
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// HTTP request logging middleware
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.http(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Location-specific logging methods
const locationLogger = {
  trackingStarted: (data) => {
    logger.info('Location tracking started', {
      event: 'tracking_started',
      deliveryId: data.deliveryId,
      userId: data.userId,
      settings: data.settings,
      timestamp: new Date().toISOString()
    });
  },

  locationUpdated: (data) => {
    logger.debug('Location updated', {
      event: 'location_updated',
      deliveryId: data.deliveryId,
      userId: data.userId,
      coordinates: data.location?.coordinates,
      accuracy: data.location?.accuracy,
      timestamp: new Date().toISOString()
    });
  },

  geofenceEvent: (data) => {
    logger.info('Geofence event triggered', {
      event: 'geofence_event',
      geofenceId: data.geofenceId,
      eventType: data.eventType,
      userId: data.userId,
      deliveryId: data.deliveryId,
      coordinates: data.coordinates,
      timestamp: new Date().toISOString()
    });
  },

  emergencyReported: (data) => {
    logger.warn('Emergency reported', {
      event: 'emergency_reported',
      emergencyId: data.emergencyId,
      emergencyType: data.emergencyType,
      severity: data.severity,
      userId: data.userId,
      deliveryId: data.deliveryId,
      coordinates: data.coordinates,
      timestamp: new Date().toISOString()
    });
  },

  trackingStopped: (data) => {
    logger.info('Location tracking stopped', {
      event: 'tracking_stopped',
      deliveryId: data.deliveryId,
      userId: data.userId,
      reason: data.reason,
      totalUpdates: data.totalUpdates,
      totalDistance: data.totalDistance,
      duration: data.totalDuration,
      timestamp: new Date().toISOString()
    });
  },

  privacySettingsUpdated: (data) => {
    logger.info('Privacy settings updated', {
      event: 'privacy_settings_updated',
      userId: data.userId,
      changes: data.changes,
      timestamp: new Date().toISOString()
    });
  },

  dataExported: (data) => {
    logger.info('User data exported', {
      event: 'data_exported',
      userId: data.userId,
      exportId: data.exportId,
      format: data.format,
      recordCount: data.recordCount,
      timestamp: new Date().toISOString()
    });
  },

  dataDeleted: (data) => {
    logger.warn('User data deleted', {
      event: 'data_deleted',
      userId: data.userId,
      deletionId: data.deletionId,
      recordsDeleted: data.recordsDeleted,
      timestamp: new Date().toISOString()
    });
  }
};

// Performance monitoring
const performanceLogger = {
  slowQuery: (query, duration) => {
    logger.warn('Slow database query detected', {
      event: 'slow_query',
      query: query.substring(0, 200), // Truncate long queries
      duration,
      threshold: 1000, // 1 second
      timestamp: new Date().toISOString()
    });
  },

  highMemoryUsage: (usage) => {
    logger.warn('High memory usage detected', {
      event: 'high_memory_usage',
      memoryUsage: usage,
      timestamp: new Date().toISOString()
    });
  },

  apiLatency: (endpoint, duration) => {
    if (duration > 2000) { // Log if API call takes more than 2 seconds
      logger.warn('High API latency detected', {
        event: 'high_api_latency',
        endpoint,
        duration,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Security logging
const securityLogger = {
  authFailure: (data) => {
    logger.warn('Authentication failure', {
      event: 'auth_failure',
      ip: data.ip,
      userAgent: data.userAgent,
      endpoint: data.endpoint,
      reason: data.reason,
      timestamp: new Date().toISOString()
    });
  },

  unauthorizedAccess: (data) => {
    logger.warn('Unauthorized access attempt', {
      event: 'unauthorized_access',
      userId: data.userId,
      ip: data.ip,
      endpoint: data.endpoint,
      requiredRole: data.requiredRole,
      userRole: data.userRole,
      timestamp: new Date().toISOString()
    });
  },

  suspiciousActivity: (data) => {
    logger.error('Suspicious activity detected', {
      event: 'suspicious_activity',
      userId: data.userId,
      ip: data.ip,
      activity: data.activity,
      details: data.details,
      timestamp: new Date().toISOString()
    });
  }
};

// Error logging with context
const errorLogger = {
  databaseError: (error, context) => {
    logger.error('Database error occurred', {
      event: 'database_error',
      error: error.message,
      stack: error.stack,
      query: context?.query,
      params: context?.params,
      timestamp: new Date().toISOString()
    });
  },

  externalServiceError: (service, error, context) => {
    logger.error('External service error', {
      event: 'external_service_error',
      service,
      error: error.message,
      statusCode: error.response?.status,
      responseData: error.response?.data,
      context,
      timestamp: new Date().toISOString()
    });
  },

  validationError: (error, context) => {
    logger.warn('Validation error', {
      event: 'validation_error',
      error: error.message,
      details: error.details,
      endpoint: context?.endpoint,
      userId: context?.userId,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  logger,
  httpLogger,
  locationLogger,
  performanceLogger,
  securityLogger,
  errorLogger
};