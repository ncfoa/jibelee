const jwtService = require('../services/jwtService');
const sessionService = require('../services/sessionService');
const { User } = require('../models');
const { logger, logSecurityEvent } = require('../config/logger');

class AuthMiddleware {
  // Verify JWT token and attach user to request
  async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required',
          errors: ['No authorization token provided']
        });
      }

      // Check if token is blacklisted
      const isBlacklisted = await jwtService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        logSecurityEvent('blacklisted_token_used', 'medium', { token: token.substring(0, 20) + '...' }, req);
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked',
          errors: ['Invalid or expired token']
        });
      }

      // Verify token
      const decoded = jwtService.verifyAccessToken(token);
      
      // Get user from database
      const user = await User.findByPk(decoded.sub);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          errors: ['Invalid token']
        });
      }

      // Check if user is active
      if (!user.canLogin()) {
        logSecurityEvent('inactive_user_access_attempt', 'high', { 
          userId: user.id, 
          status: user.status,
          verified: user.isEmailVerified()
        }, req);
        
        return res.status(401).json({
          success: false,
          message: 'Account is not active or verified',
          errors: ['Please verify your email or contact support']
        });
      }

      // Attach user and token info to request
      req.user = user;
      req.token = decoded;
      req.tokenString = token;

      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      
      if (error.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          errors: ['Please login again'],
          code: 'TOKEN_EXPIRED'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        errors: ['Authentication failed']
      });
    }
  }

  // Optional authentication - don't fail if no token
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (token) {
        const decoded = jwtService.verifyAccessToken(token);
        const user = await User.findByPk(decoded.sub);
        
        if (user && user.canLogin()) {
          req.user = user;
          req.token = decoded;
          req.tokenString = token;
        }
      }
      
      next();
    } catch (error) {
      // Ignore errors in optional auth
      next();
    }
  }

  // Check if user has required permissions
  requirePermissions(permissions = []) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: ['Please login to access this resource']
        });
      }

      const userPermissions = req.token?.permissions || [];
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission) || userPermissions.includes('*')
      );

      if (!hasAllPermissions) {
        logSecurityEvent('insufficient_permissions', 'medium', {
          userId: req.user.id,
          required: permissions,
          available: userPermissions
        }, req);

        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          errors: ['You do not have permission to access this resource']
        });
      }

      next();
    };
  }

  // Check if user has required role
  requireRole(roles = []) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: ['Please login to access this resource']
        });
      }

      const userRole = req.user.userType;
      const hasRequiredRole = roles.includes(userRole) || roles.includes('*');

      if (!hasRequiredRole) {
        logSecurityEvent('insufficient_role', 'medium', {
          userId: req.user.id,
          required: roles,
          current: userRole
        }, req);

        return res.status(403).json({
          success: false,
          message: 'Insufficient privileges',
          errors: ['Your account type does not have access to this resource']
        });
      }

      next();
    };
  }

  // Check if user is admin
  requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!['admin', 'super_admin'].includes(req.user.userType)) {
      logSecurityEvent('admin_access_denied', 'high', {
        userId: req.user.id,
        userType: req.user.userType
      }, req);

      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  }

  // Check if email is verified
  requireEmailVerification(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.isEmailVerified()) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required',
        errors: ['Please verify your email address to access this resource'],
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    next();
  }

  // Check if user owns the resource
  requireOwnership(resourceIdParam = 'id', userIdField = 'userId') {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;

      // If user is admin, allow access
      if (['admin', 'super_admin'].includes(req.user.userType)) {
        return next();
      }

      // Check ownership based on URL parameter
      if (resourceId === userId) {
        return next();
      }

      // If we have a resource to check, we'd typically query it here
      // For now, just check if the resource ID matches user ID
      logSecurityEvent('unauthorized_resource_access', 'medium', {
        userId,
        resourceId,
        resourceType: req.route?.path || 'unknown'
      }, req);

      return res.status(403).json({
        success: false,
        message: 'Access denied',
        errors: ['You can only access your own resources']
      });
    };
  }

  // Validate session for sensitive operations
  async requireValidSession(req, res, next) {
    try {
      if (!req.user || !req.token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const deviceId = req.token.deviceId;
      if (!deviceId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid session',
          errors: ['Session validation failed']
        });
      }

      // Check if session is still valid
      const sessions = await sessionService.getUserSessions(req.user.id);
      const currentSession = sessions.find(s => s.deviceId === deviceId);

      if (!currentSession) {
        logSecurityEvent('invalid_session_access', 'high', {
          userId: req.user.id,
          deviceId
        }, req);

        return res.status(401).json({
          success: false,
          message: 'Session expired',
          errors: ['Please login again'],
          code: 'SESSION_INVALID'
        });
      }

      next();
    } catch (error) {
      logger.error('Session validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Session validation failed'
      });
    }
  }

  // Rate limiting for sensitive auth operations
  createAuthRateLimit(windowMs = 15 * 60 * 1000, max = 5) {
    const attempts = new Map();

    return (req, res, next) => {
      const key = req.ip + ':' + (req.user?.id || 'anonymous');
      const now = Date.now();
      
      // Clean old entries
      for (const [attemptKey, data] of attempts.entries()) {
        if (now - data.firstAttempt > windowMs) {
          attempts.delete(attemptKey);
        }
      }

      const userAttempts = attempts.get(key) || { count: 0, firstAttempt: now };
      
      if (userAttempts.count >= max) {
        logSecurityEvent('rate_limit_exceeded', 'high', {
          ip: req.ip,
          userId: req.user?.id,
          attempts: userAttempts.count,
          endpoint: req.originalUrl
        }, req);

        return res.status(429).json({
          success: false,
          message: 'Too many attempts',
          errors: [`Please wait ${Math.ceil(windowMs / 60000)} minutes before trying again`],
          retryAfter: Math.ceil((userAttempts.firstAttempt + windowMs - now) / 1000)
        });
      }

      userAttempts.count += 1;
      attempts.set(key, userAttempts);
      
      next();
    };
  }

  // Device fingerprint validation
  validateDeviceFingerprint(req, res, next) {
    if (!req.token?.deviceId) {
      return next();
    }

    const currentFingerprint = sessionService.generateDeviceFingerprint(req);
    const tokenFingerprint = req.token.deviceId;

    // This is a simplified check - in production you might want more sophisticated validation
    if (currentFingerprint !== tokenFingerprint) {
      logSecurityEvent('device_fingerprint_mismatch', 'medium', {
        userId: req.user?.id,
        expected: tokenFingerprint,
        actual: currentFingerprint
      }, req);

      // For now, just log the mismatch - you might want to require re-authentication
    }

    next();
  }
}

module.exports = new AuthMiddleware();