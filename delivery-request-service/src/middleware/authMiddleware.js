const jwt = require('jsonwebtoken');
const axios = require('axios');
const { cache } = require('../config/redis');

class AuthMiddleware {
  // Verify JWT token
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      const token = authHeader.substring(7);
      
      // Check if token is blacklisted
      const isBlacklisted = await cache.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user info is cached
      let user = await cache.get(`user:${decoded.userId}`);
      
      if (!user) {
        // Fetch user info from auth/user service
        try {
          const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
          const userResponse = await axios.get(`${authServiceUrl}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000
          });
          
          user = userResponse.data.data;
          
          // Cache user info for 5 minutes
          await cache.set(`user:${decoded.userId}`, user, 300);
        } catch (error) {
          console.error('Failed to fetch user info:', error.message);
          
          // Fallback to token data
          user = {
            id: decoded.userId,
            email: decoded.email,
            firstName: decoded.firstName || 'User',
            lastName: decoded.lastName || '',
            role: decoded.role || 'customer'
          };
        }
      }
      
      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }

  // Optional authentication (for public endpoints that benefit from user context)
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      // Use verifyToken but don't fail if token is invalid
      await this.verifyToken(req, res, next);
    } catch (error) {
      // Continue without authentication
      next();
    }
  }

  // Require specific role
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      
      const hasRole = requiredRoles.some(role => userRoles.includes(role));
      
      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  // Require customer role
  requireCustomer(req, res, next) {
    return this.requireRole(['customer', 'admin'])(req, res, next);
  }

  // Require traveler role
  requireTraveler(req, res, next) {
    return this.requireRole(['traveler', 'admin'])(req, res, next);
  }

  // Require admin role
  requireAdmin(req, res, next) {
    return this.requireRole('admin')(req, res, next);
  }

  // Check if user can access resource
  async checkResourceAccess(req, res, next) {
    try {
      const { requestId, offerId, deliveryId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admin can access everything
      if (userRole === 'admin') {
        return next();
      }

      // TODO: Implement resource access checks
      // For now, we'll handle this in individual controllers
      
      next();
    } catch (error) {
      console.error('Resource access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Access check failed'
      });
    }
  }
}

module.exports = new AuthMiddleware();