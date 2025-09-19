const jwtService = require('../config/jwt');
const logger = require('../config/logger');
const redisService = require('../config/redis');
const { AdminUser } = require('../models');

/**
 * Middleware to authenticate admin users via Bearer token
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = jwtService.verifyAdminToken(token);
    
    // Check if token is blacklisted
    const blacklisted = await redisService.exists(`blacklist:admin:${token}`);
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Get admin user details
    const adminUser = await AdminUser.findByPk(decoded.adminId, {
      include: ['user']
    });

    if (!adminUser || !adminUser.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Admin account not found or inactive',
        code: 'ADMIN_INACTIVE'
      });
    }

    // Add admin info to request
    req.adminUser = {
      id: adminUser.id,
      userId: adminUser.user_id,
      role: adminUser.role,
      permissions: adminUser.permissions || [],
      user: adminUser.user
    };

    // Update last activity
    await adminUser.update({ last_login_at: new Date() });

    // Log admin activity
    logger.adminActivity(adminUser.id, 'api_access', req.path, {
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    logger.error('Admin authentication error:', error);
    
    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Admin token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid admin token',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Middleware to authenticate admin users via X-Admin-Token header
 */
const authenticateAdminApi = async (req, res, next) => {
  try {
    const adminToken = req.headers['x-admin-token'];
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'X-Admin-Token header required',
        code: 'ADMIN_TOKEN_REQUIRED'
      });
    }

    // Verify admin API token
    const decoded = jwtService.verifyAdminApiToken(adminToken);
    
    // Check if token is blacklisted
    const blacklisted = await redisService.exists(`blacklist:admin_api:${adminToken}`);
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        error: 'Admin token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Get admin user details
    const adminUser = await AdminUser.findByPk(decoded.adminId, {
      include: ['user']
    });

    if (!adminUser || !adminUser.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Admin account not found or inactive',
        code: 'ADMIN_INACTIVE'
      });
    }

    // Add admin info to request
    req.adminUser = {
      id: adminUser.id,
      userId: adminUser.user_id,
      role: adminUser.role,
      permissions: decoded.permissions || adminUser.permissions || [],
      user: adminUser.user
    };

    // Update last activity
    await adminUser.update({ last_login_at: new Date() });

    next();
  } catch (error) {
    logger.error('Admin API authentication error:', error);
    
    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Admin API token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid admin API token',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Middleware to authenticate both Bearer token and X-Admin-Token
 */
const authenticateAdminFlex = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminToken = req.headers['x-admin-token'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateAdmin(req, res, next);
  } else if (adminToken) {
    return authenticateAdminApi(req, res, next);
  } else {
    return res.status(401).json({
      success: false,
      error: 'Admin authentication required (Bearer token or X-Admin-Token)',
      code: 'ADMIN_AUTH_REQUIRED'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const adminToken = req.headers['x-admin-token'];

    if (!authHeader && !adminToken) {
      return next();
    }

    // Try to authenticate if token is provided
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateAdmin(req, res, next);
    } else if (adminToken) {
      return authenticateAdminApi(req, res, next);
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on errors
    logger.warn('Optional admin auth failed:', error);
    next();
  }
};

/**
 * Revoke admin token
 */
const revokeAdminToken = async (token, type = 'admin') => {
  try {
    const expiration = jwtService.getTimeUntilExpiration(token);
    if (expiration > 0) {
      const key = `blacklist:${type}:${token}`;
      await redisService.set(key, true, Math.ceil(expiration / 1000));
      logger.info(`Admin token revoked: ${type}`);
    }
  } catch (error) {
    logger.error('Error revoking admin token:', error);
  }
};

/**
 * Revoke all admin tokens for a user
 */
const revokeAllAdminTokens = async (adminId) => {
  try {
    // Add admin ID to revoked list
    await redisService.set(`revoked_admin:${adminId}`, true, 86400); // 24 hours
    logger.info(`All admin tokens revoked for admin: ${adminId}`);
  } catch (error) {
    logger.error('Error revoking all admin tokens:', error);
  }
};

module.exports = {
  authenticateAdmin,
  authenticateAdminApi,
  authenticateAdminFlex,
  optionalAdminAuth,
  revokeAdminToken,
  revokeAllAdminTokens
};