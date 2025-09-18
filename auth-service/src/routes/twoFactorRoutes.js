const express = require('express');
const twoFactorController = require('../controllers/twoFactorController');
const { validation, rateLimit, auth } = require('../middleware');

const router = express.Router();

// All 2FA routes require authentication except 2FA login
router.use('/setup', auth.authenticate);
router.use('/verify', auth.authenticate);
router.use('/enable', auth.authenticate);
router.use('/disable', auth.authenticate);
router.use('/status', auth.authenticate);
router.use('/regenerate-backup-codes', auth.authenticate);
router.use('/recovery-codes', auth.authenticate);

// Setup 2FA (generate QR code and backup codes)
router.post('/setup',
  rateLimit.twoFactorSetupRateLimit,
  twoFactorController.setup2FA
);

// Enable 2FA (verify setup and activate)
router.post('/enable',
  rateLimit.twoFactorVerifyRateLimit,
  validation.validate2FAVerification,
  twoFactorController.enable2FA
);

// Disable 2FA
router.post('/disable',
  rateLimit.twoFactorVerifyRateLimit,
  validation.validate2FAVerification,
  twoFactorController.disable2FA
);

// Verify 2FA code (for sensitive operations)
router.post('/verify',
  rateLimit.twoFactorVerifyRateLimit,
  validation.validate2FAVerification,
  twoFactorController.verify2FA
);

// Get 2FA status
router.get('/status',
  twoFactorController.get2FAStatus
);

// Regenerate backup codes
router.post('/regenerate-backup-codes',
  rateLimit.twoFactorSetupRateLimit,
  validation.validate2FAVerification,
  twoFactorController.regenerateBackupCodes
);

// Get recovery codes
router.post('/recovery-codes',
  rateLimit.twoFactorSetupRateLimit,
  validation.validate2FAVerification,
  twoFactorController.getRecoveryCodes
);

// 2FA Login (public route)
router.post('/login',
  rateLimit.loginRateLimit,
  rateLimit.createFailedAttemptLimiter(),
  validation.validate2FALogin,
  twoFactorController.login2FA
);

module.exports = router;