module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      validate: {
        isUUID: 4
      }
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'template_id',
      validate: {
        isUUID: 4
      }
    },
    notificationType: {
      type: DataTypes.ENUM('push', 'email', 'sms', 'in_app'),
      allowNull: false,
      field: 'notification_type'
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    pushData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'push_data'
    },
    emailData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'email_data'
    },
    smsData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'sms_data'
    },
    inAppData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'in_app_data'
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed', 'bounced'),
      allowNull: false,
      defaultValue: 'sent'
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'normal'
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'sent_at'
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'delivered_at'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at'
    },
    clickedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'clicked_at'
    },
    externalId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'external_id'
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'failure_reason'
    },
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'delivery_id'
    },
    tripId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'trip_id'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'notifications',
    timestamps: false, // We handle timestamps manually
    underscored: true,
    indexes: [
      {
        fields: ['user_id', 'status', 'sent_at']
      },
      {
        fields: ['notification_type', 'category']
      },
      {
        fields: ['external_id']
      },
      {
        fields: ['delivery_id', 'trip_id']
      },
      {
        fields: ['sent_at']
      },
      {
        fields: ['user_id', 'read_at', 'clicked_at']
      },
      {
        fields: ['template_id']
      },
      {
        fields: ['status']
      }
    ]
  });

  // Instance methods
  Notification.prototype.markAsDelivered = function(deliveredAt = new Date(), externalId = null) {
    this.status = 'delivered';
    this.deliveredAt = deliveredAt;
    if (externalId) {
      this.externalId = externalId;
    }
    return this.save();
  };

  Notification.prototype.markAsRead = function(readAt = new Date()) {
    this.status = 'read';
    this.readAt = readAt;
    return this.save();
  };

  Notification.prototype.markAsClicked = function(clickedAt = new Date()) {
    this.clickedAt = clickedAt;
    return this.save();
  };

  Notification.prototype.markAsFailed = function(failureReason, failedAt = new Date()) {
    this.status = 'failed';
    this.failureReason = failureReason;
    this.deliveredAt = failedAt;
    return this.save();
  };

  Notification.prototype.isRead = function() {
    return this.status === 'read' || this.readAt !== null;
  };

  Notification.prototype.isClicked = function() {
    return this.clickedAt !== null;
  };

  Notification.prototype.getChannelData = function() {
    switch (this.notificationType) {
      case 'push':
        return this.pushData;
      case 'email':
        return this.emailData;
      case 'sms':
        return this.smsData;
      case 'in_app':
        return this.inAppData;
      default:
        return null;
    }
  };

  Notification.prototype.getDeliveryTime = function() {
    if (this.deliveredAt && this.sentAt) {
      return this.deliveredAt.getTime() - this.sentAt.getTime();
    }
    return null;
  };

  // Class methods
  Notification.findByUser = function(userId, options = {}) {
    const {
      type,
      category,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      includeRead = true
    } = options;

    const where = { userId };

    if (type) where.notificationType = type;
    if (category) where.category = category;
    if (status) where.status = status;
    if (!includeRead) where.readAt = null;

    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt[sequelize.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) where.sentAt[sequelize.Sequelize.Op.lte] = new Date(endDate);
    }

    return this.findAndCountAll({
      where,
      order: [['sent_at', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: sequelize.models.NotificationTemplate,
          as: 'template',
          attributes: ['name', 'category']
        }
      ]
    });
  };

  Notification.getUnreadCount = function(userId, category = null) {
    const where = {
      userId,
      readAt: null
    };

    if (category) {
      where.category = category;
    }

    return this.count({ where });
  };

  Notification.markAllAsRead = function(userId, category = null, type = null) {
    const where = {
      userId,
      readAt: null
    };

    if (category) where.category = category;
    if (type) where.notificationType = type;

    return this.update(
      {
        status: 'read',
        readAt: new Date()
      },
      { where }
    );
  };

  Notification.getEngagementStats = function(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.findAll({
      where: {
        userId,
        sentAt: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      attributes: [
        'notification_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('delivered_at')), 'delivered'],
        [sequelize.fn('COUNT', sequelize.col('read_at')), 'read'],
        [sequelize.fn('COUNT', sequelize.col('clicked_at')), 'clicked']
      ],
      group: ['notification_type'],
      raw: true
    });
  };

  Notification.getDeliveryAnalytics = function(options = {}) {
    const {
      startDate,
      endDate,
      type,
      category,
      groupBy = 'day'
    } = options;

    const where = {};
    
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt[sequelize.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) where.sentAt[sequelize.Sequelize.Op.lte] = new Date(endDate);
    }
    
    if (type) where.notificationType = type;
    if (category) where.category = category;

    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00:00';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    return this.findAll({
      where,
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('sent_at'), dateFormat), 'period'],
        'notification_type',
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['period', 'notification_type', 'status'],
      order: [['period', 'ASC']],
      raw: true
    });
  };

  // Associations
  Notification.associate = (models) => {
    Notification.belongsTo(models.NotificationTemplate, {
      foreignKey: 'templateId',
      as: 'template'
    });

    Notification.hasMany(models.NotificationAnalytics, {
      foreignKey: 'notificationId',
      as: 'analytics'
    });
  };

  return Notification;
};