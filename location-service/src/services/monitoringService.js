const { logger, performanceLogger } = require('../utils/logger');
const Redis = require('ioredis');

class MonitoringService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.metrics = new Map();
    this.alerts = new Map();
    this.startTime = Date.now();
    
    // Initialize monitoring
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    // Monitor system health every minute
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000);

    // Monitor Redis connection
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
      this.recordAlert('redis_connection_error', 'critical', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });

    // Monitor process events
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.recordAlert('uncaught_exception', 'critical', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection:', reason);
      this.recordAlert('unhandled_rejection', 'critical', {
        reason: reason?.message || reason,
        timestamp: new Date().toISOString()
      });
    });
  }

  // System metrics collection
  async collectSystemMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoop: this.getEventLoopLag(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };

    // Store metrics in Redis with expiration
    await this.redis.setex(
      `metrics:system:${Date.now()}`,
      3600, // 1 hour
      JSON.stringify(metrics)
    );

    // Check for alerts
    this.checkSystemAlerts(metrics);

    return metrics;
  }

  // Location service specific metrics
  async recordLocationMetric(type, data) {
    const metric = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    const key = `metrics:location:${type}:${Date.now()}`;
    await this.redis.setex(key, 3600, JSON.stringify(metric));

    // Update counters
    await this.incrementCounter(`location_${type}_total`);
    
    return metric;
  }

  // Performance monitoring
  async recordPerformanceMetric(operation, duration, metadata = {}) {
    const metric = {
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString()
    };

    // Store detailed metric
    await this.redis.setex(
      `metrics:performance:${operation}:${Date.now()}`,
      3600,
      JSON.stringify(metric)
    );

    // Update running averages
    await this.updateRunningAverage(`performance_${operation}`, duration);

    // Check for performance alerts
    if (duration > this.getPerformanceThreshold(operation)) {
      performanceLogger.apiLatency(operation, duration);
      
      await this.recordAlert('performance_degradation', 'warning', {
        operation,
        duration,
        threshold: this.getPerformanceThreshold(operation),
        metadata
      });
    }

    return metric;
  }

  // Database query monitoring
  async recordDatabaseMetric(query, duration, success = true) {
    const metric = {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      success,
      timestamp: new Date().toISOString()
    };

    await this.redis.setex(
      `metrics:database:${Date.now()}`,
      3600,
      JSON.stringify(metric)
    );

    // Check for slow queries
    if (duration > 1000) { // 1 second threshold
      performanceLogger.slowQuery(query, duration);
    }

    // Update counters
    await this.incrementCounter(success ? 'db_queries_success' : 'db_queries_error');
    await this.updateRunningAverage('db_query_duration', duration);

    return metric;
  }

  // API endpoint monitoring
  async recordAPIMetric(method, endpoint, statusCode, duration, userId = null) {
    const metric = {
      method,
      endpoint,
      statusCode,
      duration,
      userId,
      timestamp: new Date().toISOString()
    };

    await this.redis.setex(
      `metrics:api:${Date.now()}`,
      3600,
      JSON.stringify(metric)
    );

    // Update counters by status code
    await this.incrementCounter(`api_${Math.floor(statusCode / 100)}xx_total`);
    await this.incrementCounter(`api_requests_total`);

    // Update endpoint-specific metrics
    const endpointKey = `${method}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await this.updateRunningAverage(`endpoint_${endpointKey}_duration`, duration);

    return metric;
  }

  // Error monitoring
  async recordError(error, context = {}) {
    const errorMetric = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      timestamp: new Date().toISOString()
    };

    await this.redis.setex(
      `metrics:error:${Date.now()}`,
      86400, // 24 hours
      JSON.stringify(errorMetric)
    );

    await this.incrementCounter('errors_total');
    await this.incrementCounter(`error_${error.name || 'unknown'}_total`);

    // Create alert for critical errors
    if (this.isCriticalError(error)) {
      await this.recordAlert('critical_error', 'critical', errorMetric);
    }

    return errorMetric;
  }

  // Location-specific monitoring
  async recordLocationUpdate(deliveryId, userId, coordinates, accuracy) {
    const metric = {
      deliveryId,
      userId,
      coordinates,
      accuracy,
      timestamp: new Date().toISOString()
    };

    await this.recordLocationMetric('update', metric);

    // Track accuracy distribution
    const accuracyBucket = this.getAccuracyBucket(accuracy);
    await this.incrementCounter(`location_accuracy_${accuracyBucket}`);

    // Monitor for accuracy issues
    if (accuracy > 100) {
      await this.recordAlert('poor_location_accuracy', 'warning', {
        deliveryId,
        accuracy,
        threshold: 100
      });
    }

    return metric;
  }

  async recordGeofenceEvent(geofenceId, eventType, userId, deliveryId) {
    const metric = {
      geofenceId,
      eventType,
      userId,
      deliveryId,
      timestamp: new Date().toISOString()
    };

    await this.recordLocationMetric('geofence_event', metric);
    await this.incrementCounter(`geofence_${eventType}_total`);

    return metric;
  }

  async recordEmergency(emergencyId, emergencyType, severity, userId) {
    const metric = {
      emergencyId,
      emergencyType,
      severity,
      userId,
      timestamp: new Date().toISOString()
    };

    await this.recordLocationMetric('emergency', metric);
    await this.incrementCounter(`emergency_${severity}_total`);

    // Always create alert for emergencies
    await this.recordAlert('emergency_reported', 
      severity === 'critical' ? 'critical' : 'warning', 
      metric
    );

    return metric;
  }

  // Alert management
  async recordAlert(type, severity, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      data,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    // Store alert
    await this.redis.setex(
      `alert:${alert.id}`,
      86400, // 24 hours
      JSON.stringify(alert)
    );

    // Add to active alerts list
    await this.redis.lpush('alerts:active', alert.id);
    await this.redis.ltrim('alerts:active', 0, 999); // Keep last 1000 alerts

    // Log alert
    logger.warn(`Alert created: ${type}`, alert);

    // Send notifications for critical alerts
    if (severity === 'critical') {
      await this.sendAlertNotification(alert);
    }

    return alert;
  }

  async getActiveAlerts() {
    const alertIds = await this.redis.lrange('alerts:active', 0, -1);
    const alerts = [];

    for (const alertId of alertIds) {
      const alertData = await this.redis.get(`alert:${alertId}`);
      if (alertData) {
        alerts.push(JSON.parse(alertData));
      }
    }

    return alerts.filter(alert => !alert.acknowledged);
  }

  async acknowledgeAlert(alertId, acknowledgedBy) {
    const alertData = await this.redis.get(`alert:${alertId}`);
    if (alertData) {
      const alert = JSON.parse(alertData);
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();

      await this.redis.setex(
        `alert:${alertId}`,
        86400,
        JSON.stringify(alert)
      );

      return alert;
    }
    return null;
  }

  // Health check
  async getHealthStatus() {
    const metrics = await this.collectSystemMetrics();
    const activeAlerts = await this.getActiveAlerts();
    
    // Calculate health score
    let healthScore = 100;
    
    // Deduct points for high memory usage
    if (metrics.memory.heapUsed / metrics.memory.heapTotal > 0.9) {
      healthScore -= 20;
    }
    
    // Deduct points for active alerts
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = activeAlerts.filter(a => a.severity === 'warning').length;
    healthScore -= (criticalAlerts * 10) + (warningAlerts * 5);
    
    const status = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'degraded' : 'unhealthy';
    
    return {
      status,
      score: Math.max(0, healthScore),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      metrics: {
        memory: metrics.memory,
        activeHandles: metrics.activeHandles,
        activeRequests: metrics.activeRequests
      },
      alerts: {
        total: activeAlerts.length,
        critical: criticalAlerts,
        warning: warningAlerts
      },
      dependencies: {
        redis: await this.checkRedisHealth(),
        database: await this.checkDatabaseHealth()
      }
    };
  }

  // Utility methods
  async incrementCounter(key) {
    await this.redis.incr(`counter:${key}`);
    await this.redis.expire(`counter:${key}`, 86400); // 24 hours
  }

  async updateRunningAverage(key, value) {
    const multi = this.redis.multi();
    multi.lpush(`avg:${key}`, value);
    multi.ltrim(`avg:${key}`, 0, 99); // Keep last 100 values
    multi.expire(`avg:${key}`, 3600); // 1 hour
    await multi.exec();
  }

  async getRunningAverage(key) {
    const values = await this.redis.lrange(`avg:${key}`, 0, -1);
    if (values.length === 0) return 0;
    
    const sum = values.reduce((acc, val) => acc + parseFloat(val), 0);
    return sum / values.length;
  }

  getEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
      return lag;
    });
    return 0; // Placeholder - actual implementation would be more complex
  }

  checkSystemAlerts(metrics) {
    // Memory usage alert
    const memoryUsage = metrics.memory.heapUsed / metrics.memory.heapTotal;
    if (memoryUsage > 0.9) {
      performanceLogger.highMemoryUsage(metrics.memory);
      this.recordAlert('high_memory_usage', 'warning', {
        usage: memoryUsage,
        threshold: 0.9,
        memory: metrics.memory
      });
    }

    // High number of active handles
    if (metrics.activeHandles > 1000) {
      this.recordAlert('high_active_handles', 'warning', {
        count: metrics.activeHandles,
        threshold: 1000
      });
    }
  }

  getPerformanceThreshold(operation) {
    const thresholds = {
      'location_update': 500,
      'geofence_check': 200,
      'route_optimization': 2000,
      'emergency_report': 1000,
      'database_query': 1000
    };
    return thresholds[operation] || 1000;
  }

  getAccuracyBucket(accuracy) {
    if (accuracy <= 5) return 'excellent';
    if (accuracy <= 15) return 'good';
    if (accuracy <= 50) return 'fair';
    return 'poor';
  }

  isCriticalError(error) {
    const criticalErrors = [
      'DatabaseConnectionError',
      'RedisConnectionError',
      'OutOfMemoryError',
      'SecurityError'
    ];
    return criticalErrors.includes(error.name) || error.code === 'ECONNREFUSED';
  }

  async checkRedisHealth() {
    try {
      await this.redis.ping();
      return { status: 'healthy', latency: 0 }; // Would measure actual latency
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async checkDatabaseHealth() {
    try {
      // Would implement actual database health check
      return { status: 'healthy', latency: 0 };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async sendAlertNotification(alert) {
    // Mock notification sending - integrate with actual notification service
    logger.error(`CRITICAL ALERT: ${alert.type}`, alert);
    
    // In production, this would:
    // - Send email to administrators
    // - Send SMS for critical alerts
    // - Post to Slack/Teams
    // - Create incident in monitoring system
  }

  // Cleanup old metrics
  async cleanup() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean up old metrics
    const keys = await this.redis.keys('metrics:*');
    for (const key of keys) {
      const timestamp = parseInt(key.split(':').pop());
      if (timestamp < cutoffTime) {
        await this.redis.del(key);
      }
    }
    
    logger.info('Metrics cleanup completed');
  }
}

module.exports = MonitoringService;