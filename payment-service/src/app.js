const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('express-async-errors');
require('dotenv').config();

const { logger, requestLogger } = require('./config/logger');
const { testConnection } = require('./config/database');
const { validateStripeConfig } = require('./config/stripe');
const { createRedisClient } = require('./config/redis');
const { createQueues } = require('./config/queue');

// Import middleware
const {
  securityHeaders,
  compressionMiddleware,
  rateLimitConfigs,
  slowDownMiddleware,
  sanitizeInput,
  requestSizeLimit,
  corsOptions,
  requestTimeout
} = require('./middleware');

// Import routes
const pricingRoutes = require('./routes/pricingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const escrowRoutes = require('./routes/escrowRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Create Express app
const app = express();

// Global middleware
app.use(requestTimeout(30000)); // 30 second timeout
app.use(securityHeaders);
app.use(compressionMiddleware);
app.use(cors(corsOptions));

// Raw body parser for webhooks (must be before express.json())
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }));

// JSON body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(sanitizeInput);
app.use(requestSizeLimit('10mb'));
app.use(slowDownMiddleware);
app.use(rateLimitConfigs.general);

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'payment-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Detailed health check endpoint
app.get('/health/detailed', async (req, res) => {
  const health = {
    success: true,
    service: 'payment-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      stripe: 'unknown'
    }
  };

  try {
    // Check database connection
    await testConnection();
    health.checks.database = 'healthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.success = false;
  }

  try {
    // Check Redis connection
    const redis = createRedisClient();
    await redis.ping();
    health.checks.redis = 'healthy';
    await redis.disconnect();
  } catch (error) {
    health.checks.redis = 'unhealthy';
  }

  try {
    // Check Stripe configuration
    validateStripeConfig();
    health.checks.stripe = 'configured';
  } catch (error) {
    health.checks.stripe = 'misconfigured';
  }

  const statusCode = health.success ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.use('/api/v1/payments', pricingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/payments', escrowRoutes);
app.use('/api/v1/payments', payoutRoutes);
app.use('/api/v1/payments', subscriptionRoutes);
app.use('/api/v1/payments', analyticsRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: 'The requested endpoint was not found'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: isDevelopment ? error.message : 'An internal server error occurred',
      ...(isDevelopment && { stack: error.stack })
    }
  });
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('HTTP server closed');
    
    // Close database connections
    const { sequelize } = require('./config/database');
    sequelize.close().then(() => {
      logger.info('Database connections closed');
      process.exit(0);
    }).catch((err) => {
      logger.error('Error closing database connections:', err);
      process.exit(1);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Initialize the application
const initializeApp = async () => {
  try {
    // Test database connection
    await testConnection();
    logger.info('Database connection established');

    // Validate Stripe configuration
    validateStripeConfig();
    logger.info('Stripe configuration validated');

    // Initialize Redis connection
    const redis = createRedisClient();
    await redis.connect();
    logger.info('Redis connection established');

    // Initialize job queues
    const queues = createQueues();
    logger.info('Job queues initialized');

    // Start server
    const PORT = process.env.PORT || 3007;
    const server = app.listen(PORT, () => {
      logger.info(`Payment service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    // Setup graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    return server;

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Start the application if this file is run directly
if (require.main === module) {
  initializeApp();
}

module.exports = { app, initializeApp };