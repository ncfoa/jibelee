const logger = require('../config/logger');
const jwtService = require('../config/jwt');
const { AdminUser } = require('../models');

class DashboardSocket {
  constructor(io) {
    this.io = io;
    this.connectedAdmins = new Map();
    this.setupSocketHandlers();
    this.startMetricsStreaming();
    
    logger.info('Dashboard Socket service initialized');
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.debug('New socket connection', { socketId: socket.id });

      // Handle admin authentication
      socket.on('admin-join', async (data) => {
        try {
          await this.handleAdminJoin(socket, data);
        } catch (error) {
          logger.error('Admin join error:', error);
          socket.emit('auth-error', { message: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Handle metric subscriptions
      socket.on('subscribe-metrics', (metricTypes) => {
        this.handleMetricSubscription(socket, metricTypes);
      });

      // Handle unsubscribe
      socket.on('unsubscribe-metrics', (metricTypes) => {
        this.handleMetricUnsubscription(socket, metricTypes);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket error:', { socketId: socket.id, error: error.message });
      });
    });
  }

  async handleAdminJoin(socket, data) {
    const { token, adminToken } = data;
    let adminUser = null;

    // Try to authenticate with either Bearer token or Admin token
    if (token) {
      const decoded = jwtService.verifyAdminToken(token);
      adminUser = await AdminUser.findByPk(decoded.adminId);
    } else if (adminToken) {
      const decoded = jwtService.verifyAdminApiToken(adminToken);
      adminUser = await AdminUser.findByPk(decoded.adminId);
    } else {
      throw new Error('No authentication token provided');
    }

    if (!adminUser || !adminUser.is_active) {
      throw new Error('Invalid or inactive admin user');
    }

    // Store admin info
    this.connectedAdmins.set(socket.id, {
      adminId: adminUser.id,
      userId: adminUser.user_id,
      role: adminUser.role,
      permissions: adminUser.permissions || [],
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    // Join admin room
    socket.join('admin-dashboard');
    
    // Join role-specific room
    socket.join(`role-${adminUser.role}`);

    // Send initial dashboard data
    const dashboardData = await this.getInitialDashboardData();
    socket.emit('dashboard-data', dashboardData);

    // Send connection confirmation
    socket.emit('admin-joined', {
      success: true,
      adminId: adminUser.id,
      role: adminUser.role,
      connectedAt: new Date()
    });

    logger.info('Admin joined dashboard', {
      adminId: adminUser.id,
      role: adminUser.role,
      socketId: socket.id
    });

    // Update admin's last activity
    await adminUser.update({ last_login_at: new Date() });
  }

  handleMetricSubscription(socket, metricTypes) {
    const admin = this.connectedAdmins.get(socket.id);
    if (!admin) return;

    if (!Array.isArray(metricTypes)) {
      metricTypes = [metricTypes];
    }

    metricTypes.forEach(type => {
      socket.join(`metrics-${type}`);
    });

    socket.emit('subscription-confirmed', {
      subscribed: metricTypes,
      timestamp: new Date()
    });

    logger.debug('Admin subscribed to metrics', {
      adminId: admin.adminId,
      metrics: metricTypes
    });
  }

  handleMetricUnsubscription(socket, metricTypes) {
    const admin = this.connectedAdmins.get(socket.id);
    if (!admin) return;

    if (!Array.isArray(metricTypes)) {
      metricTypes = [metricTypes];
    }

    metricTypes.forEach(type => {
      socket.leave(`metrics-${type}`);
    });

    socket.emit('unsubscription-confirmed', {
      unsubscribed: metricTypes,
      timestamp: new Date()
    });
  }

  handleDisconnection(socket, reason) {
    const admin = this.connectedAdmins.get(socket.id);
    
    if (admin) {
      logger.info('Admin disconnected from dashboard', {
        adminId: admin.adminId,
        role: admin.role,
        socketId: socket.id,
        reason,
        duration: new Date() - admin.connectedAt
      });

      this.connectedAdmins.delete(socket.id);
    }
  }

  startMetricsStreaming() {
    // Stream real-time metrics every 30 seconds
    setInterval(async () => {
      try {
        const realtimeMetrics = await this.getRealtimeMetrics();
        this.io.to('admin-dashboard').emit('metrics-update', {
          type: 'realtime',
          data: realtimeMetrics,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Error streaming realtime metrics:', error);
      }
    }, 30000);

    // Stream system health every 60 seconds
    setInterval(async () => {
      try {
        const systemHealth = await this.getSystemHealth();
        this.io.to('admin-dashboard').emit('system-health', {
          type: 'health',
          data: systemHealth,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Error streaming system health:', error);
      }
    }, 60000);

    logger.info('Metrics streaming started');
  }

  // Broadcast methods
  broadcastToAdmins(event, data, requiredPermission = null) {
    this.connectedAdmins.forEach((admin, socketId) => {
      if (!requiredPermission || this.hasPermission(admin, requiredPermission)) {
        this.io.to(socketId).emit(event, data);
      }
    });
  }

  broadcastToRole(role, event, data) {
    this.io.to(`role-${role}`).emit(event, data);
  }

  broadcastAlert(alert) {
    const alertData = {
      id: alert.id || Date.now(),
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: new Date(),
      ...alert
    };

    this.io.to('admin-dashboard').emit('new-alert', alertData);
    
    logger.info('Alert broadcasted', { alert: alertData });
  }

  broadcastSystemEvent(event) {
    const eventData = {
      type: event.type,
      description: event.description,
      severity: event.severity || 'info',
      timestamp: new Date(),
      ...event
    };

    this.io.to('admin-dashboard').emit('system-event', eventData);
    
    logger.info('System event broadcasted', { event: eventData });
  }

  // Helper methods
  hasPermission(admin, permission) {
    if (admin.role === 'super_admin') return true;
    return admin.permissions && admin.permissions.includes(permission);
  }

  getConnectedAdmins() {
    return Array.from(this.connectedAdmins.values());
  }

  getAdminCount() {
    return this.connectedAdmins.size;
  }

  getAdminsByRole(role) {
    return Array.from(this.connectedAdmins.values()).filter(admin => admin.role === role);
  }

  // Data methods (placeholder implementations)
  async getInitialDashboardData() {
    // This would typically fetch real data from services
    return {
      overview: {
        totalUsers: 12450,
        activeUsers: 8932,
        totalDeliveries: 45620,
        activeDeliveries: 234,
        totalRevenue: 1245067.50,
        monthlyRevenue: 125450.75,
        platformGrowth: "+12.5%"
      },
      realtimeMetrics: {
        onlineUsers: 1245,
        activeDeliveries: 234,
        newSignups: 45,
        completedDeliveries: 156,
        systemLoad: "normal",
        serverStatus: "healthy"
      },
      alerts: [],
      quickStats: {
        newUsers: { today: 45, week: 312, month: 1456 },
        deliveries: { today: 156, week: 1234, month: 5678 },
        revenue: { today: 5234.50, week: 45678.90, month: 125450.75 }
      }
    };
  }

  async getRealtimeMetrics() {
    // This would fetch real-time metrics from various sources
    return {
      onlineUsers: Math.floor(Math.random() * 2000) + 1000,
      activeDeliveries: Math.floor(Math.random() * 500) + 200,
      apiCallsPerMinute: Math.floor(Math.random() * 1000) + 500,
      systemLoad: Math.random() > 0.8 ? 'high' : Math.random() > 0.5 ? 'medium' : 'low',
      errorRate: Math.random() * 2,
      responseTime: Math.floor(Math.random() * 200) + 100
    };
  }

  async getSystemHealth() {
    // This would check actual system health
    return {
      database: 'healthy',
      redis: 'healthy',
      externalServices: 'healthy',
      diskSpace: Math.floor(Math.random() * 30) + 60,
      memoryUsage: Math.floor(Math.random() * 40) + 40,
      cpuUsage: Math.floor(Math.random() * 60) + 20
    };
  }

  // Cleanup method
  cleanup() {
    this.connectedAdmins.clear();
    logger.info('Dashboard Socket service cleaned up');
  }
}

module.exports = DashboardSocket;