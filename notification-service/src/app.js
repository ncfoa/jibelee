require('dotenv').config();
require('express-async-errors');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import configurations
const { logger } = require('./config/logger');
const { testConnection: testDbConnection, initializeDatabase } = require('./config/database');
const { testConnection: testRedisConnection } = require('./config/redis');
const { validateConfigurations } = require('./config/providers');

// Import routes
const notificationRoutes = require('./routes/notificationRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');

// Import models to ensure they're initialized
require('./models');

class NotificationServiceApp {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = process.env.PORT || 3009;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-API-Key', 'X-Service-Token']
    };
    this.app.use(cors(corsOptions));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global rate limiting
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000, // limit each IP to 1000 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(globalLimiter);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length')
      });
      next();
    });

    // Trust proxy if behind load balancer
    if (process.env.TRUST_PROXY === 'true') {
      this.app.set('trust proxy', 1);
    }
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        service: 'notification-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/v1/notifications', notificationRoutes);
    this.app.use('/api/v1/notifications/preferences', preferenceRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'P2P Delivery Notification Service',
        version: process.env.npm_package_version || '1.0.0',
        documentation: '/api/v1/notifications/health',
        endpoints: {
          notifications: '/api/v1/notifications',
          preferences: '/api/v1/notifications/preferences',
          health: '/health'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(isDevelopment && { stack: error.stack })
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('unhandledRejection');
    });

    // Handle SIGTERM and SIGINT
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  async checkDependencies() {
    logger.info('Checking service dependencies...');

    // Check database connection
    const dbConnected = await testDbConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Check Redis connection
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      logger.warn('Redis connection failed - some features may be limited');
    }

    // Validate provider configurations
    try {
      validateConfigurations();
      logger.info('Provider configurations validated');
    } catch (error) {
      logger.error('Provider configuration validation failed:', error);
      throw error;
    }

    logger.info('All dependencies checked successfully');
  }

  async initializeDatabase() {
    try {
      logger.info('Initializing database...');
      await initializeDatabase();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  async start() {
    try {
      // Check dependencies
      await this.checkDependencies();

      // Initialize database
      await this.initializeDatabase();

      // Create HTTP server
      this.server = http.createServer(this.app);

      // Initialize Socket.IO for in-app notifications
      // The InAppProvider will handle Socket.IO initialization
      
      // Start server
      this.server.listen(this.port, () => {
        logger.info(`Notification service started successfully`, {
          port: this.port,
          environment: process.env.NODE_ENV,
          pid: process.pid
        });
      });

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${this.port} is already in use`);
        } else {
          logger.error('Server error:', error);
        }
        process.exit(1);
      });

    } catch (error) {
      logger.error('Failed to start notification service:', error);
      process.exit(1);
    }
  }

  async gracefulShutdown(signal) {
    logger.info(`Graceful shutdown initiated by ${signal}`);

    // Stop accepting new connections
    if (this.server) {
      this.server.close(async (error) => {
        if (error) {
          logger.error('Error during server shutdown:', error);
        } else {
          logger.info('HTTP server closed');
        }

        try {
          // Close database connections
          const { closeConnection } = require('./config/database');
          await closeConnection();

          // Close Redis connections
          const { closeConnections } = require('./config/redis');
          await closeConnections();

          logger.info('All connections closed');
          process.exit(0);
        } catch (shutdownError) {
          logger.error('Error during shutdown:', shutdownError);
          process.exit(1);
        }
      });

      // Force close after timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000); // 10 seconds timeout
    } else {
      process.exit(0);
    }
  }

  getApp() {
    return this.app;
  }

  getServer() {
    return this.server;
  }
}

// Create and export app instance
const notificationApp = new NotificationServiceApp();

// Start the server if this file is run directly
if (require.main === module) {
  notificationApp.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = notificationApp;