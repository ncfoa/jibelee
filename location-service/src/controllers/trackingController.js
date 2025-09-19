const LocationService = require('../services/locationService');
const { asyncHandler, sendSuccessResponse } = require('../middleware/errorHandler');

class TrackingController {
  constructor() {
    this.locationService = new LocationService();
  }

  /**
   * Start location tracking for a delivery
   * POST /api/v1/location/track
   */
  startTracking = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { deliveryId, location, timestamp, batteryLevel, networkType, deviceInfo } = req.body;

    const result = await this.locationService.updateLocation(userId, deliveryId, {
      coordinates: {
        latitude: location.lat,
        longitude: location.lng
      },
      accuracy: location.accuracy,
      altitude: location.altitude,
      bearing: location.bearing,
      speed: location.speed,
      timestamp,
      deviceInfo: {
        batteryLevel,
        networkType,
        ...deviceInfo
      }
    });

    // Calculate route progress and ETA (mock implementation)
    const routeProgress = {
      progress: 35.5,
      remainingDistance: 198.5,
      estimatedArrival: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString()
    };

    sendSuccessResponse(res, {
      trackingId: result.locationId,
      deliveryId,
      status: 'tracking_active',
      location: {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        timestamp: result.location.timestamp
      },
      route: routeProgress,
      notifications: {
        customerNotified: true,
        milestoneReached: null
      }
    });
  });

  /**
   * Get current location for a delivery
   * GET /api/v1/location/current/:deliveryId
   */
  getCurrentLocation = asyncHandler(async (req, res) => {
    const { deliveryId } = req.params;
    const userId = req.user.id;

    const location = await this.locationService.getCurrentLocation(deliveryId, userId);
    
    if (!location) {
      return sendSuccessResponse(res, {
        deliveryId,
        message: 'No location data available'
      });
    }

    // Mock traveler and route information
    const response = {
      deliveryId,
      traveler: {
        id: userId,
        firstName: 'John',
        lastName: 'Doe'
      },
      currentLocation: {
        lat: location.coordinates.latitude,
        lng: location.coordinates.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        address: 'Somewhere on the route' // Would be reverse geocoded
      },
      route: {
        totalDistance: 306,
        remainingDistance: 165.5,
        progress: 45.9,
        estimatedArrival: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        delayStatus: 'on_time',
        delayMinutes: 0
      },
      status: 'in_transit',
      lastUpdate: location.timestamp,
      batteryLevel: location.batteryLevel || 78,
      networkStatus: 'good'
    };

    sendSuccessResponse(res, response);
  });

  /**
   * Get location history for a delivery
   * GET /api/v1/location/history/:deliveryId
   */
  getLocationHistory = asyncHandler(async (req, res) => {
    const { deliveryId } = req.params;
    const { from, to, interval = '60', format = 'json' } = req.query;

    const options = {
      startTime: from ? new Date(from) : undefined,
      endTime: to ? new Date(to) : undefined,
      limit: 1000
    };

    const history = await this.locationService.getLocationHistory(deliveryId, options);
    
    if (history.locations.length === 0) {
      return sendSuccessResponse(res, {
        deliveryId,
        message: 'No location history available'
      });
    }

    const response = {
      deliveryId,
      trackingPeriod: {
        start: history.trackingPeriod.start,
        end: history.trackingPeriod.end,
        duration: `${Math.round(history.summary.duration)} minutes`
      },
      route: {
        totalDistance: history.summary.totalDistance,
        actualDistance: history.summary.totalDistance * 1.02, // Add small variance
        averageSpeed: history.summary.averageSpeed,
        maxSpeed: history.summary.maxSpeed,
        stops: 2, // Mock data
        totalStopTime: '15 minutes'
      },
      locations: history.locations.map(loc => ({
        lat: loc.coordinates.latitude,
        lng: loc.coordinates.longitude,
        timestamp: loc.timestamp,
        accuracy: loc.accuracy,
        speed: loc.speed || 0,
        event: this.determineLocationEvent(loc)
      })),
      milestones: this.generateMilestones(history.locations)
    };

    sendSuccessResponse(res, response);
  });

  /**
   * Search for available travelers nearby
   * GET /api/v1/location/travelers/nearby
   */
  findNearbyTravelers = asyncHandler(async (req, res) => {
    const {
      lat,
      lng,
      radius = 50,
      destination,
      departureTimeFrom,
      departureTimeTo,
      minRating,
      capacity,
      limit = 20
    } = req.query;

    const coordinates = { latitude: parseFloat(lat), longitude: parseFloat(lng) };
    const radiusMeters = parseFloat(radius) * 1000;

    const nearbyDeliveries = await this.locationService.findNearbyDeliveries(
      coordinates,
      radiusMeters,
      { limit: parseInt(limit) }
    );

    // Mock traveler data - in real implementation, this would integrate with user service
    const travelers = nearbyDeliveries.slice(0, limit).map((delivery, index) => ({
      id: `traveler_${index + 1}`,
      user: {
        firstName: ['Jane', 'John', 'Alice', 'Bob'][index % 4],
        lastName: ['Doe', 'Smith', 'Johnson', 'Wilson'][index % 4],
        profilePicture: `https://cdn.example.com/pic${index + 1}.jpg`,
        rating: {
          average: 4.2 + (Math.random() * 0.8),
          count: Math.floor(Math.random() * 200) + 50
        }
      },
      trip: {
        id: `trip_${index + 1}`,
        title: 'NYC to Boston Flight',
        type: 'flight',
        departureTime: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        arrivalTime: new Date(Date.now() + Math.random() * 30 * 60 * 60 * 1000).toISOString()
      },
      location: {
        current: {
          lat: delivery.coordinates.latitude,
          lng: delivery.coordinates.longitude,
          address: 'Manhattan, NY',
          lastUpdate: delivery.timestamp
        },
        pickup: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          address: 'Financial District, NY'
        },
        destination: destination ? {
          lat: destination.split(',')[0],
          lng: destination.split(',')[1],
          address: 'Boston, MA'
        } : null
      },
      distance: {
        fromSearchCenter: delivery.distance / 1000,
        routeMatch: 85 + Math.random() * 15
      },
      capacity: {
        available: {
          weight: Math.random() * 5 + 1,
          volume: Math.random() * 10 + 5,
          items: Math.floor(Math.random() * 3) + 1
        }
      },
      pricing: {
        estimatedPrice: 20 + Math.random() * 20,
        priceRange: {
          min: 15 + Math.random() * 10,
          max: 30 + Math.random() * 15
        }
      },
      status: 'available',
      responseTime: `${Math.random() * 3 + 1} hours average`
    }));

    const summary = {
      totalFound: travelers.length,
      averageDistance: travelers.reduce((sum, t) => sum + t.distance.fromSearchCenter, 0) / travelers.length || 0,
      averagePrice: travelers.reduce((sum, t) => sum + t.pricing.estimatedPrice, 0) / travelers.length || 0,
      availableCapacity: travelers.reduce((sum, t) => sum + t.capacity.available.weight, 0)
    };

    sendSuccessResponse(res, {
      searchCriteria: {
        center: { lat: parseFloat(lat), lng: parseFloat(lng) },
        radius: parseInt(radius),
        filters: {
          minRating: minRating ? parseFloat(minRating) : undefined,
          capacity: capacity ? parseFloat(capacity) : undefined
        }
      },
      travelers,
      summary
    });
  });

  /**
   * Get ETA updates for a delivery
   * GET /api/v1/location/eta/:deliveryId
   */
  getETAUpdates = asyncHandler(async (req, res) => {
    const { deliveryId } = req.params;

    // Mock ETA calculation - in real implementation, this would use route optimization service
    const currentEta = {
      pickup: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      delivery: new Date(Date.now() + 4.25 * 60 * 60 * 1000).toISOString()
    };

    const originalEta = {
      pickup: new Date(Date.now() + 0 * 60 * 1000).toISOString(),
      delivery: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    };

    const response = {
      deliveryId,
      currentEta,
      originalEta,
      changes: {
        pickupDelay: 30,
        deliveryDelay: 15,
        reason: 'traffic_congestion',
        lastUpdate: new Date().toISOString()
      },
      confidence: {
        pickup: 85,
        delivery: 78
      },
      factors: [
        {
          factor: 'traffic',
          impact: 12,
          description: 'Heavy traffic on I-95'
        },
        {
          factor: 'weather',
          impact: 3,
          description: 'Light rain reducing speed'
        }
      ],
      notifications: {
        customerNotified: true,
        notificationSent: new Date().toISOString()
      }
    };

    sendSuccessResponse(res, response);
  });

  /**
   * Get location analytics
   * GET /api/v1/location/analytics
   */
  getLocationAnalytics = asyncHandler(async (req, res) => {
    const { period = 'week', metric, userId } = req.query;
    const requestingUserId = req.user.id;

    const options = {
      period,
      userId: userId || requestingUserId
    };

    const analytics = await this.locationService.getLocationAnalytics(options);

    const response = {
      period,
      summary: {
        totalDeliveries: 45,
        averageAccuracy: analytics.accuracy?.average || 12.5,
        trackingUptime: 98.2,
        batteryUsage: {
          average: analytics.performance?.batteryUsage?.average || 15,
          optimized: true
        }
      },
      accuracy: {
        gps: {
          average: analytics.accuracy?.average || 8.5,
          best: 3.2,
          worst: 25.0
        },
        network: {
          wifi: 5.2,
          cellular: 12.8
        }
      },
      coverage: analytics.coverage || {
        urban: 99.1,
        suburban: 96.8,
        rural: 87.3,
        indoor: 45.2
      },
      performance: {
        updateFrequency: analytics.performance?.updateFrequency || '30 seconds average',
        dataUsage: '2.5 MB per delivery',
        batteryOptimization: 'active'
      },
      heatmap: {
        popularRoutes: [
          {
            route: 'NYC → Boston',
            frequency: 12,
            averageAccuracy: 9.2
          }
        ],
        problemAreas: [
          {
            area: 'Tunnel sections',
            issue: 'GPS signal loss',
            frequency: 8
          }
        ]
      }
    };

    sendSuccessResponse(res, response);
  });

  // Helper methods

  determineLocationEvent(location) {
    // Simple logic to determine location event type
    if (location.speed < 2) {
      return 'stationary';
    } else if (location.speed < 10) {
      return 'slow_movement';
    } else {
      return 'route_progress';
    }
  }

  generateMilestones(locations) {
    if (locations.length === 0) return [];

    const milestones = [];
    
    // Add pickup milestone (first location)
    if (locations.length > 0) {
      const firstLocation = locations[locations.length - 1];
      milestones.push({
        type: 'pickup_completed',
        timestamp: firstLocation.timestamp,
        location: {
          lat: firstLocation.coordinates.latitude,
          lng: firstLocation.coordinates.longitude
        }
      });
    }

    // Add midpoint milestone
    if (locations.length > 2) {
      const midIndex = Math.floor(locations.length / 2);
      const midLocation = locations[midIndex];
      milestones.push({
        type: 'halfway_point',
        timestamp: midLocation.timestamp,
        location: {
          lat: midLocation.coordinates.latitude,
          lng: midLocation.coordinates.longitude
        },
        description: 'Halfway to destination'
      });
    }

    return milestones;
  }
}

module.exports = TrackingController;