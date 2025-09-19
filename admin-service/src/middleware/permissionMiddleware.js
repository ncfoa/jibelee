const logger = require('../config/logger');

// Define permission hierarchy and roles
const PERMISSIONS = {
  // User management permissions
  'users.read': 'Read user information',
  'users.write': 'Create and update users',
  'users.suspend': 'Suspend/unsuspend users',
  'users.ban': 'Ban/unban users',
  'users.verify': 'Verify user identity',
  'users.delete': 'Delete user accounts',

  // Financial permissions
  'finance.read': 'View financial data',
  'finance.write': 'Modify financial records',
  'finance.payouts': 'Process payouts',
  'finance.refunds': 'Process refunds',
  'finance.reports': 'Generate financial reports',

  // Delivery management permissions
  'deliveries.read': 'View delivery information',
  'deliveries.write': 'Modify delivery records',
  'deliveries.cancel': 'Cancel deliveries',
  'deliveries.assign': 'Assign deliveries',

  // Dispute management permissions
  'disputes.read': 'View disputes',
  'disputes.write': 'Update dispute information',
  'disputes.assign': 'Assign disputes to admins',
  'disputes.resolve': 'Resolve disputes',

  // System management permissions
  'system.read': 'View system information',
  'system.write': 'Modify system settings',
  'system.config': 'Update system configuration',
  'system.backup': 'Manage system backups',
  'system.logs': 'Access system logs',

  // Analytics permissions
  'analytics.read': 'View analytics data',
  'analytics.export': 'Export analytics data',
  'reports.generate': 'Generate reports',
  'reports.schedule': 'Schedule automated reports',

  // Content moderation permissions
  'content.moderate': 'Moderate user content',
  'content.approve': 'Approve content',
  'content.reject': 'Reject content',

  // Admin management permissions
  'admins.read': 'View admin users',
  'admins.write': 'Create and update admin users',
  'admins.delete': 'Delete admin users',
  'admins.permissions': 'Manage admin permissions'
};

// Role-based permission sets
const ROLE_PERMISSIONS = {
  super_admin: ['*'], // All permissions
  
  admin: [
    'users.read', 'users.write', 'users.suspend', 'users.verify',
    'finance.read', 'finance.write', 'finance.payouts', 'finance.refunds', 'finance.reports',
    'deliveries.read', 'deliveries.write', 'deliveries.cancel', 'deliveries.assign',
    'disputes.read', 'disputes.write', 'disputes.assign', 'disputes.resolve',
    'system.read', 'system.write', 'system.config', 'system.backup',
    'analytics.read', 'analytics.export', 'reports.generate',
    'content.moderate', 'content.approve', 'content.reject'
  ],
  
  moderator: [
    'users.read', 'users.suspend',
    'deliveries.read',
    'disputes.read', 'disputes.write', 'disputes.assign',
    'content.moderate', 'content.approve', 'content.reject',
    'analytics.read'
  ],
  
  support: [
    'users.read',
    'deliveries.read',
    'disputes.read', 'disputes.write',
    'analytics.read'
  ],
  
  finance: [
    'users.read',
    'finance.read', 'finance.write', 'finance.payouts', 'finance.refunds', 'finance.reports',
    'deliveries.read',
    'disputes.read',
    'analytics.read', 'reports.generate'
  ],
  
  analyst: [
    'users.read',
    'finance.read',
    'deliveries.read',
    'disputes.read',
    'analytics.read', 'analytics.export', 'reports.generate', 'reports.schedule'
  ]
};

/**
 * Check if user has a specific permission
 */
const hasPermission = (userRole, userPermissions = [], requiredPermission) => {
  // Super admin has all permissions
  if (userRole === 'super_admin') {
    return true;
  }

  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  if (rolePermissions.includes(requiredPermission) || rolePermissions.includes('*')) {
    return true;
  }

  // Check individual permissions
  if (userPermissions.includes(requiredPermission) || userPermissions.includes('*')) {
    return true;
  }

  return false;
};

/**
 * Check if user has any of the specified permissions
 */
const hasAnyPermission = (userRole, userPermissions = [], requiredPermissions = []) => {
  return requiredPermissions.some(permission => 
    hasPermission(userRole, userPermissions, permission)
  );
};

/**
 * Check if user has all of the specified permissions
 */
const hasAllPermissions = (userRole, userPermissions = [], requiredPermissions = []) => {
  return requiredPermissions.every(permission => 
    hasPermission(userRole, userPermissions, permission)
  );
};

/**
 * Get all permissions for a role
 */
const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Get effective permissions for a user (role + individual permissions)
 */
const getEffectivePermissions = (userRole, userPermissions = []) => {
  const rolePermissions = getRolePermissions(userRole);
  
  if (rolePermissions.includes('*')) {
    return Object.keys(PERMISSIONS);
  }

  // Combine role permissions with individual permissions
  const allPermissions = [...new Set([...rolePermissions, ...userPermissions])];
  
  if (allPermissions.includes('*')) {
    return Object.keys(PERMISSIONS);
  }

  return allPermissions;
};

/**
 * Middleware factory to require specific permission
 */
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    const { role, permissions = [] } = req.adminUser;

    if (!hasPermission(role, permissions, requiredPermission)) {
      logger.securityEvent('permission_denied', {
        adminId: req.adminUser.id,
        role,
        requiredPermission,
        userPermissions: permissions,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermission
      });
    }

    // Log permission granted
    logger.debug('Permission granted', {
      adminId: req.adminUser.id,
      role,
      permission: requiredPermission,
      path: req.path
    });

    next();
  };
};

/**
 * Middleware factory to require any of the specified permissions
 */
const requireAnyPermission = (requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    const { role, permissions = [] } = req.adminUser;

    if (!hasAnyPermission(role, permissions, requiredPermissions)) {
      logger.securityEvent('permission_denied', {
        adminId: req.adminUser.id,
        role,
        requiredPermissions,
        userPermissions: permissions,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermissions
      });
    }

    next();
  };
};

/**
 * Middleware factory to require all of the specified permissions
 */
const requireAllPermissions = (requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    const { role, permissions = [] } = req.adminUser;

    if (!hasAllPermissions(role, permissions, requiredPermissions)) {
      logger.securityEvent('permission_denied', {
        adminId: req.adminUser.id,
        role,
        requiredPermissions,
        userPermissions: permissions,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermissions
      });
    }

    next();
  };
};

/**
 * Middleware to require super admin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.adminUser) {
    return res.status(401).json({
      success: false,
      error: 'Admin authentication required',
      code: 'ADMIN_AUTH_REQUIRED'
    });
  }

  if (req.adminUser.role !== 'super_admin') {
    logger.securityEvent('super_admin_required', {
      adminId: req.adminUser.id,
      role: req.adminUser.role,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    return res.status(403).json({
      success: false,
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware to check if user can access resource owned by another user
 */
const requireResourceAccess = (resourceOwnerField = 'userId') => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    const { role, permissions = [] } = req.adminUser;
    const resourceOwnerId = req.params[resourceOwnerField] || req.body[resourceOwnerField];

    // Super admin can access any resource
    if (role === 'super_admin') {
      return next();
    }

    // Check if admin has global access permissions
    if (hasPermission(role, permissions, 'users.read') || 
        hasPermission(role, permissions, 'system.read')) {
      return next();
    }

    // Admin can only access their own resources
    if (req.adminUser.userId === resourceOwnerId) {
      return next();
    }

    logger.securityEvent('resource_access_denied', {
      adminId: req.adminUser.id,
      role,
      resourceOwnerId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    return res.status(403).json({
      success: false,
      error: 'Access denied to this resource',
      code: 'RESOURCE_ACCESS_DENIED'
    });
  };
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  getEffectivePermissions,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireSuperAdmin,
  requireResourceAccess
};