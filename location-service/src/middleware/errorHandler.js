const logger = require('../utils/logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, 'DATABASE_ERROR', originalError?.message);
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message, statusCode = 503) {
    super(`${service} service error: ${message}`, statusCode, 'EXTERNAL_SERVICE_ERROR');
  }
}

class TrackingNotActiveError extends AppError {
  constructor(message = 'Location tracking is not active for this delivery') {
    super(message, 400, 'TRACKING_NOT_ACTIVE');
  }
}

class GeofenceError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'GEOFENCE_ERROR', details);
  }
}

class LocationAccuracyError extends AppError {
  constructor(message = 'Location accuracy is insufficient') {
    super(message, 400, 'LOCATION_ACCURACY_ERROR');
  }
}

class RouteOptimizationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'ROUTE_OPTIMIZATION_ERROR', details);
  }
}

class EmergencyServiceError extends AppError {
  constructor(message, details = null) {
    super(message, 500, 'EMERGENCY_SERVICE_ERROR', details);
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    error: error.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Mongoose/Database errors
  if (err.name === 'ValidationError') {
    const message = 'Database validation error';
    const details = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
    error = new ValidationError(message, details);
  }

  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = new ValidationError(message);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for field: ${field}`;
    error = new ConflictError(message);
  }

  // PostgreSQL/Knex errors
  if (err.code === '23505') {
    const message = 'Duplicate entry found';
    error = new ConflictError(message);
  }

  if (err.code === '23503') {
    const message = 'Referenced record not found';
    error = new ValidationError(message);
  }

  if (err.code === '23502') {
    const message = 'Required field is missing';
    error = new ValidationError(message);
  }

  if (err.code === '22P02') {
    const message = 'Invalid input format';
    error = new ValidationError(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid authentication token';
    error = new UnauthorizedError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Authentication token has expired';
    error = new UnauthorizedError(message);
  }

  // Axios/HTTP errors
  if (err.response) {
    const service = err.config?.baseURL || 'External service';
    const message = err.response.data?.message || err.message;
    error = new ExternalServiceError(service, message, err.response.status);
  }

  // Network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    const message = 'External service unavailable';
    error = new ExternalServiceError('External service', message);
  }

  // Rate limiting errors
  if (err.type === 'entity.too.large') {
    const message = 'Request payload too large';
    error = new ValidationError(message);
  }

  // Default to 500 server error
  if (!error.isOperational) {
    error = new AppError('Something went wrong', 500, 'INTERNAL_SERVER_ERROR');
  }

  // Send error response
  const response = {
    success: false,
    error: error.message,
    code: error.code || 'UNKNOWN_ERROR'
  };

  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    response.details = error.details;
    response.stack = error.stack;
  }

  // Add details for validation errors
  if (error.details && (error.code === 'VALIDATION_ERROR' || error.statusCode === 400)) {
    response.details = error.details;
  }

  res.status(error.statusCode || 500).json(response);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Unhandled promise rejection handler
const unhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise
    });
    
    // Close server gracefully
    process.exit(1);
  });
};

// Uncaught exception handler
const uncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      error: error.message,
      stack: error.stack
    });
    
    // Close server gracefully
    process.exit(1);
  });
};

// Graceful shutdown handler
const gracefulShutdownHandler = (server) => {
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Error response helper
const sendErrorResponse = (res, error, statusCode = 500) => {
  const response = {
    success: false,
    error: error.message || 'An error occurred',
    code: error.code || 'UNKNOWN_ERROR'
  };

  if (error.details) {
    response.details = error.details;
  }

  res.status(statusCode).json(response);
};

// Success response helper
const sendSuccessResponse = (res, data, message = null, statusCode = 200) => {
  const response = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  TrackingNotActiveError,
  GeofenceError,
  LocationAccuracyError,
  RouteOptimizationError,
  EmergencyServiceError,
  
  // Middleware and handlers
  errorHandler,
  asyncHandler,
  notFoundHandler,
  unhandledRejectionHandler,
  uncaughtExceptionHandler,
  gracefulShutdownHandler,
  
  // Helper functions
  sendErrorResponse,
  sendSuccessResponse
};