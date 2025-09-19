require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const logger = require('./config/logger');
const { testConnection } = require('./config/database');
const { syncDatabase } = require('./models');
const routes = require('./routes');

const {
  securityHeaders,
  generalRateLimit,
  requestSizeLimit,
  addSecurityHeaders,
  validateUserAgent,
  requestTimeout,
  corsOptions
} = require('./middleware');

class QRCodeServiceApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3006;
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      // Test database connection
      await testConnection();
      logger.info('Database connection verified');

      // Sync database models
      if (process.env.NODE_ENV === 'development') {
        await syncDatabase({ alter: true });
      } else {
        await syncDatabase();
      }
      logger.info('Database models synchronized');

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      logger.info('QR Code Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize QR Code Service:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Trust proxy (important for rate limiting and IP detection)
    this.app.set('trust proxy', 1);

    // Compression
    this.app.use(compression());

    // Security middleware
    this.app.use(securityHeaders);
    this.app.use(addSecurityHeaders);

    // CORS
    this.app.use(cors(corsOptions));

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request size limiting
    this.app.use(requestSizeLimit('10mb'));

    // Request timeout
    this.app.use(requestTimeout(30000)); // 30 seconds

    // User agent validation
    this.app.use(validateUserAgent);

    // General rate limiting
    this.app.use('/api', generalRateLimit);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.logRequest(req, res, duration);
      });
      
      next();
    });
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/v1', routes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        service: 'QR Code Service',
        message: 'Service is running',
        version: process.env.npm_package_version || '1.0.0',
        documentation: '/api/v1/info',
        health: '/api/v1/health',
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint (for load balancers)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        userId: req.user?.id,
        ip: req.ip
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(error.status || 500).json({
        success: false,
        error: isDevelopment ? error.message : 'Internal server error',
        ...(isDevelopment && { stack: error.stack })
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', {
        reason,
        promise: promise.toString()
      });
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  async start() {
    try {
      await this.initialize();
      
      const server = this.app.listen(this.port, () => {
        logger.info(`QR Code Service running on port ${this.port}`, {
          environment: process.env.NODE_ENV,
          port: this.port,
          pid: process.pid
        });
      });

      // Store server reference for graceful shutdown
      this.server = server;

      return server;
    } catch (error) {
      logger.error('Failed to start QR Code Service:', error);
      process.exit(1);
    }
  }

  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    if (this.server) {
      this.server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Close database connections
          const { sequelize } = require('./config/database');
          await sequelize.close();
          logger.info('Database connections closed');

          // Perform any other cleanup
          await this.cleanup();

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000); // 10 seconds
    } else {
      process.exit(0);
    }
  }

  async cleanup() {
    // Perform any necessary cleanup operations
    logger.info('Performing cleanup operations...');
    
    // Close Redis connections, stop background jobs, etc.
    // This would be implemented based on actual dependencies
  }
}

// Create and start the application
const qrService = new QRCodeServiceApp();

// Start the service if this file is run directly
if (require.main === module) {
  qrService.start().catch((error) => {
    logger.error('Failed to start service:', error);
    process.exit(1);
  });
}

module.exports = qrService;