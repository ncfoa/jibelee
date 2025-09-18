const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Log format for files (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: format,
  }),

  // Error log file
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: fileFormat,
    maxSize: '20m',
    maxFiles: '14d',
  }),

  // Combined log file
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: fileFormat,
    maxSize: '20m',
    maxFiles: '14d',
  }),

  // Auth events log file
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/auth-events-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: fileFormat,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'info',
  }),
];

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Stream for HTTP request logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Auth event logger
const authLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/auth-events-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    })
  ]
});

// Security event logger
const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/security-events-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Helper functions for structured logging
const logAuthEvent = (eventType, userId, details = {}, req = null) => {
  const logData = {
    eventType,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (req) {
    logData.ip = req.ip || req.connection?.remoteAddress;
    logData.userAgent = req.get('User-Agent');
    logData.origin = req.get('Origin');
  }

  authLogger.info('Auth event', logData);
};

const logSecurityEvent = (eventType, severity, details = {}, req = null) => {
  const logData = {
    eventType,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (req) {
    logData.ip = req.ip || req.connection?.remoteAddress;
    logData.userAgent = req.get('User-Agent');
    logData.origin = req.get('Origin');
  }

  securityLogger.warn('Security event', logData);
};

module.exports = {
  logger,
  authLogger,
  securityLogger,
  logAuthEvent,
  logSecurityEvent
};