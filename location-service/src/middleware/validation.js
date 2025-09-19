const Joi = require('joi');

// Custom validation schemas
const coordinatesSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

const locationDataSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracy: Joi.number().min(0).max(10000).optional(),
  altitude: Joi.number().optional(),
  bearing: Joi.number().min(0).max(360).optional(),
  speed: Joi.number().min(0).max(500).optional(),
  timestamp: Joi.date().iso().optional()
});

const deviceInfoSchema = Joi.object({
  batteryLevel: Joi.number().min(0).max(100).optional(),
  networkType: Joi.string().valid('wifi', 'cellular', 'offline').optional(),
  platform: Joi.string().valid('ios', 'android', 'web').optional(),
  appVersion: Joi.string().optional()
});

// Validation schemas for different endpoints
const validationSchemas = {
  // Location tracking
  startTracking: Joi.object({
    deliveryId: Joi.string().uuid().required(),
    trackingSettings: Joi.object({
      interval: Joi.number().min(5).max(300).default(30),
      accuracy: Joi.string().valid('low', 'medium', 'high').default('high'),
      batteryOptimization: Joi.boolean().default(true),
      backgroundTracking: Joi.boolean().default(true)
    }).optional(),
    privacySettings: Joi.object({
      shareWithCustomer: Joi.boolean().default(true),
      shareWithTraveler: Joi.boolean().default(true),
      trackingLevel: Joi.string().valid('precise', 'approximate', 'minimal').default('precise'),
      anonymizeAfterHours: Joi.number().min(1).max(168).default(24)
    }).optional()
  }),

  updateLocation: Joi.object({
    deliveryId: Joi.string().uuid().required(),
    location: locationDataSchema.required(),
    deviceInfo: deviceInfoSchema.optional()
  }),

  batchUpdateLocations: Joi.object({
    deliveryId: Joi.string().uuid().required(),
    locations: Joi.array().items(
      Joi.object({
        ...locationDataSchema.describe().keys,
        timestamp: Joi.date().iso().required()
      })
    ).min(1).max(100).required()
  }),

  stopTracking: Joi.object({
    deliveryId: Joi.string().uuid().required(),
    reason: Joi.string().max(255).optional()
  }),

  // Geofencing
  createGeofence: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    type: Joi.string().valid('pickup', 'delivery', 'restricted', 'safe_zone').required(),
    deliveryId: Joi.string().uuid().optional(),
    geometry: Joi.alternatives().try(
      // Circle geometry
      Joi.object({
        type: Joi.string().valid('circle').required(),
        center: coordinatesSchema.required(),
        radius: Joi.number().min(1).max(10000).required()
      }),
      // Polygon geometry
      Joi.object({
        type: Joi.string().valid('polygon').required(),
        coordinates: Joi.array().items(
          Joi.array().items(
            Joi.array().items(Joi.number()).length(2)
          ).min(4) // At least 4 points for a closed polygon
        ).length(1).required() // Only one ring supported for now
      })
    ).required(),
    notifications: Joi.object({
      onEntry: Joi.boolean().default(false),
      onExit: Joi.boolean().default(false),
      onDwell: Joi.object({
        enabled: Joi.boolean().default(false),
        duration: Joi.number().min(30).max(3600).default(300)
      }).optional()
    }).optional(),
    schedule: Joi.object({
      startTime: Joi.date().iso().optional(),
      endTime: Joi.date().iso().optional(),
      timezone: Joi.string().default('UTC')
    }).optional(),
    metadata: Joi.object().optional()
  }),

  updateGeofence: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    notifications: Joi.object({
      onEntry: Joi.boolean().optional(),
      onExit: Joi.boolean().optional(),
      onDwell: Joi.object({
        enabled: Joi.boolean().optional(),
        duration: Joi.number().min(30).max(3600).optional()
      }).optional()
    }).optional(),
    active: Joi.boolean().optional(),
    schedule: Joi.object({
      startTime: Joi.date().iso().optional(),
      endTime: Joi.date().iso().optional(),
      timezone: Joi.string().optional()
    }).optional(),
    metadata: Joi.object().optional(),
    geometry: Joi.alternatives().try(
      Joi.object({
        type: Joi.string().valid('circle').required(),
        center: coordinatesSchema.required(),
        radius: Joi.number().min(1).max(10000).required()
      }),
      Joi.object({
        type: Joi.string().valid('polygon').required(),
        coordinates: Joi.array().items(
          Joi.array().items(
            Joi.array().items(Joi.number()).length(2)
          ).min(4)
        ).length(1).required()
      })
    ).optional()
  }),

  checkGeofence: Joi.object({
    location: coordinatesSchema.required(),
    geofences: Joi.array().items(
      Joi.object({
        id: Joi.string().uuid().required(),
        center: coordinatesSchema.optional(),
        radius: Joi.number().min(1).max(10000).optional(),
        type: Joi.string().valid('pickup', 'delivery', 'restricted', 'safe_zone').optional()
      })
    ).min(1).max(50).required()
  }),

  // Route optimization
  optimizeRoute: Joi.object({
    origin: coordinatesSchema.required(),
    destination: coordinatesSchema.required(),
    waypoints: Joi.array().items(
      Joi.object({
        ...coordinatesSchema.describe().keys,
        type: Joi.string().valid('pickup', 'delivery', 'stop').optional(),
        timeWindow: Joi.object({
          start: Joi.date().iso().optional(),
          end: Joi.date().iso().optional()
        }).optional(),
        duration: Joi.number().min(1).max(120).optional()
      })
    ).max(25).optional(),
    preferences: Joi.object({
      avoidTolls: Joi.boolean().default(false),
      avoidHighways: Joi.boolean().default(false),
      optimize: Joi.string().valid('time', 'distance', 'fuel').default('time'),
      vehicleType: Joi.string().valid('car', 'truck', 'motorcycle').default('car'),
      departureTime: Joi.date().iso().optional()
    }).optional(),
    constraints: Joi.object({
      maxDetour: Joi.number().min(0).max(100).default(20),
      maxTimeIncrease: Joi.number().min(0).max(120).default(30)
    }).optional(),
    vehicle: Joi.object({
      type: Joi.string().valid('car', 'truck', 'motorcycle').default('car'),
      fuelType: Joi.string().valid('gasoline', 'diesel', 'electric', 'hybrid').default('gasoline'),
      fuelEfficiency: Joi.number().min(5).max(50).optional()
    }).optional()
  }),

  // Emergency services
  reportEmergency: Joi.object({
    deliveryId: Joi.string().uuid().required(),
    emergencyType: Joi.string().valid('accident', 'breakdown', 'theft', 'medical', 'other').required(),
    severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
    location: coordinatesSchema.required(),
    accuracy: Joi.number().min(0).max(10000).optional(),
    description: Joi.string().min(10).max(1000).required(),
    contactNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20).optional(),
    requiresAssistance: Joi.boolean().default(false)
  }),

  updateEmergencyStatus: Joi.object({
    status: Joi.string().valid('reported', 'acknowledged', 'in_progress', 'resolved').required(),
    notes: Joi.string().max(1000).optional(),
    resolvedBy: Joi.string().uuid().optional()
  }),

  // Geocoding
  geocode: Joi.object({
    address: Joi.string().min(5).max(255).when('type', {
      is: 'forward',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    lat: Joi.number().min(-90).max(90).when('type', {
      is: 'reverse',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    lng: Joi.number().min(-180).max(180).when('type', {
      is: 'reverse',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    type: Joi.string().valid('forward', 'reverse').required(),
    country: Joi.string().length(2).optional(),
    limit: Joi.number().min(1).max(10).default(5)
  }),

  // Privacy settings
  updatePrivacySettings: Joi.object({
    trackingLevel: Joi.string().valid('precise', 'approximate', 'minimal').optional(),
    shareWith: Joi.object({
      customers: Joi.boolean().optional(),
      platform: Joi.boolean().optional(),
      emergencyContacts: Joi.boolean().optional(),
      thirdParties: Joi.boolean().optional()
    }).optional(),
    dataRetention: Joi.object({
      period: Joi.number().min(1).max(365).optional(),
      deleteAfterDelivery: Joi.boolean().optional()
    }).optional(),
    anonymization: Joi.object({
      enabled: Joi.boolean().optional(),
      delay: Joi.number().min(1).max(168).optional()
    }).optional(),
    notifications: Joi.object({
      locationSharing: Joi.boolean().optional(),
      dataUsage: Joi.boolean().optional()
    }).optional()
  }),

  // Cache sync
  syncCache: Joi.object({
    deliveryId: Joi.string().uuid().required(),
    cachedLocations: Joi.array().items(
      Joi.object({
        ...locationDataSchema.describe().keys,
        timestamp: Joi.date().iso().required(),
        cached: Joi.boolean().default(true)
      })
    ).min(1).max(1000).required(),
    syncReason: Joi.string().valid('network_restored', 'manual_sync', 'scheduled').required(),
    deviceInfo: deviceInfoSchema.optional()
  })
};

// Query parameter validation schemas
const querySchemas = {
  locationHistory: Joi.object({
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    interval: Joi.number().valid(60, 300, 900, 3600).default(60),
    format: Joi.string().valid('json', 'geojson', 'gpx', 'kml').default('json'),
    limit: Joi.number().min(1).max(10000).default(1000),
    offset: Joi.number().min(0).default(0)
  }),

  nearbyTravelers: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(1).max(100).default(50),
    destination: coordinatesSchema.optional(),
    departureTimeFrom: Joi.date().iso().optional(),
    departureTimeTo: Joi.date().iso().optional(),
    minRating: Joi.number().min(1).max(5).optional(),
    capacity: Joi.number().min(0).max(100).optional(),
    limit: Joi.number().min(1).max(100).default(20)
  }),

  activeGeofences: Joi.object({
    deliveryId: Joi.string().uuid().optional(),
    type: Joi.string().valid('pickup', 'delivery', 'restricted', 'safe_zone').optional(),
    lat: Joi.number().min(-90).max(90).optional(),
    lng: Joi.number().min(-180).max(180).optional(),
    radius: Joi.number().min(100).max(50000).default(5000)
  }),

  traffic: Joi.object({
    route: Joi.string().optional(),
    origin: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*$/).optional(),
    destination: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*$/).optional(),
    departureTime: Joi.date().iso().optional()
  }),

  analytics: Joi.object({
    period: Joi.string().valid('day', 'week', 'month', 'quarter').default('week'),
    metric: Joi.string().valid('accuracy', 'battery', 'coverage').optional(),
    userId: Joi.string().uuid().optional()
  }),

  nearbyEmergencyServices: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(1000).max(50000).default(10000),
    type: Joi.string().valid('hospital', 'police', 'fire', 'tow').optional()
  }),

  recommendations: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    type: Joi.string().valid('pickup', 'delivery', 'route', 'poi').optional(),
    radius: Joi.number().min(1).max(50).default(10)
  })
};

// Parameter validation schemas
const paramSchemas = {
  uuid: Joi.string().uuid().required(),
  deliveryId: Joi.string().uuid().required(),
  geofenceId: Joi.string().uuid().required(),
  emergencyId: Joi.string().uuid().required(),
  routeId: Joi.string().uuid().required()
};

// Middleware factory function
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    let data;
    let schemaToUse;

    // Determine data source and schema
    switch (source) {
      case 'body':
        data = req.body;
        schemaToUse = validationSchemas[schema];
        break;
      case 'query':
        data = req.query;
        schemaToUse = querySchemas[schema];
        break;
      case 'params':
        data = req.params;
        schemaToUse = paramSchemas[schema];
        break;
      default:
        return res.status(500).json({
          success: false,
          error: 'Invalid validation source'
        });
    }

    if (!schemaToUse) {
      return res.status(500).json({
        success: false,
        error: 'Validation schema not found'
      });
    }

    // Validate data
    const { error, value } = schemaToUse.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Update request with validated data
    switch (source) {
      case 'body':
        req.body = value;
        break;
      case 'query':
        req.query = value;
        break;
      case 'params':
        req.params = value;
        break;
    }

    next();
  };
};

// Coordinate validation middleware
const validateCoordinates = (req, res, next) => {
  const { lat, lng, latitude, longitude } = req.body;
  
  const coords = {
    latitude: lat || latitude,
    longitude: lng || longitude
  };

  const { error } = coordinatesSchema.validate(coords);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid coordinates',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Normalize coordinate names
  req.body.coordinates = coords;
  next();
};

// UUID validation middleware
const validateUUID = (paramName) => {
  return (req, res, next) => {
    const value = req.params[paramName];
    const { error } = Joi.string().uuid().validate(value);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName}`,
        details: [{
          field: paramName,
          message: 'Must be a valid UUID'
        }]
      });
    }
    
    next();
  };
};

// Custom validation for specific business rules
const validateDeliveryAccess = async (req, res, next) => {
  // This would check if the user has access to the delivery
  // Implementation depends on your auth system
  next();
};

const validateTrackingPermissions = async (req, res, next) => {
  // This would check if the user can track this delivery
  // Implementation depends on your auth system
  next();
};

module.exports = {
  validate,
  validateCoordinates,
  validateUUID,
  validateDeliveryAccess,
  validateTrackingPermissions,
  validationSchemas,
  querySchemas,
  paramSchemas
};