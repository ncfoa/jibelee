module.exports = (sequelize, DataTypes) => {
  const NotificationTemplate = sequelize.define('NotificationTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM(
        'delivery_update',
        'new_request',
        'payment',
        'system',
        'promotional',
        'security'
      ),
      allowNull: false
    },
    pushTemplate: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'push_template'
    },
    emailTemplate: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'email_template'
    },
    smsTemplate: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'sms_template'
    },
    inAppTemplate: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'in_app_template'
    },
    variables: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    targeting: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'draft'),
      allowNull: false,
      defaultValue: 'active'
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'notification_templates',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['category', 'status']
      },
      {
        fields: ['name']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ],
    hooks: {
      beforeUpdate: (template) => {
        template.updatedAt = new Date();
      }
    }
  });

  // Instance methods
  NotificationTemplate.prototype.getTemplateForChannel = function(channel) {
    switch (channel) {
      case 'push':
        return this.pushTemplate;
      case 'email':
        return this.emailTemplate;
      case 'sms':
        return this.smsTemplate;
      case 'in_app':
        return this.inAppTemplate;
      default:
        return null;
    }
  };

  NotificationTemplate.prototype.hasChannel = function(channel) {
    const template = this.getTemplateForChannel(channel);
    return template && Object.keys(template).length > 0;
  };

  NotificationTemplate.prototype.validateVariables = function(providedVariables) {
    const requiredVariables = this.variables.filter(v => v.required);
    const missingVariables = requiredVariables.filter(v => !(v.name in providedVariables));
    
    if (missingVariables.length > 0) {
      throw new Error(`Missing required variables: ${missingVariables.map(v => v.name).join(', ')}`);
    }
    
    return true;
  };

  NotificationTemplate.prototype.incrementVersion = function() {
    this.version += 1;
    return this.save();
  };

  // Class methods
  NotificationTemplate.findActiveByCategory = function(category) {
    return this.findAll({
      where: {
        category,
        status: 'active'
      },
      order: [['created_at', 'DESC']]
    });
  };

  NotificationTemplate.findByNameAndStatus = function(name, status = 'active') {
    return this.findOne({
      where: {
        name,
        status
      }
    });
  };

  NotificationTemplate.getAvailableChannels = function(templateId) {
    return this.findByPk(templateId).then(template => {
      if (!template) return [];
      
      const channels = [];
      if (template.pushTemplate) channels.push('push');
      if (template.emailTemplate) channels.push('email');
      if (template.smsTemplate) channels.push('sms');
      if (template.inAppTemplate) channels.push('in_app');
      
      return channels;
    });
  };

  // Associations
  NotificationTemplate.associate = (models) => {
    NotificationTemplate.hasMany(models.Notification, {
      foreignKey: 'templateId',
      as: 'notifications'
    });

    NotificationTemplate.hasMany(models.BulkNotification, {
      foreignKey: 'templateId',
      as: 'bulkNotifications'
    });

    NotificationTemplate.hasMany(models.EmailTemplate, {
      foreignKey: 'templateId',
      as: 'emailTemplates'
    });
  };

  return NotificationTemplate;
};