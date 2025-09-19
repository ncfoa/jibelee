const Joi = require('joi');
const logger = require('../config/logger');

/**
 * Generic validation middleware factory
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation failed:', {
        endpoint: req.path,
        errors: errorDetails,
        userId: req.user?.id
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorDetails
      });
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

/**
 * QR Code Generation Validation Schema
 */
const qrGenerationSchema = Joi.object({
  deliveryId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Delivery ID must be a valid UUID',
      'any.required': 'Delivery ID is required'
    }),
  
  qrType: Joi.string().valid('pickup', 'delivery').required()
    .messages({
      'any.only': 'QR type must be either pickup or delivery',
      'any.required': 'QR type is required'
    }),
  
  securityLevel: Joi.string().valid('standard', 'high', 'maximum').default('standard'),
  
  expirationHours: Joi.number().integer().min(1).max(168).default(24)
    .messages({
      'number.min': 'Expiration hours must be at least 1',
      'number.max': 'Expiration hours cannot exceed 168 (7 days)'
    }),
  
  locationBinding: Joi.object({
    enabled: Joi.boolean().default(false),
    coordinates: Joi.when('enabled', {
      is: true,
      then: Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lng: Joi.number().min(-180).max(180).required()
      }).required(),
      otherwise: Joi.forbidden()
    }),
    radius: Joi.when('enabled', {
      is: true,
      then: Joi.number().integer().min(1).max(10000).required()
        .messages({
          'number.min': 'Radius must be at least 1 meter',
          'number.max': 'Radius cannot exceed 10000 meters'
        }),
      otherwise: Joi.forbidden()
    })
  }).default({ enabled: false }),
  
  additionalSecurity: Joi.object({
    requiresPhoto: Joi.boolean().default(false),
    requiresSignature: Joi.boolean().default(false),
    requiresBiometric: Joi.boolean().default(false)
  }).default({}),
  
  imageOptions: Joi.object({
    size: Joi.string().valid('small', 'medium', 'large', 'xlarge').default('medium'),
    style: Joi.string().valid('standard', 'rounded', 'gradient', 'shadow', 'branded').default('standard'),
    format: Joi.string().valid('png', 'jpeg', 'webp', 'svg').default('png'),
    branding: Joi.object({
      logo: Joi.string().uri(),
      border: Joi.object({
        width: Joi.number().integer().min(1).max(50),
        color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/)
      })
    })
  }).default({}),
  
  additionalData: Joi.object().default({})
});

/**
 * QR Code Validation Schema
 */
const qrValidationSchema = Joi.object({
  qrCodeData: Joi.string().base64().required()
    .messages({
      'string.base64': 'QR code data must be valid base64',
      'any.required': 'QR code data is required'
    }),
  
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).max(10000),
    timestamp: Joi.date().iso()
  }),
  
  deviceInfo: Joi.object({
    deviceId: Joi.string().max(100),
    platform: Joi.string().valid('ios', 'android', 'web'),
    appVersion: Joi.string().max(20),
    osVersion: Joi.string().max(20)
  }).default({}),
  
  additionalVerification: Joi.object({
    photo: Joi.string().uri(),
    signature: Joi.string(),
    biometric: Joi.string(),
    notes: Joi.string().max(500)
  }).default({})
});

/**
 * Backup Code Validation Schema
 */
const backupCodeValidationSchema = Joi.object({
  backupCode: Joi.string().pattern(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/).required()
    .messages({
      'string.pattern.base': 'Backup code must be in format XXX-XXX-XXX-XXX',
      'any.required': 'Backup code is required'
    }),
  
  deliveryId: Joi.string().uuid().required(),
  
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).max(10000)
  }),
  
  reason: Joi.string().min(10).max(200).required()
    .messages({
      'string.min': 'Reason must be at least 10 characters',
      'string.max': 'Reason cannot exceed 200 characters'
    })
});

/**
 * Emergency Override Request Schema
 */
const emergencyOverrideSchema = Joi.object({
  deliveryId: Joi.string().uuid().required(),
  qrCodeId: Joi.string().uuid(),
  
  reason: Joi.string().min(10).max(500).required()
    .messages({
      'string.min': 'Reason must be at least 10 characters',
      'string.max': 'Reason cannot exceed 500 characters'
    }),
  
  description: Joi.string().max(1000),
  
  alternativeVerification: Joi.object({
    idPhoto: Joi.string().uri(),
    selfiePhoto: Joi.string().uri(),
    deliveryDetails: Joi.string().max(300),
    contactInfo: Joi.object({
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
      email: Joi.string().email()
    })
  }).default({}),
  
  contactPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
    .messages({
      'string.pattern.base': 'Contact phone must be a valid phone number'
    }),
  
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).max(10000)
  })
});

/**
 * Emergency Override Approval Schema
 */
const emergencyApprovalSchema = Joi.object({
  approvalNotes: Joi.string().min(10).max(500).required()
    .messages({
      'string.min': 'Approval notes must be at least 10 characters'
    }),
  
  validityHours: Joi.number().integer().min(1).max(24).default(2)
    .messages({
      'number.min': 'Validity must be at least 1 hour',
      'number.max': 'Validity cannot exceed 24 hours'
    }),
  
  additionalRestrictions: Joi.object({
    requiresAdminPresence: Joi.boolean().default(false),
    photoRequired: Joi.boolean().default(false),
    locationRestricted: Joi.boolean().default(false),
    timeRestricted: Joi.boolean().default(false)
  }).default({})
});

/**
 * Emergency Override Usage Schema
 */
const emergencyUsageSchema = Joi.object({
  alternativeCode: Joi.string().pattern(/^EMRG-[A-Z0-9-]+$/).required()
    .messages({
      'string.pattern.base': 'Invalid alternative code format'
    }),
  
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).max(10000)
  }),
  
  verificationEvidence: Joi.object({
    photo: Joi.string().uri(),
    notes: Joi.string().max(300),
    timestamp: Joi.date().iso().default(() => new Date())
  }).default({}),
  
  deviceInfo: Joi.object({
    deviceId: Joi.string().max(100),
    platform: Joi.string().valid('ios', 'android', 'web'),
    appVersion: Joi.string().max(20)
  }).default({})
});

/**
 * Bulk Generation Schema
 */
const bulkGenerationSchema = Joi.object({
  requests: Joi.array().items(
    Joi.object({
      deliveryId: Joi.string().uuid().required(),
      type: Joi.string().valid('pickup', 'delivery').required(),
      options: Joi.object().default({})
    })
  ).min(1).max(100).required()
    .messages({
      'array.min': 'At least 1 request is required',
      'array.max': 'Maximum 100 requests allowed per batch'
    }),
  
  securityLevel: Joi.string().valid('standard', 'high', 'maximum').default('standard'),
  downloadFormat: Joi.string().valid('png', 'pdf', 'svg', 'zip').default('png'),
  concurrency: Joi.number().integer().min(1).max(10).default(5)
});

/**
 * Query Parameter Validation Schemas
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'expiresAt', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const dateRangeSchema = Joi.object({
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().greater(Joi.ref('dateFrom'))
    .messages({
      'date.greater': 'End date must be after start date'
    })
});

const qrFilterSchema = Joi.object({
  status: Joi.string().valid('active', 'used', 'expired', 'revoked'),
  qrType: Joi.string().valid('pickup', 'delivery'),
  securityLevel: Joi.string().valid('standard', 'high', 'maximum'),
  deliveryId: Joi.string().uuid()
}).concat(paginationSchema).concat(dateRangeSchema);

/**
 * UUID Parameter Validation
 */
const validateUUID = (paramName) => {
  return validate(Joi.object({
    [paramName]: Joi.string().uuid().required()
      .messages({
        'string.guid': `${paramName} must be a valid UUID`
      })
  }), 'params');
};

/**
 * File Upload Validation
 */
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const file = req.file || (req.files && req.files[0]);
  
  if (file) {
    // Check file size
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
      });
    }

    // Check file type
    const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
      });
    }
  }

  next();
};

/**
 * Sanitize Input Middleware
 */
const sanitizeInput = (req, res, next) => {
  // Remove any potentially harmful characters
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '');
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

module.exports = {
  validate,
  validateUUID,
  validateFileUpload,
  sanitizeInput,
  
  // Validation middleware for specific endpoints
  validateQRGeneration: validate(qrGenerationSchema),
  validateQRValidation: validate(qrValidationSchema),
  validateBackupCode: validate(backupCodeValidationSchema),
  validateEmergencyOverride: validate(emergencyOverrideSchema),
  validateEmergencyApproval: validate(emergencyApprovalSchema),
  validateEmergencyUsage: validate(emergencyUsageSchema),
  validateBulkGeneration: validate(bulkGenerationSchema),
  validateQRFilters: validate(qrFilterSchema, 'query'),
  validatePagination: validate(paginationSchema, 'query'),
  
  // Schemas for direct use
  schemas: {
    qrGeneration: qrGenerationSchema,
    qrValidation: qrValidationSchema,
    backupCode: backupCodeValidationSchema,
    emergencyOverride: emergencyOverrideSchema,
    emergencyApproval: emergencyApprovalSchema,
    emergencyUsage: emergencyUsageSchema,
    bulkGeneration: bulkGenerationSchema,
    pagination: paginationSchema,
    qrFilters: qrFilterSchema
  }
};