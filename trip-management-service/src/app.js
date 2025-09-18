require('dotenv').config();
require('express-async-errors'); // Handle async errors automatically

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { testConnection, syncDatabase } = require('./models');
const { connectRedis } = require('./config/redis');
const { logger, requestLogger } = require('./config/logger');

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Security middleware (must be first)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3004',
      'http://localhost:3005'
    ];
    
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
    }
    
    if (process.env.CORS_ORIGIN) {
      allowedOrigins.push(process.env.CORS_ORIGIN);
    }
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ 
  limit: process.env.UPLOAD_MAX_SIZE || '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.UPLOAD_MAX_SIZE || '10mb' 
}));

// Generate request ID for tracking
app.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Health check endpoint (before other routes)
app.get('/health', async (req, res) => {
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
      logger.error('Database health check failed:', error);
    }

    // Check Redis connection
    try {
      const { client } = require('./config/redis');
      if (client && client.status === 'ready') {
        health.services.redis = 'healthy';
      } else {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
      logger.error('Redis health check failed:', error);
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
app.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: process.env.APP_VERSION || '1.0.0',
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(metrics);
});

// API routes (will be implemented)
app.use('/api/v1/trips', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Trip routes are being implemented',
    error: 'Service under construction'
  });
});

// API documentation placeholder
app.get('/api/v1/docs', (req, res) => {
  res.json({
    service: 'Trip Management Service',
    version: '1.0.0',
    description: 'Comprehensive trip management microservice for P2P delivery platform',
    endpoints: {
      '/api/v1/trips': 'Trip management endpoints',
      '/api/v1/trips/templates': 'Trip template management',
      '/api/v1/trips/analytics': 'Trip analytics and statistics',
      '/api/v1/trips/weather': 'Weather information for trips'
    },
    documentation: 'Full API documentation coming soon'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    error: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
    available_endpoints: [
      'GET /health',
      'GET /metrics',
      'GET /api/v1/docs',
      'POST /api/v1/trips (coming soon)'
    ]
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
    requestId: req.requestId
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = error.status || error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: isDevelopment ? error.message : 'Internal server error',
    error: isDevelopment ? error.message : 'An unexpected error occurred',
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
    if (client && client.status === 'ready') {
      await client.quit();
      logger.info('Redis connection closed');
    }

    // Close database connection
    const { sequelize } = require('./models');
    if (sequelize) {
      await sequelize.close();
      logger.info('Database connection closed');
    }

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
    logger.info('Starting P2P Delivery Trip Management Service...');

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
    const port = process.env.PORT || 3003;
    const host = process.env.HOST || '0.0.0.0';

    const server = app.listen(port, host, () => {
      logger.info(`Trip Management Service started successfully`, {
        port,
        host,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        pid: process.pid
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

    return server;
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