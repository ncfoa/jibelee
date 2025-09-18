const express = require('express');
const templateController = require('../controllers/templateController');
const { auth, validation, rateLimit } = require('../middleware');

const router = express.Router();

// Template CRUD Routes
router.get('/',
  auth.verifyToken,
  validation.validatePagination(),
  templateController.getTemplates
);

router.post('/',
  auth.verifyToken,
  auth.requireUserType('traveler', 'both', 'admin'),
  validation.validateCreateTemplate(),
  validation.sanitizeInput(),
  rateLimit.strictRateLimit,
  templateController.createTemplate
);

router.get('/public',
  auth.optionalAuth,
  validation.validatePagination(),
  templateController.getPublicTemplates
);

router.get('/popular',
  auth.optionalAuth,
  validation.validate(validation.schema.object({
    limit: validation.schema.number().integer().min(1).max(50).default(10)
  }), 'query'),
  templateController.getPopularTemplates
);

router.get('/search',
  auth.optionalAuth,
  validation.validate(validation.schema.object({
    origin: validation.schema.string().min(2).max(200).required(),
    destination: validation.schema.string().min(2).max(200).required(),
    category: validation.schema.string().max(100).optional(),
    page: validation.schema.number().integer().min(1).default(1),
    limit: validation.schema.number().integer().min(1).max(100).default(20)
  }), 'query'),
  rateLimit.searchRateLimit,
  templateController.searchTemplates
);

router.get('/categories',
  auth.optionalAuth,
  templateController.getTemplateCategories
);

router.get('/:id',
  validation.validateUUID('id'),
  auth.optionalAuth,
  templateController.getTemplateById
);

router.put('/:id',
  validation.validateUUID('id'),
  auth.verifyToken,
  validation.validate(validation.schema.object({
    name: validation.schema.string().min(3).max(255).optional(),
    description: validation.schema.string().max(1000).optional(),
    tripData: validation.schema.object().optional(),
    category: validation.schema.string().max(100).optional(),
    tags: validation.schema.array().items(validation.schema.string().max(50)).max(10).optional(),
    isPublic: validation.schema.boolean().optional(),
    metadata: validation.schema.object().optional()
  })),
  validation.sanitizeInput(),
  rateLimit.updateRateLimit,
  templateController.updateTemplate
);

router.delete('/:id',
  validation.validateUUID('id'),
  auth.verifyToken,
  rateLimit.strictRateLimit,
  templateController.deleteTemplate
);

// Template Usage Routes
router.post('/:id/create-trip',
  validation.validateUUID('id'),
  auth.verifyToken,
  auth.requireUserType('traveler', 'both', 'admin'),
  validation.validate(validation.schema.object({
    departureTime: validation.schema.date().iso().greater('now').required(),
    arrivalTime: validation.schema.date().iso().greater(validation.schema.ref('departureTime')).required(),
    overrides: validation.schema.object({
      title: validation.schema.string().max(255).optional(),
      capacity: validation.capacitySchema.optional(),
      pricing: validation.pricingSchema.optional(),
      restrictions: validation.schema.object().optional(),
      preferences: validation.schema.object().optional(),
      tags: validation.schema.array().items(validation.schema.string().max(50)).optional()
    }).optional()
  })),
  validation.sanitizeInput(),
  rateLimit.createTripRateLimit,
  templateController.createTripFromTemplate
);

module.exports = router;