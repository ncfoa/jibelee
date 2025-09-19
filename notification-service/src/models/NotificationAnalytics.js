module.exports = (sequelize, DataTypes) => {
  const NotificationAnalytics = sequelize.define('NotificationAnalytics', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    notificationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'notification_id',
      validate: {
        isUUID: 4
      }
    },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'event_type',
      validate: {
        isIn: [['sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'unsubscribed']]
      }
    },
    eventData: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'event_data'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent'
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true,
      field: 'ip_address'
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'notification_analytics',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['notification_id']
      },
      {
        fields: ['event_type', 'timestamp']
      },
      {
        fields: ['timestamp']
      },
      {
        fields: ['event_type']
      }
    ]
  });

  // Instance methods
  NotificationAnalytics.prototype.getEventDetails = function() {
    return {
      id: this.id,
      notificationId: this.notificationId,
      eventType: this.eventType,
      timestamp: this.timestamp,
      data: this.eventData,
      userAgent: this.userAgent,
      ipAddress: this.ipAddress,
      location: this.location
    };
  };

  NotificationAnalytics.prototype.isEngagementEvent = function() {
    return ['opened', 'clicked'].includes(this.eventType);
  };

  NotificationAnalytics.prototype.isDeliveryEvent = function() {
    return ['sent', 'delivered', 'failed', 'bounced'].includes(this.eventType);
  };

  NotificationAnalytics.prototype.extractBrowserInfo = function() {
    if (!this.userAgent) return null;

    // Simple user agent parsing (in production, use a proper library like ua-parser-js)
    const ua = this.userAgent.toLowerCase();
    let browser = 'unknown';
    let os = 'unknown';

    if (ua.includes('chrome')) browser = 'chrome';
    else if (ua.includes('firefox')) browser = 'firefox';
    else if (ua.includes('safari')) browser = 'safari';
    else if (ua.includes('edge')) browser = 'edge';

    if (ua.includes('windows')) os = 'windows';
    else if (ua.includes('mac')) os = 'macos';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('ios')) os = 'ios';

    return { browser, os };
  };

  // Class methods
  NotificationAnalytics.trackEvent = function(notificationId, eventType, eventData = {}, metadata = {}) {
    return this.create({
      notificationId,
      eventType,
      eventData,
      userAgent: metadata.userAgent || null,
      ipAddress: metadata.ipAddress || null,
      location: metadata.location || null,
      timestamp: new Date()
    });
  };

  NotificationAnalytics.getNotificationEvents = function(notificationId) {
    return this.findAll({
      where: { notificationId },
      order: [['timestamp', 'ASC']]
    });
  };

  NotificationAnalytics.getEngagementMetrics = function(options = {}) {
    const {
      startDate,
      endDate,
      notificationType,
      category,
      templateId,
      groupBy = 'day'
    } = options;

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

    const whereClause = [];
    const replacements = {};

    if (startDate) {
      whereClause.push('na.timestamp >= :startDate');
      replacements.startDate = startDate;
    }

    if (endDate) {
      whereClause.push('na.timestamp <= :endDate');
      replacements.endDate = endDate;
    }

    if (notificationType) {
      whereClause.push('n.notification_type = :notificationType');
      replacements.notificationType = notificationType;
    }

    if (category) {
      whereClause.push('n.category = :category');
      replacements.category = category;
    }

    if (templateId) {
      whereClause.push('n.template_id = :templateId');
      replacements.templateId = templateId;
    }

    const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const query = `
      SELECT 
        DATE_FORMAT(na.timestamp, '${dateFormat}') as period,
        n.notification_type,
        n.category,
        COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) as opened,
        COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) as clicked,
        COUNT(CASE WHEN na.event_type = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN na.event_type = 'bounced' THEN 1 END) as bounced
      FROM notification_analytics na
      JOIN notifications n ON na.notification_id = n.id
      ${whereString}
      GROUP BY period, n.notification_type, n.category
      ORDER BY period ASC
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements
    });
  };

  NotificationAnalytics.getDeliveryMetrics = function(startDate, endDate) {
    const query = `
      SELECT 
        n.notification_type,
        n.category,
        COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END) as total_sent,
        COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END) as total_delivered,
        COUNT(CASE WHEN na.event_type = 'failed' THEN 1 END) as total_failed,
        COUNT(CASE WHEN na.event_type = 'bounced' THEN 1 END) as total_bounced,
        (COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END), 0)) as delivery_rate,
        AVG(CASE WHEN na.event_type = 'delivered' THEN 
          EXTRACT(EPOCH FROM (na.timestamp - n.sent_at)) END) as avg_delivery_time_seconds
      FROM notification_analytics na
      JOIN notifications n ON na.notification_id = n.id
      WHERE na.timestamp BETWEEN :startDate AND :endDate
      GROUP BY n.notification_type, n.category
      ORDER BY n.notification_type, n.category
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { startDate, endDate }
    });
  };

  NotificationAnalytics.getEngagementRates = function(startDate, endDate) {
    const query = `
      SELECT 
        n.notification_type,
        n.category,
        nt.name as template_name,
        COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END) as total_sent,
        COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END) as total_delivered,
        COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) as total_opened,
        COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) as total_clicked,
        (COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END), 0)) as open_rate,
        (COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END), 0)) as click_rate,
        (COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END), 0)) as click_through_rate
      FROM notification_analytics na
      JOIN notifications n ON na.notification_id = n.id
      LEFT JOIN notification_templates nt ON n.template_id = nt.id
      WHERE na.timestamp BETWEEN :startDate AND :endDate
      GROUP BY n.notification_type, n.category, nt.name
      HAVING COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END) > 0
      ORDER BY open_rate DESC, click_rate DESC
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { startDate, endDate }
    });
  };

  NotificationAnalytics.getUserEngagementProfile = function(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = `
      SELECT 
        n.notification_type,
        n.category,
        COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END) as received,
        COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) as opened,
        COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) as clicked,
        (COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END), 0)) as engagement_rate,
        EXTRACT(HOUR FROM na.timestamp) as hour_of_day,
        COUNT(*) as activity_count
      FROM notification_analytics na
      JOIN notifications n ON na.notification_id = n.id
      WHERE n.user_id = :userId 
        AND na.timestamp >= :startDate
        AND na.event_type IN ('opened', 'clicked')
      GROUP BY n.notification_type, n.category, EXTRACT(HOUR FROM na.timestamp)
      ORDER BY engagement_rate DESC, activity_count DESC
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { userId, startDate }
    });
  };

  NotificationAnalytics.getTopPerformingTemplates = function(startDate, endDate, limit = 10) {
    const query = `
      SELECT 
        nt.id,
        nt.name,
        nt.category,
        COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END) as total_sent,
        COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END) as total_delivered,
        COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) as total_opened,
        COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) as total_clicked,
        (COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END), 0)) as open_rate,
        (COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(CASE WHEN na.event_type = 'delivered' THEN 1 END), 0)) as click_rate
      FROM notification_analytics na
      JOIN notifications n ON na.notification_id = n.id
      JOIN notification_templates nt ON n.template_id = nt.id
      WHERE na.timestamp BETWEEN :startDate AND :endDate
      GROUP BY nt.id, nt.name, nt.category
      HAVING COUNT(CASE WHEN na.event_type = 'sent' THEN 1 END) >= 10
      ORDER BY 
        (COUNT(CASE WHEN na.event_type = 'opened' THEN 1 END) + 
         COUNT(CASE WHEN na.event_type = 'clicked' THEN 1 END) * 2) DESC
      LIMIT :limit
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { startDate, endDate, limit }
    });
  };

  NotificationAnalytics.getFailureAnalysis = function(startDate, endDate) {
    const query = `
      SELECT 
        n.notification_type,
        n.category,
        na.event_data->>'error_code' as error_code,
        na.event_data->>'error_message' as error_message,
        COUNT(*) as failure_count,
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as failure_percentage
      FROM notification_analytics na
      JOIN notifications n ON na.notification_id = n.id
      WHERE na.event_type IN ('failed', 'bounced')
        AND na.timestamp BETWEEN :startDate AND :endDate
      GROUP BY n.notification_type, n.category, na.event_data->>'error_code', na.event_data->>'error_message'
      ORDER BY failure_count DESC
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { startDate, endDate }
    });
  };

  NotificationAnalytics.cleanupOldAnalytics = function(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return this.destroy({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
  };

  NotificationAnalytics.getHourlyActivity = function(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query = `
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        event_type,
        COUNT(*) as count
      FROM notification_analytics
      WHERE timestamp BETWEEN :startOfDay AND :endOfDay
      GROUP BY EXTRACT(HOUR FROM timestamp), event_type
      ORDER BY hour, event_type
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { startOfDay, endOfDay }
    });
  };

  // Associations
  NotificationAnalytics.associate = (models) => {
    NotificationAnalytics.belongsTo(models.Notification, {
      foreignKey: 'notificationId',
      as: 'notification'
    });
  };

  return NotificationAnalytics;
};