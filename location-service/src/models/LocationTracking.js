const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class LocationTracking {
  constructor() {
    this.tableName = 'location_tracking';
  }

  async create(locationData) {
    const {
      deliveryId,
      userId,
      coordinates,
      accuracy,
      altitude,
      bearing,
      speed,
      batteryLevel,
      networkType,
      timestamp
    } = locationData;

    const [location] = await db(this.tableName)
      .insert({
        id: uuidv4(),
        delivery_id: deliveryId,
        user_id: userId,
        coordinates: db.raw(`ST_GeogFromText('POINT(${coordinates.longitude} ${coordinates.latitude})')`),
        accuracy,
        altitude,
        bearing,
        speed,
        battery_level: batteryLevel,
        network_type: networkType,
        timestamp: timestamp || new Date(),
        created_at: new Date()
      })
      .returning('*');

    return this.formatLocation(location);
  }

  async batchCreate(locationsData) {
    const locations = locationsData.map(locationData => ({
      id: uuidv4(),
      delivery_id: locationData.deliveryId,
      user_id: locationData.userId,
      coordinates: db.raw(`ST_GeogFromText('POINT(${locationData.coordinates.longitude} ${locationData.coordinates.latitude})')`),
      accuracy: locationData.accuracy,
      altitude: locationData.altitude,
      bearing: locationData.bearing,
      speed: locationData.speed,
      battery_level: locationData.batteryLevel,
      network_type: locationData.networkType,
      timestamp: locationData.timestamp || new Date(),
      created_at: new Date()
    }));

    const insertedLocations = await db(this.tableName)
      .insert(locations)
      .returning('*');

    return insertedLocations.map(location => this.formatLocation(location));
  }

  async findByDeliveryId(deliveryId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      startTime,
      endTime,
      userId,
      orderBy = 'timestamp',
      orderDirection = 'desc'
    } = options;

    let query = db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'altitude',
        'bearing',
        'speed',
        'battery_level',
        'network_type',
        'timestamp',
        'created_at'
      ])
      .where('delivery_id', deliveryId);

    if (userId) {
      query = query.where('user_id', userId);
    }

    if (startTime) {
      query = query.where('timestamp', '>=', startTime);
    }

    if (endTime) {
      query = query.where('timestamp', '<=', endTime);
    }

    const locations = await query
      .orderBy(orderBy, orderDirection)
      .limit(limit)
      .offset(offset);

    return locations.map(location => this.formatLocation(location));
  }

  async findLatestByDeliveryId(deliveryId, userId = null) {
    let query = db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'altitude',
        'bearing',
        'speed',
        'battery_level',
        'network_type',
        'timestamp',
        'created_at'
      ])
      .where('delivery_id', deliveryId);

    if (userId) {
      query = query.where('user_id', userId);
    }

    const location = await query
      .orderBy('timestamp', 'desc')
      .first();

    return location ? this.formatLocation(location) : null;
  }

  async findNearbyLocations(coordinates, radiusMeters = 1000, options = {}) {
    const {
      limit = 50,
      excludeUserId,
      maxAge = 3600 // 1 hour in seconds
    } = options;

    const maxAgeTimestamp = new Date(Date.now() - (maxAge * 1000));

    let query = db(this.tableName)
      .select([
        'id',
        'delivery_id',
        'user_id',
        db.raw('ST_X(coordinates::geometry) as longitude'),
        db.raw('ST_Y(coordinates::geometry) as latitude'),
        'accuracy',
        'altitude',
        'bearing',
        'speed',
        'battery_level',
        'network_type',
        'timestamp',
        'created_at',
        db.raw(`ST_Distance(coordinates, ST_GeogFromText('POINT(${coordinates.longitude} ${coordinates.latitude})')) as distance`)
      ])
      .whereRaw(`ST_DWithin(coordinates, ST_GeogFromText('POINT(${coordinates.longitude} ${coordinates.latitude})'), ?)`, [radiusMeters])
      .where('timestamp', '>=', maxAgeTimestamp);

    if (excludeUserId) {
      query = query.where('user_id', '!=', excludeUserId);
    }

    const locations = await query
      .orderBy('distance', 'asc')
      .limit(limit);

    return locations.map(location => this.formatLocation(location));
  }

  async getLocationStats(deliveryId, userId = null) {
    let query = db(this.tableName)
      .where('delivery_id', deliveryId);

    if (userId) {
      query = query.where('user_id', userId);
    }

    const stats = await query
      .select([
        db.raw('COUNT(*) as total_points'),
        db.raw('MIN(timestamp) as first_update'),
        db.raw('MAX(timestamp) as last_update'),
        db.raw('AVG(accuracy) as avg_accuracy'),
        db.raw('MAX(speed) as max_speed'),
        db.raw('AVG(speed) as avg_speed'),
        db.raw('MIN(battery_level) as min_battery'),
        db.raw('AVG(battery_level) as avg_battery')
      ])
      .first();

    // Calculate total distance traveled
    const distanceResult = await query
      .select(
        db.raw(`
          SUM(
            ST_Distance(
              LAG(coordinates) OVER (ORDER BY timestamp),
              coordinates
            )
          ) / 1000 as total_distance_km
        `)
      )
      .first();

    return {
      ...stats,
      total_distance_km: parseFloat(distanceResult.total_distance_km || 0),
      duration_minutes: stats.first_update && stats.last_update
        ? Math.round((new Date(stats.last_update) - new Date(stats.first_update)) / (1000 * 60))
        : 0
    };
  }

  async deleteByDeliveryId(deliveryId, userId = null) {
    let query = db(this.tableName)
      .where('delivery_id', deliveryId);

    if (userId) {
      query = query.where('user_id', userId);
    }

    return await query.del();
  }

  async deleteOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await db(this.tableName)
      .where('created_at', '<', cutoffDate)
      .del();
  }

  async anonymizeByDeliveryId(deliveryId) {
    // Remove precise location data while keeping aggregated stats
    const locations = await this.findByDeliveryId(deliveryId);
    
    if (locations.length === 0) return 0;

    // Calculate anonymized summary
    const summary = await this.getLocationStats(deliveryId);

    // Store summary in a separate table (would need to be created)
    // For now, we'll just delete the precise data
    return await this.deleteByDeliveryId(deliveryId);
  }

  formatLocation(location) {
    if (!location) return null;

    return {
      id: location.id,
      deliveryId: location.delivery_id,
      userId: location.user_id,
      coordinates: {
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude)
      },
      accuracy: location.accuracy ? parseFloat(location.accuracy) : null,
      altitude: location.altitude ? parseFloat(location.altitude) : null,
      bearing: location.bearing ? parseFloat(location.bearing) : null,
      speed: location.speed ? parseFloat(location.speed) : null,
      batteryLevel: location.battery_level,
      networkType: location.network_type,
      timestamp: location.timestamp,
      createdAt: location.created_at,
      distance: location.distance ? parseFloat(location.distance) : undefined
    };
  }
}

module.exports = LocationTracking;