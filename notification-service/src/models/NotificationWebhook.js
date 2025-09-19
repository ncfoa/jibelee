module.exports = (sequelize, DataTypes) => {
  const NotificationWebhook = sequelize.define('NotificationWebhook', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        isUrl: true,
        len: [1, 500]
      }
    },
    events: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    secret: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [8, 255]
      }
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    filters: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
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
    },
    lastTriggeredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_triggered_at'
    },
    totalAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_attempts'
    },
    successfulAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'successful_attempts'
    },
    failedAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'failed_attempts'
    }
  }, {
    tableName: 'notification_webhooks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['active'],
        where: { active: true }
      },
      {
        fields: ['events'],
        using: 'gin'
      },
      {
        fields: ['url']
      },
      {
        fields: ['last_triggered_at']
      }
    ],
    hooks: {
      beforeUpdate: (webhook) => {
        webhook.updatedAt = new Date();
      }
    }
  });

  // Instance methods
  NotificationWebhook.prototype.activate = function() {
    this.active = true;
    return this.save();
  };

  NotificationWebhook.prototype.deactivate = function() {
    this.active = false;
    return this.save();
  };

  NotificationWebhook.prototype.supportsEvent = function(eventType) {
    return this.events.includes(eventType);
  };

  NotificationWebhook.prototype.matchesFilters = function(eventData) {
    if (!this.filters || Object.keys(this.filters).length === 0) {
      return true;
    }

    // Check category filters
    if (this.filters.categories && this.filters.categories.length > 0) {
      if (!this.filters.categories.includes(eventData.category)) {
        return false;
      }
    }

    // Check priority filters
    if (this.filters.priority && this.filters.priority.length > 0) {
      if (!this.filters.priority.includes(eventData.priority)) {
        return false;
      }
    }

    // Check channel filters
    if (this.filters.channels && this.filters.channels.length > 0) {
      if (!this.filters.channels.includes(eventData.channel)) {
        return false;
      }
    }

    // Check user ID filters
    if (this.filters.userIds && this.filters.userIds.length > 0) {
      if (!this.filters.userIds.includes(eventData.userId)) {
        return false;
      }
    }

    // Check template ID filters
    if (this.filters.templateIds && this.filters.templateIds.length > 0) {
      if (!this.filters.templateIds.includes(eventData.templateId)) {
        return false;
      }
    }

    // Check custom filters
    if (this.filters.custom) {
      for (const [key, value] of Object.entries(this.filters.custom)) {
        if (eventData[key] !== value) {
          return false;
        }
      }
    }

    return true;
  };

  NotificationWebhook.prototype.recordAttempt = function(success = true) {
    this.totalAttempts += 1;
    this.lastTriggeredAt = new Date();
    
    if (success) {
      this.successfulAttempts += 1;
    } else {
      this.failedAttempts += 1;
    }
    
    return this.save();
  };

  NotificationWebhook.prototype.getSuccessRate = function() {
    if (this.totalAttempts === 0) return 0;
    return (this.successfulAttempts / this.totalAttempts) * 100;
  };

  NotificationWebhook.prototype.getFailureRate = function() {
    if (this.totalAttempts === 0) return 0;
    return (this.failedAttempts / this.totalAttempts) * 100;
  };

  NotificationWebhook.prototype.isHealthy = function(threshold = 80) {
    return this.getSuccessRate() >= threshold;
  };

  NotificationWebhook.prototype.resetStatistics = function() {
    this.totalAttempts = 0;
    this.successfulAttempts = 0;
    this.failedAttempts = 0;
    this.lastTriggeredAt = null;
    return this.save();
  };

  NotificationWebhook.prototype.updateSecret = function(newSecret) {
    this.secret = newSecret;
    return this.save();
  };

  NotificationWebhook.prototype.addEvent = function(eventType) {
    if (!this.events.includes(eventType)) {
      this.events.push(eventType);
      return this.save();
    }
    return Promise.resolve(this);
  };

  NotificationWebhook.prototype.removeEvent = function(eventType) {
    const index = this.events.indexOf(eventType);
    if (index > -1) {
      this.events.splice(index, 1);
      return this.save();
    }
    return Promise.resolve(this);
  };

  NotificationWebhook.prototype.updateFilters = function(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
    return this.save();
  };

  NotificationWebhook.prototype.generateSignature = function(payload) {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
  };

  NotificationWebhook.prototype.verifySignature = function(payload, signature) {
    const expectedSignature = this.generateSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  };

  // Class methods
  NotificationWebhook.findActiveByEvent = function(eventType) {
    return this.findAll({
      where: {
        active: true,
        events: {
          [sequelize.Sequelize.Op.contains]: [eventType]
        }
      },
      order: [['created_at', 'ASC']]
    });
  };

  NotificationWebhook.findByUrl = function(url) {
    return this.findOne({
      where: { url }
    });
  };

  NotificationWebhook.findUnhealthy = function(threshold = 80, minAttempts = 10) {
    return this.findAll({
      where: {
        active: true,
        totalAttempts: {
          [sequelize.Sequelize.Op.gte]: minAttempts
        }
      }
    }).then(webhooks => {
      return webhooks.filter(webhook => !webhook.isHealthy(threshold));
    });
  };

  NotificationWebhook.getStatistics = function() {
    return this.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_webhooks'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN active = true THEN 1 END')), 'active_webhooks'],
        [sequelize.fn('SUM', sequelize.col('total_attempts')), 'total_attempts'],
        [sequelize.fn('SUM', sequelize.col('successful_attempts')), 'total_successful'],
        [sequelize.fn('SUM', sequelize.col('failed_attempts')), 'total_failed'],
        [sequelize.fn('AVG', 
          sequelize.literal('CASE WHEN total_attempts > 0 THEN (successful_attempts * 100.0 / total_attempts) ELSE 0 END')
        ), 'avg_success_rate']
      ],
      raw: true
    });
  };

  NotificationWebhook.getEventStatistics = function() {
    return this.findAll({
      where: { active: true },
      attributes: ['events']
    }).then(webhooks => {
      const eventCounts = {};
      webhooks.forEach(webhook => {
        webhook.events.forEach(event => {
          eventCounts[event] = (eventCounts[event] || 0) + 1;
        });
      });
      return eventCounts;
    });
  };

  NotificationWebhook.cleanupInactive = function(daysInactive = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    return this.destroy({
      where: {
        active: false,
        updatedAt: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
  };

  NotificationWebhook.findDuplicateUrls = function() {
    return this.findAll({
      attributes: [
        'url',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['url'],
      having: sequelize.literal('COUNT(id) > 1'),
      raw: true
    });
  };

  NotificationWebhook.getPerformanceReport = function(startDate, endDate) {
    return this.findAll({
      where: {
        lastTriggeredAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'id',
        'url',
        'events',
        'active',
        'total_attempts',
        'successful_attempts',
        'failed_attempts',
        'last_triggered_at',
        [sequelize.literal('(successful_attempts * 100.0 / NULLIF(total_attempts, 0))'), 'success_rate']
      ],
      order: [['success_rate', 'DESC']],
      raw: true
    });
  };

  NotificationWebhook.validateUrl = function(url) {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  };

  NotificationWebhook.validateEvents = function(events) {
    const validEvents = [
      'notification_sent',
      'notification_delivered',
      'notification_opened',
      'notification_clicked',
      'notification_failed',
      'notification_bounced',
      'bulk_notification_started',
      'bulk_notification_completed',
      'bulk_notification_failed'
    ];

    return events.every(event => validEvents.includes(event));
  };

  NotificationWebhook.generateSecret = function(length = 32) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  };

  // Associations
  NotificationWebhook.associate = (models) => {
    // No direct associations, but webhooks are triggered by notification events
  };

  return NotificationWebhook;
};