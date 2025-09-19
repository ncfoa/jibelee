module.exports = (sequelize, DataTypes) => {
  const AdminActivityLog = sequelize.define('AdminActivityLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    admin_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to admin user who performed the action'
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Type of action performed'
    },
    resource_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of resource affected'
    },
    resource_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the affected resource'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Human-readable description of the action'
    },
    details: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional details about the action'
    },
    ip_address: {
      type: DataTypes.INET,
      allowNull: true,
      comment: 'IP address from which the action was performed'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent string'
    },
    session_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Session identifier'
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium',
      comment: 'Severity level of the action'
    },
    status: {
      type: DataTypes.ENUM('success', 'failure', 'partial'),
      defaultValue: 'success',
      comment: 'Status of the action'
    }
  }, {
    tableName: 'admin_activity_log',
    timestamps: true,
    underscored: true,
    updatedAt: false, // Activity logs are immutable
    indexes: [
      {
        fields: ['admin_id', 'created_at']
      },
      {
        fields: ['action', 'created_at']
      },
      {
        fields: ['resource_type', 'resource_id']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['severity']
      },
      {
        fields: ['status']
      },
      {
        fields: ['ip_address']
      }
    ]
  });

  AdminActivityLog.associate = (models) => {
    // Association with AdminUser
    AdminActivityLog.belongsTo(models.AdminUser, {
      foreignKey: 'admin_id',
      as: 'admin'
    });
  };

  // Class methods
  AdminActivityLog.logActivity = async function(adminId, action, resourceType, resourceId, details = {}) {
    try {
      const activity = await this.create({
        admin_id: adminId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        description: this.generateDescription(action, resourceType, details),
        details,
        ip_address: details.ip_address,
        user_agent: details.user_agent,
        session_id: details.session_id,
        severity: this.determineSeverity(action),
        status: details.status || 'success'
      });

      return activity;
    } catch (error) {
      console.error('Failed to log admin activity:', error);
      return null;
    }
  };

  AdminActivityLog.generateDescription = function(action, resourceType, details = {}) {
    const descriptions = {
      'user_status_update': `Updated user status from ${details.oldStatus} to ${details.newStatus}`,
      'user_verification': `Updated user verification level to ${details.verificationLevel}`,
      'user_suspend': `Suspended user for ${details.duration} days`,
      'user_ban': `Banned user account`,
      'user_unban': `Unbanned user account`,
      'manual_payout': `Processed manual payout of ${details.amount} ${details.currency}`,
      'dispute_assigned': `Assigned dispute to ${details.assigneeId}`,
      'dispute_resolved': `Resolved dispute with ${details.resolution}`,
      'system_config_update': `Updated system configuration: ${details.key}`,
      'backup_created': `Created ${details.type} backup`,
      'data_export': `Exported ${details.type} data in ${details.format} format`,
      'login': 'Admin user logged in',
      'logout': 'Admin user logged out',
      'password_change': 'Changed password',
      'permission_update': `Updated permissions for ${resourceType}`,
      'role_change': `Changed role from ${details.oldRole} to ${details.newRole}`
    };

    return descriptions[action] || `Performed ${action} on ${resourceType}`;
  };

  AdminActivityLog.determineSeverity = function(action) {
    const severityMap = {
      'user_ban': 'high',
      'user_delete': 'critical',
      'manual_payout': 'high',
      'system_config_update': 'medium',
      'backup_created': 'low',
      'data_export': 'medium',
      'dispute_resolved': 'medium',
      'permission_update': 'high',
      'role_change': 'high',
      'login': 'low',
      'logout': 'low'
    };

    return severityMap[action] || 'medium';
  };

  AdminActivityLog.getRecentActivities = function(adminId, limit = 50) {
    const whereClause = adminId ? { admin_id: adminId } : {};
    
    return this.findAll({
      where: whereClause,
      include: ['admin'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  AdminActivityLog.getActivitiesByDateRange = function(startDate, endDate, adminId = null) {
    const whereClause = {
      created_at: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate]
      }
    };

    if (adminId) {
      whereClause.admin_id = adminId;
    }

    return this.findAll({
      where: whereClause,
      include: ['admin'],
      order: [['created_at', 'DESC']]
    });
  };

  AdminActivityLog.getActivityStats = async function(startDate, endDate) {
    const activities = await this.findAll({
      where: {
        created_at: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: ['action', 'severity', 'status'],
      raw: true
    });

    const stats = {
      total: activities.length,
      byAction: {},
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byStatus: { success: 0, failure: 0, partial: 0 }
    };

    activities.forEach(activity => {
      // Count by action
      stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[activity.severity] = (stats.bySeverity[activity.severity] || 0) + 1;
      
      // Count by status
      stats.byStatus[activity.status] = (stats.byStatus[activity.status] || 0) + 1;
    });

    return stats;
  };

  AdminActivityLog.searchActivities = function(searchTerm, limit = 100) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { description: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { action: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { resource_type: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      include: ['admin'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  return AdminActivityLog;
};