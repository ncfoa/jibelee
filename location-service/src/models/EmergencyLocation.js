const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class EmergencyLocation {
  constructor() {
    this.tableName = 'emergency_locations';
  }

  async create(emergencyData) {
    const {
      deliveryId,
      userId,
      emergencyType,
      coordinates,
      accuracy,
      description,
      contactNumber,
      requiresAssistance = false,
      severity
    } = emergencyData;

    const [emergency] = await db(this.tableName)
      .insert({
        id: uuidv4(),
        delivery_id: deliveryId,
        user_id: userId,
        emergency_type: emergencyType,
        coordinates: db.raw(`ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})')`),
        accuracy,
        description,
        contact_number: contactNumber,
        requires_assistance: requiresAssistance,
        severity,
        status: 'reported',
        created_at: new Date()
      })
      .returning('*');

    return this.formatEmergency(emergency);
  }

  async findById(id) {
    const emergency = await db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        'emergency_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'description',
        'contact_number',
        'requires_assistance',
        'severity',
        'status',
        'resolved_at',
        'resolution_notes',
        'created_at'
      ])
      .where('id', id)
      .first();

    return emergency ? this.formatEmergency(emergency) : null;
  }

  async findByDeliveryId(deliveryId, options = {}) {
    const {
      status,
      severity,
      limit = 50,
      offset = 0
    } = options;

    let query = db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        'emergency_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'description',
        'contact_number',
        'requires_assistance',
        'severity',
        'status',
        'resolved_at',
        'resolution_notes',
        'created_at'
      ])
      .where('delivery_id', deliveryId);

    if (status) {
      if (Array.isArray(status)) {
        query = query.whereIn('status', status);
      } else {
        query = query.where('status', status);
      }
    }

    if (severity) {
      if (Array.isArray(severity)) {
        query = query.whereIn('severity', severity);
      } else {
        query = query.where('severity', severity);
      }
    }

    const emergencies = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return emergencies.map(emergency => this.formatEmergency(emergency));
  }

  async findByUserId(userId, options = {}) {
    const {
      status,
      severity,
      startTime,
      endTime,
      limit = 50,
      offset = 0
    } = options;

    let query = db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        'emergency_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'description',
        'contact_number',
        'requires_assistance',
        'severity',
        'status',
        'resolved_at',
        'resolution_notes',
        'created_at'
      ])
      .where('user_id', userId);

    if (status) {
      if (Array.isArray(status)) {
        query = query.whereIn('status', status);
      } else {
        query = query.where('status', status);
      }
    }

    if (severity) {
      if (Array.isArray(severity)) {
        query = query.whereIn('severity', severity);
      } else {
        query = query.where('severity', severity);
      }
    }

    if (startTime) {
      query = query.where('created_at', '>=', startTime);
    }

    if (endTime) {
      query = query.where('created_at', '<=', endTime);
    }

    const emergencies = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return emergencies.map(emergency => this.formatEmergency(emergency));
  }

  async findActiveEmergencies(options = {}) {
    const {
      severity,
      emergencyType,
      requiresAssistance,
      limit = 100,
      offset = 0
    } = options;

    let query = db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        'emergency_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'description',
        'contact_number',
        'requires_assistance',
        'severity',
        'status',
        'resolved_at',
        'resolution_notes',
        'created_at'
      ])
      .whereIn('status', ['reported', 'acknowledged', 'in_progress']);

    if (severity) {
      if (Array.isArray(severity)) {
        query = query.whereIn('severity', severity);
      } else {
        query = query.where('severity', severity);
      }
    }

    if (emergencyType) {
      if (Array.isArray(emergencyType)) {
        query = query.whereIn('emergency_type', emergencyType);
      } else {
        query = query.where('emergency_type', emergencyType);
      }
    }

    if (requiresAssistance !== undefined) {
      query = query.where('requires_assistance', requiresAssistance);
    }

    const emergencies = await query
      .orderBy([
        { column: 'severity', order: 'desc' },
        { column: 'created_at', order: 'asc' }
      ])
      .limit(limit)
      .offset(offset);

    return emergencies.map(emergency => this.formatEmergency(emergency));
  }

  async findNearbyEmergencies(coordinates, radiusMeters = 10000, options = {}) {
    const {
      status = ['reported', 'acknowledged', 'in_progress'],
      severity,
      emergencyType,
      limit = 50
    } = options;

    let query = db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        'emergency_type',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'description',
        'contact_number',
        'requires_assistance',
        'severity',
        'status',
        'resolved_at',
        'resolution_notes',
        'created_at',
        db.raw(`ST_Distance(coordinates, ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})')) as distance`)
      ])
      .whereRaw(`ST_DWithin(coordinates, ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})'), ?)`, [radiusMeters])
      .whereIn('status', status);

    if (severity) {
      if (Array.isArray(severity)) {
        query = query.whereIn('severity', severity);
      } else {
        query = query.where('severity', severity);
      }
    }

    if (emergencyType) {
      if (Array.isArray(emergencyType)) {
        query = query.whereIn('emergency_type', emergencyType);
      } else {
        query = query.where('emergency_type', emergencyType);
      }
    }

    const emergencies = await query
      .orderBy([
        { column: 'severity', order: 'desc' },
        { column: 'distance', order: 'asc' }
      ])
      .limit(limit);

    return emergencies.map(emergency => this.formatEmergency(emergency));
  }

  async updateStatus(id, statusUpdate) {
    const {
      status,
      resolutionNotes,
      resolvedBy
    } = statusUpdate;

    const updateData = {
      status,
      updated_at: new Date()
    };

    if (status === 'resolved') {
      updateData.resolved_at = new Date();
      updateData.resolution_notes = resolutionNotes;
    }

    const [emergency] = await db(this.tableName)
      .where('id', id)
      .update(updateData)
      .returning('*');

    return emergency ? this.formatEmergency(emergency) : null;
  }

  async getEmergencyStats(options = {}) {
    const {
      startTime,
      endTime,
      userId,
      deliveryId
    } = options;

    let query = db(this.tableName);

    if (startTime) {
      query = query.where('created_at', '>=', startTime);
    }

    if (endTime) {
      query = query.where('created_at', '<=', endTime);
    }

    if (userId) {
      query = query.where('user_id', userId);
    }

    if (deliveryId) {
      query = query.where('delivery_id', deliveryId);
    }

    const stats = await query
      .select([
        'status',
        'severity',
        'emergency_type',
        db.raw('COUNT(*) as count'),
        db.raw('AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))) as avg_resolution_time_seconds')
      ])
      .groupBy(['status', 'severity', 'emergency_type']);

    const totalStats = await query
      .clone()
      .select([
        db.raw('COUNT(*) as total_emergencies'),
        db.raw('COUNT(CASE WHEN status = \'resolved\' THEN 1 END) as resolved_count'),
        db.raw('COUNT(CASE WHEN requires_assistance = true THEN 1 END) as assistance_required_count'),
        db.raw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_time_seconds')
      ])
      .first();

    return {
      byCategory: stats.map(stat => ({
        status: stat.status,
        severity: stat.severity,
        emergencyType: stat.emergency_type,
        count: parseInt(stat.count),
        avgResolutionTimeSeconds: stat.avg_resolution_time_seconds ? 
          parseFloat(stat.avg_resolution_time_seconds) : null
      })),
      totals: {
        totalEmergencies: parseInt(totalStats.total_emergencies),
        resolvedCount: parseInt(totalStats.resolved_count),
        assistanceRequiredCount: parseInt(totalStats.assistance_required_count),
        avgResolutionTimeSeconds: totalStats.avg_resolution_time_seconds ? 
          parseFloat(totalStats.avg_resolution_time_seconds) : null,
        resolutionRate: totalStats.total_emergencies > 0 ? 
          (totalStats.resolved_count / totalStats.total_emergencies * 100) : 0
      }
    };
  }

  async escalateUnresolvedEmergencies(hoursThreshold = 2) {
    const cutoffTime = new Date(Date.now() - (hoursThreshold * 60 * 60 * 1000));

    const emergencies = await db(this.tableName)
      .select('id', 'severity', 'emergency_type', 'created_at')
      .whereIn('status', ['reported', 'acknowledged'])
      .where('created_at', '<', cutoffTime)
      .where('severity', '!=', 'critical'); // Don't escalate already critical

    const escalatedIds = [];

    for (const emergency of emergencies) {
      let newSeverity = emergency.severity;
      
      if (emergency.severity === 'low') {
        newSeverity = 'medium';
      } else if (emergency.severity === 'medium') {
        newSeverity = 'high';
      } else if (emergency.severity === 'high') {
        newSeverity = 'critical';
      }

      if (newSeverity !== emergency.severity) {
        await db(this.tableName)
          .where('id', emergency.id)
          .update({ severity: newSeverity });
        
        escalatedIds.push(emergency.id);
      }
    }

    return escalatedIds;
  }

  async deleteOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await db(this.tableName)
      .where('created_at', '<', cutoffDate)
      .where('status', 'resolved')
      .del();
  }

  formatEmergency(emergency) {
    if (!emergency) return null;

    return {
      id: emergency.id,
      deliveryId: emergency.delivery_id,
      userId: emergency.user_id,
      emergencyType: emergency.emergency_type,
      coordinates: {
        latitude: parseFloat(emergency.latitude),
        longitude: parseFloat(emergency.longitude)
      },
      accuracy: emergency.accuracy ? parseFloat(emergency.accuracy) : null,
      description: emergency.description,
      contactNumber: emergency.contact_number,
      requiresAssistance: emergency.requires_assistance,
      severity: emergency.severity,
      status: emergency.status,
      resolvedAt: emergency.resolved_at,
      resolutionNotes: emergency.resolution_notes,
      createdAt: emergency.created_at,
      distance: emergency.distance ? parseFloat(emergency.distance) : undefined
    };
  }
}

module.exports = EmergencyLocation;