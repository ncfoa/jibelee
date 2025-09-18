const express = require('express');
const Joi = require('joi');
const accountController = require('../controllers/accountController');
const { validation, rateLimit, auth } = require('../middleware');

const router = express.Router();

// Account deactivation (public route for reactivation)
router.post('/reactivate',
  rateLimit.authRateLimit,
  validation.validate(Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })),
  accountController.reactivateAccount
);

// Protected routes (authentication required)
router.use(auth.authenticate);

// Get account status
router.get('/status',
  accountController.getAccountStatus
);

// Update account settings
router.patch('/settings',
  rateLimit.accountManagementRateLimit,
  validation.validate(Joi.object({
    preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'it', 'pt').optional(),
    timezone: Joi.string().max(50).optional(),
    preferredCurrency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'AUD').optional(),
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional()
  })),
  accountController.updateAccountSettings
);

// Export account data (GDPR compliance)
router.get('/export',
  rateLimit.accountManagementRateLimit,
  accountController.exportAccountData
);

// Get security log
router.get('/security-log',
  validation.validatePagination,
  accountController.getSecurityLog
);

// Account deactivation
router.post('/deactivate',
  rateLimit.accountManagementRateLimit,
  validation.validateAccountDeactivation,
  accountController.deactivateAccount
);

// Account deletion request
router.delete('/',
  rateLimit.accountManagementRateLimit,
  validation.validateAccountDeletion,
  accountController.deleteAccount
);

module.exports = router;