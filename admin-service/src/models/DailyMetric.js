module.exports = (sequelize, DataTypes) => {
  const DailyMetric = sequelize.define('DailyMetric', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'The date these metrics represent'
    },
    metric_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of metric (user, delivery, financial, system)'
    },
    // User metrics
    new_users: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of new user registrations'
    },
    active_users: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of active users (logged in or performed action)'
    },
    deleted_users: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of users who deleted their accounts'
    },
    verified_users: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of newly verified users'
    },
    suspended_users: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of users suspended'
    },
    
    // Delivery metrics
    new_requests: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of new delivery requests'
    },
    matched_requests: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of requests matched with travelers'
    },
    completed_deliveries: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of completed deliveries'
    },
    cancelled_deliveries: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of cancelled deliveries'
    },
    average_delivery_time: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      comment: 'Average delivery time in hours'
    },
    
    // Financial metrics
    total_revenue: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      comment: 'Total revenue in USD'
    },
    platform_fees: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      comment: 'Platform fees collected in USD'
    },
    refunds: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      comment: 'Total refunds processed in USD'
    },
    payouts: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      comment: 'Total payouts to travelers in USD'
    },
    transaction_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of financial transactions'
    },
    average_order_value: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      comment: 'Average order value in USD'
    },
    
    // Performance metrics
    average_response_time: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Average API response time in milliseconds'
    },
    success_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 100.00,
      comment: 'API success rate percentage'
    },
    uptime_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 100.00,
      comment: 'System uptime percentage'
    },
    
    // System metrics
    api_calls: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of API calls'
    },
    errors: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of errors'
    },
    unique_visitors: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of unique visitors/users'
    },
    page_views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total page views'
    },
    
    // Support metrics
    support_tickets: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of support tickets created'
    },
    resolved_tickets: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of support tickets resolved'
    },
    average_resolution_time: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      comment: 'Average ticket resolution time in hours'
    },
    
    // Dispute metrics
    new_disputes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of new disputes filed'
    },
    resolved_disputes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of disputes resolved'
    },
    dispute_resolution_time: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      comment: 'Average dispute resolution time in hours'
    },
    
    // Additional metrics as JSON
    additional_metrics: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional metrics that don\'t fit in standard columns'
    },
    
    // Metadata
    data_sources: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      comment: 'List of data sources used to compile these metrics'
    },
    calculated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When these metrics were calculated'
    },
    is_final: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether these metrics are final or may be updated'
    }
  }, {
    tableName: 'daily_metrics',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['date', 'metric_type']
      },
      {
        fields: ['date']
      },
      {
        fields: ['metric_type']
      },
      {
        fields: ['calculated_at']
      },
      {
        fields: ['is_final']
      }
    ]
  });

  // Instance methods
  DailyMetric.prototype.markAsFinal = function() {
    this.is_final = true;
    this.calculated_at = new Date();
    return this.save();
  };

  DailyMetric.prototype.updateMetric = function(field, value) {
    if (this.hasAttribute(field)) {
      this[field] = value;
      this.calculated_at = new Date();
      return this.save();
    }
    throw new Error(`Invalid metric field: ${field}`);
  };

  DailyMetric.prototype.addAdditionalMetric = function(key, value) {
    if (!this.additional_metrics) {
      this.additional_metrics = {};
    }
    this.additional_metrics[key] = value;
    this.calculated_at = new Date();
    return this.save();
  };

  DailyMetric.prototype.getGrowthRate = async function(field, days = 7) {
    const previousDate = new Date(this.date);
    previousDate.setDate(previousDate.getDate() - days);
    
    const previousMetric = await DailyMetric.findOne({
      where: {
        date: previousDate,
        metric_type: this.metric_type
      }
    });
    
    if (!previousMetric || !previousMetric[field] || previousMetric[field] === 0) {
      return this[field] > 0 ? 100 : 0; // 100% growth if previous was 0
    }
    
    return ((this[field] - previousMetric[field]) / previousMetric[field]) * 100;
  };

  DailyMetric.prototype.getConversionRate = function(numeratorField, denominatorField) {
    if (!this[denominatorField] || this[denominatorField] === 0) {
      return 0;
    }
    return (this[numeratorField] / this[denominatorField]) * 100;
  };

  DailyMetric.prototype.calculateUserRetention = function() {
    if (!this.new_users || this.new_users === 0) {
      return 0;
    }
    return (this.active_users / this.new_users) * 100;
  };

  DailyMetric.prototype.calculateDeliverySuccessRate = function() {
    const totalDeliveries = this.completed_deliveries + this.cancelled_deliveries;
    if (totalDeliveries === 0) {
      return 0;
    }
    return (this.completed_deliveries / totalDeliveries) * 100;
  };

  DailyMetric.prototype.calculateErrorRate = function() {
    if (!this.api_calls || this.api_calls === 0) {
      return 0;
    }
    return (this.errors / this.api_calls) * 100;
  };

  // Class methods
  DailyMetric.findByDate = function(date, metricType = null) {
    const where = { date };
    if (metricType) where.metric_type = metricType;
    
    return this.findAll({
      where,
      order: [['metric_type', 'ASC']]
    });
  };

  DailyMetric.findByDateRange = function(startDate, endDate, metricType = null) {
    const where = {
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate]
      }
    };
    
    if (metricType) where.metric_type = metricType;
    
    return this.findAll({
      where,
      order: [['date', 'ASC'], ['metric_type', 'ASC']]
    });
  };

  DailyMetric.findByMetricType = function(metricType, limit = 30) {
    return this.findAll({
      where: { metric_type: metricType },
      order: [['date', 'DESC']],
      limit
    });
  };

  DailyMetric.getLatestMetrics = function(metricTypes = []) {
    const where = {};
    if (metricTypes.length > 0) {
      where.metric_type = metricTypes;
    }
    
    return this.findAll({
      where,
      order: [['date', 'DESC']],
      limit: metricTypes.length || 10
    });
  };

  DailyMetric.createOrUpdate = async function(date, metricType, metrics) {
    const [metric, created] = await this.findOrCreate({
      where: { date, metric_type: metricType },
      defaults: {
        date,
        metric_type: metricType,
        ...metrics,
        calculated_at: new Date()
      }
    });
    
    if (!created) {
      // Update existing record
      Object.assign(metric, metrics);
      metric.calculated_at = new Date();
      await metric.save();
    }
    
    return metric;
  };

  DailyMetric.aggregateMetrics = async function(startDate, endDate, metricType, aggregationType = 'sum') {
    const metrics = await this.findByDateRange(startDate, endDate, metricType);
    
    if (metrics.length === 0) {
      return null;
    }
    
    const aggregated = {
      start_date: startDate,
      end_date: endDate,
      metric_type: metricType,
      period_days: metrics.length
    };
    
    // Define numeric fields to aggregate
    const numericFields = [
      'new_users', 'active_users', 'deleted_users', 'verified_users', 'suspended_users',
      'new_requests', 'matched_requests', 'completed_deliveries', 'cancelled_deliveries',
      'total_revenue', 'platform_fees', 'refunds', 'payouts', 'transaction_count',
      'api_calls', 'errors', 'unique_visitors', 'page_views',
      'support_tickets', 'resolved_tickets', 'new_disputes', 'resolved_disputes'
    ];
    
    const averageFields = [
      'average_delivery_time', 'average_response_time', 'success_rate', 'uptime_percentage',
      'average_order_value', 'average_resolution_time', 'dispute_resolution_time'
    ];
    
    // Aggregate numeric fields
    numericFields.forEach(field => {
      if (aggregationType === 'sum') {
        aggregated[field] = metrics.reduce((sum, metric) => sum + (metric[field] || 0), 0);
      } else if (aggregationType === 'avg') {
        const total = metrics.reduce((sum, metric) => sum + (metric[field] || 0), 0);
        aggregated[field] = total / metrics.length;
      } else if (aggregationType === 'max') {
        aggregated[field] = Math.max(...metrics.map(m => m[field] || 0));
      } else if (aggregationType === 'min') {
        aggregated[field] = Math.min(...metrics.map(m => m[field] || 0));
      }
    });
    
    // Always average the average fields
    averageFields.forEach(field => {
      const validMetrics = metrics.filter(m => m[field] && m[field] > 0);
      if (validMetrics.length > 0) {
        const total = validMetrics.reduce((sum, metric) => sum + metric[field], 0);
        aggregated[field] = total / validMetrics.length;
      } else {
        aggregated[field] = 0;
      }
    });
    
    return aggregated;
  };

  DailyMetric.getTrends = async function(metricType, field, days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const metrics = await this.findAll({
      where: {
        metric_type: metricType,
        date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['date', 'ASC']],
      attributes: ['date', field]
    });
    
    const trends = metrics.map(metric => ({
      date: metric.date,
      value: metric[field] || 0
    }));
    
    // Calculate trend direction
    if (trends.length >= 2) {
      const firstValue = trends[0].value;
      const lastValue = trends[trends.length - 1].value;
      const trendDirection = lastValue > firstValue ? 'up' : 
                           lastValue < firstValue ? 'down' : 'flat';
      
      return {
        trends,
        direction: trendDirection,
        change: lastValue - firstValue,
        changePercent: firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0
      };
    }
    
    return { trends, direction: 'flat', change: 0, changePercent: 0 };
  };

  DailyMetric.getTopPerformingDays = function(metricType, field, limit = 10) {
    return this.findAll({
      where: { metric_type: metricType },
      order: [[field, 'DESC']],
      limit,
      attributes: ['date', field]
    });
  };

  DailyMetric.calculateGrowthRates = async function(metricType, fields, days = 7) {
    const today = new Date();
    const compareDate = new Date();
    compareDate.setDate(today.getDate() - days);
    
    const [currentMetrics, previousMetrics] = await Promise.all([
      this.findByDate(today, metricType),
      this.findByDate(compareDate, metricType)
    ]);
    
    const growthRates = {};
    
    fields.forEach(field => {
      const current = currentMetrics[0]?.[field] || 0;
      const previous = previousMetrics[0]?.[field] || 0;
      
      if (previous === 0) {
        growthRates[field] = current > 0 ? 100 : 0;
      } else {
        growthRates[field] = ((current - previous) / previous) * 100;
      }
    });
    
    return growthRates;
  };

  DailyMetric.generateReport = async function(startDate, endDate, metricTypes = []) {
    const where = {
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate]
      }
    };
    
    if (metricTypes.length > 0) {
      where.metric_type = metricTypes;
    }
    
    const metrics = await this.findAll({
      where,
      order: [['date', 'ASC'], ['metric_type', 'ASC']]
    });
    
    // Group by metric type
    const grouped = {};
    metrics.forEach(metric => {
      if (!grouped[metric.metric_type]) {
        grouped[metric.metric_type] = [];
      }
      grouped[metric.metric_type].push(metric);
    });
    
    // Generate summary for each metric type
    const report = {
      period: { start: startDate, end: endDate },
      summary: {},
      detailed: grouped
    };
    
    Object.keys(grouped).forEach(metricType => {
      const typeMetrics = grouped[metricType];
      report.summary[metricType] = {
        totalDays: typeMetrics.length,
        averages: {},
        totals: {},
        trends: {}
      };
      
      // Calculate averages and totals
      const numericFields = [
        'new_users', 'active_users', 'completed_deliveries', 'total_revenue',
        'api_calls', 'errors'
      ];
      
      numericFields.forEach(field => {
        const values = typeMetrics.map(m => m[field] || 0);
        report.summary[metricType].totals[field] = values.reduce((sum, val) => sum + val, 0);
        report.summary[metricType].averages[field] = report.summary[metricType].totals[field] / values.length;
      });
    });
    
    return report;
  };

  return DailyMetric;
};