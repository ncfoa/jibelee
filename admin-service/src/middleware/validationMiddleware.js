const Joi = require('joi');
const logger = require('../config/logger');

/**
 * Generic validation middleware factory
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation error:', {
        path: req.path,
        method: req.method,
        property,
        errors: details,
        adminUser: req.adminUser ? req.adminUser.id : null
      });

      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details,
        code: 'VALIDATION_ERROR'
      });
    }

    // Replace request data with validated data
    req[property] = value;
    next();
  };
};

/**
 * Validate request body
 */
const validateBody = (schema) => validate(schema, 'body');

/**
 * Validate query parameters
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validate URL parameters
 */
const validateParams = (schema) => validate(schema, 'params');

// Common validation schemas
const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  optionalUuid: Joi.string().uuid().optional(),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(50),
    sortBy: Joi.string().default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Date range
  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    period: Joi.string().valid('today', 'week', 'month', 'quarter', 'year')
  }).xor('period', 'startDate'),

  // Search
  search: Joi.object({
    q: Joi.string().min(1).max(255),
    fields: Joi.array().items(Joi.string()).default(['name', 'email'])
  }),

  // Status filter
  statusFilter: Joi.string().valid('active', 'inactive', 'suspended', 'banned', 'pending'),

  // Amount range
  amountRange: Joi.object({
    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(Joi.ref('minAmount'))
  })
};

// Admin-specific validation schemas
const adminSchemas = {
  // Admin user creation
  createAdminUser: Joi.object({
    userId: commonSchemas.uuid,
    role: Joi.string().valid('super_admin', 'admin', 'moderator', 'support', 'finance', 'analyst').required(),
    permissions: Joi.array().items(Joi.string()).default([]),
    isActive: Joi.boolean().default(true)
  }),

  // Update admin user
  updateAdminUser: Joi.object({
    role: Joi.string().valid('super_admin', 'admin', 'moderator', 'support', 'finance', 'analyst'),
    permissions: Joi.array().items(Joi.string()),
    isActive: Joi.boolean()
  }),

  // User status update
  updateUserStatus: Joi.object({
    status: Joi.string().valid('active', 'suspended', 'banned', 'pending').required(),
    reason: Joi.string().valid('violation_of_terms', 'suspicious_activity', 'user_request', 'other').required(),
    description: Joi.string().max(1000).required(),
    duration: Joi.number().integer().min(1).max(365).when('status', {
      is: 'suspended',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    notifyUser: Joi.boolean().default(true),
    internalNotes: Joi.string().max(2000).optional()
  }),

  // User verification
  userVerification: Joi.object({
    verificationLevel: Joi.string().valid('unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified').required(),
    verificationNotes: Joi.string().max(1000).optional(),
    documentIds: Joi.array().items(commonSchemas.uuid).default([])
  }),

  // Dispute assignment
  disputeAssignment: Joi.object({
    assigneeId: commonSchemas.uuid.required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
    dueDate: Joi.date().iso().min('now').required(),
    notes: Joi.string().max(1000).optional()
  }),

  // Dispute resolution
  disputeResolution: Joi.object({
    resolution: Joi.string().valid('refund_customer', 'compensate_traveler', 'no_action', 'partial_refund').required(),
    amount: Joi.number().min(0).when('resolution', {
      is: Joi.valid('partial_refund', 'compensate_traveler'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    reason: Joi.string().max(1000).required(),
    customerRefund: Joi.number().min(0).default(0),
    travelerCompensation: Joi.number().min(0).default(0),
    platformLoss: Joi.number().min(0).default(0),
    internalNotes: Joi.string().max(2000).optional(),
    customerMessage: Joi.string().max(500).optional(),
    travelerMessage: Joi.string().max(500).optional(),
    preventiveMeasures: Joi.array().items(Joi.string().max(255)).default([])
  }),

  // Manual payout
  manualPayout: Joi.object({
    userId: commonSchemas.uuid.required(),
    amount: Joi.number().integer().min(1).required(), // in cents
    currency: Joi.string().length(3).uppercase().default('USD'),
    reason: Joi.string().max(500).required(),
    reference: Joi.string().max(100).optional(),
    notifyUser: Joi.boolean().default(true)
  }),

  // System configuration update
  systemConfigUpdate: Joi.object({
    category: Joi.string().valid('platform', 'payment', 'notification', 'security', 'feature_flags').required(),
    key: Joi.string().max(100).required(),
    value: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.object(),
      Joi.array()
    ).required(),
    description: Joi.string().max(500).optional(),
    requiresRestart: Joi.boolean().default(false)
  }),

  // Backup creation
  createBackup: Joi.object({
    type: Joi.string().valid('full', 'incremental', 'database_only', 'files_only').required(),
    description: Joi.string().max(255).optional(),
    includeUploads: Joi.boolean().default(true),
    includeLogs: Joi.boolean().default(false),
    retentionDays: Joi.number().integer().min(1).max(365).default(30)
  }),

  // Data export
  dataExport: Joi.object({
    type: Joi.string().valid('users', 'deliveries', 'transactions', 'reviews', 'all').required(),
    format: Joi.string().valid('csv', 'json', 'xlsx').required(),
    filters: Joi.object({
      dateFrom: Joi.date().iso(),
      dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
      status: Joi.string(),
      includeDeleted: Joi.boolean().default(false)
    }).default({}),
    fields: Joi.array().items(Joi.string()).optional(),
    compression: Joi.string().valid('zip', 'gzip', 'none').default('zip'),
    notifyWhenComplete: Joi.boolean().default(true)
  }),

  // Content moderation
  moderateContent: Joi.object({
    action: Joi.string().valid('approve', 'reject', 'edit', 'escalate').required(),
    reason: Joi.string().valid('inappropriate_content', 'spam', 'harassment', 'false_information', 'other').required(),
    moderatorNotes: Joi.string().max(1000).optional(),
    editedContent: Joi.string().max(5000).when('action', {
      is: 'edit',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    userAction: Joi.object({
      warnUser: Joi.boolean().default(false),
      suspendUser: Joi.boolean().default(false),
      duration: Joi.number().integer().min(1).max(365).when('suspendUser', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    }).default({}),
    notifyReporter: Joi.boolean().default(true),
    notifyAuthor: Joi.boolean().default(true)
  })
};

// Query parameter validation schemas
const querySchemas = {
  // User list filters
  userFilters: Joi.object({
    ...commonSchemas.pagination,
    search: Joi.string().max(255),
    status: Joi.string().valid('active', 'suspended', 'banned', 'pending'),
    userType: Joi.string().valid('customer', 'traveler', 'both'),
    verificationLevel: Joi.string().valid('unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified'),
    registrationDate: Joi.string().isoDate(),
    country: Joi.string().length(2).uppercase(),
    city: Joi.string().max(100)
  }),

  // Delivery filters
  deliveryFilters: Joi.object({
    ...commonSchemas.pagination,
    status: Joi.string().valid('pending', 'matched', 'in_transit', 'delivered', 'cancelled'),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    customerId: commonSchemas.optionalUuid,
    travelerId: commonSchemas.optionalUuid,
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
    search: Joi.string().max(255)
  }),

  // Financial filters
  financialFilters: Joi.object({
    ...commonSchemas.pagination,
    type: Joi.string().valid('payment', 'payout', 'refund', 'chargeback'),
    status: Joi.string().valid('pending', 'completed', 'failed', 'cancelled'),
    userId: commonSchemas.optionalUuid,
    amountFrom: Joi.number().min(0),
    amountTo: Joi.number().min(Joi.ref('amountFrom')),
    currency: Joi.string().length(3).uppercase(),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom'))
  }),

  // Dispute filters
  disputeFilters: Joi.object({
    ...commonSchemas.pagination,
    status: Joi.string().valid('open', 'under_review', 'awaiting_response', 'resolved', 'escalated', 'closed'),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    category: Joi.string().valid('item_not_delivered', 'item_damaged', 'service_not_as_described', 'unauthorized_charge', 'payment_issue', 'other'),
    assignee: commonSchemas.optionalUuid,
    createdAfter: Joi.date().iso(),
    createdBefore: Joi.date().iso().min(Joi.ref('createdAfter'))
  }),

  // Analytics filters
  analyticsFilters: Joi.object({
    period: Joi.string().valid('hour', 'day', 'week', 'month', 'quarter', 'year').default('day'),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    timezone: Joi.string().default('UTC'),
    granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day'),
    metrics: Joi.array().items(Joi.string()).default([]),
    dimensions: Joi.array().items(Joi.string()).default([])
  })
};

// Parameter validation schemas
const paramSchemas = {
  userId: Joi.object({
    userId: commonSchemas.uuid
  }),
  
  deliveryId: Joi.object({
    deliveryId: commonSchemas.uuid
  }),
  
  disputeId: Joi.object({
    disputeId: commonSchemas.uuid
  }),
  
  transactionId: Joi.object({
    transactionId: commonSchemas.uuid
  }),
  
  adminId: Joi.object({
    adminId: commonSchemas.uuid
  }),
  
  exportId: Joi.object({
    exportId: commonSchemas.uuid
  }),
  
  backupId: Joi.object({
    backupId: commonSchemas.uuid
  })
};

module.exports = {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
  adminSchemas,
  querySchemas,
  paramSchemas
};