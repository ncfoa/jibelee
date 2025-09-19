const Geofence = require('../models/Geofence');
const GeofenceEvent = require('../models/GeofenceEvent');
const GeoUtils = require('../utils/geoUtils');
const EventEmitter = require('events');
const Redis = require('ioredis');
const { GeofenceError } = require('../middleware/errorHandler');

class GeofenceService extends EventEmitter {
  constructor() {
    super();
    this.geofence = new Geofence();
    this.geofenceEvent = new GeofenceEvent();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.notificationService = require('./notificationService');
  }

  /**
   * Create a new geofence
   */
  async createGeofence(geofenceData) {
    const {
      name,
      type,
      deliveryId,
      geometry,
      notifications = {},
      schedule,
      metadata = {}
    } = geofenceData;

    // Validate geometry
    this.validateGeometry(geometry);

    // Create geofence
    const geofence = await this.geofence.create({
      name,
      type,
      deliveryId,
      geometry,
      notifications: this.normalizeNotifications(notifications),
      active: true,
      startTime: schedule?.startTime,
      endTime: schedule?.endTime,
      timezone: schedule?.timezone || 'UTC',
      metadata
    });

    // Add to active monitoring
    await this.addToActiveMonitoring(geofence.id);

    this.emit('geofence_created', {
      geofenceId: geofence.id,
      type,
      deliveryId,
      geometry
    });

    return geofence;
  }

  /**
   * Update an existing geofence
   */
  async updateGeofence(geofenceId, updateData) {
    const existingGeofence = await this.geofence.findById(geofenceId);
    if (!existingGeofence) {
      throw new GeofenceError('Geofence not found');
    }

    // Validate geometry if provided
    if (updateData.geometry) {
      this.validateGeometry(updateData.geometry);
    }

    // Normalize notifications if provided
    if (updateData.notifications) {
      updateData.notifications = this.normalizeNotifications(updateData.notifications);
    }

    const updatedGeofence = await this.geofence.update(geofenceId, updateData);

    // Update monitoring cache
    if (updateData.active !== undefined) {
      if (updateData.active) {
        await this.addToActiveMonitoring(geofenceId);
      } else {
        await this.removeFromActiveMonitoring(geofenceId);
      }
    }

    this.emit('geofence_updated', {
      geofenceId,
      changes: updateData
    });

    return updatedGeofence;
  }

  /**
   * Delete a geofence
   */
  async deleteGeofence(geofenceId) {
    const geofence = await this.geofence.findById(geofenceId);
    if (!geofence) {
      throw new GeofenceError('Geofence not found');
    }

    // Remove from active monitoring
    await this.removeFromActiveMonitoring(geofenceId);

    // Delete related events
    await this.geofenceEvent.deleteByGeofenceId(geofenceId);

    // Delete geofence
    await this.geofence.delete(geofenceId);

    this.emit('geofence_deleted', {
      geofenceId,
      type: geofence.type,
      deliveryId: geofence.deliveryId
    });

    return { success: true, geofenceId };
  }

  /**
   * Get geofences by delivery ID
   */
  async getGeofencesByDeliveryId(deliveryId, activeOnly = true) {
    return await this.geofence.findByDeliveryId(deliveryId, activeOnly);
  }

  /**
   * Find nearby geofences
   */
  async findNearbyGeofences(coordinates, radiusMeters = 5000, options = {}) {
    return await this.geofence.findNearbyGeofences(coordinates, radiusMeters, options);
  }

  /**
   * Check if location is inside any geofences
   */
  async checkGeofences(deliveryId, userId, coordinates) {
    const activeGeofences = await this.getActiveGeofences(deliveryId);
    const events = [];

    for (const geofence of activeGeofences) {
      const isInside = await this.isLocationInsideGeofence(coordinates, geofence);
      const wasInside = await this.wasUserInsideGeofence(userId, geofence.id);
      
      let eventType = null;
      let dwellTime = null;

      if (isInside && !wasInside) {
        eventType = 'enter';
      } else if (!isInside && wasInside) {
        eventType = 'exit';
      } else if (isInside && wasInside) {
        // Check for dwell event
        dwellTime = await this.geofenceEvent.calculateDwellTime(userId, geofence.id);
        const dwellThreshold = geofence.notifications?.onDwell?.duration || 300;
        
        if (dwellTime >= dwellThreshold && geofence.notifications?.onDwell?.enabled) {
          eventType = 'dwell';
        }
      }

      if (eventType) {
        const event = await this.createGeofenceEvent(
          geofence.id,
          userId,
          deliveryId,
          eventType,
          coordinates,
          dwellTime
        );
        
        events.push(event);
        
        // Send notifications if enabled
        if (this.shouldSendNotification(geofence, eventType)) {
          await this.sendGeofenceNotification(geofence, event);
        }
      }

      // Update user's geofence status in cache
      await this.updateUserGeofenceStatus(userId, geofence.id, isInside);
    }

    return events;
  }

  /**
   * Check multiple locations against geofences
   */
  async checkMultipleGeofences(coordinates, geofenceIds) {
    const results = [];

    for (const geofenceId of geofenceIds) {
      const geofence = await this.geofence.findById(geofenceId);
      if (!geofence) continue;

      const isInside = await this.isLocationInsideGeofence(coordinates, geofence);
      
      results.push({
        geofenceId,
        name: geofence.name,
        type: geofence.type,
        isInside,
        distance: await this.calculateDistanceToGeofence(coordinates, geofence)
      });
    }

    return results;
  }

  /**
   * Get geofence events
   */
  async getGeofenceEvents(geofenceId, options = {}) {
    return await this.geofenceEvent.findByGeofenceId(geofenceId, options);
  }

  /**
   * Get geofence statistics
   */
  async getGeofenceStats(geofenceId, options = {}) {
    return await this.geofenceEvent.getEventStats(geofenceId, options);
  }

  /**
   * Create delivery-specific geofences
   */
  async createDeliveryGeofences(deliveryData) {
    const geofences = [];

    // Create pickup geofence
    if (deliveryData.pickupLocation) {
      const pickupGeofence = await this.createGeofence({
        name: `Pickup - ${deliveryData.deliveryNumber}`,
        type: 'pickup',
        deliveryId: deliveryData.id,
        geometry: {
          type: 'circle',
          center: deliveryData.pickupLocation,
          radius: deliveryData.pickupRadius || 100
        },
        notifications: {
          onEntry: true,
          onExit: true,
          onDwell: {
            enabled: true,
            duration: 300 // 5 minutes
          }
        },
        metadata: {
          address: deliveryData.pickupAddress,
          contactName: deliveryData.pickupContactName,
          contactPhone: deliveryData.pickupContactPhone
        }
      });
      geofences.push(pickupGeofence);
    }

    // Create delivery geofence
    if (deliveryData.deliveryLocation) {
      const deliveryGeofence = await this.createGeofence({
        name: `Delivery - ${deliveryData.deliveryNumber}`,
        type: 'delivery',
        deliveryId: deliveryData.id,
        geometry: {
          type: 'circle',
          center: deliveryData.deliveryLocation,
          radius: deliveryData.deliveryRadius || 100
        },
        notifications: {
          onEntry: true,
          onExit: false,
          onDwell: {
            enabled: true,
            duration: 600 // 10 minutes
          }
        },
        metadata: {
          address: deliveryData.deliveryAddress,
          contactName: deliveryData.deliveryContactName,
          contactPhone: deliveryData.deliveryContactPhone
        }
      });
      geofences.push(deliveryGeofence);
    }

    return geofences;
  }

  /**
   * Clean up expired geofences
   */
  async cleanupExpiredGeofences() {
    const deactivated = await this.geofence.deactivateExpiredGeofences();
    
    if (deactivated > 0) {
      this.emit('geofences_expired', { count: deactivated });
    }

    return deactivated;
  }

  // Private helper methods

  validateGeometry(geometry) {
    if (!geometry || !geometry.type) {
      throw new GeofenceError('Geometry type is required');
    }

    switch (geometry.type) {
      case 'circle':
        if (!geometry.center || !geometry.radius) {
          throw new GeofenceError('Circle geometry requires center and radius');
        }
        if (!GeoUtils.isValidCoordinates(geometry.center)) {
          throw new GeofenceError('Invalid center coordinates');
        }
        if (geometry.radius <= 0 || geometry.radius > 10000) {
          throw new GeofenceError('Radius must be between 1 and 10000 meters');
        }
        break;

      case 'polygon':
        if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
          throw new GeofenceError('Polygon geometry requires coordinates array');
        }
        if (geometry.coordinates.length !== 1) {
          throw new GeofenceError('Only simple polygons are supported');
        }
        const ring = geometry.coordinates[0];
        if (ring.length < 4) {
          throw new GeofenceError('Polygon must have at least 4 points');
        }
        // Validate each coordinate
        for (const coord of ring) {
          if (!Array.isArray(coord) || coord.length !== 2) {
            throw new GeofenceError('Invalid polygon coordinate format');
          }
          const [lng, lat] = coord;
          if (!GeoUtils.isValidCoordinates({ latitude: lat, longitude: lng })) {
            throw new GeofenceError('Invalid polygon coordinates');
          }
        }
        break;

      default:
        throw new GeofenceError('Unsupported geometry type');
    }
  }

  normalizeNotifications(notifications) {
    return {
      onEntry: notifications.onEntry || false,
      onExit: notifications.onExit || false,
      onDwell: {
        enabled: notifications.onDwell?.enabled || false,
        duration: notifications.onDwell?.duration || 300
      }
    };
  }

  async isLocationInsideGeofence(coordinates, geofence) {
    if (!geofence.active) return false;

    // Check time-based activation
    const now = new Date();
    if (geofence.startTime && now < new Date(geofence.startTime)) return false;
    if (geofence.endTime && now > new Date(geofence.endTime)) return false;

    switch (geofence.geometryType) {
      case 'circle':
        return GeoUtils.isPointInCircle(
          coordinates,
          geofence.geometry.center,
          geofence.geometry.radius
        );

      case 'polygon':
        return GeoUtils.isPointInPolygon(
          coordinates,
          geofence.geometry.coordinates[0]
        );

      default:
        return false;
    }
  }

  async calculateDistanceToGeofence(coordinates, geofence) {
    switch (geofence.geometryType) {
      case 'circle':
        const distanceToCenter = GeoUtils.calculateDistance(
          coordinates,
          geofence.geometry.center,
          'meters'
        );
        return Math.max(0, distanceToCenter - geofence.geometry.radius);

      case 'polygon':
        // For polygons, calculate distance to closest edge
        const polygon = geofence.geometry.coordinates[0];
        let minDistance = Infinity;

        for (let i = 0; i < polygon.length - 1; i++) {
          const lineStart = { longitude: polygon[i][0], latitude: polygon[i][1] };
          const lineEnd = { longitude: polygon[i + 1][0], latitude: polygon[i + 1][1] };
          const line = [
            [lineStart.longitude, lineStart.latitude],
            [lineEnd.longitude, lineEnd.latitude]
          ];
          
          const closestPoint = GeoUtils.findClosestPointOnLine(coordinates, line);
          minDistance = Math.min(minDistance, closestPoint.distance);
        }

        return minDistance;

      default:
        return 0;
    }
  }

  async createGeofenceEvent(geofenceId, userId, deliveryId, eventType, coordinates, dwellTime = null) {
    const event = await this.geofenceEvent.create({
      geofenceId,
      userId,
      deliveryId,
      eventType,
      coordinates,
      dwellTime
    });

    this.emit('geofence_event', {
      event,
      geofenceId,
      userId,
      deliveryId,
      eventType,
      coordinates
    });

    return event;
  }

  shouldSendNotification(geofence, eventType) {
    const notifications = geofence.notifications || {};
    
    switch (eventType) {
      case 'enter':
        return notifications.onEntry === true;
      case 'exit':
        return notifications.onExit === true;
      case 'dwell':
        return notifications.onDwell?.enabled === true;
      default:
        return false;
    }
  }

  async sendGeofenceNotification(geofence, event) {
    try {
      const notificationData = {
        type: 'geofence_event',
        geofenceName: geofence.name,
        geofenceType: geofence.type,
        eventType: event.eventType,
        deliveryId: geofence.deliveryId,
        location: event.coordinates,
        timestamp: event.triggeredAt,
        metadata: geofence.metadata
      };

      // This would integrate with the notification service
      await this.notificationService.sendGeofenceNotification(
        event.userId,
        notificationData
      );

      this.emit('notification_sent', {
        geofenceId: geofence.id,
        eventId: event.id,
        userId: event.userId,
        eventType: event.eventType
      });

    } catch (error) {
      console.error('Failed to send geofence notification:', error);
      this.emit('notification_failed', {
        geofenceId: geofence.id,
        eventId: event.id,
        error: error.message
      });
    }
  }

  async getActiveGeofences(deliveryId) {
    // Try cache first
    const cacheKey = `active_geofences:${deliveryId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const geofences = await this.geofence.findByDeliveryId(deliveryId, true);
    
    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(geofences));
    
    return geofences;
  }

  async wasUserInsideGeofence(userId, geofenceId) {
    const cacheKey = `user_geofence_status:${userId}:${geofenceId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached !== null) {
      return cached === 'true';
    }

    // Check recent events
    return await this.geofenceEvent.isUserCurrentlyInside(userId, geofenceId);
  }

  async updateUserGeofenceStatus(userId, geofenceId, isInside) {
    const cacheKey = `user_geofence_status:${userId}:${geofenceId}`;
    await this.redis.setex(cacheKey, 3600, isInside.toString()); // 1 hour
  }

  async addToActiveMonitoring(geofenceId) {
    await this.redis.sadd('active_geofences', geofenceId);
  }

  async removeFromActiveMonitoring(geofenceId) {
    await this.redis.srem('active_geofences', geofenceId);
  }
}

module.exports = GeofenceService;