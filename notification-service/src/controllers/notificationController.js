const { logger } = require('../config/logger');
const NotificationService = require('../services/notificationService');
const { Notification, NotificationTemplate, DeviceToken } = require('../models');
const { validationResult } = require('express-validator');

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  // Send single notification
  async sendNotification(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        userId,
        templateId,
        channels = ['push'],
        variables = {},
        priority = 'normal',
        scheduleAt,
        metadata = {}
      } = req.body;

      const result = await this.notificationService.sendNotification({
        userId,
        templateId,
        channels,
        variables,
        priority,
        scheduleAt: scheduleAt ? new Date(scheduleAt) : null,
        metadata
      });

      logger.info('Notification sent successfully', {
        notificationId: result.notificationId,
        userId,
        channels: result.totalChannels
      });

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Send notification failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Send custom notification without template
  async sendCustomNotification(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        userId,
        type,
        title,
        message,
        data = {},
        priority = 'normal'
      } = req.body;

      const customContent = {};
      customContent[type] = {
        title,
        message,
        body: message,
        data
      };

      const result = await this.notificationService.sendNotification({
        userId,
        channels: [type],
        variables: {},
        priority,
        customContent
      });

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Send custom notification failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Send bulk notifications
  async sendBulkNotifications(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { notifications } = req.body;

      const result = await this.notificationService.sendBulkNotifications(notifications);

      logger.info('Bulk notifications processed', {
        total: result.total,
        successful: result.successful,
        failed: result.failed
      });

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Bulk notification send failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get user notifications
  async getUserNotifications(req, res) {
    try {
      const { userId } = req.params;
      const {
        type,
        category,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        includeRead = true
      } = req.query;

      const options = {
        type,
        category,
        status,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        includeRead: includeRead === 'true'
      };

      const result = await this.notificationService.getUserNotifications(userId, options);

      // Get unread count
      const unreadCount = await Notification.getUnreadCount(userId, category);

      res.status(200).json({
        success: true,
        data: {
          notifications: result.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: result.count,
            totalPages: Math.ceil(result.count / parseInt(limit))
          },
          summary: {
            unread: unreadCount,
            total: result.count
          }
        }
      });

    } catch (error) {
      logger.error('Get user notifications failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Mark notification as read
  async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const { userId } = req.user; // From auth middleware
      const { readAt } = req.body;

      const result = await this.notificationService.markAsRead(
        notificationId,
        userId,
        readAt ? new Date(readAt) : new Date()
      );

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Mark as read failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Mark notification as clicked
  async markAsClicked(req, res) {
    try {
      const { notificationId } = req.params;
      const { userId } = req.user; // From auth middleware
      const { clickedAt, actionTaken } = req.body;

      const result = await this.notificationService.markAsClicked(
        notificationId,
        userId,
        clickedAt ? new Date(clickedAt) : new Date(),
        actionTaken
      );

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Mark as clicked failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    try {
      const { userId } = req.params;
      const { category, type } = req.body;

      const result = await Notification.markAllAsRead(userId, category, type);

      logger.info('Marked all notifications as read', {
        userId,
        category,
        type,
        updated: result[0]
      });

      res.status(200).json({
        success: true,
        data: {
          markedAsRead: result[0],
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Mark all as read failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete notification
  async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const { userId } = req.user; // From auth middleware

      const notification = await Notification.findOne({
        where: { id: notificationId, userId }
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await notification.destroy();

      logger.info('Notification deleted', {
        notificationId,
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          notificationId,
          deleted: true,
          deletedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Delete notification failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Register device token
  async registerDeviceToken(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.user; // From auth middleware
      const {
        token,
        platform,
        deviceId,
        appVersion
      } = req.body;

      // Validate token format
      if (!DeviceToken.validateToken(token, platform)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token format for platform'
        });
      }

      const deviceToken = await DeviceToken.registerToken(
        userId,
        token,
        platform,
        deviceId,
        appVersion
      );

      logger.info('Device token registered', {
        userId,
        platform,
        tokenId: deviceToken.id
      });

      res.status(201).json({
        success: true,
        data: {
          tokenId: deviceToken.id,
          platform,
          active: deviceToken.active,
          registeredAt: deviceToken.createdAt
        }
      });

    } catch (error) {
      logger.error('Register device token failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update device token
  async updateDeviceToken(req, res) {
    try {
      const { tokenId } = req.params;
      const { userId } = req.user; // From auth middleware
      const { active } = req.body;

      const deviceToken = await DeviceToken.findOne({
        where: { id: tokenId, userId }
      });

      if (!deviceToken) {
        return res.status(404).json({
          success: false,
          message: 'Device token not found'
        });
      }

      if (active !== undefined) {
        if (active) {
          await deviceToken.activate();
        } else {
          await deviceToken.deactivate();
        }
      }

      res.status(200).json({
        success: true,
        data: {
          tokenId: deviceToken.id,
          active: deviceToken.active,
          updatedAt: deviceToken.updatedAt
        }
      });

    } catch (error) {
      logger.error('Update device token failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Test notification
  async testNotification(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        userId,
        channel,
        templateId,
        templateData = {},
        testMode = true
      } = req.body;

      // For test mode, we might want to use a different approach
      if (testMode) {
        // Generate preview without actually sending
        const template = await NotificationTemplate.findByPk(templateId);
        if (!template) {
          return res.status(404).json({
            success: false,
            message: 'Template not found'
          });
        }

        const content = await this.notificationService.templateEngine.generateContent(
          template,
          channel,
          templateData,
          'en'
        );

        res.status(200).json({
          success: true,
          data: {
            testNotificationId: `test_${Date.now()}`,
            status: 'preview',
            channel,
            preview: content
          }
        });
      } else {
        // Actually send the test notification
        const result = await this.notificationService.sendNotification({
          userId,
          templateId,
          channels: [channel],
          variables: templateData,
          priority: 'normal',
          metadata: { test: true }
        });

        res.status(200).json({
          success: true,
          data: {
            testNotificationId: result.notificationId,
            status: 'sent',
            channel,
            sentAt: new Date()
          }
        });
      }

    } catch (error) {
      logger.error('Test notification failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get notification statistics
  async getNotificationStats(req, res) {
    try {
      const { userId } = req.params;
      const { days = 30 } = req.query;

      const stats = await this.notificationService.getNotificationStats(userId, parseInt(days));

      res.status(200).json({
        success: true,
        data: {
          userId,
          period: `${days} days`,
          statistics: stats
        }
      });

    } catch (error) {
      logger.error('Get notification stats failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get service health
  async getHealth(req, res) {
    try {
      const serviceInfo = this.notificationService.getServiceInfo();
      
      // Test provider connections
      const providerHealth = {};
      for (const provider of serviceInfo.providers) {
        try {
          const testResult = await this.notificationService.providers[provider.channel].testConnection();
          providerHealth[provider.channel] = {
            healthy: true,
            ...testResult
          };
        } catch (error) {
          providerHealth[provider.channel] = {
            healthy: false,
            error: error.message
          };
        }
      }

      res.status(200).json({
        success: true,
        data: {
          service: 'notification-service',
          status: 'healthy',
          timestamp: new Date(),
          version: serviceInfo.version,
          providers: providerHealth
        }
      });

    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Service unhealthy',
        error: error.message
      });
    }
  }
}

module.exports = NotificationController;