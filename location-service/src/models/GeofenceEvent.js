const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class GeofenceEvent {
  constructor() {
    this.tableName = 'geofence_events';
  }

  async create(eventData) {
    const {
      geofenceId,
      userId,
      deliveryId,
      eventType,
      coordinates,
      dwellTime
    } = eventData;

    const [event] = await db(this.tableName)
      .insert({
        id: uuidv4(),
        geofence_id: geofenceId,
        user_id: userId,
        delivery_id: deliveryId,
        event_type: eventType,
        coordinates: coordinates ? 
          db.raw(`ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})')`) : 
          null,
        dwell_time: dwellTime,
        triggered_at: new Date()
      })
      .returning('*');

    return this.formatEvent(event);
  }

  async findById(id) {
    const event = await db(this.tableName)
      .select([
        'id',
        'geofence_id',
        'user_id',
        'delivery_id',
        'event_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'dwell_time',
        'triggered_at'
      ])
      .where('id', id)
      .first();

    return event ? this.formatEvent(event) : null;
  }

  async findByGeofenceId(geofenceId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      eventType,
      startTime,
      endTime,
      userId
    } = options;

    let query = db(this.tableName)
      .select([
        'id',
        'geofence_id',
        'user_id',
        'delivery_id',
        'event_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'dwell_time',
        'triggered_at'
      ])
      .where('geofence_id', geofenceId);

    if (eventType) {
      query = query.where('event_type', eventType);
    }

    if (userId) {
      query = query.where('user_id', userId);
    }

    if (startTime) {
      query = query.where('triggered_at', '>=', startTime);
    }

    if (endTime) {
      query = query.where('triggered_at', '<=', endTime);
    }

    const events = await query
      .orderBy('triggered_at', 'desc')
      .limit(limit)
      .offset(offset);

    return events.map(event => this.formatEvent(event));
  }

  async findByUserId(userId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      eventType,
      startTime,
      endTime,
      deliveryId
    } = options;

    let query = db(this.tableName)
      .select([
        'ge.id',
        'ge.geofence_id',
        'ge.user_id',
        'ge.delivery_id',
        'ge.event_type',
        db.raw('ST_X(ge.coordinates::geometry) as longitude'),
        db.raw('ST_Y(ge.coordinates::geometry) as latitude'),
        'ge.dwell_time',
        'ge.triggered_at',
        'g.name as geofence_name',
        'g.type as geofence_type'
      ])
      .from(`${this.tableName} as ge`)
      .leftJoin('geofences as g', 'ge.geofence_id', 'g.id')
      .where('ge.user_id', userId);

    if (eventType) {
      query = query.where('ge.event_type', eventType);
    }

    if (deliveryId) {
      query = query.where('ge.delivery_id', deliveryId);
    }

    if (startTime) {
      query = query.where('ge.triggered_at', '>=', startTime);
    }

    if (endTime) {
      query = query.where('ge.triggered_at', '<=', endTime);
    }

    const events = await query
      .orderBy('ge.triggered_at', 'desc')
      .limit(limit)
      .offset(offset);

    return events.map(event => this.formatEvent(event));
  }

  async findByDeliveryId(deliveryId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      eventType,
      startTime,
      endTime,
      userId
    } = options;

    let query = db(this.tableName)
      .select([
        'ge.id',
        'ge.geofence_id',
        'ge.user_id',
        'ge.delivery_id',
        'ge.event_type',
        db.raw('ST_X(ge.coordinates::geometry) as longitude'),
        db.raw('ST_Y(ge.coordinates::geometry) as latitude'),
        'ge.dwell_time',
        'ge.triggered_at',
        'g.name as geofence_name',
        'g.type as geofence_type'
      ])
      .from(`${this.tableName} as ge`)
      .leftJoin('geofences as g', 'ge.geofence_id', 'g.id')
      .where('ge.delivery_id', deliveryId);

    if (eventType) {
      query = query.where('ge.event_type', eventType);
    }

    if (userId) {
      query = query.where('ge.user_id', userId);
    }

    if (startTime) {
      query = query.where('ge.triggered_at', '>=', startTime);
    }

    if (endTime) {
      query = query.where('ge.triggered_at', '<=', endTime);
    }

    const events = await query
      .orderBy('ge.triggered_at', 'desc')
      .limit(limit)
      .offset(offset);

    return events.map(event => this.formatEvent(event));
  }

  async getEventStats(geofenceId, options = {}) {
    const {
      startTime,
      endTime,
      userId
    } = options;

    let query = db(this.tableName)
      .where('geofence_id', geofenceId);

    if (userId) {
      query = query.where('user_id', userId);
    }

    if (startTime) {
      query = query.where('triggered_at', '>=', startTime);
    }

    if (endTime) {
      query = query.where('triggered_at', '<=', endTime);
    }

    const stats = await query
      .select([
        'event_type',
        db.raw('COUNT(*) as count'),
        db.raw('AVG(dwell_time) as avg_dwell_time'),
        db.raw('MAX(dwell_time) as max_dwell_time'),
        db.raw('MIN(triggered_at) as first_event'),
        db.raw('MAX(triggered_at) as last_event')
      ])
      .groupBy('event_type');

    const totalStats = await query
      .clone()
      .select([
        db.raw('COUNT(*) as total_events'),
        db.raw('COUNT(DISTINCT user_id) as unique_users'),
        db.raw('COUNT(DISTINCT delivery_id) as unique_deliveries')
      ])
      .first();

    return {
      byEventType: stats.map(stat => ({
        eventType: stat.event_type,
        count: parseInt(stat.count),
        avgDwellTime: stat.avg_dwell_time ? parseFloat(stat.avg_dwell_time) : null,
        maxDwellTime: stat.max_dwell_time,
        firstEvent: stat.first_event,
        lastEvent: stat.last_event
      })),
      totals: {
        totalEvents: parseInt(totalStats.total_events),
        uniqueUsers: parseInt(totalStats.unique_users),
        uniqueDeliveries: parseInt(totalStats.unique_deliveries)
      }
    };
  }

  async getRecentEvents(userId, geofenceId, minutes = 30) {
    const cutoffTime = new Date(Date.now() - (minutes * 60 * 1000));

    const events = await db(this.tableName)
      .select([
        'id',
        'geofence_id',
        'user_id',
        'delivery_id',
        'event_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'dwell_time',
        'triggered_at'
      ])
      .where('user_id', userId)
      .where('geofence_id', geofenceId)
      .where('triggered_at', '>=', cutoffTime)
      .orderBy('triggered_at', 'desc');

    return events.map(event => this.formatEvent(event));
  }

  async calculateDwellTime(userId, geofenceId) {
    // Find the most recent 'enter' event without a corresponding 'exit'
    const enterEvent = await db(this.tableName)
      .select('triggered_at')
      .where('user_id', userId)
      .where('geofence_id', geofenceId)
      .where('event_type', 'enter')
      .whereNotExists(function() {
        this.select('*')
          .from('geofence_events as ge2')
          .whereRaw('ge2.user_id = geofence_events.user_id')
          .whereRaw('ge2.geofence_id = geofence_events.geofence_id')
          .where('ge2.event_type', 'exit')
          .whereRaw('ge2.triggered_at > geofence_events.triggered_at');
      })
      .orderBy('triggered_at', 'desc')
      .first();

    if (!enterEvent) return 0;

    const dwellTimeMs = Date.now() - new Date(enterEvent.triggered_at).getTime();
    return Math.floor(dwellTimeMs / 1000); // Return seconds
  }

  async isUserCurrentlyInside(userId, geofenceId) {
    const recentEvents = await this.getRecentEvents(userId, geofenceId, 60); // Last hour
    
    if (recentEvents.length === 0) return false;

    // Check the most recent event
    const lastEvent = recentEvents[0];
    return lastEvent.eventType === 'enter';
  }

  async deleteOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await db(this.tableName)
      .where('triggered_at', '<', cutoffDate)
      .del();
  }

  async deleteByGeofenceId(geofenceId) {
    return await db(this.tableName)
      .where('geofence_id', geofenceId)
      .del();
  }

  formatEvent(event) {
    if (!event) return null;

    return {
      id: event.id,
      geofenceId: event.geofence_id,
      userId: event.user_id,
      deliveryId: event.delivery_id,
      eventType: event.event_type,
      coordinates: (event.longitude && event.latitude) ? {
        latitude: parseFloat(event.latitude),
        longitude: parseFloat(event.longitude)
      } : null,
      dwellTime: event.dwell_time,
      triggeredAt: event.triggered_at,
      geofenceName: event.geofence_name,
      geofenceType: event.geofence_type
    };
  }
}

module.exports = GeofenceEvent;