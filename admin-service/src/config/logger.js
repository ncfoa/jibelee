const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = process.env.LOG_FILE_PATH || './logs';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'admin-service' },
  transports: [
    // Error log file
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    
    // Combined log file
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    
    // Admin activity log file
    new DailyRotateFile({
      filename: path.join(logDir, 'admin-activity-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Handle logging errors
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

// Custom methods for admin-specific logging
logger.adminActivity = (adminId, action, resource, details = {}) => {
  logger.info('Admin Activity', {
    type: 'admin_activity',
    adminId,
    action,
    resource,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.securityEvent = (event, details = {}) => {
  logger.warn('Security Event', {
    type: 'security_event',
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.systemEvent = (event, details = {}) => {
  logger.info('System Event', {
    type: 'system_event',
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.performanceMetric = (metric, value, details = {}) => {
  logger.info('Performance Metric', {
    type: 'performance_metric',
    metric,
    value,
    details,
    timestamp: new Date().toISOString()
  });
};

// Export logger with additional utility methods
module.exports = logger;