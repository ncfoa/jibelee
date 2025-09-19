const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

// Authentication middleware
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedError('No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // Add user info to request
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
      ...decoded
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token has expired'));
    } else {
      next(error);
    }
  }
};

// Optional authentication middleware (doesn't throw if no token)
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
      ...decoded
    };

    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

// Role-based authorization middleware
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return next(new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
};

// Permission-based authorization middleware
const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userPermissions = req.user.permissions || [];
    
    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return next(new ForbiddenError(`Access denied. Required permissions: ${requiredPermissions.join(', ')}`));
    }

    next();
  };
};

// Delivery access validation middleware
const validateDeliveryAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const { deliveryId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admin users have access to all deliveries
    if (userRole === 'admin' || userRole === 'support') {
      return next();
    }

    // For regular users, we need to check if they're involved in the delivery
    // This would typically involve checking the delivery record
    // For now, we'll implement a basic check

    // In a real implementation, you would:
    // 1. Query the delivery record from the database
    // 2. Check if the user is either the customer or traveler
    // 3. Check if the delivery is in an appropriate state

    // Mock validation - replace with actual database check
    if (!deliveryId) {
      return next(new ForbiddenError('Delivery ID is required'));
    }

    // TODO: Implement actual delivery access check
    // const delivery = await DeliveryService.findById(deliveryId);
    // if (!delivery) {
    //   return next(new NotFoundError('Delivery not found'));
    // }
    // 
    // if (delivery.customerId !== userId && delivery.travelerId !== userId) {
    //   return next(new ForbiddenError('Access denied to this delivery'));
    // }

    next();
  } catch (error) {
    next(error);
  }
};

// Tracking permissions validation
const validateTrackingPermissions = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const { deliveryId } = req.params || req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admin users can track all deliveries
    if (userRole === 'admin' || userRole === 'support') {
      return next();
    }

    // Emergency services can access tracking for emergencies
    if (userRole === 'emergency' && req.originalUrl.includes('/emergency')) {
      return next();
    }

    // For tracking operations, we need to ensure the user is authorized
    // This includes checking privacy settings and user relationships

    // TODO: Implement actual tracking permission check
    // const trackingSession = await TrackingSession.findByDeliveryId(deliveryId);
    // if (!trackingSession) {
    //   return next(new NotFoundError('Tracking session not found'));
    // }
    // 
    // const privacySettings = trackingSession.privacySettings || {};
    // 
    // // Check if user can view this tracking data based on privacy settings
    // if (privacySettings.shareWithCustomers === false && userRole === 'customer') {
    //   return next(new ForbiddenError('Tracking data sharing is disabled'));
    // }

    next();
  } catch (error) {
    next(error);
  }
};

// Emergency access validation
const validateEmergencyAccess = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const userRole = req.user.role;
  const allowedRoles = ['admin', 'support', 'emergency', 'traveler', 'customer'];

  if (!allowedRoles.includes(userRole)) {
    return next(new ForbiddenError('Access denied to emergency services'));
  }

  next();
};

// Admin access validation
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
};

// Rate limiting by user
const createUserRateLimit = (windowMs, max) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (userRequests.has(userId)) {
      const userRequestList = userRequests.get(userId);
      const validRequests = userRequestList.filter(time => time > windowStart);
      userRequests.set(userId, validRequests);
    }

    // Check rate limit
    const currentRequests = userRequests.get(userId) || [];
    
    if (currentRequests.length >= max) {
      return next(new RateLimitError('User rate limit exceeded'));
    }

    // Add current request
    currentRequests.push(now);
    userRequests.set(userId, currentRequests);

    next();
  };
};

// Service-to-service authentication
const authenticateService = (req, res, next) => {
  try {
    const serviceKey = req.headers['x-service-key'];
    const expectedKey = process.env.SERVICE_KEY;

    if (!serviceKey) {
      throw new UnauthorizedError('Service key required');
    }

    if (serviceKey !== expectedKey) {
      throw new UnauthorizedError('Invalid service key');
    }

    // Add service info to request
    req.service = {
      name: req.headers['x-service-name'] || 'unknown',
      version: req.headers['x-service-version'] || '1.0.0'
    };

    next();
  } catch (error) {
    next(error);
  }
};

// API key authentication (for external integrations)
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedError('API key required');
    }

    // TODO: Validate API key against database
    // const keyRecord = await ApiKey.findByKey(apiKey);
    // if (!keyRecord || !keyRecord.isActive) {
    //   throw new UnauthorizedError('Invalid or inactive API key');
    // }

    // Mock validation
    if (apiKey !== process.env.API_KEY) {
      throw new UnauthorizedError('Invalid API key');
    }

    req.apiKey = {
      key: apiKey,
      permissions: ['read', 'write'], // Would come from database
      rateLimit: 1000 // Requests per hour
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requirePermission,
  validateDeliveryAccess,
  validateTrackingPermissions,
  validateEmergencyAccess,
  requireAdmin,
  createUserRateLimit,
  authenticateService,
  authenticateApiKey
};