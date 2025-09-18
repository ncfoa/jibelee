const express = require('express');
const Joi = require('joi');
const socialAuthController = require('../controllers/socialAuthController');
const { validation, rateLimit, auth } = require('../middleware');

const router = express.Router();

// Social Login (public route)
router.post('/login',
  rateLimit.authRateLimit,
  rateLimit.createFailedAttemptLimiter(),
  validation.validateSocialLogin,
  socialAuthController.socialLogin
);

// Protected routes (authentication required)

// Link social account to existing account
router.post('/link',
  auth.authenticate,
  rateLimit.accountManagementRateLimit,
  validation.validateSocialLogin,
  socialAuthController.linkSocialAccount
);

// Unlink social account
router.delete('/:provider',
  auth.authenticate,
  rateLimit.accountManagementRateLimit,
  validation.validate(Joi.object({
    provider: Joi.string().valid('google', 'facebook', 'apple').required()
  }), 'params'),
  socialAuthController.unlinkSocialAccount
);

// Get linked social accounts
router.get('/linked',
  auth.authenticate,
  socialAuthController.getLinkedAccounts
);

module.exports = router;