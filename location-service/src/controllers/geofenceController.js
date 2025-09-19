const GeofenceService = require('../services/geofenceService');
const { asyncHandler, sendSuccessResponse, NotFoundError } = require('../middleware/errorHandler');

class GeofenceController {
  constructor() {
    this.geofenceService = new GeofenceService();
  }

  /**
   * Create a new geofence
   * POST /api/v1/location/geofence
   */
  createGeofence = asyncHandler(async (req, res) => {
    const {
      name,
      type,
      deliveryId,
      geometry,
      notifications,
      schedule,
      metadata
    } = req.body;

    const geofence = await this.geofenceService.createGeofence({
      name,
      type,
      deliveryId,
      geometry,
      notifications,
      schedule,
      metadata
    });

    sendSuccessResponse(res, {
      geofenceId: geofence.id,
      name: geofence.name,
      type: geofence.type,
      status: 'active',
      geometry: geofence.geometry,
      createdAt: geofence.createdAt,
      expiresAt: geofence.endTime
    }, 'Geofence created successfully', 201);
  });

  /**
   * Get active geofences
   * GET /api/v1/location/geofences/active
   */
  getActiveGeofences = asyncHandler(async (req, res) => {
    const {
      deliveryId,
      type,
      lat,
      lng,
      radius = 5000
    } = req.query;

    let geofences;

    if (deliveryId) {
      geofences = await this.geofenceService.getGeofencesByDeliveryId(deliveryId, true);
    } else if (lat && lng) {
      const coordinates = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
      };
      geofences = await this.geofenceService.findNearbyGeofences(
        coordinates,
        parseInt(radius),
        { type, activeOnly: true }
      );
    } else {
      geofences = [];
    }

    sendSuccessResponse(res, {
      geofences: geofences.map(geofence => ({
        id: geofence.id,
        name: geofence.name,
        type: geofence.type,
        geometry: geofence.geometry,
        notifications: geofence.notifications,
        active: geofence.active,
        deliveryId: geofence.deliveryId,
        distance: geofence.distance
      })),
      total: geofences.length
    });
  });

  /**
   * Update a geofence
   * PUT /api/v1/location/geofences/:geofenceId
   */
  updateGeofence = asyncHandler(async (req, res) => {
    const { geofenceId } = req.params;
    const updateData = req.body;

    const geofence = await this.geofenceService.updateGeofence(geofenceId, updateData);
    
    if (!geofence) {
      throw new NotFoundError('Geofence');
    }

    sendSuccessResponse(res, {
      geofenceId: geofence.id,
      name: geofence.name,
      type: geofence.type,
      active: geofence.active,
      geometry: geofence.geometry,
      notifications: geofence.notifications,
      updatedAt: geofence.updatedAt
    }, 'Geofence updated successfully');
  });

  /**
   * Delete a geofence
   * DELETE /api/v1/location/geofences/:geofenceId
   */
  deleteGeofence = asyncHandler(async (req, res) => {
    const { geofenceId } = req.params;

    const result = await this.geofenceService.deleteGeofence(geofenceId);

    sendSuccessResponse(res, {
      geofenceId,
      deleted: true
    }, 'Geofence deleted successfully');
  });

  /**
   * Check geofence status for a location
   * POST /api/v1/location/geofence/check
   */
  checkGeofenceStatus = asyncHandler(async (req, res) => {
    const { location, geofences } = req.body;

    const coordinates = {
      latitude: location.lat,
      longitude: location.lng
    };

    const geofenceIds = geofences.map(g => g.id);
    const results = await this.geofenceService.checkMultipleGeofences(coordinates, geofenceIds);

    // Mock nearby POIs
    const nearbyPois = [
      {
        name: 'Central Park',
        type: 'park',
        distance: 1.2,
        location: {
          lat: 40.7829,
          lng: -73.9654
        }
      }
    ];

    sendSuccessResponse(res, {
      location: coordinates,
      geofenceStatus: results.map(result => ({
        geofenceId: result.geofenceId,
        status: result.isInside ? 'inside' : 'outside',
        distance: result.distance,
        type: result.type,
        enteredAt: result.isInside ? new Date().toISOString() : null,
        dwellTime: result.isInside ? '2 minutes' : null
      })),
      nearbyPois
    });
  });

  /**
   * Get geofence events
   * GET /api/v1/location/geofences/:geofenceId/events
   */
  getGeofenceEvents = asyncHandler(async (req, res) => {
    const { geofenceId } = req.params;
    const {
      eventType,
      startTime,
      endTime,
      userId,
      limit = 100,
      offset = 0
    } = req.query;

    const options = {
      eventType,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      userId,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const events = await this.geofenceService.getGeofenceEvents(geofenceId, options);

    sendSuccessResponse(res, {
      geofenceId,
      events: events.map(event => ({
        id: event.id,
        eventType: event.eventType,
        userId: event.userId,
        deliveryId: event.deliveryId,
        coordinates: event.coordinates,
        dwellTime: event.dwellTime,
        triggeredAt: event.triggeredAt
      })),
      total: events.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: events.length === parseInt(limit)
      }
    });
  });

  /**
   * Get geofence statistics
   * GET /api/v1/location/geofences/:geofenceId/stats
   */
  getGeofenceStats = asyncHandler(async (req, res) => {
    const { geofenceId } = req.params;
    const {
      startTime,
      endTime,
      userId
    } = req.query;

    const options = {
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      userId
    };

    const stats = await this.geofenceService.getGeofenceStats(geofenceId, options);

    sendSuccessResponse(res, {
      geofenceId,
      period: {
        start: startTime,
        end: endTime
      },
      eventStats: stats.byEventType,
      totals: stats.totals,
      summary: {
        totalEvents: stats.totals.totalEvents,
        uniqueUsers: stats.totals.uniqueUsers,
        uniqueDeliveries: stats.totals.uniqueDeliveries,
        mostCommonEvent: stats.byEventType.length > 0 ? 
          stats.byEventType.reduce((prev, current) => 
            prev.count > current.count ? prev : current
          ).eventType : null
      }
    });
  });

  /**
   * Create delivery-specific geofences
   * POST /api/v1/location/geofences/delivery
   */
  createDeliveryGeofences = asyncHandler(async (req, res) => {
    const {
      deliveryId,
      deliveryNumber,
      pickupLocation,
      pickupAddress,
      pickupRadius = 100,
      deliveryLocation,
      deliveryAddress,
      deliveryRadius = 100,
      contactInfo
    } = req.body;

    const deliveryData = {
      id: deliveryId,
      deliveryNumber,
      pickupLocation,
      pickupAddress,
      pickupRadius,
      deliveryLocation,
      deliveryAddress,
      deliveryRadius,
      ...contactInfo
    };

    const geofences = await this.geofenceService.createDeliveryGeofences(deliveryData);

    sendSuccessResponse(res, {
      deliveryId,
      geofences: geofences.map(geofence => ({
        id: geofence.id,
        name: geofence.name,
        type: geofence.type,
        geometry: geofence.geometry,
        notifications: geofence.notifications,
        active: geofence.active
      })),
      total: geofences.length
    }, 'Delivery geofences created successfully', 201);
  });

  /**
   * Get geofence recommendations
   * GET /api/v1/location/geofences/recommendations
   */
  getGeofenceRecommendations = asyncHandler(async (req, res) => {
    const {
      lat,
      lng,
      type = 'pickup',
      radius = 10
    } = req.query;

    const coordinates = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng)
    };

    // Mock recommendations based on location type
    const recommendations = [];

    if (type === 'pickup' || type === 'delivery') {
      recommendations.push({
        type: 'optimal_radius',
        title: 'Recommended geofence radius',
        description: 'Based on location density and accuracy',
        value: 150,
        unit: 'meters',
        confidence: 85
      });

      recommendations.push({
        type: 'notification_settings',
        title: 'Suggested notification settings',
        description: 'Optimized for this location type',
        settings: {
          onEntry: true,
          onExit: type === 'pickup',
          onDwell: {
            enabled: true,
            duration: type === 'pickup' ? 300 : 600
          }
        },
        confidence: 92
      });
    }

    recommendations.push({
      type: 'poi_integration',
      title: 'Nearby landmarks',
      description: 'Consider these landmarks for better user experience',
      landmarks: [
        {
          name: 'Starbucks Coffee',
          type: 'cafe',
          distance: 50,
          usefulness: 'high'
        },
        {
          name: 'Main Street Entrance',
          type: 'entrance',
          distance: 25,
          usefulness: 'medium'
        }
      ]
    });

    sendSuccessResponse(res, {
      location: coordinates,
      type,
      recommendations
    });
  });
}

module.exports = GeofenceController;