const express = require('express');
const authController = require('../controllers/authController');
const { validation, rateLimit, auth } = require('../middleware');

const router = express.Router();

// Public routes (no authentication required)

// User Registration
router.post('/register', 
  rateLimit.registrationRateLimit,
  validation.validateRegistration,
  authController.register
);

// Email Verification
router.post('/verify-email',
  rateLimit.emailVerificationRateLimit,
  validation.validateEmailVerification,
  authController.verifyEmail
);

// Resend Verification Code
router.post('/resend-verification',
  rateLimit.emailVerificationRateLimit,
  validation.validateResendVerification,
  authController.resendVerification
);

// User Login
router.post('/login',
  rateLimit.loginRateLimit,
  rateLimit.createFailedAttemptLimiter(),
  validation.validateLogin,
  authController.login
);

// Forgot Password
router.post('/forgot-password',
  rateLimit.passwordResetRateLimit,
  validation.validateForgotPassword,
  authController.forgotPassword
);

// Reset Password
router.post('/reset-password',
  rateLimit.passwordResetRateLimit,
  validation.validateResetPassword,
  authController.resetPassword
);

// Refresh Token
router.post('/refresh',
  rateLimit.authRateLimit,
  validation.validateRefreshToken,
  authController.refreshToken
);

// Protected routes (authentication required)

// Change Password
router.post('/change-password',
  auth.authenticate,
  rateLimit.accountManagementRateLimit,
  validation.validateChangePassword,
  authController.changePassword
);

// Logout
router.post('/logout',
  auth.authenticate,
  rateLimit.sessionRateLimit,
  validation.validateLogout,
  authController.logout
);

// Validate Token
router.get('/validate',
  auth.authenticate,
  authController.validateToken
);

module.exports = router;