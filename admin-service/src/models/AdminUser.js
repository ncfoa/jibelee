module.exports = (sequelize, DataTypes) => {
  const AdminUser = sequelize.define('AdminUser', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      comment: 'Reference to user in auth service'
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'admin', 'moderator', 'support', 'finance', 'analyst'),
      allowNull: false,
      defaultValue: 'support'
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      comment: 'Additional permissions beyond role-based permissions'
    },
    access_level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 1, max: 10 }
    },
    regions_managed: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    categories_managed: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_super_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    can_approve_overrides: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    can_access_financials: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    can_manage_users: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    can_view_analytics: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    can_export_data: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    emergency_contact: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    backup_contact: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    security_clearance: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    account_locked_until: {
      type: DataTypes.DATE,
      allowNull: true
    },
    password_expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    two_factor_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    ip_whitelist: {
      type: DataTypes.ARRAY(DataTypes.INET),
      defaultValue: []
    },
    session_timeout_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 60
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin who created this admin user'
    },
    deactivated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deactivated_by: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'admin_users',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['role']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  AdminUser.associate = (models) => {
    // Association with AdminActivityLog
    AdminUser.hasMany(models.AdminActivityLog, {
      foreignKey: 'admin_id',
      as: 'activities'
    });

    // Association with SystemConfiguration (created_by)
    AdminUser.hasMany(models.SystemConfiguration, {
      foreignKey: 'updated_by',
      as: 'configurations'
    });

    // Association with Dispute (assignee)
    AdminUser.hasMany(models.Dispute, {
      foreignKey: 'assignee_id',
      as: 'assignedDisputes'
    });

    // Association with SystemBackup (created_by)
    AdminUser.hasMany(models.SystemBackup, {
      foreignKey: 'created_by',
      as: 'backups'
    });

    // Association with DataExport (requested_by)
    AdminUser.hasMany(models.DataExport, {
      foreignKey: 'requested_by',
      as: 'exports'
    });

    // Self-referencing association for created_by
    AdminUser.belongsTo(AdminUser, {
      foreignKey: 'created_by',
      as: 'creator'
    });
  };

  // Instance methods
  AdminUser.prototype.hasPermission = function(permission) {
    // Super admin has all permissions
    if (this.role === 'super_admin') {
      return true;
    }

    // Check if permission is in the permissions array
    return this.permissions && this.permissions.includes(permission);
  };

  AdminUser.prototype.addPermission = function(permission) {
    if (!this.permissions) {
      this.permissions = [];
    }
    
    if (!this.permissions.includes(permission)) {
      this.permissions.push(permission);
    }
    
    return this.save();
  };

  AdminUser.prototype.removePermission = function(permission) {
    if (!this.permissions) {
      return this;
    }
    
    this.permissions = this.permissions.filter(p => p !== permission);
    return this.save();
  };

  AdminUser.prototype.getEffectivePermissions = function() {
    const { getRolePermissions } = require('../middleware/permissionMiddleware');
    const rolePermissions = getRolePermissions(this.role);
    
    if (rolePermissions.includes('*')) {
      const { PERMISSIONS } = require('../middleware/permissionMiddleware');
      return Object.keys(PERMISSIONS);
    }

    // Combine role permissions with individual permissions
    return [...new Set([...rolePermissions, ...(this.permissions || [])])];
  };

  // Class methods
  AdminUser.findByUserId = function(userId) {
    return this.findOne({
      where: { user_id: userId },
      include: ['activities']
    });
  };

  AdminUser.findActiveAdmins = function() {
    return this.findAll({
      where: { is_active: true },
      order: [['created_at', 'DESC']]
    });
  };

  AdminUser.findByRole = function(role) {
    return this.findAll({
      where: { role, is_active: true },
      order: [['created_at', 'DESC']]
    });
  };

  return AdminUser;
};