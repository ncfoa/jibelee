const EmergencyLocation = require('../models/EmergencyLocation');
const GeoUtils = require('../utils/geoUtils');
const { asyncHandler, sendSuccessResponse, NotFoundError } = require('../middleware/errorHandler');

class EmergencyController {
  constructor() {
    this.emergencyLocation = new EmergencyLocation();
    this.notificationService = require('../services/notificationService');
  }

  /**
   * Report an emergency
   * POST /api/v1/location/emergency
   */
  reportEmergency = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      deliveryId,
      emergencyType,
      severity,
      location,
      description,
      contactNumber,
      requiresAssistance
    } = req.body;

    const coordinates = {
      lat: location.latitude,
      lng: location.longitude
    };

    // Create emergency record
    const emergency = await this.emergencyLocation.create({
      deliveryId,
      userId,
      emergencyType,
      coordinates,
      accuracy: location.accuracy,
      description,
      contactNumber,
      requiresAssistance,
      severity
    });

    // Find nearby emergency services
    const nearbyServices = await this.findNearbyEmergencyServices(
      coordinates,
      emergencyType
    );

    // Generate case number
    const caseNumber = `EMG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Send notifications based on severity
    if (severity === 'critical' || severity === 'high') {
      await this.notifyEmergencyServices(emergency);
    }

    sendSuccessResponse(res, {
      emergencyId: emergency.id,
      status: 'reported',
      location: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        address: await this.reverseGeocode(coordinates) // Mock implementation
      },
      nearbyServices,
      notifications: {
        customerNotified: true,
        adminNotified: severity === 'critical' || severity === 'high',
        emergencyContactsNotified: false
      },
      caseNumber,
      supportContact: '+1800SUPPORT'
    }, 'Emergency reported successfully', 201);
  });

  /**
   * Update emergency status
   * PUT /api/v1/location/emergency/:emergencyId
   */
  updateEmergencyStatus = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;
    const { status, notes, resolvedBy } = req.body;

    const emergency = await this.emergencyLocation.updateStatus(emergencyId, {
      status,
      resolutionNotes: notes,
      resolvedBy
    });

    if (!emergency) {
      throw new NotFoundError('Emergency');
    }

    sendSuccessResponse(res, {
      emergencyId: emergency.id,
      status: emergency.status,
      updatedAt: new Date().toISOString(),
      resolutionNotes: emergency.resolutionNotes,
      resolvedAt: emergency.resolvedAt
    }, 'Emergency status updated successfully');
  });

  /**
   * Get nearby emergency services
   * GET /api/v1/location/emergency/services
   */
  getNearbyEmergencyServices = asyncHandler(async (req, res) => {
    const {
      lat,
      lng,
      radius = 10000,
      type
    } = req.query;

    const coordinates = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };

    const services = await this.findNearbyEmergencyServices(
      coordinates,
      type,
      parseInt(radius)
    );

    sendSuccessResponse(res, {
      location: coordinates,
      radius: parseInt(radius),
      services,
      total: services.length
    });
  });

  /**
   * Get emergency details
   * GET /api/v1/location/emergency/:emergencyId
   */
  getEmergencyDetails = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;

    const emergency = await this.emergencyLocation.findById(emergencyId);
    
    if (!emergency) {
      throw new NotFoundError('Emergency');
    }

    // Get nearby services for context
    const nearbyServices = await this.findNearbyEmergencyServices(
      emergency.coordinates,
      emergency.emergencyType
    );

    sendSuccessResponse(res, {
      id: emergency.id,
      deliveryId: emergency.deliveryId,
      userId: emergency.userId,
      emergencyType: emergency.emergencyType,
      severity: emergency.severity,
      status: emergency.status,
      location: {
        lat: emergency.coordinates.latitude,
        lng: emergency.coordinates.longitude,
        accuracy: emergency.accuracy,
        address: await this.reverseGeocode(emergency.coordinates)
      },
      description: emergency.description,
      contactNumber: emergency.contactNumber,
      requiresAssistance: emergency.requiresAssistance,
      nearbyServices,
      timeline: {
        reportedAt: emergency.createdAt,
        resolvedAt: emergency.resolvedAt,
        resolutionTime: emergency.resolvedAt ? 
          Math.round((new Date(emergency.resolvedAt) - new Date(emergency.createdAt)) / (1000 * 60)) : null
      },
      resolutionNotes: emergency.resolutionNotes
    });
  });

  /**
   * Get emergency history for user or delivery
   * GET /api/v1/location/emergency/history
   */
  getEmergencyHistory = asyncHandler(async (req, res) => {
    const {
      userId,
      deliveryId,
      status,
      severity,
      startTime,
      endTime,
      limit = 50,
      offset = 0
    } = req.query;

    const requestingUserId = req.user.id;
    const searchUserId = userId || requestingUserId;

    const options = {
      status: status ? status.split(',') : undefined,
      severity: severity ? severity.split(',') : undefined,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    let emergencies;
    if (deliveryId) {
      emergencies = await this.emergencyLocation.findByDeliveryId(deliveryId, options);
    } else {
      emergencies = await this.emergencyLocation.findByUserId(searchUserId, options);
    }

    const formattedEmergencies = emergencies.map(emergency => ({
      id: emergency.id,
      deliveryId: emergency.deliveryId,
      emergencyType: emergency.emergencyType,
      severity: emergency.severity,
      status: emergency.status,
      location: {
        lat: emergency.coordinates.latitude,
        lng: emergency.coordinates.longitude
      },
      description: emergency.description,
      reportedAt: emergency.createdAt,
      resolvedAt: emergency.resolvedAt,
      resolutionTime: emergency.resolvedAt ? 
        Math.round((new Date(emergency.resolvedAt) - new Date(emergency.createdAt)) / (1000 * 60)) : null
    }));

    sendSuccessResponse(res, {
      emergencies: formattedEmergencies,
      total: emergencies.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: emergencies.length === parseInt(limit)
      },
      filters: {
        userId: searchUserId,
        deliveryId,
        status,
        severity,
        period: { startTime, endTime }
      }
    });
  });

  /**
   * Get emergency statistics
   * GET /api/v1/location/emergency/stats
   */
  getEmergencyStats = asyncHandler(async (req, res) => {
    const {
      period = '30',
      userId,
      deliveryId
    } = req.query;

    const startTime = new Date();
    startTime.setDate(startTime.getDate() - parseInt(period));

    const options = {
      startTime,
      endTime: new Date(),
      userId: userId || req.user.id,
      deliveryId
    };

    const stats = await this.emergencyLocation.getEmergencyStats(options);

    sendSuccessResponse(res, {
      period: `${period} days`,
      summary: stats.totals,
      breakdown: {
        byType: this.groupBy(stats.byCategory, 'emergencyType'),
        bySeverity: this.groupBy(stats.byCategory, 'severity'),
        byStatus: this.groupBy(stats.byCategory, 'status')
      },
      trends: {
        resolutionRate: stats.totals.resolutionRate,
        averageResolutionTime: stats.totals.avgResolutionTimeSeconds ? 
          Math.round(stats.totals.avgResolutionTimeSeconds / 60) : null,
        responseImprovement: '+15% faster than last period' // Mock data
      }
    });
  });

  /**
   * Get active emergencies (admin only)
   * GET /api/v1/location/emergency/active
   */
  getActiveEmergencies = asyncHandler(async (req, res) => {
    const {
      severity,
      emergencyType,
      requiresAssistance,
      limit = 100,
      offset = 0
    } = req.query;

    const options = {
      severity: severity ? severity.split(',') : undefined,
      emergencyType: emergencyType ? emergencyType.split(',') : undefined,
      requiresAssistance: requiresAssistance ? requiresAssistance === 'true' : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const emergencies = await this.emergencyLocation.findActiveEmergencies(options);

    const formattedEmergencies = emergencies.map(emergency => ({
      id: emergency.id,
      deliveryId: emergency.deliveryId,
      userId: emergency.userId,
      emergencyType: emergency.emergencyType,
      severity: emergency.severity,
      status: emergency.status,
      location: {
        lat: emergency.coordinates.latitude,
        lng: emergency.coordinates.longitude,
        address: 'Location address' // Would be reverse geocoded
      },
      description: emergency.description,
      requiresAssistance: emergency.requiresAssistance,
      reportedAt: emergency.createdAt,
      age: Math.round((Date.now() - new Date(emergency.createdAt).getTime()) / (1000 * 60)) // minutes
    }));

    sendSuccessResponse(res, {
      activeEmergencies: formattedEmergencies,
      total: emergencies.length,
      summary: {
        critical: formattedEmergencies.filter(e => e.severity === 'critical').length,
        high: formattedEmergencies.filter(e => e.severity === 'high').length,
        requiresAssistance: formattedEmergencies.filter(e => e.requiresAssistance).length,
        oldestAge: formattedEmergencies.length > 0 ? 
          Math.max(...formattedEmergencies.map(e => e.age)) : 0
      }
    });
  });

  // Helper methods

  async findNearbyEmergencyServices(coordinates, emergencyType = null, radiusMeters = 10000) {
    // Mock emergency services - in real implementation, this would query external APIs
    const allServices = [
      {
        type: 'hospital',
        name: 'General Hospital',
        location: {
          lat: coordinates.lat + 0.01,
          lng: coordinates.lng + 0.01
        },
        phone: '+1234567890',
        specialties: ['emergency', 'trauma'],
        availability: '24/7'
      },
      {
        type: 'police',
        name: 'Police Station District 5',
        location: {
          lat: coordinates.lat - 0.005,
          lng: coordinates.lng + 0.008
        },
        phone: '+1234567891',
        specialties: ['patrol', 'investigation'],
        availability: '24/7'
      },
      {
        type: 'fire',
        name: 'Fire Department Station 12',
        location: {
          lat: coordinates.lat + 0.008,
          lng: coordinates.lng - 0.003
        },
        phone: '+1234567892',
        specialties: ['fire', 'rescue', 'ems'],
        availability: '24/7'
      },
      {
        type: 'tow',
        name: 'AAA Roadside Assistance',
        location: {
          lat: coordinates.lat - 0.002,
          lng: coordinates.lng - 0.005
        },
        phone: '+1800555HELP',
        specialties: ['towing', 'roadside'],
        availability: '24/7'
      }
    ];

    // Filter by emergency type if specified
    let filteredServices = allServices;
    if (emergencyType) {
      const typeMapping = {
        accident: ['hospital', 'police', 'fire'],
        breakdown: ['tow'],
        theft: ['police'],
        medical: ['hospital', 'fire'],
        other: ['police', 'hospital']
      };
      const relevantTypes = typeMapping[emergencyType] || ['police'];
      filteredServices = allServices.filter(service => relevantTypes.includes(service.type));
    }

    // Calculate distances and ETAs
    return filteredServices.map(service => {
      const distance = GeoUtils.calculateDistance(
        coordinates,
        service.location,
        'kilometers'
      );

      // Mock ETA calculation (assuming 50 km/h average speed)
      const eta = Math.round(distance / 50 * 60); // minutes

      return {
        ...service,
        distance,
        eta: `${eta} minutes`
      };
    }).sort((a, b) => a.distance - b.distance);
  }

  async notifyEmergencyServices(emergency) {
    // Mock emergency service notification
    console.log('CRITICAL EMERGENCY NOTIFICATION:', {
      emergencyId: emergency.id,
      type: emergency.emergencyType,
      severity: emergency.severity,
      location: emergency.coordinates,
      description: emergency.description
    });

    // In real implementation, this would:
    // 1. Send automated alerts to emergency dispatch
    // 2. Notify relevant emergency services
    // 3. Create incident reports
    // 4. Trigger emergency response protocols
  }

  async reverseGeocode(coordinates) {
    // Mock reverse geocoding - in real implementation, use Google Maps or similar
    return `Approximate location: ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }
}

module.exports = EmergencyController;