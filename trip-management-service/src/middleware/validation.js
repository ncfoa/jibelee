const Joi = require('joi');
const { logger } = require('../config/logger');

/**
 * Validation middleware using Joi
 */
class ValidationMiddleware {
  /**
   * Generic validation middleware
   */
  static validate(schema, property = 'body') {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req[property], {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }));

          logger.warn('Validation failed', {
            property,
            errors,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip
          });

          return res.status(422).json({
            success: false,
            message: 'Validation failed',
            error: 'VALIDATION_ERROR',
            details: errors
          });
        }

        // Replace the property with validated and sanitized value
        req[property] = value;
        next();
      } catch (validationError) {
        logger.error('Validation middleware error:', validationError);
        return res.status(500).json({
          success: false,
          message: 'Validation error',
          error: 'VALIDATION_SYSTEM_ERROR'
        });
      }
    };
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination() {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sort: Joi.string().valid(
        'created_at', 'updated_at', 'departure_time', 'arrival_time', 
        'base_price', 'distance', 'title'
      ).default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    }).unknown(true);

    return this.validate(schema, 'query');
  }

  /**
   * Validate coordinates
   */
  static get coordinatesSchema() {
    return Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    });
  }

  /**
   * Validate address object
   */
  static get addressSchema() {
    return Joi.object({
      address: Joi.string().min(5).max(500).required(),
      coordinates: this.coordinatesSchema.optional(),
      airport: Joi.string().max(10).optional(),
      terminal: Joi.string().max(50).optional(),
      details: Joi.string().max(1000).optional()
    });
  }

  /**
   * Validate capacity object
   */
  static get capacitySchema() {
    return Joi.object({
      weight: Joi.number().min(0).max(100).required(),
      volume: Joi.number().min(0).max(500).required(),
      items: Joi.number().integer().min(1).max(50).required()
    });
  }

  /**
   * Validate pricing object
   */
  static get pricingSchema() {
    return Joi.object({
      basePrice: Joi.number().min(0).max(10000).required(),
      pricePerKg: Joi.number().min(0).max(1000).default(0),
      pricePerKm: Joi.number().min(0).max(100).default(0),
      expressMultiplier: Joi.number().min(1).max(5).default(1),
      fragileMultiplier: Joi.number().min(1).max(3).default(1)
    });
  }

  /**
   * Joi schema object for complex validations
   */
  static get schema() {
    return Joi;
  }

  /**
   * Validate trip creation data
   */
  static validateCreateTrip() {
    const schema = Joi.object({
      title: Joi.string().min(3).max(255).required(),
      description: Joi.string().max(2000).optional(),
      type: Joi.string().valid(
        'flight', 'train', 'bus', 'car', 'ship', 'other'
      ).required(),
      origin: this.addressSchema.required(),
      destination: this.addressSchema.required(),
      departureTime: Joi.date().iso().greater('now').required(),
      arrivalTime: Joi.date().iso().greater(Joi.ref('departureTime')).required(),
      estimatedDuration: Joi.number().integer().min(1).max(10080).optional(), // max 1 week
      capacity: this.capacitySchema.required(),
      pricing: this.pricingSchema.required(),
      restrictions: Joi.object({
        noFragile: Joi.boolean().default(false),
        noLiquids: Joi.boolean().default(false),
        noElectronics: Joi.boolean().default(false),
        maxItemValue: Joi.number().min(0).max(100000).optional(),
        prohibitedItems: Joi.array().items(Joi.string().max(100)).optional()
      }).optional(),
      preferences: Joi.object({
        meetingPreference: Joi.string().valid(
          'airport', 'home', 'public_place', 'flexible'
        ).optional(),
        communicationPreference: Joi.string().valid(
          'app_only', 'phone', 'email'
        ).optional(),
        advanceNotice: Joi.number().integer().min(1).max(168).optional() // max 1 week
      }).optional(),
      isRecurring: Joi.boolean().default(false),
      recurringPattern: Joi.when('isRecurring', {
        is: true,
        then: Joi.object({
          frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').required(),
          daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).optional(),
          endDate: Joi.date().iso().greater(Joi.ref('departureTime')).optional(),
          exceptions: Joi.array().items(Joi.date().iso()).optional()
        }).required(),
        otherwise: Joi.forbidden()
      }),
      visibility: Joi.string().valid('public', 'private', 'friends_only').default('public'),
      autoAccept: Joi.boolean().default(false),
      autoAcceptPrice: Joi.when('autoAccept', {
        is: true,
        then: Joi.number().min(0).max(10000).optional(),
        otherwise: Joi.forbidden()
      }),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
    });

    return this.validate(schema);
  }

  /**
   * Validate trip update data
   */
  static validateUpdateTrip() {
    const schema = Joi.object({
      title: Joi.string().min(3).max(255).optional(),
      description: Joi.string().max(2000).optional(),
      departureTime: Joi.date().iso().greater('now').optional(),
      arrivalTime: Joi.date().iso().when('departureTime', {
        is: Joi.exist(),
        then: Joi.date().iso().greater(Joi.ref('departureTime')).required(),
        otherwise: Joi.date().iso().optional()
      }),
      capacity: this.capacitySchema.optional(),
      pricing: this.pricingSchema.optional(),
      restrictions: Joi.object().optional(),
      preferences: Joi.object().optional(),
      visibility: Joi.string().valid('public', 'private', 'friends_only').optional(),
      autoAccept: Joi.boolean().optional(),
      autoAcceptPrice: Joi.number().min(0).max(10000).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
    }).min(1); // At least one field must be provided

    return this.validate(schema);
  }

  /**
   * Validate trip search parameters
   */
  static validateTripSearch() {
    const schema = Joi.object({
      origin: Joi.string().min(2).max(200).optional(),
      destination: Joi.string().min(2).max(200).optional(),
      originLat: Joi.number().min(-90).max(90).optional(),
      originLng: Joi.number().min(-180).max(180).optional(),
      destinationLat: Joi.number().min(-90).max(90).optional(),
      destinationLng: Joi.number().min(-180).max(180).optional(),
      radius: Joi.number().min(1).max(1000).default(50),
      departureDate: Joi.date().iso().optional(),
      departureDateFrom: Joi.date().iso().optional(),
      departureDateTo: Joi.date().iso().min(Joi.ref('departureDateFrom')).optional(),
      type: Joi.string().valid('flight', 'train', 'bus', 'car', 'ship', 'other').optional(),
      minCapacityWeight: Joi.number().min(0).max(100).optional(),
      minCapacityVolume: Joi.number().min(0).max(500).optional(),
      maxPrice: Joi.number().min(0).max(10000).optional(),
      minRating: Joi.number().min(0).max(5).optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().valid(
        'price', 'departure', 'rating', 'distance', 'created_at'
      ).default('departure'),
      sortOrder: Joi.string().valid('asc', 'desc').default('asc')
    });

    return this.validate(schema, 'query');
  }

  /**
   * Validate trip template creation
   */
  static validateCreateTemplate() {
    const schema = Joi.object({
      name: Joi.string().min(3).max(255).required(),
      description: Joi.string().max(1000).optional(),
      tripData: Joi.object({
        title: Joi.string().min(3).max(255).required(),
        type: Joi.string().valid('flight', 'train', 'bus', 'car', 'ship', 'other').required(),
        origin: this.addressSchema.required(),
        destination: this.addressSchema.required(),
        capacity: this.capacitySchema.required(),
        pricing: this.pricingSchema.required(),
        restrictions: Joi.object().optional(),
        preferences: Joi.object().optional(),
        tags: Joi.array().items(Joi.string().max(50)).optional()
      }).required(),
      category: Joi.string().max(100).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      isPublic: Joi.boolean().default(false)
    });

    return this.validate(schema);
  }

  /**
   * Validate trip status update
   */
  static validateStatusUpdate() {
    const schema = Joi.object({
      status: Joi.string().valid(
        'upcoming', 'active', 'completed', 'cancelled', 'delayed'
      ).required(),
      currentLocation: this.coordinatesSchema.optional(),
      estimatedArrival: Joi.date().iso().optional(),
      actualDepartureTime: Joi.date().iso().optional(),
      actualArrivalTime: Joi.date().iso().optional(),
      message: Joi.string().max(500).optional(),
      notes: Joi.string().max(1000).optional()
    });

    return this.validate(schema);
  }

  /**
   * Validate cancellation data
   */
  static validateCancellation() {
    const schema = Joi.object({
      reason: Joi.string().valid(
        'personal_emergency', 'schedule_change', 'weather', 'vehicle_issue', 'other'
      ).required(),
      message: Joi.string().max(1000).optional(),
      refundPolicy: Joi.string().valid('full', 'partial', 'none').optional(),
      notifyCustomers: Joi.boolean().default(true)
    });

    return this.validate(schema);
  }

  /**
   * Validate route optimization request
   */
  static validateRouteOptimization() {
    const schema = Joi.object({
      origin: this.coordinatesSchema.required(),
      destination: this.coordinatesSchema.required(),
      waypoints: Joi.array().items(this.coordinatesSchema).max(10).optional(),
      preferences: Joi.object({
        avoidTolls: Joi.boolean().default(false),
        avoidHighways: Joi.boolean().default(false),
        optimize: Joi.string().valid('time', 'distance', 'cost').default('time')
      }).optional(),
      travelMode: Joi.string().valid('driving', 'walking', 'bicycling', 'transit').default('driving')
    });

    return this.validate(schema);
  }

  /**
   * Validate analytics query parameters
   */
  static validateAnalyticsQuery() {
    const schema = Joi.object({
      period: Joi.string().valid('week', 'month', 'quarter', 'year').default('month'),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
      groupBy: Joi.string().valid('day', 'week', 'month').optional(),
      metrics: Joi.array().items(
        Joi.string().valid(
          'trips', 'earnings', 'distance', 'duration', 'capacity_utilization'
        )
      ).optional()
    });

    return this.validate(schema, 'query');
  }

  /**
   * Validate export parameters
   */
  static validateExportParams() {
    const schema = Joi.object({
      format: Joi.string().valid('json', 'csv', 'pdf', 'xlsx').default('json'),
      fields: Joi.array().items(Joi.string()).optional(),
      filters: Joi.object().optional()
    });

    return this.validate(schema, 'query');
  }

  /**
   * Validate UUID parameter
   */
  static validateUUID(paramName = 'id') {
    const schema = Joi.object({
      [paramName]: Joi.string().uuid().required()
    });

    return this.validate(schema, 'params');
  }

  /**
   * Custom validation for date ranges
   */
  static validateDateRange() {
    return (req, res, next) => {
      const { startDate, endDate, departureDate, departureDateFrom, departureDateTo } = req.query;

      // Validate date range combinations
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
          return res.status(422).json({
            success: false,
            message: 'Start date must be before end date',
            error: 'INVALID_DATE_RANGE'
          });
        }

        // Check if range is not too large (max 1 year)
        const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
        if (end - start > maxRange) {
          return res.status(422).json({
            success: false,
            message: 'Date range cannot exceed 1 year',
            error: 'DATE_RANGE_TOO_LARGE'
          });
        }
      }

      // Similar validation for departure date range
      if (departureDateFrom && departureDateTo) {
        const start = new Date(departureDateFrom);
        const end = new Date(departureDateTo);
        
        if (start >= end) {
          return res.status(422).json({
            success: false,
            message: 'Departure start date must be before end date',
            error: 'INVALID_DEPARTURE_DATE_RANGE'
          });
        }
      }

      next();
    };
  }

  /**
   * Sanitize input to prevent XSS
   */
  static sanitizeInput() {
    return (req, res, next) => {
      try {
        // Recursively sanitize strings in request body
        const sanitizeObject = (obj) => {
          if (typeof obj === 'string') {
            return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
          } else if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
          } else if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                sanitized[key] = sanitizeObject(obj[key]);
              }
            }
            return sanitized;
          }
          return obj;
        };

        if (req.body) {
          req.body = sanitizeObject(req.body);
        }

        next();
      } catch (error) {
        logger.error('Input sanitization error:', error);
        next(); // Continue even if sanitization fails
      }
    };
  }
}

module.exports = ValidationMiddleware;