require('dotenv').config();
require('express-async-errors'); // Handle async errors automatically

const express = require('express');
const cors = require('cors');
const { testConnection, syncDatabase } = require('./models');
const { connectRedis } = require('./config/redis');
const { logger, authLogger, securityLogger } = require('./config/logger');
const { security, rateLimit } = require('./middleware');
const routes = require('./routes');

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Security middleware (must be first)
app.use(security.generateRequestId);
app.use(security.securityHeaders);
app.use(security.requestLogger);
app.use(cors(security.corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(security.apiSecurityHeaders);
app.use(security.validateContentType(['application/json', 'application/x-www-form-urlencoded']));
app.use(security.suspiciousActivityDetector);
app.use(security.removeSensitiveHeaders);

// Input sanitization
app.use(security.requestSizeLimit('10mb'));

// Rate limiting
app.use(rateLimit.apiRateLimit);

// Health check endpoint (before other routes)
app.get('/health', security.secureHealthCheck, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'checking',
        redis: 'checking'
      }
    };

    // Check database connection
    try {
      await testConnection();
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check Redis connection
    try {
      const { client } = require('./config/redis');
      if (client.isReady) {
        health.services.redis = 'healthy';
      } else {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Metrics endpoint
app.get('/metrics', security.secureHealthCheck, (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: process.env.APP_VERSION || '1.0.0',
    node_version: process.version
  };

  res.json(metrics);
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    errors: [`The requested endpoint ${req.method} ${req.originalUrl} was not found`]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  // Log the error
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Security logging for potential attacks
  if (error.message.includes('validation') || error.status === 422) {
    securityLogger.warn('Validation error', {
      error: error.message,
      url: req.originalUrl,
      ip: req.ip,
      body: req.body
    });
  }

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = error.status || error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: isDevelopment ? error.message : 'Internal server error',
    errors: [isDevelopment ? error.message : 'An unexpected error occurred'],
    ...(isDevelopment && { stack: error.stack }),
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    }
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    // Close Redis connection
    const { client } = require('./config/redis');
    if (client.isReady) {
      await client.quit();
      logger.info('Redis connection closed');
    }

    // Close database connection
    const { sequelize } = require('./models');
    await sequelize.close();
    logger.info('Database connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Initialize and start server
const startServer = async () => {
  try {
    logger.info('Starting P2P Delivery Auth Service...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Connect to Redis
    const redisConnected = await connectRedis();
    if (!redisConnected) {
      logger.warn('Redis connection failed - some features may not work properly');
    }

    // Sync database (create tables)
    if (process.env.NODE_ENV === 'development') {
      await syncDatabase(false); // Don't force recreate in development
      logger.info('Database synchronized');
    }

    // Start server
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';

    app.listen(port, host, () => {
      logger.info(`Auth Service started successfully`, {
        port,
        host,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;