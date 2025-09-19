const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('express-async-errors');
require('dotenv').config();

const logger = require('./config/logger');
const database = require('./config/database');
const redisClient = require('./config/redis');
const { errorHandler, notFoundHandler } = require('./middleware');
const routes = require('./routes');
const DashboardSocket = require('./realtime/dashboardSocket');
const JobScheduler = require('./jobs/jobScheduler');

class AdminService {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    this.port = process.env.PORT || 3010;
    this.host = process.env.HOST || '0.0.0.0';
  }

  async initialize() {
    try {
      // Initialize database connection
      await database.authenticate();
      logger.info('Database connection established successfully');

      // Initialize Redis connection
      await redisClient.connect();
      logger.info('Redis connection established successfully');

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Initialize real-time features
      this.setupRealTime();

      // Initialize job scheduler
      this.setupJobScheduler();

      logger.info('Admin service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize admin service:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 1000),
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'admin-service',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/v1/admin', routes);

    // Serve static files for admin dashboard (if needed)
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static('public'));
    }
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  setupRealTime() {
    if (process.env.ENABLE_REAL_TIME_DASHBOARD === 'true') {
      this.dashboardSocket = new DashboardSocket(this.io);
      logger.info('Real-time dashboard initialized');
    }
  }

  setupJobScheduler() {
    this.jobScheduler = new JobScheduler();
    this.jobScheduler.start();
    logger.info('Job scheduler initialized');
  }

  async start() {
    try {
      await this.initialize();
      
      this.server.listen(this.port, this.host, () => {
        logger.info(`Admin service running on ${this.host}:${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        logger.info(`Process ID: ${process.pid}`);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        this.shutdown('uncaughtException');
      });
      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        this.shutdown('unhandledRejection');
      });

    } catch (error) {
      logger.error('Failed to start admin service:', error);
      process.exit(1);
    }
  }

  async shutdown(signal) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Close server
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close database connection
      if (database) {
        await database.close();
        logger.info('Database connection closed');
      }

      // Close Redis connection
      if (redisClient) {
        await redisClient.disconnect();
        logger.info('Redis connection closed');
      }

      // Stop job scheduler
      if (this.jobScheduler) {
        await this.jobScheduler.stop();
        logger.info('Job scheduler stopped');
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the service
const adminService = new AdminService();
adminService.start();

module.exports = adminService;