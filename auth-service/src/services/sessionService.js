const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { UserSession } = require('../models');
const { logger } = require('../config/logger');
const { redisUtils } = require('../config/redis');

class SessionService {
  constructor() {
    this.defaultExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.maxSessionsPerUser = 10; // Maximum active sessions per user
  }

  async createSession(userId, deviceInfo, refreshToken, rememberMe = false) {
    try {
      // Hash the refresh token for storage
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

      // Calculate expiry based on rememberMe
      const expiryTime = rememberMe 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        : new Date(Date.now() + this.defaultExpiry); // 7 days

      // Clean up old sessions if user has too many
      await this.cleanupOldSessions(userId);

      // Create new session
      const session = await UserSession.create({
        userId,
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
        pushToken: deviceInfo.pushToken,
        ipAddress: deviceInfo.ipAddress,
        location: deviceInfo.location,
        refreshTokenHash,
        expiresAt: expiryTime,
        lastActiveAt: new Date()
      });

      // Cache session in Redis for faster lookups
      await this.cacheSession(session);

      logger.info('Session created', {
        userId,
        sessionId: session.id,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform
      });

      return session;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw new Error('Failed to create session');
    }
  }

  async validateSession(sessionId, refreshToken) {
    try {
      // Try to get session from cache first
      let session = await this.getSessionFromCache(sessionId);
      
      if (!session) {
        // Fallback to database
        session = await UserSession.findByPk(sessionId);
        if (session) {
          await this.cacheSession(session);
        }
      }

      if (!session) {
        return null;
      }

      // Check if session is active
      if (!session.isActive()) {
        await this.removeSessionFromCache(sessionId);
        return null;
      }

      // Verify refresh token
      const isValidToken = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (!isValidToken) {
        return null;
      }

      // Update last active time
      await session.updateLastActive();
      await this.cacheSession(session);

      return session;
    } catch (error) {
      logger.error('Error validating session:', error);
      return null;
    }
  }

  async revokeSession(sessionId) {
    try {
      const session = await UserSession.findByPk(sessionId);
      if (!session) {
        return false;
      }

      await session.revoke();
      await this.removeSessionFromCache(sessionId);

      logger.info('Session revoked', {
        sessionId,
        userId: session.userId
      });

      return true;
    } catch (error) {
      logger.error('Error revoking session:', error);
      return false;
    }
  }

  async revokeAllUserSessions(userId, excludeSessionId = null) {
    try {
      await UserSession.revokeAllByUserId(userId, excludeSessionId);
      
      // Remove from cache
      const sessions = await UserSession.findAll({
        where: { userId },
        attributes: ['id']
      });

      for (const session of sessions) {
        if (!excludeSessionId || session.id !== excludeSessionId) {
          await this.removeSessionFromCache(session.id);
        }
      }

      logger.info('All user sessions revoked', {
        userId,
        excludeSessionId
      });

      return true;
    } catch (error) {
      logger.error('Error revoking all user sessions:', error);
      return false;
    }
  }

  async getUserSessions(userId) {
    try {
      const sessions = await UserSession.findActiveByUserId(userId);
      
      return sessions.map(session => ({
        id: session.id,
        deviceId: session.deviceId,
        deviceType: session.deviceType,
        platform: session.platform,
        appVersion: session.appVersion,
        ipAddress: session.ipAddress,
        location: session.location,
        lastActiveAt: session.lastActiveAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        current: false // This would need to be determined by comparing with current session
      }));
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      throw new Error('Failed to get user sessions');
    }
  }

  async cleanupOldSessions(userId) {
    try {
      const sessions = await UserSession.findAll({
        where: { userId },
        order: [['lastActiveAt', 'DESC']]
      });

      if (sessions.length >= this.maxSessionsPerUser) {
        // Keep the most recent sessions, revoke the rest
        const sessionsToRevoke = sessions.slice(this.maxSessionsPerUser - 1);
        
        for (const session of sessionsToRevoke) {
          await session.revoke();
          await this.removeSessionFromCache(session.id);
        }

        logger.info('Cleaned up old sessions', {
          userId,
          revokedCount: sessionsToRevoke.length
        });
      }
    } catch (error) {
      logger.error('Error cleaning up old sessions:', error);
    }
  }

  async cleanupExpiredSessions() {
    try {
      const result = await UserSession.cleanupExpired();
      logger.info('Cleaned up expired sessions', { count: result });
      return result;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  async cacheSession(session) {
    try {
      const key = `session:${session.id}`;
      const expiry = Math.floor((session.expiresAt - new Date()) / 1000);
      
      if (expiry > 0) {
        await redisUtils.setex(key, expiry, {
          id: session.id,
          userId: session.userId,
          deviceId: session.deviceId,
          deviceType: session.deviceType,
          platform: session.platform,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
          lastActiveAt: session.lastActiveAt,
          revokedAt: session.revokedAt
        });
      }
    } catch (error) {
      logger.error('Error caching session:', error);
    }
  }

  async getSessionFromCache(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const cached = await redisUtils.get(key);
      
      if (cached) {
        // Convert dates back to Date objects
        cached.expiresAt = new Date(cached.expiresAt);
        cached.lastActiveAt = new Date(cached.lastActiveAt);
        if (cached.revokedAt) {
          cached.revokedAt = new Date(cached.revokedAt);
        }
        
        // Create a mock session object with required methods
        return {
          ...cached,
          isActive: function() {
            return this.revokedAt === null && this.expiresAt > new Date();
          },
          updateLastActive: async function() {
            this.lastActiveAt = new Date();
            // Update in database
            await UserSession.update(
              { lastActiveAt: this.lastActiveAt },
              { where: { id: this.id } }
            );
          }
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting session from cache:', error);
      return null;
    }
  }

  async removeSessionFromCache(sessionId) {
    try {
      const key = `session:${sessionId}`;
      await redisUtils.del(key);
    } catch (error) {
      logger.error('Error removing session from cache:', error);
    }
  }

  async getSessionStats(userId) {
    try {
      const sessions = await UserSession.findAll({
        where: { userId }
      });

      const active = sessions.filter(s => s.isActive()).length;
      const expired = sessions.filter(s => s.isExpired()).length;
      const revoked = sessions.filter(s => s.revokedAt !== null).length;

      const deviceTypes = sessions.reduce((acc, session) => {
        if (session.deviceType) {
          acc[session.deviceType] = (acc[session.deviceType] || 0) + 1;
        }
        return acc;
      }, {});

      const platforms = sessions.reduce((acc, session) => {
        if (session.platform) {
          acc[session.platform] = (acc[session.platform] || 0) + 1;
        }
        return acc;
      }, {});

      return {
        total: sessions.length,
        active,
        expired,
        revoked,
        deviceTypes,
        platforms,
        oldestSession: sessions.length > 0 ? Math.min(...sessions.map(s => s.createdAt)) : null,
        newestSession: sessions.length > 0 ? Math.max(...sessions.map(s => s.createdAt)) : null
      };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      throw new Error('Failed to get session statistics');
    }
  }

  generateDeviceFingerprint(req) {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || '';

    const fingerprint = crypto
      .createHash('sha256')
      .update(`${userAgent}${acceptLanguage}${acceptEncoding}${ipAddress}`)
      .digest('hex');

    return fingerprint.substring(0, 16); // Use first 16 characters
  }

  async detectSuspiciousActivity(userId, currentSession, newDeviceInfo) {
    try {
      const recentSessions = await UserSession.findAll({
        where: {
          userId,
          createdAt: {
            [UserSession.sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      const suspiciousFlags = [];

      // Check for rapid session creation
      if (recentSessions.length > 5) {
        suspiciousFlags.push('rapid_session_creation');
      }

      // Check for different IP addresses
      const uniqueIPs = new Set(recentSessions.map(s => s.ipAddress).filter(Boolean));
      if (uniqueIPs.size > 3) {
        suspiciousFlags.push('multiple_ip_addresses');
      }

      // Check for different platforms
      const uniquePlatforms = new Set(recentSessions.map(s => s.platform).filter(Boolean));
      if (uniquePlatforms.size > 2) {
        suspiciousFlags.push('multiple_platforms');
      }

      // Check for unusual device types
      const mobileDevices = recentSessions.filter(s => s.deviceType === 'mobile').length;
      const webDevices = recentSessions.filter(s => s.deviceType === 'web').length;
      
      if (mobileDevices > 0 && webDevices > 0) {
        suspiciousFlags.push('mixed_device_types');
      }

      return {
        suspicious: suspiciousFlags.length > 0,
        flags: suspiciousFlags,
        riskLevel: suspiciousFlags.length >= 3 ? 'high' : suspiciousFlags.length >= 2 ? 'medium' : 'low'
      };
    } catch (error) {
      logger.error('Error detecting suspicious activity:', error);
      return { suspicious: false, flags: [], riskLevel: 'low' };
    }
  }
}

module.exports = new SessionService();