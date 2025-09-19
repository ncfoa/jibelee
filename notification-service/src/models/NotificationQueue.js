module.exports = (sequelize, DataTypes) => {
  const NotificationQueue = sequelize.define('NotificationQueue', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    notificationData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'notification_data',
      validate: {
        notEmpty: true
      }
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'scheduled_at'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'processing', 'completed', 'failed', 'canceled']]
      }
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    maxAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      field: 'max_attempts',
      validate: {
        min: 1,
        max: 10
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message'
    },
    nextRetryAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'next_retry_at'
    }
  }, {
    tableName: 'notification_queue',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['scheduled_at', 'status']
      },
      {
        fields: ['status']
      },
      {
        fields: ['next_retry_at']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  // Instance methods
  NotificationQueue.prototype.markAsProcessing = function() {
    this.status = 'processing';
    this.processedAt = new Date();
    return this.save();
  };

  NotificationQueue.prototype.markAsCompleted = function() {
    this.status = 'completed';
    this.processedAt = new Date();
    this.errorMessage = null;
    return this.save();
  };

  NotificationQueue.prototype.markAsFailed = function(errorMessage, scheduleRetry = true) {
    this.attempts += 1;
    this.errorMessage = errorMessage;
    this.processedAt = new Date();
    
    if (this.attempts >= this.maxAttempts || !scheduleRetry) {
      this.status = 'failed';
      this.nextRetryAt = null;
    } else {
      this.status = 'pending';
      this.nextRetryAt = this.calculateNextRetryTime();
    }
    
    return this.save();
  };

  NotificationQueue.prototype.markAsCanceled = function() {
    this.status = 'canceled';
    this.processedAt = new Date();
    this.nextRetryAt = null;
    return this.save();
  };

  NotificationQueue.prototype.calculateNextRetryTime = function() {
    // Exponential backoff: 2^attempts * 60 seconds
    const baseDelay = 60 * 1000; // 1 minute in milliseconds
    const delay = Math.pow(2, this.attempts) * baseDelay;
    const maxDelay = 30 * 60 * 1000; // 30 minutes maximum
    
    const actualDelay = Math.min(delay, maxDelay);
    return new Date(Date.now() + actualDelay);
  };

  NotificationQueue.prototype.reschedule = function(newScheduledAt) {
    this.scheduledAt = newScheduledAt;
    this.status = 'pending';
    this.nextRetryAt = null;
    this.errorMessage = null;
    return this.save();
  };

  NotificationQueue.prototype.incrementPriority = function() {
    // Move scheduled time earlier to increase priority
    const currentTime = new Date();
    if (this.scheduledAt > currentTime) {
      this.scheduledAt = currentTime;
      return this.save();
    }
    return Promise.resolve(this);
  };

  NotificationQueue.prototype.isExpired = function(expirationHours = 24) {
    const expirationTime = new Date(this.createdAt.getTime() + (expirationHours * 60 * 60 * 1000));
    return new Date() > expirationTime;
  };

  NotificationQueue.prototype.canRetry = function() {
    return this.attempts < this.maxAttempts && 
           this.status === 'pending' && 
           (!this.nextRetryAt || this.nextRetryAt <= new Date());
  };

  NotificationQueue.prototype.getWaitTime = function() {
    if (!this.nextRetryAt) return 0;
    const waitTime = this.nextRetryAt.getTime() - Date.now();
    return Math.max(0, waitTime);
  };

  NotificationQueue.prototype.updateNotificationData = function(newData) {
    this.notificationData = { ...this.notificationData, ...newData };
    return this.save();
  };

  NotificationQueue.prototype.getProcessingDuration = function() {
    if (!this.processedAt) return null;
    return this.processedAt.getTime() - this.createdAt.getTime();
  };

  // Class methods
  NotificationQueue.enqueue = function(notificationData, scheduledAt = new Date(), options = {}) {
    const {
      maxAttempts = 3,
      priority = 'normal'
    } = options;

    // Adjust scheduled time based on priority
    let adjustedScheduledAt = new Date(scheduledAt);
    if (priority === 'high') {
      adjustedScheduledAt = new Date(Math.max(adjustedScheduledAt.getTime() - 60000, Date.now())); // 1 minute earlier
    } else if (priority === 'urgent') {
      adjustedScheduledAt = new Date(); // Immediate
    }

    return this.create({
      notificationData,
      scheduledAt: adjustedScheduledAt,
      maxAttempts,
      status: 'pending'
    });
  };

  NotificationQueue.dequeue = function(limit = 10) {
    const currentTime = new Date();
    
    return this.findAll({
      where: {
        status: 'pending',
        scheduledAt: {
          [sequelize.Sequelize.Op.lte]: currentTime
        },
        [sequelize.Sequelize.Op.or]: [
          { nextRetryAt: null },
          { nextRetryAt: { [sequelize.Sequelize.Op.lte]: currentTime } }
        ]
      },
      order: [['scheduled_at', 'ASC']],
      limit
    });
  };

  NotificationQueue.findPending = function() {
    return this.findAll({
      where: {
        status: 'pending'
      },
      order: [['scheduled_at', 'ASC']]
    });
  };

  NotificationQueue.findFailed = function() {
    return this.findAll({
      where: {
        status: 'failed'
      },
      order: [['processed_at', 'DESC']]
    });
  };

  NotificationQueue.findRetryable = function() {
    const currentTime = new Date();
    
    return this.findAll({
      where: {
        status: 'pending',
        attempts: {
          [sequelize.Sequelize.Op.gt]: 0
        },
        nextRetryAt: {
          [sequelize.Sequelize.Op.lte]: currentTime
        }
      },
      order: [['next_retry_at', 'ASC']]
    });
  };

  NotificationQueue.getQueueStats = function() {
    return this.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('attempts')), 'avg_attempts']
      ],
      group: ['status'],
      raw: true
    });
  };

  NotificationQueue.getProcessingStats = function(hours = 24) {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        processedAt: {
          [sequelize.Sequelize.Op.gte]: startTime
        }
      },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', 
          sequelize.literal('EXTRACT(EPOCH FROM (processed_at - created_at))')
        ), 'avg_processing_time_seconds']
      ],
      group: ['status'],
      raw: true
    });
  };

  NotificationQueue.cleanupCompleted = function(hoursOld = 24) {
    const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));
    
    return this.destroy({
      where: {
        status: 'completed',
        processedAt: {
          [sequelize.Sequelize.Op.lt]: cutoffTime
        }
      }
    });
  };

  NotificationQueue.cleanupExpired = function(hoursOld = 72) {
    const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));
    
    return this.destroy({
      where: {
        status: {
          [sequelize.Sequelize.Op.in]: ['failed', 'canceled']
        },
        [sequelize.Sequelize.Op.or]: [
          { processedAt: { [sequelize.Sequelize.Op.lt]: cutoffTime } },
          { 
            processedAt: null,
            createdAt: { [sequelize.Sequelize.Op.lt]: cutoffTime }
          }
        ]
      }
    });
  };

  NotificationQueue.retryFailed = function(maxRetries = null) {
    const where = {
      status: 'failed'
    };
    
    if (maxRetries !== null) {
      where.attempts = {
        [sequelize.Sequelize.Op.lt]: maxRetries
      };
    }
    
    return this.update(
      {
        status: 'pending',
        nextRetryAt: null,
        errorMessage: null
      },
      { where }
    );
  };

  NotificationQueue.cancelPending = function(filter = {}) {
    const where = {
      status: 'pending',
      ...filter
    };
    
    return this.update(
      {
        status: 'canceled',
        processedAt: new Date()
      },
      { where }
    );
  };

  NotificationQueue.getUpcomingScheduled = function(hours = 24) {
    const endTime = new Date(Date.now() + (hours * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        status: 'pending',
        scheduledAt: {
          [sequelize.Sequelize.Op.between]: [new Date(), endTime]
        }
      },
      order: [['scheduled_at', 'ASC']]
    });
  };

  NotificationQueue.getQueueDepth = function() {
    return this.count({
      where: {
        status: 'pending'
      }
    });
  };

  NotificationQueue.getOldestPending = function() {
    return this.findOne({
      where: {
        status: 'pending'
      },
      order: [['created_at', 'ASC']]
    });
  };

  NotificationQueue.getAverageWaitTime = function(hours = 24) {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const query = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_wait_time_seconds
      FROM notification_queue
      WHERE status = 'completed'
        AND processed_at >= :startTime
        AND processed_at IS NOT NULL
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { startTime }
    });
  };

  NotificationQueue.getFailureReasons = function(hours = 24) {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        status: 'failed',
        processedAt: {
          [sequelize.Sequelize.Op.gte]: startTime
        },
        errorMessage: {
          [sequelize.Sequelize.Op.not]: null
        }
      },
      attributes: [
        'error_message',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['error_message'],
      order: [[sequelize.literal('count'), 'DESC']],
      raw: true
    });
  };

  // Associations
  NotificationQueue.associate = (models) => {
    // No direct associations, but notification_data contains references to other entities
  };

  return NotificationQueue;
};