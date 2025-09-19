const crypto = require('crypto');
const { logger, notificationLogger } = require('../config/logger');
const { NotificationCache } = require('../config/redis');
const TemplateEngine = require('../templates/templateEngine');
const PushProvider = require('../providers/pushProvider');
const EmailProvider = require('../providers/emailProvider');
const SMSProvider = require('../providers/smsProvider');
const InAppProvider = require('../providers/inAppProvider');
const { 
  Notification, 
  NotificationTemplate, 
  NotificationPreference, 
  DeviceToken,
  NotificationAnalytics 
} = require('../models');

class NotificationService {
  constructor(httpServer = null) {
    this.templateEngine = new TemplateEngine();
    this.pushProvider = new PushProvider();
    this.emailProvider = new EmailProvider();
    this.smsProvider = new SMSProvider();
    this.inAppProvider = new InAppProvider(httpServer);
    
    this.providers = {
      push: this.pushProvider,
      email: this.emailProvider,
      sms: this.smsProvider,
      in_app: this.inAppProvider
    };

    notificationLogger.info('Notification service initialized');
  }

  async sendNotification(notificationData) {
    const {
      userId,
      templateId,
      channels = ['push'],
      variables = {},
      priority = 'normal',
      scheduleAt,
      metadata = {},
      customContent = null
    } = notificationData;

    try {
      notificationLogger.info('Processing notification request', {
        userId,
        templateId,
        channels,
        priority
      });

      // Get user preferences
      const userPreferences = await this.getUserPreferences(userId);
      
      // Filter channels based on user preferences and quiet hours
      const allowedChannels = await this.filterChannelsByPreferences(
        channels, 
        userPreferences, 
        priority
      );
      
      if (allowedChannels.length === 0) {
        throw new Error('User has disabled all requested notification channels');
      }

      // Get template if templateId is provided
      let template = null;
      if (templateId) {
        template = await this.getTemplate(templateId);
        if (!template) {
          throw new Error(`Template not found: ${templateId}`);
        }
      }

      // Check for duplicate notification
      if (await this.isDuplicateNotification(userId, templateId, variables)) {
        notificationLogger.warn('Duplicate notification detected, skipping', {
          userId,
          templateId
        });
        return {
          notificationId: null,
          status: 'skipped',
          reason: 'duplicate_notification'
        };
      }

      const results = [];
      const notificationId = this.generateNotificationId();

      // Send to each allowed channel
      for (const channel of allowedChannels) {
        try {
          const result = await this.sendToChannel({
            notificationId,
            channel,
            userId,
            template,
            variables,
            userPreferences,
            scheduleAt,
            priority,
            metadata,
            customContent
          });
          
          results.push({ channel, success: true, ...result });
          
          // Track analytics
          await this.trackAnalytics(notificationId, 'sent', {
            channel,
            userId,
            templateId,
            category: template?.category
          });
          
        } catch (error) {
          notificationLogger.error(`Failed to send ${channel} notification:`, error);
          results.push({ 
            channel, 
            success: false, 
            error: error.message 
          });

          // Track failure
          await this.trackAnalytics(notificationId, 'failed', {
            channel,
            userId,
            templateId,
            error: error.message
          });

          // Try fallback for critical notifications
          if (priority === 'urgent' || priority === 'high') {
            await this.tryFallbackChannel(channel, userId, template, variables, userPreferences);
          }
        }
      }

      const successfulChannels = results.filter(r => r.success).length;
      
      notificationLogger.info('Notification processing completed', {
        notificationId,
        userId,
        totalChannels: allowedChannels.length,
        successfulChannels
      });

      return {
        notificationId,
        results,
        totalChannels: allowedChannels.length,
        successfulChannels,
        status: successfulChannels > 0 ? 'sent' : 'failed'
      };

    } catch (error) {
      notificationLogger.error('Notification send failed:', error);
      throw error;
    }
  }

  async sendToChannel({
    notificationId,
    channel,
    userId,
    template,
    variables,
    userPreferences,
    scheduleAt,
    priority,
    metadata,
    customContent
  }) {
    try {
      const provider = this.providers[channel];
      if (!provider) {
        throw new Error(`No provider found for channel: ${channel}`);
      }

      // Generate content
      let content;
      if (customContent && customContent[channel]) {
        content = customContent[channel];
      } else if (template) {
        content = await this.templateEngine.generateContent(
          template, 
          channel, 
          variables, 
          userPreferences.language || 'en'
        );
      } else {
        throw new Error('No template or custom content provided');
      }

      // Add notification metadata
      content.notificationId = notificationId;
      content.userId = userId;
      content.category = template?.category;
      content.priority = priority;

      // Check quiet hours for non-urgent notifications
      if (priority !== 'urgent' && this.isInQuietHours(userPreferences, channel)) {
        scheduleAt = this.getNextAllowedTime(userPreferences, channel);
      }

      // Create notification record
      const notificationRecord = await this.createNotificationRecord({
        id: notificationId,
        userId,
        templateId: template?.id,
        notificationType: channel,
        category: template?.category || 'system',
        title: content.title || content.subject,
        message: content.message || content.body,
        channelData: content,
        priority,
        metadata,
        scheduleAt
      });

      // Send via provider
      let result;
      if (scheduleAt && scheduleAt > new Date()) {
        result = await this.scheduleNotification(notificationRecord, scheduleAt, provider, content);
      } else {
        result = await this.sendImmediate(notificationRecord, provider, content);
      }

      return result;

    } catch (error) {
      notificationLogger.error(`Channel send failed for ${channel}:`, error);
      throw error;
    }
  }

  async sendImmediate(notificationRecord, provider, content) {
    try {
      const result = await provider.send(notificationRecord.userId, content);
      
      // Update notification record
      await notificationRecord.update({
        status: 'delivered',
        deliveredAt: new Date(),
        externalId: result.externalId
      });

      // Track delivery analytics
      await this.trackAnalytics(notificationRecord.id, 'delivered', {
        provider: result.provider,
        externalId: result.externalId
      });

      return {
        notificationId: notificationRecord.id,
        externalId: result.externalId,
        status: 'delivered',
        provider: result.provider
      };

    } catch (error) {
      // Update notification with failure
      await notificationRecord.update({
        status: 'failed',
        failureReason: error.message
      });

      throw error;
    }
  }

  async scheduleNotification(notificationRecord, scheduleAt, provider, content) {
    try {
      // Add to notification queue
      const { NotificationQueue } = require('../models');
      await NotificationQueue.enqueue({
        notificationId: notificationRecord.id,
        provider: provider.channel,
        content
      }, scheduleAt);

      notificationLogger.info('Notification scheduled', {
        notificationId: notificationRecord.id,
        scheduleAt,
        channel: provider.channel
      });

      return {
        notificationId: notificationRecord.id,
        status: 'scheduled',
        scheduleAt,
        provider: provider.channel
      };

    } catch (error) {
      notificationLogger.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  async createNotificationRecord({
    id,
    userId,
    templateId,
    notificationType,
    category,
    title,
    message,
    channelData,
    priority,
    metadata,
    scheduleAt
  }) {
    try {
      const data = {};
      data[`${notificationType}Data`] = channelData;

      const notification = await Notification.create({
        id,
        userId,
        templateId,
        notificationType,
        category,
        title,
        message,
        ...data,
        priority,
        metadata,
        sentAt: scheduleAt || new Date()
      });

      return notification;

    } catch (error) {
      notificationLogger.error('Failed to create notification record:', error);
      throw error;
    }
  }

  async getUserPreferences(userId) {
    try {
      // Try cache first
      let preferences = await NotificationCache.getCachedPreferences(userId);
      
      if (!preferences) {
        // Get from database
        const [dbPreferences] = await NotificationPreference.findOrCreateDefault(userId);
        preferences = dbPreferences.toJSON();
        
        // Cache for future use
        await NotificationCache.cacheUserPreferences(userId, preferences);
      }

      return preferences;

    } catch (error) {
      notificationLogger.error('Failed to get user preferences:', error);
      
      // Return default preferences on error
      return {
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
        language: 'en',
        timezone: 'UTC'
      };
    }
  }

  async getTemplate(templateId) {
    try {
      // Try cache first
      let template = await NotificationCache.getCachedTemplate(templateId);
      
      if (!template) {
        // Get from database
        const dbTemplate = await NotificationTemplate.findByPk(templateId);
        if (dbTemplate) {
          template = dbTemplate.toJSON();
          await NotificationCache.cacheTemplate(templateId, template);
        }
      }

      return template;

    } catch (error) {
      notificationLogger.error('Failed to get template:', error);
      return null;
    }
  }

  async filterChannelsByPreferences(requestedChannels, preferences, priority) {
    const allowedChannels = [];

    for (const channel of requestedChannels) {
      // Check if channel is enabled
      if (!preferences[`${channel}Enabled`]) {
        continue;
      }

      // For urgent notifications, override some preferences
      if (priority === 'urgent') {
        allowedChannels.push(channel);
        continue;
      }

      // Check category preferences
      const categoryPrefs = preferences[`${channel}Categories`];
      if (categoryPrefs && Object.keys(categoryPrefs).length > 0) {
        // If specific categories are set, check them
        // For now, allow all since we don't have category in this context
        allowedChannels.push(channel);
      } else {
        // If no specific category preferences, allow
        allowedChannels.push(channel);
      }
    }

    return allowedChannels;
  }

  isInQuietHours(preferences, channel) {
    if (channel !== 'push' || !preferences.pushQuietHours) {
      return false;
    }

    const quietHours = preferences.pushQuietHours;
    if (!quietHours.enabled) {
      return false;
    }

    const moment = require('moment-timezone');
    const userTime = moment().tz(preferences.timezone || 'UTC');
    const currentHour = userTime.hour();
    const currentMinute = userTime.minute();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = (quietHours.start || '22:00').split(':').map(Number);
    const [endHour, endMinute] = (quietHours.end || '08:00').split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes < endMinutes) {
      return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
    } else {
      return currentTimeMinutes >= startMinutes || currentTimeMinutes <= endMinutes;
    }
  }

  getNextAllowedTime(preferences, channel) {
    if (channel !== 'push' || !preferences.pushQuietHours) {
      return new Date();
    }

    const moment = require('moment-timezone');
    const userTime = moment().tz(preferences.timezone || 'UTC');
    const endTime = preferences.pushQuietHours.end || '08:00';
    
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const nextAllowed = userTime.clone()
      .hour(endHour)
      .minute(endMinute)
      .second(0)
      .millisecond(0);

    if (nextAllowed.isBefore(userTime)) {
      nextAllowed.add(1, 'day');
    }

    return nextAllowed.utc().toDate();
  }

  async isDuplicateNotification(userId, templateId, variables) {
    if (!templateId) return false;

    try {
      const hash = this.generateVariableHash(variables);
      return await NotificationCache.isDuplicateNotification(userId, templateId, hash);
    } catch (error) {
      notificationLogger.error('Duplicate check failed:', error);
      return false;
    }
  }

  generateVariableHash(variables) {
    const sortedVars = JSON.stringify(variables, Object.keys(variables).sort());
    return crypto.createHash('md5').update(sortedVars).digest('hex');
  }

  generateNotificationId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async tryFallbackChannel(failedChannel, userId, template, variables, userPreferences) {
    try {
      const fallbackMap = {
        push: 'in_app',
        email: 'push',
        sms: 'push',
        in_app: 'push'
      };

      const fallbackChannel = fallbackMap[failedChannel];
      if (!fallbackChannel || !userPreferences[`${fallbackChannel}Enabled`]) {
        return;
      }

      notificationLogger.info(`Attempting fallback from ${failedChannel} to ${fallbackChannel}`, {
        userId
      });

      await this.sendToChannel({
        notificationId: this.generateNotificationId(),
        channel: fallbackChannel,
        userId,
        template,
        variables,
        userPreferences,
        priority: 'high',
        metadata: { fallbackFrom: failedChannel }
      });

    } catch (error) {
      notificationLogger.error('Fallback channel also failed:', error);
    }
  }

  async trackAnalytics(notificationId, eventType, eventData = {}) {
    try {
      await NotificationAnalytics.trackEvent(notificationId, eventType, eventData);
    } catch (error) {
      notificationLogger.error('Analytics tracking failed:', error);
    }
  }

  async sendBulkNotifications(notifications) {
    const results = [];
    const batchSize = 50;

    try {
      notificationLogger.info(`Processing bulk notifications: ${notifications.length}`);

      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(notification => this.sendNotification(notification))
        );

        batchResults.forEach((result, index) => {
          const originalIndex = i + index;
          if (result.status === 'fulfilled') {
            results.push({
              index: originalIndex,
              success: true,
              ...result.value
            });
          } else {
            results.push({
              index: originalIndex,
              success: false,
              error: result.reason.message
            });
          }
        });

        // Add delay between batches to avoid overwhelming providers
        if (i + batchSize < notifications.length) {
          await this.delay(1000);
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      notificationLogger.info('Bulk notification processing completed', {
        total: notifications.length,
        successful,
        failed
      });

      return {
        total: notifications.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      notificationLogger.error('Bulk notification processing failed:', error);
      throw error;
    }
  }

  async markAsRead(notificationId, userId, readAt = new Date()) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, userId }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead(readAt);
      await this.trackAnalytics(notificationId, 'opened', { readAt });

      notificationLogger.info('Notification marked as read', {
        notificationId,
        userId
      });

      return { success: true, readAt };

    } catch (error) {
      notificationLogger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  async markAsClicked(notificationId, userId, clickedAt = new Date(), action = null) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, userId }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsClicked(clickedAt);
      await this.trackAnalytics(notificationId, 'clicked', { clickedAt, action });

      notificationLogger.info('Notification marked as clicked', {
        notificationId,
        userId,
        action
      });

      return { success: true, clickedAt, action };

    } catch (error) {
      notificationLogger.error('Failed to mark notification as clicked:', error);
      throw error;
    }
  }

  async getUserNotifications(userId, options = {}) {
    try {
      const notifications = await Notification.findByUser(userId, options);
      return notifications;
    } catch (error) {
      notificationLogger.error('Failed to get user notifications:', error);
      throw error;
    }
  }

  async getNotificationStats(userId) {
    try {
      const stats = await Notification.getEngagementStats(userId);
      return stats;
    } catch (error) {
      notificationLogger.error('Failed to get notification stats:', error);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    try {
      await this.emailProvider.cleanup();
      await this.inAppProvider.cleanup();
      notificationLogger.info('Notification service cleanup completed');
    } catch (error) {
      notificationLogger.error('Cleanup failed:', error);
    }
  }

  getServiceInfo() {
    return {
      name: 'Notification Service',
      version: '1.0.0',
      providers: Object.keys(this.providers).map(key => ({
        channel: key,
        ...this.providers[key].getProviderInfo()
      })),
      features: [
        'multi_channel',
        'templating',
        'user_preferences',
        'quiet_hours',
        'scheduling',
        'analytics',
        'bulk_operations',
        'fallback_channels'
      ]
    };
  }
}

module.exports = NotificationService;