require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import middleware
const { httpLogger, logger } = require('./utils/logger');
const { 
  errorHandler, 
  notFoundHandler, 
  unhandledRejectionHandler, 
  uncaughtExceptionHandler,
  gracefulShutdownHandler 
} = require('./middleware/errorHandler');

// Import routes
const routes = require('./routes');

// Import services
const LocationService = require('./services/locationService');
const GeofenceService = require('./services/geofenceService');
const MonitoringService = require('./services/monitoringService');

class LocationServiceApp {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });
    
    this.port = process.env.PORT || 3008;
    this.env = process.env.NODE_ENV || 'development';
    
    // Initialize services
    this.locationService = new LocationService();
    this.geofenceService = new GeofenceService();
    this.monitoringService = new MonitoringService();
    
    // Setup error handlers
    this.setupErrorHandlers();
    
    // Setup middleware
    this.setupMiddleware();
    
    // Setup routes
    this.setupRoutes();
    
    // Setup WebSocket
    this.setupWebSocket();
    
    // Setup service event listeners
    this.setupEventListeners();
  }

  setupErrorHandlers() {
    // Handle uncaught exceptions and unhandled rejections
    unhandledRejectionHandler();
    uncaughtExceptionHandler();
    
    // Graceful shutdown
    gracefulShutdownHandler(this.server);
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(httpLogger);

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/v1/location/health';
      }
    });
    this.app.use(limiter);

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });

    // Performance monitoring middleware
    this.app.use(async (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        
        // Record API metrics
        await this.monitoringService.recordAPIMetric(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration,
          req.user?.id
        );
      });
      
      next();
    });
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/v1/location', routes);
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        service: 'Location Service',
        version: process.env.npm_package_version || '1.0.0',
        environment: this.env,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/v1/location/health',
          docs: '/api/v1/location/docs',
          tracking: '/api/v1/location/track',
          geofences: '/api/v1/location/geofences',
          emergency: '/api/v1/location/emergency'
        }
      });
    });

    // 404 handler
    this.app.use(notFoundHandler);

    // Error handler
    this.app.use(errorHandler);
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', {
        socketId: socket.id,
        clientIP: socket.handshake.address
      });

      // Join delivery room for real-time updates
      socket.on('join_delivery', (deliveryId) => {
        socket.join(`delivery:${deliveryId}`);
        logger.debug('Client joined delivery room', {
          socketId: socket.id,
          deliveryId
        });
      });

      // Leave delivery room
      socket.on('leave_delivery', (deliveryId) => {
        socket.leave(`delivery:${deliveryId}`);
        logger.debug('Client left delivery room', {
          socketId: socket.id,
          deliveryId
        });
      });

      // Handle location updates from mobile clients
      socket.on('location_update', async (data) => {
        try {
          const { deliveryId, userId, location } = data;
          
          // Validate and process location update
          await this.locationService.updateLocation(userId, deliveryId, {
            coordinates: location,
            timestamp: new Date()
          });
          
          logger.debug('Location update received via WebSocket', {
            socketId: socket.id,
            deliveryId,
            userId
          });
        } catch (error) {
          logger.error('WebSocket location update error:', error);
          socket.emit('error', {
            message: 'Failed to process location update',
            error: error.message
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', {
          socketId: socket.id,
          reason
        });
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('WebSocket error:', {
          socketId: socket.id,
          error: error.message
        });
      });
    });
  }

  setupEventListeners() {
    // Location service events
    this.locationService.on('tracking_started', (data) => {
      this.io.to(`delivery:${data.deliveryId}`).emit('tracking_started', data);
      this.monitoringService.recordLocationMetric('tracking_started', data);
    });

    this.locationService.on('location_updated', (data) => {
      this.io.to(`delivery:${data.deliveryId}`).emit('location_updated', {
        deliveryId: data.deliveryId,
        location: data.location,
        timestamp: data.location.timestamp
      });
      this.monitoringService.recordLocationUpdate(
        data.deliveryId,
        data.userId,
        data.location.coordinates,
        data.location.accuracy
      );
    });

    this.locationService.on('tracking_stopped', (data) => {
      this.io.to(`delivery:${data.deliveryId}`).emit('tracking_stopped', data);
      this.monitoringService.recordLocationMetric('tracking_stopped', data);
    });

    // Geofence service events
    this.geofenceService.on('geofence_event', (data) => {
      this.io.to(`delivery:${data.deliveryId}`).emit('geofence_event', {
        geofenceId: data.geofenceId,
        eventType: data.eventType,
        deliveryId: data.deliveryId,
        timestamp: new Date().toISOString()
      });
      this.monitoringService.recordGeofenceEvent(
        data.geofenceId,
        data.eventType,
        data.userId,
        data.deliveryId
      );
    });

    this.geofenceService.on('geofence_created', (data) => {
      this.io.to(`delivery:${data.deliveryId}`).emit('geofence_created', data);
    });

    // Error events
    this.locationService.on('error', async (error) => {
      logger.error('Location service error:', error);
      await this.monitoringService.recordError(error, { service: 'location' });
    });

    this.geofenceService.on('error', async (error) => {
      logger.error('Geofence service error:', error);
      await this.monitoringService.recordError(error, { service: 'geofence' });
    });
  }

  async start() {
    try {
      // Start the server
      this.server.listen(this.port, () => {
        logger.info(`🚀 Location Service started successfully`, {
          port: this.port,
          environment: this.env,
          nodeVersion: process.version,
          timestamp: new Date().toISOString()
        });
      });

      // Setup periodic tasks
      this.setupPeriodicTasks();

      // Log startup success
      logger.info('✅ All services initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to start Location Service:', error);
      process.exit(1);
    }
  }

  setupPeriodicTasks() {
    // Cleanup expired geofences every hour
    setInterval(async () => {
      try {
        await this.geofenceService.cleanupExpiredGeofences();
      } catch (error) {
        logger.error('Geofence cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Cleanup old metrics every 6 hours
    setInterval(async () => {
      try {
        await this.monitoringService.cleanup();
      } catch (error) {
        logger.error('Metrics cleanup error:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Health check every 5 minutes
    setInterval(async () => {
      try {
        const health = await this.monitoringService.getHealthStatus();
        if (health.status !== 'healthy') {
          logger.warn('Service health degraded', health);
        }
      } catch (error) {
        logger.error('Health check error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Log service statistics every 30 minutes
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      logger.info('Service statistics', {
        uptime: Math.round(uptime),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024)
        },
        connections: this.io.engine.clientsCount
      });
    }, 30 * 60 * 1000); // 30 minutes
  }

  async stop() {
    logger.info('🛑 Shutting down Location Service...');
    
    // Close WebSocket connections
    this.io.close();
    
    // Close HTTP server
    this.server.close(() => {
      logger.info('✅ Location Service shut down successfully');
    });
  }
}

// Create and start the application
const app = new LocationServiceApp();

// Start the service
if (require.main === module) {
  app.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = app;