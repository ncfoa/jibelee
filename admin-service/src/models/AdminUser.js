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
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      comment: 'Additional permissions beyond role-based permissions'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin who created this admin user'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional admin-specific metadata'
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