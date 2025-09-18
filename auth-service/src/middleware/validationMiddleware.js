const Joi = require('joi');
const { logger } = require('../config/logger');

class ValidationMiddleware {
  // Generic validation middleware
  validate(schema, property = 'body') {
    return (req, res, next) => {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Validation error', {
          endpoint: req.originalUrl,
          errors,
          userAgent: req.get('User-Agent')
        });

        return res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: errors.map(e => e.message),
          details: errors
        });
      }

      // Replace request data with validated and sanitized data
      req[property] = value;
      next();
    };
  }

  // User registration validation
  validateRegistration = this.validate(Joi.object({
    email: Joi.string()
      .email()
      .max(255)
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.max': 'Email address is too long',
        'any.required': 'Email address is required'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password is too long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Password confirmation is required'
      }),
    
    firstName: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.min': 'First name must be at least 2 characters long',
        'string.max': 'First name is too long',
        'string.pattern.base': 'First name can only contain letters, spaces, apostrophes, and hyphens',
        'any.required': 'First name is required'
      }),
    
    lastName: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.min': 'Last name must be at least 2 characters long',
        'string.max': 'Last name is too long',
        'string.pattern.base': 'Last name can only contain letters, spaces, apostrophes, and hyphens',
        'any.required': 'Last name is required'
      }),
    
    phoneNumber: Joi.string()
      .pattern(/^\+[1-9]\d{1,14}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Phone number must be in E.164 format (e.g., +1234567890)'
      }),
    
    dateOfBirth: Joi.date()
      .max('now')
      .min('1900-01-01')
      .optional()
      .messages({
        'date.max': 'Date of birth cannot be in the future',
        'date.min': 'Please provide a valid date of birth'
      }),
    
    userType: Joi.string()
      .valid('customer', 'traveler', 'both')
      .default('customer')
      .messages({
        'any.only': 'User type must be customer, traveler, or both'
      }),
    
    acceptedTerms: Joi.boolean()
      .valid(true)
      .required()
      .messages({
        'any.only': 'You must accept the terms and conditions',
        'any.required': 'Terms acceptance is required'
      }),
    
    acceptedPrivacy: Joi.boolean()
      .valid(true)
      .required()
      .messages({
        'any.only': 'You must accept the privacy policy',
        'any.required': 'Privacy policy acceptance is required'
      }),
    
    preferredLanguage: Joi.string()
      .valid('en', 'es', 'fr', 'de', 'it', 'pt')
      .default('en')
      .optional(),
    
    timezone: Joi.string()
      .max(50)
      .default('UTC')
      .optional(),
    
    referralCode: Joi.string()
      .alphanum()
      .max(20)
      .optional()
      .messages({
        'string.alphanum': 'Referral code must contain only letters and numbers'
      })
  }));

  // User login validation
  validateLogin = this.validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email address is required'
      }),
    
    password: Joi.string()
      .min(1)
      .required()
      .messages({
        'any.required': 'Password is required'
      }),
    
    deviceInfo: Joi.object({
      deviceId: Joi.string().max(255).optional(),
      deviceType: Joi.string().valid('mobile', 'web', 'tablet', 'desktop').optional(),
      platform: Joi.string().valid('ios', 'android', 'web', 'windows', 'macos', 'linux').optional(),
      appVersion: Joi.string().max(20).optional(),
      pushToken: Joi.string().max(500).optional()
    }).optional().default({}),
    
    rememberMe: Joi.boolean().default(false)
  }));

  // Social login validation
  validateSocialLogin = this.validate(Joi.object({
    provider: Joi.string()
      .valid('google', 'facebook', 'apple')
      .required()
      .messages({
        'any.only': 'Provider must be google, facebook, or apple',
        'any.required': 'Social provider is required'
      }),
    
    accessToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Social access token is required'
      }),
    
    userInfo: Joi.object({
      id: Joi.string().required(),
      email: Joi.string().email().required(),
      firstName: Joi.string().max(100).required(),
      lastName: Joi.string().max(100).required(),
      profilePicture: Joi.string().uri().optional()
    }).required(),
    
    deviceInfo: Joi.object({
      deviceId: Joi.string().max(255).optional(),
      deviceType: Joi.string().valid('mobile', 'web', 'tablet', 'desktop').optional(),
      platform: Joi.string().valid('ios', 'android', 'web', 'windows', 'macos', 'linux').optional(),
      appVersion: Joi.string().max(20).optional()
    }).optional().default({})
  }));

  // Email verification validation
  validateEmailVerification = this.validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email address is required'
      }),
    
    verificationCode: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'Verification code must be 6 digits',
        'any.required': 'Verification code is required'
      })
  }));

  // Resend verification validation
  validateResendVerification = this.validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email address is required'
      })
  }));

  // Forgot password validation
  validateForgotPassword = this.validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email address is required'
      })
  }));

  // Reset password validation
  validateResetPassword = this.validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email address is required'
      }),
    
    resetCode: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'Reset code must be 6 digits',
        'any.required': 'Reset code is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password is too long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Password confirmation is required'
      })
  }));

  // Change password validation
  validateChangePassword = this.validate(Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password is too long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Password confirmation is required'
      })
  }));

  // 2FA verification validation
  validate2FAVerification = this.validate(Joi.object({
    code: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'Verification code must be 6 digits',
        'any.required': 'Verification code is required'
      })
  }));

  // 2FA login validation
  validate2FALogin = this.validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email address is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      }),
    
    twoFactorCode: Joi.string()
      .pattern(/^(\d{6}|[A-F0-9]{8})$/)
      .required()
      .messages({
        'string.pattern.base': 'Two-factor code must be 6 digits or 8-character backup code',
        'any.required': 'Two-factor authentication code is required'
      })
  }));

  // Refresh token validation
  validateRefreshToken = this.validate(Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Refresh token is required'
      })
  }));

  // Logout validation
  validateLogout = this.validate(Joi.object({
    deviceId: Joi.string().max(255).optional(),
    logoutFromAllDevices: Joi.boolean().default(false)
  }));

  // Account deactivation validation
  validateAccountDeactivation = this.validate(Joi.object({
    reason: Joi.string()
      .valid('privacy_concerns', 'not_useful', 'too_expensive', 'other')
      .required()
      .messages({
        'any.only': 'Reason must be one of: privacy_concerns, not_useful, too_expensive, other',
        'any.required': 'Reason for deactivation is required'
      }),
    
    feedback: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Feedback is too long (maximum 1000 characters)'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password confirmation is required'
      })
  }));

  // Account deletion validation
  validateAccountDeletion = this.validate(Joi.object({
    reason: Joi.string()
      .valid('privacy_concerns', 'not_useful', 'too_expensive', 'other')
      .required()
      .messages({
        'any.only': 'Reason must be one of: privacy_concerns, not_useful, too_expensive, other',
        'any.required': 'Reason for deletion is required'
      }),
    
    feedback: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Feedback is too long (maximum 1000 characters)'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password confirmation is required'
      }),
    
    confirmDeletion: Joi.boolean()
      .valid(true)
      .required()
      .messages({
        'any.only': 'You must confirm account deletion',
        'any.required': 'Deletion confirmation is required'
      })
  }));

  // Custom validation for UUID parameters
  validateUUID = this.validate(Joi.object({
    id: Joi.string()
      .guid({ version: 'uuidv4' })
      .required()
      .messages({
        'string.guid': 'Invalid ID format',
        'any.required': 'ID is required'
      })
  }), 'params');

  // Sanitize input to prevent XSS
  sanitizeInput(req, res, next) {
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;
      
      // Remove potentially dangerous characters
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
    };

    const sanitizeObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      
      return sanitizeString(obj);
    };

    // Sanitize request body, query, and params
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  }

  // Validate pagination parameters
  validatePagination = this.validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('createdAt', 'updatedAt', 'email', 'firstName', 'lastName').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }), 'query');

  // Validate search parameters
  validateSearch = this.validate(Joi.object({
    q: Joi.string().max(100).optional(),
    status: Joi.string().valid('pending', 'active', 'suspended', 'banned', 'deactivated').optional(),
    userType: Joi.string().valid('customer', 'traveler', 'both', 'admin', 'super_admin').optional(),
    verificationLevel: Joi.string().valid('unverified', 'email_verified', 'phone_verified', 'id_verified', 'fully_verified').optional()
  }), 'query');
}

module.exports = new ValidationMiddleware();