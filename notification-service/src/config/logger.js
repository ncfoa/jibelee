const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
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

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transport for errors
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    handleExceptions: true,
    json: true,
    maxSize: '20m',
    maxFiles: '14d'
  }),
  
  // File transport for all logs
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    handleExceptions: true,
    json: true,
    maxSize: '20m',
    maxFiles: '14d'
  }),
  
  // File transport for notifications
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'notifications-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    json: true,
    maxSize: '20m',
    maxFiles: '30d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false
});

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'logs', 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    json: true,
    maxSize: '20m',
    maxFiles: '14d'
  })
);

process.on('unhandledRejection', (ex) => {
  throw ex;
});

// Create specialized loggers for different components
const createComponentLogger = (component) => {
  return {
    error: (message, meta = {}) => logger.error(`[${component}] ${message}`, meta),
    warn: (message, meta = {}) => logger.warn(`[${component}] ${message}`, meta),
    info: (message, meta = {}) => logger.info(`[${component}] ${message}`, meta),
    http: (message, meta = {}) => logger.http(`[${component}] ${message}`, meta),
    debug: (message, meta = {}) => logger.debug(`[${component}] ${message}`, meta)
  };
};

// Specialized loggers
const notificationLogger = createComponentLogger('NOTIFICATION');
const emailLogger = createComponentLogger('EMAIL');
const pushLogger = createComponentLogger('PUSH');
const smsLogger = createComponentLogger('SMS');
const webhookLogger = createComponentLogger('WEBHOOK');
const analyticsLogger = createComponentLogger('ANALYTICS');

module.exports = {
  logger,
  notificationLogger,
  emailLogger,
  pushLogger,
  smsLogger,
  webhookLogger,
  analyticsLogger,
  createComponentLogger
};