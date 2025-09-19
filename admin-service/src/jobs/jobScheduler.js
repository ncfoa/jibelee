const cron = require('node-cron');
const logger = require('../config/logger');

class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Job scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.scheduleJobs();
    logger.info('Job scheduler started');
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('Job scheduler is not running');
      return;
    }

    // Stop all scheduled jobs
    this.jobs.forEach((task, name) => {
      task.stop();
      logger.info(`Stopped job: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    logger.info('Job scheduler stopped');
  }

  scheduleJobs() {
    // Daily metrics aggregation job - runs every day at 1 AM
    this.scheduleJob('daily-metrics-aggregation', '0 1 * * *', async () => {
      await this.runDailyMetricsAggregation();
    });

    // Cleanup old activity logs - runs every Sunday at 2 AM
    this.scheduleJob('cleanup-activity-logs', '0 2 * * 0', async () => {
      await this.runActivityLogCleanup();
    });

    // Cleanup expired exports - runs every hour
    this.scheduleJob('cleanup-expired-exports', '0 * * * *', async () => {
      await this.runExpiredExportsCleanup();
    });

    // System health check - runs every 5 minutes
    this.scheduleJob('system-health-check', '*/5 * * * *', async () => {
      await this.runSystemHealthCheck();
    });

    // Backup cleanup - runs daily at 3 AM
    this.scheduleJob('backup-cleanup', '0 3 * * *', async () => {
      await this.runBackupCleanup();
    });

    // Generate daily reports - runs every day at 6 AM
    this.scheduleJob('daily-reports', '0 6 * * *', async () => {
      await this.runDailyReports();
    });

    // Update dispute SLA alerts - runs every 30 minutes
    this.scheduleJob('dispute-sla-alerts', '*/30 * * * *', async () => {
      await this.runDisputeSLAAlerts();
    });

    // Auto backup (if enabled) - runs daily at 2 AM
    if (process.env.ENABLE_AUTO_BACKUP === 'true') {
      this.scheduleJob('auto-backup', '0 2 * * *', async () => {
        await this.runAutoBackup();
      });
    }

    logger.info(`Scheduled ${this.jobs.size} jobs`);
  }

  scheduleJob(name, schedule, task) {
    try {
      const cronJob = cron.schedule(schedule, async () => {
        logger.info(`Starting job: ${name}`);
        const startTime = Date.now();

        try {
          await task();
          const duration = Date.now() - startTime;
          logger.info(`Completed job: ${name} (${duration}ms)`);
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(`Failed job: ${name} (${duration}ms)`, error);
        }
      }, {
        scheduled: false,
        timezone: process.env.TZ || 'UTC'
      });

      cronJob.start();
      this.jobs.set(name, cronJob);
      logger.info(`Scheduled job: ${name} with schedule: ${schedule}`);
    } catch (error) {
      logger.error(`Failed to schedule job: ${name}`, error);
    }
  }

  // Job implementations
  async runDailyMetricsAggregation() {
    const { DailyMetric } = require('../models');
    
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0];

      // This would typically fetch data from various services
      // For now, we'll create placeholder metrics
      const metricTypes = ['user', 'delivery', 'financial', 'system'];
      
      for (const metricType of metricTypes) {
        await DailyMetric.createOrUpdate(dateString, metricType, {
          // Placeholder data - in real implementation, this would fetch from actual services
          new_users: metricType === 'user' ? Math.floor(Math.random() * 100) + 50 : 0,
          active_users: metricType === 'user' ? Math.floor(Math.random() * 1000) + 500 : 0,
          completed_deliveries: metricType === 'delivery' ? Math.floor(Math.random() * 200) + 100 : 0,
          total_revenue: metricType === 'financial' ? Math.random() * 10000 + 5000 : 0,
          api_calls: metricType === 'system' ? Math.floor(Math.random() * 100000) + 50000 : 0,
          is_final: true
        });
      }

      logger.info(`Daily metrics aggregated for ${dateString}`);
    } catch (error) {
      logger.error('Daily metrics aggregation failed:', error);
      throw error;
    }
  }

  async runActivityLogCleanup() {
    const { AdminActivityLog } = require('../models');
    
    try {
      const retentionDays = parseInt(process.env.ACTIVITY_LOG_RETENTION_DAYS || 90);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deletedCount = await AdminActivityLog.destroy({
        where: {
          created_at: {
            [require('sequelize').Op.lt]: cutoffDate
          },
          severity: {
            [require('sequelize').Op.notIn]: ['high', 'critical']
          }
        }
      });

      logger.info(`Cleaned up ${deletedCount} old activity log entries`);
    } catch (error) {
      logger.error('Activity log cleanup failed:', error);
      throw error;
    }
  }

  async runExpiredExportsCleanup() {
    const { DataExport } = require('../models');
    
    try {
      const result = await DataExport.cleanup({ dryRun: false });
      
      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} expired data exports`);
      }

      if (result.errors && result.errors.length > 0) {
        logger.warn('Some export cleanup operations failed:', result.errors);
      }
    } catch (error) {
      logger.error('Expired exports cleanup failed:', error);
      throw error;
    }
  }

  async runSystemHealthCheck() {
    try {
      const { sequelize } = require('../config/database');
      const redisService = require('../config/redis');

      const health = {
        database: 'unknown',
        redis: 'unknown',
        timestamp: new Date()
      };

      // Check database
      try {
        await sequelize.authenticate();
        health.database = 'healthy';
      } catch (error) {
        health.database = 'unhealthy';
        logger.error('Database health check failed:', error);
      }

      // Check Redis
      try {
        await redisService.set('health_check', 'ok', 10);
        const result = await redisService.get('health_check');
        health.redis = result === 'ok' ? 'healthy' : 'unhealthy';
      } catch (error) {
        health.redis = 'unhealthy';
        logger.error('Redis health check failed:', error);
      }

      // Store health status
      await redisService.set('system_health', health, 300); // 5 minutes TTL

      // Log unhealthy services
      if (health.database === 'unhealthy' || health.redis === 'unhealthy') {
        logger.warn('System health check found unhealthy services:', health);
      }
    } catch (error) {
      logger.error('System health check failed:', error);
      throw error;
    }
  }

  async runBackupCleanup() {
    const { SystemBackup } = require('../models');
    
    try {
      const result = await SystemBackup.cleanup({ dryRun: false });
      
      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} expired backups`);
      }

      if (result.errors && result.errors.length > 0) {
        logger.warn('Some backup cleanup operations failed:', result.errors);
      }
    } catch (error) {
      logger.error('Backup cleanup failed:', error);
      throw error;
    }
  }

  async runDailyReports() {
    try {
      // This would generate and send daily reports to administrators
      logger.info('Daily reports generation - placeholder implementation');
      
      // In a real implementation, this would:
      // 1. Generate various reports (user activity, financial summary, etc.)
      // 2. Send reports to relevant administrators
      // 3. Store reports for later access
    } catch (error) {
      logger.error('Daily reports generation failed:', error);
      throw error;
    }
  }

  async runDisputeSLAAlerts() {
    const { Dispute } = require('../models');
    
    try {
      // Find overdue disputes
      const overdueDisputes = await Dispute.findOverdue();
      
      if (overdueDisputes.length > 0) {
        logger.warn(`Found ${overdueDisputes.length} overdue disputes`);
        
        // In a real implementation, this would send alerts to administrators
        // For now, we'll just log the information
        overdueDisputes.forEach(dispute => {
          logger.warn(`Overdue dispute: ${dispute.case_number} (${dispute.getDaysOpen()} days old)`);
        });
      }
    } catch (error) {
      logger.error('Dispute SLA alerts failed:', error);
      throw error;
    }
  }

  async runAutoBackup() {
    const { SystemBackup } = require('../models');
    
    try {
      // Create an automated backup
      const backup = await SystemBackup.create({
        backup_type: 'full',
        description: 'Automated daily backup',
        include_uploads: true,
        include_logs: false,
        is_scheduled: true,
        schedule_name: 'daily_backup',
        created_by: '00000000-0000-0000-0000-000000000000' // System user
      });

      logger.info(`Started automated backup: ${backup.id}`);
      
      // In a real implementation, this would trigger the actual backup process
      // For now, we'll just mark it as completed
      setTimeout(async () => {
        await backup.markCompleted({
          sizeBytes: Math.floor(Math.random() * 1000000000) + 1000000000, // 1-2 GB
          filePath: `/backups/auto_backup_${Date.now()}.tar.gz`,
          checksum: 'placeholder_checksum'
        });
      }, 5000);
    } catch (error) {
      logger.error('Auto backup failed:', error);
      throw error;
    }
  }

  // Manual job execution methods
  async executeJob(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job not found: ${jobName}`);
    }

    logger.info(`Manually executing job: ${jobName}`);
    // Jobs are executed through the cron scheduler, so we can't manually trigger them
    // In a real implementation, you might want to extract the job logic to separate functions
  }

  getJobStatus() {
    const status = {
      isRunning: this.isRunning,
      jobCount: this.jobs.size,
      jobs: []
    };

    this.jobs.forEach((task, name) => {
      status.jobs.push({
        name,
        running: task.running || false,
        lastExecution: task.lastDate || null,
        nextExecution: task.nextDate || null
      });
    });

    return status;
  }
}

module.exports = JobScheduler;