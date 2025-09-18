const Joi = require('joi');
const { logger } = require('../config/logger');

class ValidationMiddleware {
  constructor() {
    this.logger = logger;
  }

  // Generic validation middleware
  validate(schema, source = 'body') {
    return (req, res, next) => {
      const data = source === 'params' ? req.params : 
                   source === 'query' ? req.query : req.body;

      const { error, value } = schema.validate(data, {
        abortEarly: false, // Show all validation errors
        stripUnknown: true, // Remove unknown fields
        allowUnknown: false
      });

      if (error) {
        const errors = error.details.map(detail => detail.message);
        
        this.logger.warn('Validation failed', {
          source,
          errors,
          data: this.sanitizeLogData(data),
          userId: req.user?.id
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors
        });
      }

      // Replace original data with validated data
      if (source === 'params') {
        req.params = value;
      } else if (source === 'query') {
        req.query = value;
      } else {
        req.body = value;
      }

      next();
    };
  }

  // Profile update validation
  profileUpdateValidation() {
    const schema = Joi.object({
      firstName: Joi.string().min(2).max(50).trim().pattern(/^[a-zA-Z\s'-]+$/),
      lastName: Joi.string().min(2).max(50).trim().pattern(/^[a-zA-Z\s'-]+$/),
      phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
      dateOfBirth: Joi.date().max('now').min('1900-01-01'),
      bio: Joi.string().max(1000).trim().allow(''),
      preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'),
      timezone: Joi.string().max(50),
      preferredCurrency: Joi.string().length(3).uppercase()
    });

    return this.validate(schema);
  }

  // Address validation
  addressValidation() {
    const schema = Joi.object({
      type: Joi.string().valid('home', 'work', 'other').required(),
      label: Joi.string().max(100).trim(),
      street: Joi.string().min(5).max(255).trim().required(),
      city: Joi.string().min(2).max(100).trim().required(),
      state: Joi.string().max(100).trim(),
      postalCode: Joi.string().min(3).max(20).trim().required(),
      country: Joi.string().length(2).uppercase().required(),
      isDefault: Joi.boolean()
    });

    return this.validate(schema);
  }

  // Address update validation (all fields optional)
  addressUpdateValidation() {
    const schema = Joi.object({
      type: Joi.string().valid('home', 'work', 'other'),
      label: Joi.string().max(100).trim().allow(''),
      street: Joi.string().min(5).max(255).trim(),
      city: Joi.string().min(2).max(100).trim(),
      state: Joi.string().max(100).trim().allow(''),
      postalCode: Joi.string().min(3).max(20).trim(),
      country: Joi.string().length(2).uppercase(),
      isDefault: Joi.boolean()
    });

    return this.validate(schema);
  }

  // Review submission validation
  reviewValidation() {
    const schema = Joi.object({
      deliveryId: Joi.string().uuid().required(),
      overallRating: Joi.number().integer().min(1).max(5).required(),
      comment: Joi.string().max(1000).trim().allow(''),
      communicationRating: Joi.number().integer().min(1).max(5),
      punctualityRating: Joi.number().integer().min(1).max(5),
      carefulnessRating: Joi.number().integer().min(1).max(5),
      friendlinessRating: Joi.number().integer().min(1).max(5),
      isAnonymous: Joi.boolean().default(false)
    });

    return this.validate(schema);
  }

  // Review response validation
  reviewResponseValidation() {
    const schema = Joi.object({
      response: Joi.string().min(1).max(500).trim().required()
    });

    return this.validate(schema);
  }

  // User search validation
  userSearchValidation() {
    const schema = Joi.object({
      q: Joi.string().min(2).max(100).trim(),
      userType: Joi.string().valid('customer', 'traveler', 'both'),
      verificationLevel: Joi.string().valid('unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified'),
      minRating: Joi.number().min(1).max(5),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180),
      radius: Joi.number().min(1).max(500).default(10)
    }).with('lat', 'lng').with('lng', 'lat');

    return this.validate(schema, 'query');
  }

  // Preferences update validation
  preferencesValidation() {
    const schema = Joi.object({
      notificationSettings: Joi.object({
        email: Joi.object({
          newDeliveryRequest: Joi.boolean(),
          deliveryUpdates: Joi.boolean(),
          paymentNotifications: Joi.boolean(),
          reviewNotifications: Joi.boolean(),
          promotions: Joi.boolean(),
          newsletter: Joi.boolean(),
          securityAlerts: Joi.boolean()
        }),
        push: Joi.object({
          newDeliveryRequest: Joi.boolean(),
          deliveryUpdates: Joi.boolean(),
          paymentNotifications: Joi.boolean(),
          reviewNotifications: Joi.boolean(),
          locationUpdates: Joi.boolean(),
          chatMessages: Joi.boolean(),
          quietHours: Joi.object({
            enabled: Joi.boolean(),
            start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
            end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
          })
        }),
        sms: Joi.object({
          deliveryUpdates: Joi.boolean(),
          paymentNotifications: Joi.boolean(),
          securityAlerts: Joi.boolean(),
          emergencyOnly: Joi.boolean()
        })
      }),
      privacySettings: Joi.object({
        showRealName: Joi.boolean(),
        showPhoneNumber: Joi.boolean(),
        showRating: Joi.boolean(),
        showStatistics: Joi.boolean(),
        showLastActive: Joi.boolean(),
        profileVisibility: Joi.string().valid('public', 'friends', 'private'),
        locationSharing: Joi.object({
          duringDelivery: Joi.boolean(),
          afterDelivery: Joi.boolean(),
          precision: Joi.string().valid('exact', 'approximate', 'city')
        })
      }),
      deliverySettings: Joi.object({
        autoAccept: Joi.object({
          enabled: Joi.boolean(),
          maxPrice: Joi.number().min(0),
          trustedUsersOnly: Joi.boolean()
        }),
        preferences: Joi.object({
          maxWeight: Joi.number().min(0).max(100),
          maxDistance: Joi.number().min(1).max(1000),
          acceptFragile: Joi.boolean(),
          acceptPerishable: Joi.boolean(),
          acceptHazardous: Joi.boolean()
        })
      })
    });

    return this.validate(schema);
  }

  // Block user validation
  blockUserValidation() {
    const schema = Joi.object({
      reason: Joi.string().valid(
        'inappropriate_behavior', 'spam', 'harassment', 
        'unreliable', 'fraud_concern', 'safety_concern', 'other'
      ),
      comment: Joi.string().max(500).trim()
    });

    return this.validate(schema);
  }

  // Report user validation
  reportUserValidation() {
    const schema = Joi.object({
      reportedUserId: Joi.string().uuid().required(),
      deliveryId: Joi.string().uuid(),
      category: Joi.string().valid(
        'inappropriate_behavior', 'fraud', 'harassment', 
        'spam', 'safety_concern', 'other'
      ).required(),
      description: Joi.string().min(10).max(1000).trim().required(),
      evidence: Joi.array().items(
        Joi.object({
          type: Joi.string().valid('image', 'video', 'text').required(),
          url: Joi.string().uri(),
          description: Joi.string().max(200).trim()
        })
      ).max(5)
    });

    return this.validate(schema);
  }

  // Favorite user validation
  favoriteUserValidation() {
    const schema = Joi.object({
      notes: Joi.string().max(500).trim(),
      priority: Joi.number().integer().min(1).max(5).default(1),
      notificationSettings: Joi.object({
        notifyOnNewTrip: Joi.boolean().default(true),
        notifyOnPriceChange: Joi.boolean().default(false),
        maxNotificationDistance: Joi.number().min(1).max(1000)
      })
    });

    return this.validate(schema);
  }

  // UUID parameter validation
  uuidParamValidation(paramName = 'id') {
    const schema = Joi.object({
      [paramName]: Joi.string().uuid().required()
    });

    return this.validate(schema, 'params');
  }

  // Pagination validation
  paginationValidation() {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    });

    return this.validate(schema, 'query');
  }

  // Statistics period validation
  statisticsPeriodValidation() {
    const schema = Joi.object({
      period: Joi.string().valid('week', 'month', 'quarter', 'year', 'all').default('all'),
      year: Joi.number().integer().min(2020).max(new Date().getFullYear()),
      month: Joi.number().integer().min(1).max(12)
    }).with('month', 'year');

    return this.validate(schema, 'query');
  }

  // Verification document type validation
  verificationDocumentValidation() {
    const schema = Joi.object({
      documentType: Joi.string().valid(
        'passport', 'driving_license', 'national_id', 
        'utility_bill', 'bank_statement'
      ).required()
    });

    return this.validate(schema);
  }

  // Phone verification validation
  phoneVerificationValidation() {
    const schema = Joi.object({
      phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
    });

    return this.validate(schema);
  }

  // Phone verification confirm validation
  phoneVerificationConfirmValidation() {
    const schema = Joi.object({
      verificationId: Joi.string().uuid().required(),
      code: Joi.string().length(6).pattern(/^\d{6}$/).required()
    });

    return this.validate(schema);
  }

  // Review report validation
  reviewReportValidation() {
    const schema = Joi.object({
      reason: Joi.string().valid(
        'inappropriate_content', 'spam', 'harassment', 
        'false_information', 'personal_attack', 'other'
      ).required(),
      description: Joi.string().min(10).max(500).trim().required()
    });

    return this.validate(schema);
  }

  // Review vote validation
  reviewVoteValidation() {
    const schema = Joi.object({
      helpful: Joi.boolean().required()
    });

    return this.validate(schema);
  }

  // Sanitize sensitive data for logging
  sanitizeLogData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'phoneNumber', 'email', 'ssn', 'creditCard'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  // Custom validation for conditional fields
  conditionalValidation(condition, schema) {
    return (req, res, next) => {
      if (condition(req)) {
        return this.validate(schema)(req, res, next);
      }
      next();
    };
  }

  // Validate array of UUIDs
  uuidArrayValidation(fieldName = 'ids') {
    const schema = Joi.object({
      [fieldName]: Joi.array().items(Joi.string().uuid()).min(1).max(100).required()
    });

    return this.validate(schema);
  }

  // Validate coordinates
  coordinatesValidation() {
    const schema = Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    });

    return this.validate(schema);
  }
}

module.exports = new ValidationMiddleware();