const { Server } = require('socket.io');
const { redis, publisher } = require('../config/redis');
const { logger } = require('../config/logger');
const { socket: socketConfig } = require('../config/providers');

class InAppProvider {
  constructor(httpServer) {
    this.channel = 'in_app';
    this.io = null;
    this.connectedUsers = new Map(); // userId -> Set of socket ids
    this.socketUsers = new Map(); // socket id -> userId
    this.httpServer = httpServer;
    this.initialize();
  }

  initialize() {
    try {
      if (this.httpServer) {
        this.io = new Server(this.httpServer, {
          ...socketConfig,
          adapter: this.createRedisAdapter()
        });

        this.setupEventHandlers();
        logger.info('Socket.IO server initialized successfully');
      } else {
        logger.warn('HTTP server not provided for Socket.IO initialization');
      }
    } catch (error) {
      logger.error('Failed to initialize Socket.IO:', error);
    }
  }

  createRedisAdapter() {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = publisher;
      const subClient = publisher.duplicate();
      
      return createAdapter(pubClient, subClient);
    } catch (error) {
      logger.warn('Redis adapter not available, using memory adapter:', error.message);
      return undefined;
    }
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', async (data) => {
        try {
          const { userId, token } = data;
          
          // Verify JWT token (implement your auth logic)
          const isValid = await this.verifyToken(token);
          
          if (isValid && userId) {
            // Associate socket with user
            this.socketUsers.set(socket.id, userId);
            
            if (!this.connectedUsers.has(userId)) {
              this.connectedUsers.set(userId, new Set());
            }
            this.connectedUsers.get(userId).add(socket.id);
            
            // Join user-specific room
            socket.join(`user_${userId}`);
            
            socket.emit('authenticated', { success: true, userId });
            logger.info(`User authenticated: ${userId} on socket ${socket.id}`);
            
            // Send any pending notifications
            await this.sendPendingNotifications(userId);
            
          } else {
            socket.emit('authentication_error', { message: 'Invalid token or user ID' });
            logger.warn(`Authentication failed for socket ${socket.id}`);
          }
        } catch (error) {
          logger.error('Authentication error:', error);
          socket.emit('authentication_error', { message: 'Authentication failed' });
        }
      });

      // Handle notification acknowledgment
      socket.on('notification_received', (data) => {
        const { notificationId, timestamp } = data;
        logger.info(`Notification acknowledged: ${notificationId} by socket ${socket.id}`);
        
        // Update notification status in database
        this.updateNotificationStatus(notificationId, 'delivered', timestamp);
      });

      // Handle notification read
      socket.on('notification_read', (data) => {
        const { notificationId, timestamp } = data;
        const userId = this.socketUsers.get(socket.id);
        
        if (userId) {
          logger.info(`Notification read: ${notificationId} by user ${userId}`);
          this.updateNotificationStatus(notificationId, 'read', timestamp);
        }
      });

      // Handle notification click
      socket.on('notification_clicked', (data) => {
        const { notificationId, action, timestamp } = data;
        const userId = this.socketUsers.get(socket.id);
        
        if (userId) {
          logger.info(`Notification clicked: ${notificationId} by user ${userId}`);
          this.updateNotificationStatus(notificationId, 'clicked', timestamp, { action });
        }
      });

      // Handle user presence updates
      socket.on('presence_update', (data) => {
        const { status } = data; // online, away, busy, offline
        const userId = this.socketUsers.get(socket.id);
        
        if (userId) {
          this.updateUserPresence(userId, status);
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        
        const userId = this.socketUsers.get(socket.id);
        if (userId) {
          // Remove socket from user's set
          const userSockets = this.connectedUsers.get(userId);
          if (userSockets) {
            userSockets.delete(socket.id);
            
            // If user has no more sockets, remove from connected users
            if (userSockets.size === 0) {
              this.connectedUsers.delete(userId);
              this.updateUserPresence(userId, 'offline');
            }
          }
        }
        
        this.socketUsers.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    // Handle Redis pub/sub for distributed notifications
    this.setupRedisSubscription();
  }

  setupRedisSubscription() {
    try {
      const subscriber = redis.duplicate();
      
      subscriber.subscribe('notifications:in_app', (err) => {
        if (err) {
          logger.error('Failed to subscribe to Redis notifications channel:', err);
        } else {
          logger.info('Subscribed to Redis notifications channel');
        }
      });

      subscriber.on('message', (channel, message) => {
        if (channel === 'notifications:in_app') {
          try {
            const notification = JSON.parse(message);
            this.deliverNotificationFromRedis(notification);
          } catch (error) {
            logger.error('Failed to process Redis notification message:', error);
          }
        }
      });

    } catch (error) {
      logger.warn('Redis subscription not available:', error.message);
    }
  }

  async send(userId, content) {
    try {
      const notification = {
        id: content.notificationId || this.generateNotificationId(),
        userId,
        type: 'in_app',
        title: content.title,
        message: content.message || content.body,
        data: content.data || {},
        timestamp: new Date().toISOString(),
        priority: content.priority || 'normal',
        category: content.category,
        icon: content.icon,
        color: content.color,
        actions: content.actions || [],
        persistent: content.persistent || false,
        expiresAt: content.expiresAt,
        sound: content.sound,
        badge: content.badge
      };

      // Check if user is connected
      const userSockets = this.connectedUsers.get(userId);
      
      if (userSockets && userSockets.size > 0) {
        // User is online, send immediately
        const delivered = await this.deliverToConnectedUser(userId, notification);
        
        if (delivered) {
          logger.info(`In-app notification delivered to connected user: ${userId}`, {
            notificationId: notification.id,
            socketCount: userSockets.size
          });

          return {
            externalId: notification.id,
            status: 'delivered',
            recipient: userId,
            deliveredSockets: userSockets.size,
            timestamp: new Date()
          };
        }
      }

      // User is offline, store for later delivery
      if (notification.persistent) {
        await this.storePendingNotification(userId, notification);
        
        logger.info(`In-app notification stored for offline user: ${userId}`, {
          notificationId: notification.id
        });

        return {
          externalId: notification.id,
          status: 'stored',
          recipient: userId,
          timestamp: new Date()
        };
      }

      // Non-persistent notification for offline user
      logger.info(`In-app notification discarded for offline user: ${userId}`, {
        notificationId: notification.id,
        persistent: false
      });

      return {
        externalId: notification.id,
        status: 'discarded',
        recipient: userId,
        reason: 'User offline and notification not persistent',
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('In-app notification send failed:', error);
      throw error;
    }
  }

  async deliverToConnectedUser(userId, notification) {
    try {
      const userSockets = this.connectedUsers.get(userId);
      if (!userSockets || userSockets.size === 0) {
        return false;
      }

      // Send to user's room
      this.io.to(`user_${userId}`).emit('notification', notification);

      // Also publish to Redis for other server instances
      try {
        await publisher.publish('notifications:in_app', JSON.stringify({
          ...notification,
          targetUserId: userId,
          fromInstance: process.pid
        }));
      } catch (redisError) {
        logger.warn('Failed to publish notification to Redis:', redisError.message);
      }

      return true;
    } catch (error) {
      logger.error('Failed to deliver notification to connected user:', error);
      return false;
    }
  }

  async deliverNotificationFromRedis(notification) {
    const { targetUserId, fromInstance } = notification;
    
    // Don't process notifications from this instance
    if (fromInstance === process.pid) {
      return;
    }

    const userSockets = this.connectedUsers.get(targetUserId);
    if (userSockets && userSockets.size > 0) {
      this.io.to(`user_${targetUserId}`).emit('notification', notification);
    }
  }

  async sendBulk(notifications) {
    const results = [];
    
    try {
      for (const notification of notifications) {
        try {
          const result = await this.send(notification.userId, notification.content);
          results.push({
            userId: notification.userId,
            success: true,
            ...result
          });
        } catch (error) {
          results.push({
            userId: notification.userId,
            success: false,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      logger.info(`Bulk in-app notifications completed`, {
        total: notifications.length,
        successful,
        failed
      });

      return {
        successful,
        failed,
        results
      };

    } catch (error) {
      logger.error('Bulk in-app notification send failed:', error);
      throw error;
    }
  }

  async storePendingNotification(userId, notification) {
    try {
      const key = `pending_notifications:${userId}`;
      const notificationData = JSON.stringify(notification);
      
      // Store in Redis list with expiration
      await redis.lpush(key, notificationData);
      await redis.expire(key, 7 * 24 * 60 * 60); // 7 days
      
      // Limit number of pending notifications per user
      await redis.ltrim(key, 0, 99); // Keep only latest 100
      
    } catch (error) {
      logger.error('Failed to store pending notification:', error);
    }
  }

  async sendPendingNotifications(userId) {
    try {
      const key = `pending_notifications:${userId}`;
      const pendingNotifications = await redis.lrange(key, 0, -1);
      
      if (pendingNotifications.length > 0) {
        logger.info(`Sending ${pendingNotifications.length} pending notifications to user: ${userId}`);
        
        for (const notificationData of pendingNotifications) {
          try {
            const notification = JSON.parse(notificationData);
            
            // Check if notification is still valid (not expired)
            if (notification.expiresAt) {
              const expiresAt = new Date(notification.expiresAt);
              if (expiresAt < new Date()) {
                continue; // Skip expired notification
              }
            }
            
            // Send notification
            this.io.to(`user_${userId}`).emit('notification', notification);
            
          } catch (parseError) {
            logger.error('Failed to parse pending notification:', parseError);
          }
        }
        
        // Clear pending notifications after sending
        await redis.del(key);
      }
      
    } catch (error) {
      logger.error('Failed to send pending notifications:', error);
    }
  }

  async updateNotificationStatus(notificationId, status, timestamp, metadata = {}) {
    try {
      // Update notification in database (implement based on your models)
      // const { Notification } = require('../models');
      // await Notification.update(
      //   { 
      //     status, 
      //     [`${status}At`]: new Date(timestamp),
      //     metadata: { ...metadata }
      //   },
      //   { where: { id: notificationId } }
      // );
      
      logger.info(`Notification status updated: ${notificationId} -> ${status}`);
      
    } catch (error) {
      logger.error('Failed to update notification status:', error);
    }
  }

  async updateUserPresence(userId, status) {
    try {
      const key = `user_presence:${userId}`;
      const presenceData = {
        status,
        lastSeen: new Date().toISOString(),
        socketCount: this.connectedUsers.get(userId)?.size || 0
      };
      
      await redis.setex(key, 300, JSON.stringify(presenceData)); // 5 minutes TTL
      
      // Broadcast presence update to user's contacts/relevant users
      this.io.emit('user_presence_update', {
        userId,
        status,
        timestamp: presenceData.lastSeen
      });
      
    } catch (error) {
      logger.error('Failed to update user presence:', error);
    }
  }

  async getUserPresence(userId) {
    try {
      const key = `user_presence:${userId}`;
      const presenceData = await redis.get(key);
      
      if (presenceData) {
        return JSON.parse(presenceData);
      }
      
      return {
        status: 'offline',
        lastSeen: null,
        socketCount: 0
      };
      
    } catch (error) {
      logger.error('Failed to get user presence:', error);
      return { status: 'unknown', lastSeen: null, socketCount: 0 };
    }
  }

  async getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  async getConnectionStats() {
    return {
      totalConnections: this.socketUsers.size,
      uniqueUsers: this.connectedUsers.size,
      averageConnectionsPerUser: this.connectedUsers.size > 0 
        ? this.socketUsers.size / this.connectedUsers.size 
        : 0
    };
  }

  async verifyToken(token) {
    try {
      // Implement JWT token verification
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return !!decoded;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return false;
    }
  }

  generateNotificationId() {
    return `in_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async testConnection() {
    try {
      const stats = await this.getConnectionStats();
      return {
        socketio: true,
        stats
      };
    } catch (error) {
      logger.error('In-app provider connection test failed:', error);
      return {
        socketio: false,
        error: error.message
      };
    }
  }

  getProviderInfo() {
    return {
      name: 'In-App Notification Provider',
      channel: this.channel,
      initialized: !!this.io,
      features: [
        'real_time_delivery',
        'offline_storage',
        'presence_tracking',
        'acknowledgments',
        'bulk_send',
        'redis_clustering'
      ],
      stats: {
        connectedSockets: this.socketUsers.size,
        connectedUsers: this.connectedUsers.size
      }
    };
  }

  async cleanup() {
    if (this.io) {
      this.io.close();
      logger.info('Socket.IO server closed');
    }
  }
}

module.exports = InAppProvider;