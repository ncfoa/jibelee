const LocationTracking = require('../models/LocationTracking');
const TrackingSession = require('../models/TrackingSession');
const GeoUtils = require('../utils/geoUtils');
const Redis = require('ioredis');
const EventEmitter = require('events');
const { TrackingNotActiveError, LocationAccuracyError } = require('../middleware/errorHandler');

class LocationService extends EventEmitter {
  constructor() {
    super();
    this.locationTracking = new LocationTracking();
    this.trackingSession = new TrackingSession();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.privacyService = require('./privacyService');
  }

  /**
   * Start location tracking for a delivery
   */
  async startTracking(userId, deliveryId, settings = {}) {
    // Check if tracking is already active
    const existingSession = await this.trackingSession.findByDeliveryId(deliveryId);
    if (existingSession && existingSession.status === 'active') {
      throw new TrackingNotActiveError('Tracking is already active for this delivery');
    }

    // Create or resume tracking session
    let session;
    if (existingSession) {
      session = await this.trackingSession.resumeSession(deliveryId);
    } else {
      session = await this.trackingSession.create({
        deliveryId,
        userId,
        settings: this.optimizeTrackingSettings(settings),
        privacySettings: settings.privacySettings || {}
      });
    }

    // Cache session for quick access
    await this.cacheTrackingSession(deliveryId, session);

    // Set up geofences for this delivery
    await this.setupDeliveryGeofences(deliveryId);

    // Emit tracking started event
    this.emit('tracking_started', {
      deliveryId,
      userId,
      sessionId: session.id,
      settings: session.settings
    });

    return {
      trackingId: session.id,
      deliveryId,
      status: 'active',
      settings: session.settings,
      startedAt: session.startedAt
    };
  }

  /**
   * Update location for a delivery
   */
  async updateLocation(userId, deliveryId, locationData) {
    // Validate tracking session
    const session = await this.getTrackingSession(deliveryId);
    if (!session || session.status !== 'active') {
      throw new TrackingNotActiveError('Location tracking is not active for this delivery');
    }

    // Validate location data
    const validatedLocation = this.validateLocationData(locationData);

    // Check location accuracy
    if (validatedLocation.accuracy && validatedLocation.accuracy > 100) {
      console.warn(`Low accuracy location update: ${validatedLocation.accuracy}m`);
    }

    // Apply privacy filters
    const filteredLocation = await this.privacyService.filterLocationData(
      validatedLocation,
      session.privacySettings
    );

    // Calculate additional metrics
    const lastLocation = await this.locationTracking.findLatestByDeliveryId(deliveryId, userId);
    let additionalDistance = 0;
    let calculatedSpeed = null;

    if (lastLocation) {
      additionalDistance = GeoUtils.calculateDistance(
        lastLocation.coordinates,
        validatedLocation.coordinates,
        'kilometers'
      );

      // Calculate speed if we have timestamp data
      if (lastLocation.timestamp && validatedLocation.timestamp) {
        calculatedSpeed = GeoUtils.calculateSpeed(
          { ...lastLocation.coordinates, timestamp: lastLocation.timestamp },
          { ...validatedLocation.coordinates, timestamp: validatedLocation.timestamp },
          'kmh'
        );
      }
    }

    // Store location in database
    const locationRecord = await this.locationTracking.create({
      deliveryId,
      userId,
      coordinates: validatedLocation.coordinates,
      accuracy: validatedLocation.accuracy,
      altitude: validatedLocation.altitude,
      bearing: validatedLocation.bearing,
      speed: validatedLocation.speed || calculatedSpeed,
      batteryLevel: locationData.deviceInfo?.batteryLevel,
      networkType: locationData.deviceInfo?.networkType,
      timestamp: validatedLocation.timestamp || new Date()
    });

    // Update tracking session
    await this.trackingSession.incrementUpdateCount(deliveryId);
    if (additionalDistance > 0) {
      await this.trackingSession.updateDistance(deliveryId, additionalDistance);
    }

    // Cache current location
    await this.cacheCurrentLocation(deliveryId, userId, filteredLocation);

    // Check geofences
    const geofenceEvents = await this.checkGeofences(deliveryId, userId, validatedLocation.coordinates);

    // Emit location update event
    this.emit('location_updated', {
      deliveryId,
      userId,
      location: filteredLocation,
      locationId: locationRecord.id,
      geofenceEvents,
      additionalDistance,
      calculatedSpeed
    });

    return {
      status: 'updated',
      locationId: locationRecord.id,
      location: filteredLocation,
      geofenceEvents,
      metrics: {
        additionalDistance,
        calculatedSpeed,
        totalDistance: session.totalDistance + additionalDistance
      }
    };
  }

  /**
   * Batch update multiple locations
   */
  async batchUpdateLocations(userId, deliveryId, locations) {
    const session = await this.getTrackingSession(deliveryId);
    if (!session || session.status !== 'active') {
      throw new TrackingNotActiveError('Location tracking is not active');
    }

    const results = [];
    const validLocations = [];

    // Validate all locations first
    for (const locationData of locations) {
      try {
        const validatedLocation = this.validateLocationData(locationData);
        validLocations.push(validatedLocation);
      } catch (error) {
        results.push({
          success: false,
          timestamp: locationData.timestamp,
          error: error.message
        });
      }
    }

    // Sort by timestamp
    validLocations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Process locations in batches
    const batchSize = 50;
    let totalDistance = 0;

    for (let i = 0; i < validLocations.length; i += batchSize) {
      const batch = validLocations.slice(i, i + batchSize);
      
      try {
        const batchData = batch.map(location => ({
          deliveryId,
          userId,
          coordinates: location.coordinates,
          accuracy: location.accuracy,
          altitude: location.altitude,
          bearing: location.bearing,
          speed: location.speed,
          batteryLevel: location.deviceInfo?.batteryLevel,
          networkType: location.deviceInfo?.networkType,
          timestamp: location.timestamp
        }));

        const locationRecords = await this.locationTracking.batchCreate(batchData);

        // Calculate distance for this batch
        for (let j = 1; j < batch.length; j++) {
          const distance = GeoUtils.calculateDistance(
            batch[j - 1].coordinates,
            batch[j].coordinates,
            'kilometers'
          );
          totalDistance += distance;
        }

        // Add successful results
        locationRecords.forEach((record, index) => {
          results.push({
            success: true,
            locationId: record.id,
            timestamp: batch[index].timestamp
          });
        });

      } catch (error) {
        // Add failed results for this batch
        batch.forEach(location => {
          results.push({
            success: false,
            timestamp: location.timestamp,
            error: error.message
          });
        });
      }
    }

    // Update session totals
    const successfulUpdates = results.filter(r => r.success).length;
    if (successfulUpdates > 0) {
      await this.trackingSession.updateSession(deliveryId, {
        totalUpdates: session.totalUpdates + successfulUpdates,
        totalDistance: session.totalDistance + totalDistance
      });
    }

    // Cache the latest location
    if (validLocations.length > 0) {
      const latestLocation = validLocations[validLocations.length - 1];
      const filteredLocation = await this.privacyService.filterLocationData(
        latestLocation,
        session.privacySettings
      );
      await this.cacheCurrentLocation(deliveryId, userId, filteredLocation);
    }

    this.emit('batch_locations_updated', {
      deliveryId,
      userId,
      processed: locations.length,
      successful: successfulUpdates,
      totalDistance
    });

    return {
      processed: locations.length,
      successful: successfulUpdates,
      failed: locations.length - successfulUpdates,
      totalDistance,
      results
    };
  }

  /**
   * Stop location tracking
   */
  async stopTracking(deliveryId, reason = null) {
    const session = await this.trackingSession.stopSession(deliveryId);
    
    if (!session) {
      throw new TrackingNotActiveError('No active tracking session found');
    }

    // Clear cached data
    await this.clearTrackingCache(deliveryId);

    // Emit tracking stopped event
    this.emit('tracking_stopped', {
      deliveryId,
      sessionId: session.id,
      reason,
      totalUpdates: session.totalUpdates,
      totalDistance: session.totalDistance,
      totalDuration: session.totalDuration
    });

    return {
      status: 'stopped',
      sessionId: session.id,
      summary: {
        totalUpdates: session.totalUpdates,
        totalDistance: session.totalDistance,
        totalDuration: session.totalDuration,
        startedAt: session.startedAt,
        stoppedAt: session.stoppedAt
      }
    };
  }

  /**
   * Get current location for a delivery
   */
  async getCurrentLocation(deliveryId, userId = null) {
    // Try cache first
    const cachedLocation = await this.getCachedLocation(deliveryId, userId);
    if (cachedLocation) {
      return cachedLocation;
    }

    // Fallback to database
    const location = await this.locationTracking.findLatestByDeliveryId(deliveryId, userId);
    if (!location) {
      return null;
    }

    // Apply privacy filters
    const session = await this.getTrackingSession(deliveryId);
    const filteredLocation = session ? 
      await this.privacyService.filterLocationData(location, session.privacySettings) :
      location;

    // Cache the result
    await this.cacheCurrentLocation(deliveryId, userId, filteredLocation);

    return filteredLocation;
  }

  /**
   * Get location history for a delivery
   */
  async getLocationHistory(deliveryId, options = {}) {
    const locations = await this.locationTracking.findByDeliveryId(deliveryId, options);
    
    if (locations.length === 0) {
      return {
        deliveryId,
        locations: [],
        summary: {
          totalPoints: 0,
          totalDistance: 0,
          duration: 0
        }
      };
    }

    // Calculate route statistics
    const summary = await this.calculateRouteSummary(locations);

    // Apply privacy filters if needed
    const session = await this.getTrackingSession(deliveryId);
    let filteredLocations = locations;
    
    if (session && session.privacySettings) {
      filteredLocations = await Promise.all(
        locations.map(location => 
          this.privacyService.filterLocationData(location, session.privacySettings)
        )
      );
    }

    return {
      deliveryId,
      locations: filteredLocations,
      summary,
      trackingPeriod: {
        start: locations[locations.length - 1]?.timestamp,
        end: locations[0]?.timestamp,
        totalPoints: locations.length
      }
    };
  }

  /**
   * Find nearby active deliveries
   */
  async findNearbyDeliveries(coordinates, radiusMeters = 5000, options = {}) {
    const locations = await this.locationTracking.findNearbyLocations(
      coordinates,
      radiusMeters,
      options
    );

    // Group by delivery and get the latest location for each
    const deliveryMap = new Map();
    
    locations.forEach(location => {
      const existing = deliveryMap.get(location.deliveryId);
      if (!existing || new Date(location.timestamp) > new Date(existing.timestamp)) {
        deliveryMap.set(location.deliveryId, location);
      }
    });

    return Array.from(deliveryMap.values());
  }

  /**
   * Get location analytics
   */
  async getLocationAnalytics(options = {}) {
    const {
      deliveryId,
      userId,
      startTime,
      endTime,
      period = 'week'
    } = options;

    // Get location statistics
    const stats = await this.locationTracking.getLocationStats(deliveryId, userId);
    
    // Get session statistics
    const sessionStats = await this.trackingSession.getSessionStats({
      userId,
      startTime,
      endTime
    });

    return {
      period,
      locationStats: stats,
      sessionStats: sessionStats.totals,
      accuracy: {
        average: stats.avg_accuracy,
        distribution: await this.getAccuracyDistribution(deliveryId, userId)
      },
      coverage: await this.getCoverageAnalytics(deliveryId, userId),
      performance: {
        updateFrequency: stats.total_points && stats.duration_minutes ? 
          (stats.total_points / stats.duration_minutes).toFixed(2) : 0,
        batteryUsage: {
          average: stats.avg_battery,
          minimum: stats.min_battery
        }
      }
    };
  }

  // Private helper methods

  async getTrackingSession(deliveryId) {
    // Try cache first
    const cached = await this.redis.get(`tracking_session:${deliveryId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const session = await this.trackingSession.findByDeliveryId(deliveryId);
    if (session) {
      await this.cacheTrackingSession(deliveryId, session);
    }

    return session;
  }

  async cacheTrackingSession(deliveryId, session) {
    await this.redis.setex(
      `tracking_session:${deliveryId}`,
      3600, // 1 hour
      JSON.stringify(session)
    );
  }

  async cacheCurrentLocation(deliveryId, userId, location) {
    const key = userId ? 
      `current_location:${deliveryId}:${userId}` :
      `current_location:${deliveryId}`;
    
    await this.redis.setex(key, 300, JSON.stringify(location)); // 5 minutes
  }

  async getCachedLocation(deliveryId, userId) {
    const key = userId ? 
      `current_location:${deliveryId}:${userId}` :
      `current_location:${deliveryId}`;
    
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async clearTrackingCache(deliveryId) {
    const keys = await this.redis.keys(`*${deliveryId}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  validateLocationData(locationData) {
    const { coordinates, accuracy, speed, timestamp } = locationData;

    if (!GeoUtils.isValidCoordinates(coordinates)) {
      throw new LocationAccuracyError('Invalid coordinates provided');
    }

    // Validate accuracy
    if (accuracy && (accuracy < 0 || accuracy > 10000)) {
      throw new LocationAccuracyError('Invalid accuracy value');
    }

    // Validate speed
    if (speed && (speed < 0 || speed > 500)) {
      throw new LocationAccuracyError('Invalid speed value');
    }

    return {
      coordinates,
      accuracy,
      altitude: locationData.altitude,
      bearing: locationData.bearing,
      speed,
      timestamp: timestamp || new Date()
    };
  }

  optimizeTrackingSettings(settings) {
    const optimized = {
      interval: 30,
      accuracy: 'high',
      batteryOptimization: true,
      backgroundTracking: true,
      ...settings
    };

    // Adjust interval based on battery optimization
    if (optimized.batteryOptimization) {
      optimized.interval = Math.max(optimized.interval, 15);
    }

    return optimized;
  }

  async setupDeliveryGeofences(deliveryId) {
    // This would set up pickup and delivery geofences
    // Implementation depends on delivery service integration
    this.emit('geofences_setup', { deliveryId });
  }

  async checkGeofences(deliveryId, userId, coordinates) {
    // This would check against active geofences
    // Implementation in geofenceService
    return [];
  }

  async calculateRouteSummary(locations) {
    if (locations.length < 2) {
      return {
        totalDistance: 0,
        duration: 0,
        averageSpeed: 0,
        maxSpeed: 0
      };
    }

    const totalDistance = GeoUtils.calculateRouteDistance(
      locations.map(l => l.coordinates),
      'kilometers'
    );

    const startTime = new Date(locations[locations.length - 1].timestamp);
    const endTime = new Date(locations[0].timestamp);
    const duration = Math.max(0, (endTime - startTime) / (1000 * 60)); // minutes

    const speeds = locations
      .map(l => l.speed)
      .filter(s => s !== null && s !== undefined);

    const averageSpeed = speeds.length > 0 ? 
      speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0;
    
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    return {
      totalDistance,
      duration,
      averageSpeed,
      maxSpeed,
      totalPoints: locations.length
    };
  }

  async getAccuracyDistribution(deliveryId, userId) {
    // Implementation for accuracy distribution analysis
    return {
      excellent: 0, // < 5m
      good: 0,     // 5-15m
      fair: 0,     // 15-50m
      poor: 0      // > 50m
    };
  }

  async getCoverageAnalytics(deliveryId, userId) {
    // Implementation for coverage analysis
    return {
      urban: 95,
      suburban: 88,
      rural: 72,
      indoor: 45
    };
  }
}

module.exports = LocationService;