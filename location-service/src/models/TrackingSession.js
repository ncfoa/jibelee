const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class TrackingSession {
  constructor() {
    this.tableName = 'tracking_sessions';
  }

  async create(sessionData) {
    const {
      deliveryId,
      userId,
      settings = {},
      privacySettings = {}
    } = sessionData;

    const [session] = await db(this.tableName)
      .insert({
        id: uuidv4(),
        delivery_id: deliveryId,
        user_id: userId,
        status: 'active',
        settings,
        privacy_settings: privacySettings,
        started_at: new Date(),
        last_update_at: new Date(),
        total_updates: 0,
        total_distance: 0,
        total_duration: 0
      })
      .returning('*');

    return this.formatSession(session);
  }

  async findById(id) {
    const session = await db(this.tableName)
      .select('*')
      .where('id', id)
      .first();

    return session ? this.formatSession(session) : null;
  }

  async findByDeliveryId(deliveryId) {
    const session = await db(this.tableName)
      .select('*')
      .where('delivery_id', deliveryId)
      .first();

    return session ? this.formatSession(session) : null;
  }

  async findByUserId(userId, options = {}) {
    const {
      status,
      limit = 50,
      offset = 0
    } = options;

    let query = db(this.tableName)
      .select('*')
      .where('user_id', userId);

    if (status) {
      if (Array.isArray(status)) {
        query = query.whereIn('status', status);
      } else {
        query = query.where('status', status);
      }
    }

    const sessions = await query
      .orderBy('started_at', 'desc')
      .limit(limit)
      .offset(offset);

    return sessions.map(session => this.formatSession(session));
  }

  async findActiveSessions(options = {}) {
    const {
      userId,
      limit = 100,
      offset = 0
    } = options;

    let query = db(this.tableName)
      .select('*')
      .where('status', 'active');

    if (userId) {
      query = query.where('user_id', userId);
    }

    const sessions = await query
      .orderBy('started_at', 'desc')
      .limit(limit)
      .offset(offset);

    return sessions.map(session => this.formatSession(session));
  }

  async updateSession(deliveryId, updateData) {
    const {
      status,
      settings,
      privacySettings,
      totalUpdates,
      totalDistance,
      totalDuration
    } = updateData;

    const updateFields = {
      last_update_at: new Date()
    };

    if (status !== undefined) {
      updateFields.status = status;
      if (status === 'stopped' || status === 'completed') {
        updateFields.stopped_at = new Date();
      }
    }

    if (settings !== undefined) updateFields.settings = settings;
    if (privacySettings !== undefined) updateFields.privacy_settings = privacySettings;
    if (totalUpdates !== undefined) updateFields.total_updates = totalUpdates;
    if (totalDistance !== undefined) updateFields.total_distance = totalDistance;
    if (totalDuration !== undefined) updateFields.total_duration = totalDuration;

    const [session] = await db(this.tableName)
      .where('delivery_id', deliveryId)
      .update(updateFields)
      .returning('*');

    return session ? this.formatSession(session) : null;
  }

  async incrementUpdateCount(deliveryId) {
    const [session] = await db(this.tableName)
      .where('delivery_id', deliveryId)
      .increment('total_updates', 1)
      .update({ last_update_at: new Date() })
      .returning('*');

    return session ? this.formatSession(session) : null;
  }

  async updateDistance(deliveryId, additionalDistance) {
    const [session] = await db(this.tableName)
      .where('delivery_id', deliveryId)
      .increment('total_distance', additionalDistance)
      .update({ last_update_at: new Date() })
      .returning('*');

    return session ? this.formatSession(session) : null;
  }

  async pauseSession(deliveryId) {
    return await this.updateSession(deliveryId, { status: 'paused' });
  }

  async resumeSession(deliveryId) {
    return await this.updateSession(deliveryId, { status: 'active' });
  }

  async stopSession(deliveryId) {
    const session = await this.findByDeliveryId(deliveryId);
    if (!session) return null;

    const totalDuration = session.startedAt ? 
      Math.floor((new Date() - new Date(session.startedAt)) / (1000 * 60)) : 0;

    return await this.updateSession(deliveryId, { 
      status: 'stopped',
      totalDuration
    });
  }

  async completeSession(deliveryId) {
    const session = await this.findByDeliveryId(deliveryId);
    if (!session) return null;

    const totalDuration = session.startedAt ? 
      Math.floor((new Date() - new Date(session.startedAt)) / (1000 * 60)) : 0;

    return await this.updateSession(deliveryId, { 
      status: 'completed',
      totalDuration
    });
  }

  async getSessionStats(options = {}) {
    const {
      userId,
      startTime,
      endTime,
      status
    } = options;

    let query = db(this.tableName);

    if (userId) {
      query = query.where('user_id', userId);
    }

    if (startTime) {
      query = query.where('started_at', '>=', startTime);
    }

    if (endTime) {
      query = query.where('started_at', '<=', endTime);
    }

    if (status) {
      if (Array.isArray(status)) {
        query = query.whereIn('status', status);
      } else {
        query = query.where('status', status);
      }
    }

    const stats = await query
      .select([
        'status',
        db.raw('COUNT(*) as count'),
        db.raw('AVG(total_updates) as avg_updates'),
        db.raw('AVG(total_distance) as avg_distance'),
        db.raw('AVG(total_duration) as avg_duration'),
        db.raw('SUM(total_distance) as total_distance_sum'),
        db.raw('SUM(total_duration) as total_duration_sum')
      ])
      .groupBy('status');

    const totalStats = await query
      .clone()
      .select([
        db.raw('COUNT(*) as total_sessions'),
        db.raw('AVG(total_updates) as avg_updates_per_session'),
        db.raw('SUM(total_distance) as total_distance_all'),
        db.raw('SUM(total_duration) as total_duration_all'),
        db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_sessions'),
        db.raw('COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_sessions')
      ])
      .first();

    return {
      byStatus: stats.map(stat => ({
        status: stat.status,
        count: parseInt(stat.count),
        avgUpdates: stat.avg_updates ? parseFloat(stat.avg_updates) : 0,
        avgDistance: stat.avg_distance ? parseFloat(stat.avg_distance) : 0,
        avgDuration: stat.avg_duration ? parseFloat(stat.avg_duration) : 0,
        totalDistance: stat.total_distance_sum ? parseFloat(stat.total_distance_sum) : 0,
        totalDuration: stat.total_duration_sum ? parseInt(stat.total_duration_sum) : 0
      })),
      totals: {
        totalSessions: parseInt(totalStats.total_sessions),
        avgUpdatesPerSession: totalStats.avg_updates_per_session ? 
          parseFloat(totalStats.avg_updates_per_session) : 0,
        totalDistanceAll: totalStats.total_distance_all ? 
          parseFloat(totalStats.total_distance_all) : 0,
        totalDurationAll: totalStats.total_duration_all ? 
          parseInt(totalStats.total_duration_all) : 0,
        completedSessions: parseInt(totalStats.completed_sessions),
        activeSessions: parseInt(totalStats.active_sessions),
        completionRate: totalStats.total_sessions > 0 ? 
          (totalStats.completed_sessions / totalStats.total_sessions * 100) : 0
      }
    };
  }

  async findStaleSessions(hoursThreshold = 24) {
    const cutoffTime = new Date(Date.now() - (hoursThreshold * 60 * 60 * 1000));

    const sessions = await db(this.tableName)
      .select('*')
      .where('status', 'active')
      .where('last_update_at', '<', cutoffTime);

    return sessions.map(session => this.formatSession(session));
  }

  async cleanupStaleSessions(hoursThreshold = 24) {
    const cutoffTime = new Date(Date.now() - (hoursThreshold * 60 * 60 * 1000));

    return await db(this.tableName)
      .where('status', 'active')
      .where('last_update_at', '<', cutoffTime)
      .update({
        status: 'stopped',
        stopped_at: new Date()
      });
  }

  async deleteOldSessions(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await db(this.tableName)
      .where('started_at', '<', cutoffDate)
      .whereIn('status', ['stopped', 'completed'])
      .del();
  }

  async delete(deliveryId) {
    return await db(this.tableName)
      .where('delivery_id', deliveryId)
      .del();
  }

  formatSession(session) {
    if (!session) return null;

    return {
      id: session.id,
      deliveryId: session.delivery_id,
      userId: session.user_id,
      status: session.status,
      settings: session.settings || {},
      privacySettings: session.privacy_settings || {},
      startedAt: session.started_at,
      stoppedAt: session.stopped_at,
      lastUpdateAt: session.last_update_at,
      totalUpdates: session.total_updates || 0,
      totalDistance: session.total_distance ? parseFloat(session.total_distance) : 0,
      totalDuration: session.total_duration || 0
    };
  }
}

module.exports = TrackingSession;