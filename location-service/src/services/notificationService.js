const { logger, locationLogger } = require('../utils/logger');

class NotificationService {
  constructor() {
    this.webhooks = new Map();
    this.subscribers = new Map();
  }

  /**
   * Send geofence event notification
   */
  async sendGeofenceNotification(userId, notificationData) {
    try {
      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'geofence_event',
        userId,
        title: this.getGeofenceNotificationTitle(notificationData),
        message: this.getGeofenceNotificationMessage(notificationData),
        data: notificationData,
        timestamp: new Date().toISOString(),
        channels: ['push', 'in_app']
      };

      // Send push notification
      await this.sendPushNotification(userId, notification);
      
      // Send in-app notification
      await this.sendInAppNotification(userId, notification);

      // Log notification
      logger.info('Geofence notification sent', {
        notificationId: notification.id,
        userId,
        geofenceType: notificationData.geofenceType,
        eventType: notificationData.eventType
      });

      return notification;
    } catch (error) {
      logger.error('Failed to send geofence notification:', error);
      throw error;
    }
  }

  /**
   * Send emergency alert notification
   */
  async sendEmergencyAlert(emergencyData) {
    try {
      const notification = {
        id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'emergency_alert',
        title: 'Emergency Reported',
        message: `${emergencyData.emergencyType} emergency reported`,
        data: emergencyData,
        timestamp: new Date().toISOString(),
        priority: emergencyData.severity === 'critical' ? 'high' : 'normal',
        channels: ['push', 'sms', 'email', 'in_app']
      };

      // Send to user
      if (emergencyData.userId) {
        await this.sendMultiChannelNotification(emergencyData.userId, notification);
      }

      // Send to emergency contacts
      if (emergencyData.severity === 'critical' || emergencyData.severity === 'high') {
        await this.notifyEmergencyContacts(emergencyData);
        await this.notifyAdministrators(emergencyData);
      }

      locationLogger.emergencyReported(emergencyData);

      return notification;
    } catch (error) {
      logger.error('Failed to send emergency alert:', error);
      throw error;
    }
  }

  /**
   * Send location tracking status notification
   */
  async sendTrackingStatusNotification(userId, status, data) {
    try {
      const notification = {
        id: `tracking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'tracking_status',
        userId,
        title: this.getTrackingStatusTitle(status),
        message: this.getTrackingStatusMessage(status, data),
        data,
        timestamp: new Date().toISOString(),
        channels: ['push', 'in_app']
      };

      await this.sendPushNotification(userId, notification);
      await this.sendInAppNotification(userId, notification);

      return notification;
    } catch (error) {
      logger.error('Failed to send tracking status notification:', error);
      throw error;
    }
  }

  /**
   * Send delivery milestone notification
   */
  async sendMilestoneNotification(deliveryId, milestone, participants) {
    try {
      const notification = {
        id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'delivery_milestone',
        title: this.getMilestoneTitle(milestone),
        message: this.getMilestoneMessage(milestone),
        data: {
          deliveryId,
          milestone,
          timestamp: new Date().toISOString()
        },
        channels: ['push', 'in_app']
      };

      // Send to all participants (customer, traveler)
      for (const userId of participants) {
        await this.sendMultiChannelNotification(userId, {
          ...notification,
          userId
        });
      }

      return notification;
    } catch (error) {
      logger.error('Failed to send milestone notification:', error);
      throw error;
    }
  }

  /**
   * Send ETA update notification
   */
  async sendETAUpdateNotification(deliveryId, etaData, participants) {
    try {
      const notification = {
        id: `eta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'eta_update',
        title: 'Delivery Time Update',
        message: this.getETAUpdateMessage(etaData),
        data: {
          deliveryId,
          ...etaData,
          timestamp: new Date().toISOString()
        },
        channels: ['push', 'in_app']
      };

      // Send to participants
      for (const userId of participants) {
        await this.sendMultiChannelNotification(userId, {
          ...notification,
          userId
        });
      }

      return notification;
    } catch (error) {
      logger.error('Failed to send ETA update notification:', error);
      throw error;
    }
  }

  /**
   * Send privacy alert notification
   */
  async sendPrivacyAlert(userId, alertType, data) {
    try {
      const notification = {
        id: `privacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'privacy_alert',
        userId,
        title: this.getPrivacyAlertTitle(alertType),
        message: this.getPrivacyAlertMessage(alertType, data),
        data: {
          alertType,
          ...data,
          timestamp: new Date().toISOString()
        },
        channels: ['email', 'in_app']
      };

      await this.sendEmailNotification(userId, notification);
      await this.sendInAppNotification(userId, notification);

      return notification;
    } catch (error) {
      logger.error('Failed to send privacy alert:', error);
      throw error;
    }
  }

  // Channel-specific notification methods

  async sendPushNotification(userId, notification) {
    // Mock push notification - integrate with FCM/APNS
    logger.info('Push notification sent', {
      userId,
      notificationId: notification.id,
      title: notification.title
    });

    // In production, this would:
    // 1. Get user's device tokens from database
    // 2. Send to FCM for Android devices
    // 3. Send to APNS for iOS devices
    // 4. Handle delivery receipts and failures
    
    return {
      success: true,
      messageId: `push_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  async sendSMSNotification(userId, notification) {
    // Mock SMS notification - integrate with Twilio/AWS SNS
    logger.info('SMS notification sent', {
      userId,
      notificationId: notification.id,
      message: notification.message
    });

    // In production, this would:
    // 1. Get user's phone number from database
    // 2. Send SMS via Twilio/AWS SNS
    // 3. Handle delivery status
    
    return {
      success: true,
      messageId: `sms_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  async sendEmailNotification(userId, notification) {
    // Mock email notification - integrate with SendGrid/AWS SES
    logger.info('Email notification sent', {
      userId,
      notificationId: notification.id,
      subject: notification.title
    });

    // In production, this would:
    // 1. Get user's email from database
    // 2. Render email template
    // 3. Send via SendGrid/AWS SES
    // 4. Track opens and clicks
    
    return {
      success: true,
      messageId: `email_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  async sendInAppNotification(userId, notification) {
    // Mock in-app notification - would store in database and use WebSocket
    logger.info('In-app notification sent', {
      userId,
      notificationId: notification.id,
      type: notification.type
    });

    // In production, this would:
    // 1. Store notification in database
    // 2. Send via WebSocket to connected clients
    // 3. Show badge counts in app
    
    return {
      success: true,
      messageId: `inapp_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  async sendWebhookNotification(webhookUrl, notification) {
    try {
      // Mock webhook notification - would make HTTP request
      logger.info('Webhook notification sent', {
        webhookUrl,
        notificationId: notification.id,
        type: notification.type
      });

      // In production, this would:
      // 1. Make HTTP POST request to webhook URL
      // 2. Include proper headers and authentication
      // 3. Handle retries and failures
      // 4. Verify webhook signatures
      
      return {
        success: true,
        statusCode: 200,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Webhook notification failed:', {
        webhookUrl,
        error: error.message
      });
      throw error;
    }
  }

  // Multi-channel notification
  async sendMultiChannelNotification(userId, notification) {
    const results = {};

    for (const channel of notification.channels) {
      try {
        switch (channel) {
          case 'push':
            results.push = await this.sendPushNotification(userId, notification);
            break;
          case 'sms':
            results.sms = await this.sendSMSNotification(userId, notification);
            break;
          case 'email':
            results.email = await this.sendEmailNotification(userId, notification);
            break;
          case 'in_app':
            results.inApp = await this.sendInAppNotification(userId, notification);
            break;
        }
      } catch (error) {
        logger.error(`Failed to send ${channel} notification:`, error);
        results[channel] = { success: false, error: error.message };
      }
    }

    return results;
  }

  // Emergency-specific notifications
  async notifyEmergencyContacts(emergencyData) {
    // Mock emergency contact notification
    logger.warn('Emergency contacts notified', {
      emergencyId: emergencyData.id,
      emergencyType: emergencyData.emergencyType,
      severity: emergencyData.severity
    });

    // In production, this would:
    // 1. Get emergency contacts from user profile
    // 2. Send SMS and email to all contacts
    // 3. Include location and emergency details
    // 4. Provide emergency services contact info
  }

  async notifyAdministrators(emergencyData) {
    // Mock admin notification
    logger.error('Administrators notified of emergency', {
      emergencyId: emergencyData.id,
      emergencyType: emergencyData.emergencyType,
      severity: emergencyData.severity
    });

    // In production, this would:
    // 1. Send alerts to on-call administrators
    // 2. Create incident in monitoring system
    // 3. Send to admin dashboard
    // 4. Trigger escalation procedures for critical emergencies
  }

  // Message generation helpers
  getGeofenceNotificationTitle(data) {
    const titles = {
      pickup: {
        enter: 'Arrived at Pickup Location',
        exit: 'Left Pickup Location',
        dwell: 'Waiting at Pickup Location'
      },
      delivery: {
        enter: 'Arrived at Delivery Location',
        exit: 'Left Delivery Location',
        dwell: 'At Delivery Location'
      }
    };

    return titles[data.geofenceType]?.[data.eventType] || 'Location Update';
  }

  getGeofenceNotificationMessage(data) {
    const messages = {
      pickup: {
        enter: 'Your traveler has arrived at the pickup location.',
        exit: 'Your traveler has left the pickup location with your item.',
        dwell: 'Your traveler is waiting at the pickup location.'
      },
      delivery: {
        enter: 'Your traveler has arrived at the delivery location.',
        exit: 'Your item has been delivered successfully.',
        dwell: 'Your traveler is at the delivery location.'
      }
    };

    return messages[data.geofenceType]?.[data.eventType] || 'Location event occurred.';
  }

  getTrackingStatusTitle(status) {
    const titles = {
      started: 'Tracking Started',
      stopped: 'Tracking Stopped',
      paused: 'Tracking Paused',
      resumed: 'Tracking Resumed'
    };
    return titles[status] || 'Tracking Update';
  }

  getTrackingStatusMessage(status, data) {
    const messages = {
      started: 'Location tracking has been started for your delivery.',
      stopped: `Location tracking has been stopped. Total distance: ${data.totalDistance}km`,
      paused: 'Location tracking has been paused.',
      resumed: 'Location tracking has been resumed.'
    };
    return messages[status] || 'Tracking status has changed.';
  }

  getMilestoneTitle(milestone) {
    const titles = {
      pickup_completed: 'Item Picked Up',
      halfway_point: 'Halfway There',
      delivery_completed: 'Item Delivered',
      state_border_crossed: 'State Border Crossed'
    };
    return titles[milestone.type] || 'Delivery Milestone';
  }

  getMilestoneMessage(milestone) {
    const messages = {
      pickup_completed: 'Your item has been picked up and is on its way.',
      halfway_point: 'Your delivery is halfway to its destination.',
      delivery_completed: 'Your item has been successfully delivered.',
      state_border_crossed: `Your delivery has entered ${milestone.description || 'a new state'}.`
    };
    return messages[milestone.type] || 'A delivery milestone has been reached.';
  }

  getETAUpdateMessage(etaData) {
    if (etaData.delayMinutes > 0) {
      return `Delivery delayed by ${etaData.delayMinutes} minutes due to ${etaData.reason}.`;
    } else if (etaData.delayMinutes < 0) {
      return `Delivery is ${Math.abs(etaData.delayMinutes)} minutes ahead of schedule.`;
    }
    return 'Delivery is on time.';
  }

  getPrivacyAlertTitle(alertType) {
    const titles = {
      data_exported: 'Data Export Completed',
      data_deleted: 'Data Deletion Completed',
      settings_updated: 'Privacy Settings Updated',
      data_shared: 'Location Data Shared'
    };
    return titles[alertType] || 'Privacy Alert';
  }

  getPrivacyAlertMessage(alertType, data) {
    const messages = {
      data_exported: 'Your location data export is ready for download.',
      data_deleted: 'Your location data has been permanently deleted.',
      settings_updated: 'Your privacy settings have been updated.',
      data_shared: `Your location data was shared with ${data.recipient}.`
    };
    return messages[alertType] || 'A privacy-related event has occurred.';
  }

  // Subscription management
  async subscribe(userId, eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Map());
    }
    this.subscribers.get(eventType).set(userId, callback);
  }

  async unsubscribe(userId, eventType) {
    if (this.subscribers.has(eventType)) {
      this.subscribers.get(eventType).delete(userId);
    }
  }

  // Webhook management
  async registerWebhook(userId, url, events) {
    this.webhooks.set(userId, { url, events });
    logger.info('Webhook registered', { userId, url, events });
  }

  async unregisterWebhook(userId) {
    this.webhooks.delete(userId);
    logger.info('Webhook unregistered', { userId });
  }
}

module.exports = NotificationService;