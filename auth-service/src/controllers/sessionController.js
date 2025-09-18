const sessionService = require('../services/sessionService');
const jwtService = require('../services/jwtService');
const emailService = require('../services/emailService');
const { logger, logAuthEvent, logSecurityEvent } = require('../config/logger');

class SessionController {
  // Get user sessions
  async getSessions(req, res) {
    try {
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      const sessions = await sessionService.getUserSessions(user.id);

      // Mark current session
      const sessionsWithCurrent = sessions.map(session => ({
        ...session,
        current: session.deviceId === currentDeviceId
      }));

      // Sort by last active (current session first, then by last active)
      sessionsWithCurrent.sort((a, b) => {
        if (a.current && !b.current) return -1;
        if (!a.current && b.current) return 1;
        return new Date(b.lastActiveAt) - new Date(a.lastActiveAt);
      });

      res.json({
        success: true,
        data: {
          sessions: sessionsWithCurrent,
          total: sessionsWithCurrent.length
        }
      });
    } catch (error) {
      logger.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sessions',
        errors: ['An error occurred while retrieving your sessions']
      });
    }
  }

  // Revoke a specific session
  async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID required',
          errors: ['Please provide a valid session ID']
        });
      }

      // Get all user sessions to verify ownership
      const userSessions = await sessionService.getUserSessions(user.id);
      const targetSession = userSessions.find(s => s.id === sessionId);

      if (!targetSession) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          errors: ['The specified session was not found or does not belong to you']
        });
      }

      // Check if trying to revoke current session
      if (targetSession.deviceId === currentDeviceId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot revoke current session',
          errors: ['You cannot revoke your current session. Use logout instead.']
        });
      }

      // Revoke the session
      const success = await sessionService.revokeSession(sessionId);

      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to revoke session',
          errors: ['The session could not be revoked']
        });
      }

      // Send notification email
      await emailService.sendSessionRevoked(user, {
        deviceType: targetSession.deviceType,
        platform: targetSession.platform,
        location: targetSession.location
      });

      logAuthEvent('session_revoked', user.id, {
        revokedSessionId: sessionId,
        deviceType: targetSession.deviceType,
        platform: targetSession.platform
      }, req);

      res.json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      logger.error('Revoke session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to revoke session',
        errors: ['An error occurred while revoking the session']
      });
    }
  }

  // Revoke all sessions except current
  async revokeAllSessions(req, res) {
    try {
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      // Get current session info for exclusion
      const userSessions = await sessionService.getUserSessions(user.id);
      const currentSession = userSessions.find(s => s.deviceId === currentDeviceId);
      const currentSessionId = currentSession?.id;

      // Revoke all sessions except current
      await sessionService.revokeAllUserSessions(user.id, currentSessionId);

      // Send notification email
      await emailService.sendAllSessionsRevoked(user);

      logAuthEvent('all_sessions_revoked', user.id, {
        excludedSessionId: currentSessionId,
        totalRevoked: userSessions.length - 1
      }, req);

      res.json({
        success: true,
        message: 'All other sessions have been revoked successfully'
      });
    } catch (error) {
      logger.error('Revoke all sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to revoke sessions',
        errors: ['An error occurred while revoking sessions']
      });
    }
  }

  // Get session statistics
  async getSessionStats(req, res) {
    try {
      const user = req.user;
      const stats = await sessionService.getSessionStats(user.id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get session stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve session statistics',
        errors: ['An error occurred while retrieving session statistics']
      });
    }
  }

  // Update current session info
  async updateCurrentSession(req, res) {
    try {
      const { pushToken, location } = req.body;
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      if (!currentDeviceId) {
        return res.status(400).json({
          success: false,
          message: 'No active session found',
          errors: ['Unable to identify current session']
        });
      }

      // Find current session
      const userSessions = await sessionService.getUserSessions(user.id);
      const currentSession = userSessions.find(s => s.deviceId === currentDeviceId);

      if (!currentSession) {
        return res.status(404).json({
          success: false,
          message: 'Current session not found',
          errors: ['Unable to find current session']
        });
      }

      // Update session with new info
      const { UserSession } = require('../models');
      const session = await UserSession.findByPk(currentSession.id);
      
      if (session) {
        const updateData = {};
        if (pushToken) updateData.pushToken = pushToken;
        if (location) updateData.location = location;
        updateData.lastActiveAt = new Date();

        await session.update(updateData);
      }

      logAuthEvent('session_updated', user.id, {
        sessionId: currentSession.id,
        updates: { pushToken: !!pushToken, location: !!location }
      }, req);

      res.json({
        success: true,
        message: 'Session updated successfully'
      });
    } catch (error) {
      logger.error('Update session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session',
        errors: ['An error occurred while updating the session']
      });
    }
  }

  // Check for suspicious sessions
  async checkSuspiciousSessions(req, res) {
    try {
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      const userSessions = await sessionService.getUserSessions(user.id);
      const suspiciousSessions = [];

      for (const session of userSessions) {
        if (session.deviceId === currentDeviceId) continue;

        const suspiciousActivity = await sessionService.detectSuspiciousActivity(
          user.id,
          session,
          {
            deviceType: session.deviceType,
            platform: session.platform,
            ipAddress: session.ipAddress,
            location: session.location
          }
        );

        if (suspiciousActivity.suspicious) {
          suspiciousSessions.push({
            ...session,
            suspiciousFlags: suspiciousActivity.flags,
            riskLevel: suspiciousActivity.riskLevel
          });
        }
      }

      if (suspiciousSessions.length > 0) {
        logSecurityEvent('suspicious_sessions_detected', 'medium', {
          userId: user.id,
          suspiciousCount: suspiciousSessions.length,
          totalSessions: userSessions.length
        }, req);
      }

      res.json({
        success: true,
        data: {
          suspiciousSessions,
          count: suspiciousSessions.length,
          totalSessions: userSessions.length
        }
      });
    } catch (error) {
      logger.error('Check suspicious sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check suspicious sessions',
        errors: ['An error occurred while checking for suspicious activity']
      });
    }
  }

  // Get current session details
  async getCurrentSession(req, res) {
    try {
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      if (!currentDeviceId) {
        return res.status(400).json({
          success: false,
          message: 'No active session found',
          errors: ['Unable to identify current session']
        });
      }

      const userSessions = await sessionService.getUserSessions(user.id);
      const currentSession = userSessions.find(s => s.deviceId === currentDeviceId);

      if (!currentSession) {
        return res.status(404).json({
          success: false,
          message: 'Current session not found',
          errors: ['Unable to find current session details']
        });
      }

      // Add additional info
      const sessionDetails = {
        ...currentSession,
        tokenExpiresAt: new Date(req.token.exp * 1000).toISOString(),
        tokenIssuedAt: new Date(req.token.iat * 1000).toISOString(),
        current: true
      };

      res.json({
        success: true,
        data: sessionDetails
      });
    } catch (error) {
      logger.error('Get current session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve current session',
        errors: ['An error occurred while retrieving session details']
      });
    }
  }

  // Extend current session (refresh activity)
  async extendSession(req, res) {
    try {
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      if (!currentDeviceId) {
        return res.status(400).json({
          success: false,
          message: 'No active session found',
          errors: ['Unable to identify current session']
        });
      }

      const userSessions = await sessionService.getUserSessions(user.id);
      const currentSession = userSessions.find(s => s.deviceId === currentDeviceId);

      if (!currentSession) {
        return res.status(404).json({
          success: false,
          message: 'Current session not found'
        });
      }

      // Update last active time
      const { UserSession } = require('../models');
      const session = await UserSession.findByPk(currentSession.id);
      
      if (session) {
        await session.update({
          lastActiveAt: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Session extended successfully',
        data: {
          lastActiveAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Extend session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to extend session',
        errors: ['An error occurred while extending the session']
      });
    }
  }
}

module.exports = new SessionController();