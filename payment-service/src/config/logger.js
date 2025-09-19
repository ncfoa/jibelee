const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Create custom format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // Error log file
  new DailyRotateFile({
    filename: 'logs/payment-service-error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    handleExceptions: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // Combined log file
  new DailyRotateFile({
    filename: 'logs/payment-service-combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Add request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
    };
    
    if (res.statusCode >= 400) {
      logger.error(`HTTP ${res.statusCode} - ${JSON.stringify(logData)}`);
    } else {
      logger.http(`HTTP ${res.statusCode} - ${JSON.stringify(logData)}`);
    }
  });
  
  next();
};

// Payment-specific logging methods
const paymentLogger = {
  paymentCreated: (paymentIntentId, amount, currency, userId) => {
    logger.info(`Payment created - ID: ${paymentIntentId}, Amount: ${amount} ${currency}, User: ${userId}`);
  },
  
  paymentConfirmed: (paymentIntentId, amount, currency, userId) => {
    logger.info(`Payment confirmed - ID: ${paymentIntentId}, Amount: ${amount} ${currency}, User: ${userId}`);
  },
  
  paymentFailed: (paymentIntentId, error, userId) => {
    logger.error(`Payment failed - ID: ${paymentIntentId}, Error: ${error}, User: ${userId}`);
  },
  
  escrowCreated: (escrowId, paymentIntentId, amount) => {
    logger.info(`Escrow created - ID: ${escrowId}, Payment: ${paymentIntentId}, Amount: ${amount}`);
  },
  
  escrowReleased: (escrowId, amount, travelerId) => {
    logger.info(`Escrow released - ID: ${escrowId}, Amount: ${amount}, Traveler: ${travelerId}`);
  },
  
  payoutProcessed: (payoutId, amount, currency, userId) => {
    logger.info(`Payout processed - ID: ${payoutId}, Amount: ${amount} ${currency}, User: ${userId}`);
  },
  
  refundProcessed: (refundId, amount, currency, reason) => {
    logger.info(`Refund processed - ID: ${refundId}, Amount: ${amount} ${currency}, Reason: ${reason}`);
  },
  
  fraudDetected: (userId, riskScore, factors) => {
    logger.warn(`Fraud detected - User: ${userId}, Risk Score: ${riskScore}, Factors: ${JSON.stringify(factors)}`);
  },
  
  priceCalculated: (routeHash, basePrice, finalPrice, factors) => {
    logger.debug(`Price calculated - Route: ${routeHash}, Base: ${basePrice}, Final: ${finalPrice}, Factors: ${JSON.stringify(factors)}`);
  }
};

module.exports = {
  logger,
  requestLogger,
  paymentLogger
};