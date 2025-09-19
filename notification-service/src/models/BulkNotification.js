module.exports = (sequelize, DataTypes) => {
  const BulkNotification = sequelize.define('BulkNotification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'template_id',
      validate: {
        isUUID: 4
      }
    },
    operation: {
      type: DataTypes.ENUM('send', 'cancel', 'reschedule'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('processing', 'completed', 'failed', 'canceled'),
      allowNull: false,
      defaultValue: 'processing'
    },
    totalRecipients: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'total_recipients',
      validate: {
        min: 1
      }
    },
    processedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'processed_count',
      validate: {
        min: 0
      }
    },
    successfulCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'successful_count',
      validate: {
        min: 0
      }
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'failed_count',
      validate: {
        min: 0
      }
    },
    batchSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      field: 'batch_size',
      validate: {
        min: 1,
        max: 1000
      }
    },
    delayBetweenBatches: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: 'delay_between_batches',
      validate: {
        min: 0,
        max: 3600
      }
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'scheduled_at'
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'bulk_notifications',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['scheduled_at']
      },
      {
        fields: ['template_id']
      },
      {
        fields: ['created_by']
      }
    ]
  });

  // Instance methods
  BulkNotification.prototype.markAsStarted = function() {
    this.status = 'processing';
    this.startedAt = new Date();
    return this.save();
  };

  BulkNotification.prototype.markAsCompleted = function() {
    this.status = 'completed';
    this.completedAt = new Date();
    return this.save();
  };

  BulkNotification.prototype.markAsFailed = function(errorMessage = null) {
    this.status = 'failed';
    this.completedAt = new Date();
    if (errorMessage) {
      this.metadata = {
        ...this.metadata,
        error: errorMessage
      };
    }
    return this.save();
  };

  BulkNotification.prototype.markAsCanceled = function() {
    this.status = 'canceled';
    this.completedAt = new Date();
    return this.save();
  };

  BulkNotification.prototype.updateProgress = function(processed, successful, failed) {
    this.processedCount = processed;
    this.successfulCount = successful;
    this.failedCount = failed;
    return this.save();
  };

  BulkNotification.prototype.incrementProgress = function(successful = 0, failed = 0) {
    this.processedCount += successful + failed;
    this.successfulCount += successful;
    this.failedCount += failed;
    
    // Check if completed
    if (this.processedCount >= this.totalRecipients) {
      this.status = 'completed';
      this.completedAt = new Date();
    }
    
    return this.save();
  };

  BulkNotification.prototype.getProgress = function() {
    return {
      total: this.totalRecipients,
      processed: this.processedCount,
      successful: this.successfulCount,
      failed: this.failedCount,
      remaining: this.totalRecipients - this.processedCount,
      successRate: this.processedCount > 0 ? (this.successfulCount / this.processedCount) * 100 : 0,
      failureRate: this.processedCount > 0 ? (this.failedCount / this.processedCount) * 100 : 0,
      completionRate: (this.processedCount / this.totalRecipients) * 100
    };
  };

  BulkNotification.prototype.getEstimatedCompletion = function() {
    if (this.status === 'completed') {
      return this.completedAt;
    }

    if (this.processedCount === 0 || !this.startedAt) {
      return null;
    }

    const elapsedTime = new Date() - this.startedAt;
    const processedRate = this.processedCount / elapsedTime; // notifications per ms
    const remainingCount = this.totalRecipients - this.processedCount;
    const estimatedRemainingTime = remainingCount / processedRate;

    return new Date(Date.now() + estimatedRemainingTime);
  };

  BulkNotification.prototype.getDuration = function() {
    if (!this.startedAt) return null;
    
    const endTime = this.completedAt || new Date();
    return endTime - this.startedAt;
  };

  BulkNotification.prototype.getAverageProcessingTime = function() {
    const duration = this.getDuration();
    if (!duration || this.processedCount === 0) return null;
    
    return duration / this.processedCount;
  };

  BulkNotification.prototype.isScheduled = function() {
    return this.scheduledAt && this.scheduledAt > new Date();
  };

  BulkNotification.prototype.canCancel = function() {
    return ['processing', 'scheduled'].includes(this.status);
  };

  BulkNotification.prototype.reschedule = function(newScheduledAt) {
    if (!this.canCancel()) {
      throw new Error('Cannot reschedule completed or failed bulk notification');
    }
    
    this.scheduledAt = newScheduledAt;
    this.status = 'processing';
    this.metadata = {
      ...this.metadata,
      rescheduled: true,
      rescheduledAt: new Date()
    };
    
    return this.save();
  };

  // Class methods
  BulkNotification.findPending = function() {
    return this.findAll({
      where: {
        status: 'processing',
        [sequelize.Sequelize.Op.or]: [
          { scheduledAt: null },
          { scheduledAt: { [sequelize.Sequelize.Op.lte]: new Date() } }
        ]
      },
      order: [['created_at', 'ASC']]
    });
  };

  BulkNotification.findScheduled = function() {
    return this.findAll({
      where: {
        status: 'processing',
        scheduledAt: {
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      order: [['scheduled_at', 'ASC']]
    });
  };

  BulkNotification.findByStatus = function(status) {
    return this.findAll({
      where: { status },
      order: [['created_at', 'DESC']],
      include: [
        {
          model: sequelize.models.NotificationTemplate,
          as: 'template',
          attributes: ['name', 'category']
        }
      ]
    });
  };

  BulkNotification.findByCreator = function(createdBy, limit = 50, offset = 0) {
    return this.findAndCountAll({
      where: { createdBy },
      order: [['created_at', 'DESC']],
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

  BulkNotification.getStatistics = function(startDate = null, endDate = null) {
    const where = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[sequelize.Sequelize.Op.gte] = startDate;
      if (endDate) where.createdAt[sequelize.Sequelize.Op.lte] = endDate;
    }

    return this.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total_recipients')), 'total_recipients'],
        [sequelize.fn('SUM', sequelize.col('successful_count')), 'total_successful'],
        [sequelize.fn('SUM', sequelize.col('failed_count')), 'total_failed'],
        [sequelize.fn('AVG', sequelize.col('total_recipients')), 'avg_recipients']
      ],
      group: ['status'],
      raw: true
    });
  };

  BulkNotification.cleanupOldRecords = function(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.destroy({
      where: {
        completedAt: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        },
        status: {
          [sequelize.Sequelize.Op.in]: ['completed', 'failed', 'canceled']
        }
      }
    });
  };

  BulkNotification.getPerformanceMetrics = function(startDate, endDate) {
    return this.findAll({
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        },
        status: 'completed'
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_operations'],
        [sequelize.fn('SUM', sequelize.col('total_recipients')), 'total_notifications'],
        [sequelize.fn('AVG', 
          sequelize.literal('(successful_count * 100.0 / NULLIF(total_recipients, 0))')
        ), 'avg_success_rate'],
        [sequelize.fn('AVG',
          sequelize.literal('EXTRACT(EPOCH FROM (completed_at - started_at))')
        ), 'avg_duration_seconds']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [['date', 'ASC']],
      raw: true
    });
  };

  // Associations
  BulkNotification.associate = (models) => {
    BulkNotification.belongsTo(models.NotificationTemplate, {
      foreignKey: 'templateId',
      as: 'template'
    });
  };

  return BulkNotification;
};