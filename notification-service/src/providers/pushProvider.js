const admin = require('firebase-admin');
const { pushLogger } = require('../config/logger');
const { firebase: firebaseConfig } = require('../config/providers');
const { DeviceToken } = require('../models');

class PushProvider {
  constructor() {
    this.channel = 'push';
    this.initialized = false;
    this.fcm = null;
    this.initialize();
  }

  initialize() {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(firebaseConfig),
          projectId: firebaseConfig.project_id
        });
      }
      
      this.fcm = admin.messaging();
      this.initialized = true;
      pushLogger.info('Firebase Cloud Messaging initialized successfully');
    } catch (error) {
      pushLogger.error('Failed to initialize Firebase Cloud Messaging:', error);
      this.initialized = false;
    }
  }

  async send(userId, content) {
    if (!this.initialized) {
      throw new Error('Push provider not initialized');
    }

    try {
      // Get user's active device tokens
      const deviceTokens = await DeviceToken.findActiveByUserId(userId);
      
      if (deviceTokens.length === 0) {
        throw new Error('No active device tokens found for user');
      }

      const results = [];
      const invalidTokens = [];

      // Send to each device token
      for (const deviceToken of deviceTokens) {
        try {
          const message = this.buildMessage(content, deviceToken);
          const response = await this.fcm.send(message);
          
          results.push({
            tokenId: deviceToken.id,
            platform: deviceToken.platform,
            success: true,
            messageId: response,
            deviceId: deviceToken.deviceId
          });

          // Update token last used time
          await deviceToken.markAsUsed();
          
          pushLogger.info(`Push notification sent successfully`, {
            userId,
            tokenId: deviceToken.id,
            platform: deviceToken.platform,
            messageId: response
          });

        } catch (error) {
          pushLogger.error(`Failed to send push to token ${deviceToken.id}:`, error);
          
          results.push({
            tokenId: deviceToken.id,
            platform: deviceToken.platform,
            success: false,
            error: error.message,
            errorCode: error.code
          });

          // Handle invalid tokens
          if (this.isInvalidTokenError(error)) {
            invalidTokens.push(deviceToken.id);
            pushLogger.warn(`Invalid token detected: ${deviceToken.id}`, {
              userId,
              error: error.message
            });
          }
        }
      }

      // Deactivate invalid tokens
      if (invalidTokens.length > 0) {
        await this.deactivateTokens(invalidTokens);
      }

      const successfulSends = results.filter(r => r.success);
      
      if (successfulSends.length === 0) {
        throw new Error('Failed to deliver push notification to any device');
      }

      return {
        externalId: successfulSends[0].messageId,
        deliveredDevices: successfulSends.length,
        totalDevices: deviceTokens.length,
        results,
        invalidTokensRemoved: invalidTokens.length
      };

    } catch (error) {
      pushLogger.error('Push notification send failed:', error);
      throw error;
    }
  }

  async sendBulk(notifications) {
    if (!this.initialized) {
      throw new Error('Push provider not initialized');
    }

    try {
      const messages = [];
      const tokenMap = new Map();

      // Build messages for bulk send
      for (const notification of notifications) {
        const { userId, content } = notification;
        const deviceTokens = await DeviceToken.findActiveByUserId(userId);
        
        for (const deviceToken of deviceTokens) {
          const message = this.buildMessage(content, deviceToken);
          messages.push(message);
          tokenMap.set(message.token, {
            userId,
            tokenId: deviceToken.id,
            platform: deviceToken.platform,
            deviceId: deviceToken.deviceId
          });
        }
      }

      if (messages.length === 0) {
        return { successful: 0, failed: 0, results: [] };
      }

      // Send bulk messages
      const response = await this.fcm.sendAll(messages);
      const results = [];
      const invalidTokens = [];

      response.responses.forEach((result, index) => {
        const message = messages[index];
        const tokenInfo = tokenMap.get(message.token);
        
        if (result.success) {
          results.push({
            ...tokenInfo,
            success: true,
            messageId: result.messageId
          });
        } else {
          results.push({
            ...tokenInfo,
            success: false,
            error: result.error.message,
            errorCode: result.error.code
          });

          if (this.isInvalidTokenError(result.error)) {
            invalidTokens.push(tokenInfo.tokenId);
          }
        }
      });

      // Deactivate invalid tokens
      if (invalidTokens.length > 0) {
        await this.deactivateTokens(invalidTokens);
      }

      pushLogger.info(`Bulk push notification completed`, {
        total: messages.length,
        successful: response.successCount,
        failed: response.failureCount,
        invalidTokensRemoved: invalidTokens.length
      });

      return {
        successful: response.successCount,
        failed: response.failureCount,
        results,
        invalidTokensRemoved: invalidTokens.length
      };

    } catch (error) {
      pushLogger.error('Bulk push notification failed:', error);
      throw error;
    }
  }

  buildMessage(content, deviceToken) {
    const baseMessage = {
      token: deviceToken.token,
      notification: {
        title: content.title,
        body: content.body || content.message
      },
      data: this.convertDataToStrings(content.data || {})
    };

    // Add platform-specific configurations
    if (deviceToken.platform === 'ios') {
      baseMessage.apns = {
        payload: {
          aps: {
            sound: content.sound || 'default',
            badge: content.badge || 1,
            'mutable-content': 1,
            'content-available': 1,
            category: content.category
          }
        }
      };

      // Add custom data to APNS payload
      if (content.data) {
        Object.entries(content.data).forEach(([key, value]) => {
          baseMessage.apns.payload[key] = value;
        });
      }

    } else if (deviceToken.platform === 'android') {
      baseMessage.android = {
        notification: {
          icon: content.icon || 'ic_notification',
          color: content.color || '#007AFF',
          sound: content.sound || 'default',
          clickAction: content.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
          channelId: content.channelId || 'default'
        },
        priority: this.mapPriority(content.priority),
        collapseKey: content.collapseKey,
        ttl: content.ttl ? `${content.ttl}s` : '86400s' // 24 hours default
      };

      // Add custom data
      if (content.data) {
        baseMessage.android.data = this.convertDataToStrings(content.data);
      }

    } else if (deviceToken.platform === 'web') {
      baseMessage.webpush = {
        notification: {
          title: content.title,
          body: content.body || content.message,
          icon: content.icon || '/icon-192x192.png',
          badge: content.badge || '/badge-72x72.png',
          image: content.image,
          tag: content.tag,
          requireInteraction: content.requireInteraction || false,
          silent: content.silent || false
        },
        fcmOptions: {
          link: content.clickAction || content.deepLink
        }
      };

      // Add custom data
      if (content.data) {
        baseMessage.webpush.data = content.data;
      }
    }

    return baseMessage;
  }

  convertDataToStrings(data) {
    const stringData = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        stringData[key] = value;
      } else {
        stringData[key] = JSON.stringify(value);
      }
    }
    return stringData;
  }

  mapPriority(priority) {
    switch (priority) {
      case 'urgent':
      case 'high':
        return 'high';
      case 'normal':
        return 'normal';
      case 'low':
        return 'normal'; // FCM doesn't have low priority
      default:
        return 'normal';
    }
  }

  isInvalidTokenError(error) {
    const invalidTokenCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/unregistered',
      'messaging/invalid-argument'
    ];
    
    return invalidTokenCodes.includes(error.code);
  }

  async deactivateTokens(tokenIds) {
    try {
      await DeviceToken.update(
        { active: false },
        {
          where: {
            id: tokenIds
          }
        }
      );
      
      pushLogger.info(`Deactivated ${tokenIds.length} invalid device tokens`);
    } catch (error) {
      pushLogger.error('Failed to deactivate invalid tokens:', error);
    }
  }

  async validateToken(token, platform) {
    if (!this.initialized) {
      return false;
    }

    try {
      // Try to send a dry run message
      const testMessage = {
        token,
        notification: {
          title: 'Test',
          body: 'Test message'
        },
        dryRun: true
      };

      await this.fcm.send(testMessage);
      return true;
    } catch (error) {
      return !this.isInvalidTokenError(error);
    }
  }

  async subscribeToTopic(tokens, topic) {
    if (!this.initialized) {
      throw new Error('Push provider not initialized');
    }

    try {
      const response = await this.fcm.subscribeToTopic(tokens, topic);
      pushLogger.info(`Subscribed ${response.successCount} tokens to topic: ${topic}`);
      return response;
    } catch (error) {
      pushLogger.error(`Failed to subscribe to topic ${topic}:`, error);
      throw error;
    }
  }

  async unsubscribeFromTopic(tokens, topic) {
    if (!this.initialized) {
      throw new Error('Push provider not initialized');
    }

    try {
      const response = await this.fcm.unsubscribeFromTopic(tokens, topic);
      pushLogger.info(`Unsubscribed ${response.successCount} tokens from topic: ${topic}`);
      return response;
    } catch (error) {
      pushLogger.error(`Failed to unsubscribe from topic ${topic}:`, error);
      throw error;
    }
  }

  async sendToTopic(topic, content) {
    if (!this.initialized) {
      throw new Error('Push provider not initialized');
    }

    try {
      const message = {
        topic,
        notification: {
          title: content.title,
          body: content.body || content.message
        },
        data: this.convertDataToStrings(content.data || {}),
        android: {
          priority: this.mapPriority(content.priority),
          notification: {
            icon: content.icon || 'ic_notification',
            color: content.color || '#007AFF'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: content.sound || 'default',
              badge: content.badge || 1
            }
          }
        }
      };

      const response = await this.fcm.send(message);
      pushLogger.info(`Topic notification sent successfully`, {
        topic,
        messageId: response
      });

      return {
        externalId: response,
        topic
      };

    } catch (error) {
      pushLogger.error(`Failed to send topic notification to ${topic}:`, error);
      throw error;
    }
  }

  async getDeliveryStatus(messageId) {
    // FCM doesn't provide delivery status API
    // This would need to be implemented via webhooks or analytics
    return {
      messageId,
      status: 'unknown',
      message: 'FCM does not provide delivery status API'
    };
  }

  getProviderInfo() {
    return {
      name: 'Firebase Cloud Messaging',
      channel: this.channel,
      initialized: this.initialized,
      supportedPlatforms: ['ios', 'android', 'web'],
      features: [
        'single_send',
        'bulk_send',
        'topic_messaging',
        'token_validation',
        'platform_specific_config'
      ]
    };
  }
}

module.exports = PushProvider;