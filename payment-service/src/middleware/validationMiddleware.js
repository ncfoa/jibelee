const Joi = require('joi');
const { logger } = require('../config/logger');

/**
 * Generic validation middleware factory
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation failed:', {
        endpoint: req.path,
        method: req.method,
        property,
        errors: validationErrors
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationErrors
        }
      });
    }

    // Replace the request property with the validated value
    req[property] = value;
    next();
  };
};

// Common validation schemas
const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  amount: Joi.number().integer().min(50).max(10000000), // $0.50 to $100,000
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY').default('USD'),
  email: Joi.string().email().max(255),
  url: Joi.string().uri().max(2048),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  },
  dateRange: {
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom'))
  }
};

// Location schema
const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(255)
});

// Item schema
const itemSchema = Joi.object({
  weight: Joi.number().min(0.1).max(100), // 0.1kg to 100kg
  dimensions: Joi.object({
    length: Joi.number().min(1).max(200), // cm
    width: Joi.number().min(1).max(200),
    height: Joi.number().min(1).max(200)
  }),
  value: Joi.number().min(0).max(1000000), // $0 to $10,000
  category: Joi.string().valid(
    'electronics', 'documents', 'clothing', 'fragile', 
    'food', 'medical', 'books', 'gifts', 'other'
  ),
  fragile: Joi.boolean().default(false),
  hazardous: Joi.boolean().default(false)
});

// Time window schema
const timeWindowSchema = Joi.object({
  pickup: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().min(Joi.ref('start')).required()
  }),
  delivery: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().min(Joi.ref('start')).required()
  })
});

// Payment validation schemas
const paymentSchemas = {
  // Calculate price request
  calculatePrice: Joi.object({
    deliveryRequest: Joi.object({
      id: commonSchemas.uuid.optional(),
      route: Joi.object({
        origin: locationSchema.required(),
        destination: locationSchema.required()
      }).required(),
      item: itemSchema.required(),
      urgency: Joi.string().valid('standard', 'express', 'urgent').default('standard'),
      timeWindow: timeWindowSchema
    }).required(),
    trip: Joi.object({
      id: commonSchemas.uuid,
      type: Joi.string().valid('flight', 'train', 'bus', 'car'),
      departureTime: Joi.date().iso(),
      arrivalTime: Joi.date().iso().min(Joi.ref('departureTime'))
    }),
    traveler: Joi.object({
      id: commonSchemas.uuid,
      rating: Joi.number().min(0).max(5),
      experienceLevel: Joi.string().valid('novice', 'experienced', 'expert'),
      specializations: Joi.array().items(Joi.string())
    }),
    options: Joi.object({
      includeInsurance: Joi.boolean().default(false),
      expeditedService: Joi.boolean().default(false),
      whiteGloveService: Joi.boolean().default(false),
      photoUpdates: Joi.boolean().default(false),
      signatureRequired: Joi.boolean().default(false)
    }).default({})
  }),

  // Create payment intent
  createPaymentIntent: Joi.object({
    deliveryId: commonSchemas.uuid.required(),
    amount: commonSchemas.amount.required(),
    currency: commonSchemas.currency,
    paymentMethodId: Joi.string().max(255),
    customerId: commonSchemas.uuid.required(),
    customerEmail: commonSchemas.email,
    travelerId: commonSchemas.uuid,
    escrow: Joi.object({
      enabled: Joi.boolean().default(true),
      releaseCondition: Joi.string().valid(
        'delivery_confirmed', 'qr_scanned', 'manual_release'
      ).default('delivery_confirmed'),
      holdPeriod: Joi.number().integer().min(1).max(168).default(72) // 1-168 hours
    }).default({}),
    fees: Joi.object({
      platformFee: Joi.number().integer().min(0),
      processingFee: Joi.number().integer().min(0),
      insuranceFee: Joi.number().integer().min(0).default(0)
    }),
    metadata: Joi.object().pattern(Joi.string(), Joi.alternatives().try(
      Joi.string(), Joi.number(), Joi.boolean()
    )).default({})
  }),

  // Confirm payment
  confirmPayment: Joi.object({
    paymentMethodId: Joi.string().max(255),
    billingDetails: Joi.object({
      name: Joi.string().max(255),
      email: commonSchemas.email,
      address: Joi.object({
        line1: Joi.string().max(255),
        line2: Joi.string().max(255),
        city: Joi.string().max(100),
        state: Joi.string().max(100),
        postalCode: Joi.string().max(20),
        country: Joi.string().length(2).uppercase()
      })
    }),
    savePaymentMethod: Joi.boolean().default(false),
    returnUrl: commonSchemas.url,
    receiptEmail: commonSchemas.email
  }),

  // Create payout account
  createPayoutAccount: Joi.object({
    accountType: Joi.string().valid('express', 'standard', 'custom').default('express'),
    country: Joi.string().length(2).uppercase().required(),
    currency: commonSchemas.currency,
    individual: Joi.object({
      firstName: Joi.string().max(100),
      lastName: Joi.string().max(100),
      dateOfBirth: Joi.object({
        day: Joi.number().integer().min(1).max(31),
        month: Joi.number().integer().min(1).max(12),
        year: Joi.number().integer().min(1900).max(new Date().getFullYear() - 18)
      }),
      address: Joi.object({
        line1: Joi.string().max(255).required(),
        line2: Joi.string().max(255),
        city: Joi.string().max(100).required(),
        state: Joi.string().max(100),
        postalCode: Joi.string().max(20).required(),
        country: Joi.string().length(2).uppercase().required()
      }),
      phone: Joi.string().max(20),
      email: commonSchemas.email,
      ssn: Joi.string().max(20) // Last 4 digits for US
    }),
    company: Joi.object({
      name: Joi.string().max(255),
      taxId: Joi.string().max(50),
      address: Joi.object({
        line1: Joi.string().max(255).required(),
        line2: Joi.string().max(255),
        city: Joi.string().max(100).required(),
        state: Joi.string().max(100),
        postalCode: Joi.string().max(20).required(),
        country: Joi.string().length(2).uppercase().required()
      })
    }),
    businessProfile: Joi.object({
      mcc: Joi.string().length(4),
      url: commonSchemas.url
    }).default({}),
    tosAcceptance: Joi.object({
      date: Joi.number().integer().required(),
      ip: Joi.string().ip().required()
    }).required()
  }),

  // Request payout
  requestPayout: Joi.object({
    amount: commonSchemas.amount.required(),
    currency: commonSchemas.currency,
    type: Joi.string().valid('standard', 'instant').default('standard'),
    description: Joi.string().max(500).default('Delivery earnings payout')
  }),

  // Release escrow
  releaseEscrow: Joi.object({
    releaseReason: Joi.string().valid(
      'delivery_confirmed', 'qr_scanned', 'manual_approval', 'dispute_resolved'
    ).required(),
    deliveryConfirmation: Joi.object({
      qrScanId: commonSchemas.uuid,
      timestamp: Joi.date().iso(),
      location: locationSchema
    }),
    releaseAmount: commonSchemas.amount,
    deductions: Joi.object({
      damages: Joi.number().integer().min(0).default(0),
      penalties: Joi.number().integer().min(0).default(0),
      additionalFees: Joi.number().integer().min(0).default(0)
    }).default({}),
    releaseNotes: Joi.string().max(1000)
  }),

  // Create refund
  createRefund: Joi.object({
    paymentIntentId: commonSchemas.uuid.required(),
    amount: commonSchemas.amount,
    reason: Joi.string().valid(
      'delivery_cancelled', 'item_damaged', 'service_not_provided',
      'customer_request', 'dispute_resolution', 'duplicate', 'fraudulent'
    ).required(),
    description: Joi.string().max(500),
    refundBreakdown: Joi.object({
      customerRefund: Joi.number().integer().min(0).required(),
      travelerCompensation: Joi.number().integer().min(0).default(0),
      platformFeeRefund: Joi.number().integer().min(0).default(0)
    }),
    metadata: Joi.object().pattern(Joi.string(), Joi.alternatives().try(
      Joi.string(), Joi.number(), Joi.boolean()
    )).default({})
  }),

  // Market analysis query parameters
  marketAnalysis: Joi.object({
    origin: Joi.string().required(),
    destination: Joi.string().required(),
    category: Joi.string().valid(
      'electronics', 'documents', 'clothing', 'fragile', 
      'food', 'medical', 'books', 'gifts', 'other'
    ),
    weight: Joi.number().min(0.1).max(100),
    urgency: Joi.string().valid('standard', 'express', 'urgent'),
    period: Joi.string().valid('week', 'month', 'quarter').default('month')
  }),

  // Payment history query parameters
  paymentHistory: Joi.object({
    type: Joi.string().valid('payment', 'payout', 'refund', 'all').default('all'),
    status: Joi.string().valid(
      'pending', 'succeeded', 'failed', 'canceled', 'processing'
    ),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
    deliveryId: commonSchemas.uuid,
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit
  }),

  // Pricing optimization
  optimizePricing: Joi.object({
    route: Joi.object({
      origin: Joi.string().required(),
      destination: Joi.string().required()
    }).required(),
    itemCategory: Joi.string().valid(
      'electronics', 'documents', 'clothing', 'fragile', 
      'food', 'medical', 'books', 'gifts', 'other'
    ).required(),
    currentPrice: Joi.number().min(0).required(),
    goals: Joi.object({
      maximizeAcceptance: Joi.boolean().default(false),
      maximizeRevenue: Joi.boolean().default(false),
      targetMargin: Joi.number().min(0).max(1)
    }).default({}),
    constraints: Joi.object({
      minPrice: Joi.number().min(0),
      maxPrice: Joi.number().min(Joi.ref('minPrice'))
    }).default({})
  }),

  // Exchange rates
  exchangeRates: Joi.object({
    from: Joi.string().length(3).uppercase().required(),
    to: Joi.string().length(3).uppercase().required(),
    amount: Joi.number().min(0.01).default(100)
  })
};

// Parameter validation schemas
const paramSchemas = {
  paymentIntentId: Joi.object({
    paymentIntentId: commonSchemas.uuid
  }),
  escrowId: Joi.object({
    escrowId: commonSchemas.uuid
  }),
  accountId: Joi.object({
    accountId: commonSchemas.uuid
  }),
  payoutId: Joi.object({
    payoutId: commonSchemas.uuid
  }),
  refundId: Joi.object({
    refundId: commonSchemas.uuid
  })
};

/**
 * Validation middleware functions
 */
const validateCalculatePrice = validate(paymentSchemas.calculatePrice);
const validateCreatePaymentIntent = validate(paymentSchemas.createPaymentIntent);
const validateConfirmPayment = validate(paymentSchemas.confirmPayment);
const validateCreatePayoutAccount = validate(paymentSchemas.createPayoutAccount);
const validateRequestPayout = validate(paymentSchemas.requestPayout);
const validateReleaseEscrow = validate(paymentSchemas.releaseEscrow);
const validateCreateRefund = validate(paymentSchemas.createRefund);
const validateOptimizePricing = validate(paymentSchemas.optimizePricing);

// Query parameter validations
const validateMarketAnalysisQuery = validate(paymentSchemas.marketAnalysis, 'query');
const validatePaymentHistoryQuery = validate(paymentSchemas.paymentHistory, 'query');
const validateExchangeRatesQuery = validate(paymentSchemas.exchangeRates, 'query');

// Parameter validations
const validatePaymentIntentId = validate(paramSchemas.paymentIntentId, 'params');
const validateEscrowId = validate(paramSchemas.escrowId, 'params');
const validateAccountId = validate(paramSchemas.accountId, 'params');
const validatePayoutId = validate(paramSchemas.payoutId, 'params');
const validateRefundId = validate(paramSchemas.refundId, 'params');

/**
 * Custom validation middleware for complex scenarios
 */
const validatePaymentOwnership = async (req, res, next) => {
  const { paymentIntentId } = req.params;
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required'
      }
    });
  }

  // Admin users can access any payment
  if (user.roles && user.roles.includes('admin')) {
    return next();
  }

  try {
    // This would typically query the database to check ownership
    // For now, we'll pass it through and let the service handle it
    next();
  } catch (error) {
    logger.error('Error validating payment ownership:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'OWNERSHIP_VALIDATION_ERROR',
        message: 'Failed to validate payment ownership'
      }
    });
  }
};

/**
 * Webhook payload validation
 */
const validateWebhookPayload = (req, res, next) => {
  if (!req.stripeEvent) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Invalid webhook payload'
      }
    });
  }

  // Validate that the webhook event has required properties
  const event = req.stripeEvent;
  if (!event.id || !event.type || !event.data) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_WEBHOOK_EVENT',
        message: 'Webhook event is missing required properties'
      }
    });
  }

  next();
};

/**
 * Amount limits validation middleware
 */
const validateAmountLimits = (req, res, next) => {
  const { amount, currency = 'USD' } = req.body;
  
  if (!amount) {
    return next();
  }

  // Define limits per currency (in cents)
  const limits = {
    USD: { min: 50, max: 10000000 }, // $0.50 - $100,000
    EUR: { min: 50, max: 10000000 },
    GBP: { min: 50, max: 10000000 },
    CAD: { min: 50, max: 10000000 },
    AUD: { min: 50, max: 10000000 },
    JPY: { min: 50, max: 1000000000 } // Different scale for JPY
  };

  const currencyLimits = limits[currency.toUpperCase()];
  if (!currencyLimits) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_CURRENCY',
        message: `Currency ${currency} is not supported`
      }
    });
  }

  if (amount < currencyLimits.min || amount > currencyLimits.max) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AMOUNT_OUT_OF_RANGE',
        message: `Amount must be between ${currencyLimits.min} and ${currencyLimits.max} cents`
      }
    });
  }

  next();
};

module.exports = {
  validate,
  validateCalculatePrice,
  validateCreatePaymentIntent,
  validateConfirmPayment,
  validateCreatePayoutAccount,
  validateRequestPayout,
  validateReleaseEscrow,
  validateCreateRefund,
  validateOptimizePricing,
  validateMarketAnalysisQuery,
  validatePaymentHistoryQuery,
  validateExchangeRatesQuery,
  validatePaymentIntentId,
  validateEscrowId,
  validateAccountId,
  validatePayoutId,
  validateRefundId,
  validatePaymentOwnership,
  validateWebhookPayload,
  validateAmountLimits,
  commonSchemas,
  paymentSchemas,
  paramSchemas
};