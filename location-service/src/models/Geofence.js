const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Geofence {
  constructor() {
    this.tableName = 'geofences';
  }

  async create(geofenceData) {
    const {
      name,
      type,
      deliveryId,
      geometry,
      notifications = {},
      active = true,
      startTime,
      endTime,
      timezone = 'UTC',
      metadata = {}
    } = geofenceData;

    const geofenceId = uuidv4();
    let insertData = {
      id: geofenceId,
      name,
      type,
      delivery_id: deliveryId,
      geometry_type: geometry.type,
      notifications,
      active,
      start_time: startTime,
      end_time: endTime,
      timezone,
      metadata,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Handle different geometry types
    if (geometry.type === 'circle') {
      insertData.center_coordinates = db.raw(`ST_GeogFromText('POINT(${geometry.center.lng} ${geometry.center.lat})')`);
      insertData.radius = geometry.radius;
    } else if (geometry.type === 'polygon') {
      const coordinates = geometry.coordinates[0]; // First ring of polygon
      const polygonWKT = `POLYGON((${coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ')}))`;
      insertData.polygon_coordinates = db.raw(`ST_GeogFromText('${polygonWKT}')`);
    }

    const [geofence] = await db(this.tableName)
      .insert(insertData)
      .returning('*');

    return this.formatGeofence(geofence);
  }

  async findById(id) {
    const geofence = await db(this.tableName)
      .select([
        'id',
        'name',
        'type',
        'delivery_id',
        'geometry_type',
        db.raw('ST_X(center_coordinates::geometry) as center_lng'),
        db.raw('ST_Y(center_coordinates::geometry) as center_lat'),
        'radius',
        db.raw('ST_AsGeoJSON(polygon_coordinates::geometry) as polygon_geojson'),
        'notifications',
        'active',
        'start_time',
        'end_time',
        'timezone',
        'metadata',
        'created_at',
        'updated_at'
      ])
      .where('id', id)
      .first();

    return geofence ? this.formatGeofence(geofence) : null;
  }

  async findByDeliveryId(deliveryId, activeOnly = true) {
    let query = db(this.tableName)
      .select([
        'id',
        'name',
        'type',
        'delivery_id',
        'geometry_type',
        db.raw('ST_X(center_coordinates::geometry) as center_lng'),
        db.raw('ST_Y(center_coordinates::geometry) as center_lat'),
        'radius',
        db.raw('ST_AsGeoJSON(polygon_coordinates::geometry) as polygon_geojson'),
        'notifications',
        'active',
        'start_time',
        'end_time',
        'timezone',
        'metadata',
        'created_at',
        'updated_at'
      ])
      .where('delivery_id', deliveryId);

    if (activeOnly) {
      query = query.where('active', true);
      
      // Also check time-based activation
      const now = new Date();
      query = query.where(function() {
        this.whereNull('start_time')
          .orWhere('start_time', '<=', now);
      }).where(function() {
        this.whereNull('end_time')
          .orWhere('end_time', '>=', now);
      });
    }

    const geofences = await query.orderBy('created_at', 'desc');
    return geofences.map(geofence => this.formatGeofence(geofence));
  }

  async findNearbyGeofences(coordinates, radiusMeters = 5000, options = {}) {
    const {
      type,
      activeOnly = true,
      limit = 50
    } = options;

    let query = db(this.tableName)
      .select([
        'id',
        'name',
        'type',
        'delivery_id',
        'geometry_type',
        db.raw('ST_X(center_coordinates::geometry) as center_lng'),
        db.raw('ST_Y(center_coordinates::geometry) as center_lat'),
        'radius',
        db.raw('ST_AsGeoJSON(polygon_coordinates::geometry) as polygon_geojson'),
        'notifications',
        'active',
        'start_time',
        'end_time',
        'timezone',
        'metadata',
        'created_at',
        'updated_at',
        db.raw(`
          LEAST(
            ST_Distance(center_coordinates, ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})')),
            ST_Distance(polygon_coordinates, ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})'))
          ) as distance
        `)
      ])
      .whereRaw(`
        (center_coordinates IS NOT NULL AND ST_DWithin(center_coordinates, ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})'), ?))
        OR
        (polygon_coordinates IS NOT NULL AND ST_DWithin(polygon_coordinates, ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})'), ?))
      `, [radiusMeters, radiusMeters]);

    if (type) {
      query = query.where('type', type);
    }

    if (activeOnly) {
      query = query.where('active', true);
      
      const now = new Date();
      query = query.where(function() {
        this.whereNull('start_time')
          .orWhere('start_time', '<=', now);
      }).where(function() {
        this.whereNull('end_time')
          .orWhere('end_time', '>=', now);
      });
    }

    const geofences = await query
      .orderBy('distance', 'asc')
      .limit(limit);

    return geofences.map(geofence => this.formatGeofence(geofence));
  }

  async update(id, updateData) {
    const {
      name,
      notifications,
      active,
      startTime,
      endTime,
      timezone,
      metadata,
      geometry
    } = updateData;

    let updateFields = {
      updated_at: new Date()
    };

    if (name !== undefined) updateFields.name = name;
    if (notifications !== undefined) updateFields.notifications = notifications;
    if (active !== undefined) updateFields.active = active;
    if (startTime !== undefined) updateFields.start_time = startTime;
    if (endTime !== undefined) updateFields.end_time = endTime;
    if (timezone !== undefined) updateFields.timezone = timezone;
    if (metadata !== undefined) updateFields.metadata = metadata;

    // Handle geometry updates
    if (geometry) {
      if (geometry.type === 'circle') {
        updateFields.center_coordinates = db.raw(`ST_GeogFromText('POINT(${geometry.center.lng} ${geometry.center.lat})')`);
        updateFields.radius = geometry.radius;
        updateFields.polygon_coordinates = null;
      } else if (geometry.type === 'polygon') {
        const coordinates = geometry.coordinates[0];
        const polygonWKT = `POLYGON((${coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ')}))`;
        updateFields.polygon_coordinates = db.raw(`ST_GeogFromText('${polygonWKT}')`);
        updateFields.center_coordinates = null;
        updateFields.radius = null;
      }
      updateFields.geometry_type = geometry.type;
    }

    const [geofence] = await db(this.tableName)
      .where('id', id)
      .update(updateFields)
      .returning('*');

    return geofence ? this.formatGeofence(geofence) : null;
  }

  async delete(id) {
    return await db(this.tableName)
      .where('id', id)
      .del();
  }

  async isLocationInsideGeofence(coordinates, geofenceId) {
    const geofence = await this.findById(geofenceId);
    if (!geofence || !geofence.active) return false;

    // Check time-based activation
    const now = new Date();
    if (geofence.startTime && now < new Date(geofence.startTime)) return false;
    if (geofence.endTime && now > new Date(geofence.endTime)) return false;

    if (geofence.geometryType === 'circle') {
      const result = await db.raw(`
        SELECT ST_DWithin(
          ST_GeogFromText('POINT(${coordinates.lng} ${coordinates.lat})'),
          center_coordinates,
          radius
        ) as is_inside
        FROM ${this.tableName}
        WHERE id = ?
      `, [geofenceId]);

      return result.rows[0]?.is_inside || false;
    } else if (geofence.geometryType === 'polygon') {
      const result = await db.raw(`
        SELECT ST_Contains(
          polygon_coordinates::geometry,
          ST_GeomFromText('POINT(${coordinates.lng} ${coordinates.lat})', 4326)
        ) as is_inside
        FROM ${this.tableName}
        WHERE id = ?
      `, [geofenceId]);

      return result.rows[0]?.is_inside || false;
    }

    return false;
  }

  async checkMultipleGeofences(coordinates, geofenceIds) {
    const results = await Promise.all(
      geofenceIds.map(async (id) => ({
        geofenceId: id,
        isInside: await this.isLocationInsideGeofence(coordinates, id)
      }))
    );

    return results;
  }

  async deactivateExpiredGeofences() {
    const now = new Date();
    return await db(this.tableName)
      .where('active', true)
      .where('end_time', '<', now)
      .update({
        active: false,
        updated_at: now
      });
  }

  formatGeofence(geofence) {
    if (!geofence) return null;

    const formatted = {
      id: geofence.id,
      name: geofence.name,
      type: geofence.type,
      deliveryId: geofence.delivery_id,
      geometryType: geofence.geometry_type,
      notifications: geofence.notifications || {},
      active: geofence.active,
      startTime: geofence.start_time,
      endTime: geofence.end_time,
      timezone: geofence.timezone,
      metadata: geofence.metadata || {},
      createdAt: geofence.created_at,
      updatedAt: geofence.updated_at,
      distance: geofence.distance ? parseFloat(geofence.distance) : undefined
    };

    // Add geometry based on type
    if (geofence.geometry_type === 'circle' && geofence.center_lng && geofence.center_lat) {
      formatted.geometry = {
        type: 'circle',
        center: {
          lat: parseFloat(geofence.center_lat),
          lng: parseFloat(geofence.center_lng)
        },
        radius: geofence.radius
      };
    } else if (geofence.geometry_type === 'polygon' && geofence.polygon_geojson) {
      try {
        const polygonGeoJSON = JSON.parse(geofence.polygon_geojson);
        formatted.geometry = {
          type: 'polygon',
          coordinates: polygonGeoJSON.coordinates
        };
      } catch (error) {
        console.error('Error parsing polygon GeoJSON:', error);
      }
    }

    return formatted;
  }
}

module.exports = Geofence;