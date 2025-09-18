const express = require('express');
const verificationController = require('../controllers/verificationController');
const { auth, fileUpload, validation, security } = require('../middleware');

const router = express.Router();

// Identity verification endpoints

// Upload verification documents
router.post('/me/verify-identity',
  auth.authenticateToken,
  security.fileUploadRateLimit,
  fileUpload.verificationDocumentUpload(),
  fileUpload.virusScanMiddleware(),
  fileUpload.imageValidationMiddleware({
    maxSize: 10 * 1024 * 1024, // 10MB
    minWidth: 300,
    minHeight: 200,
    maxWidth: 4000,
    maxHeight: 4000
  }),
  fileUpload.handleMulterError(),
  validation.verificationDocumentValidation(),
  verificationController.uploadVerificationDocument
);

// Get verification status
router.get('/me/verification/status',
  auth.authenticateToken,
  verificationController.getVerificationStatus
);

// Resubmit verification documents
router.post('/me/verification/resubmit',
  auth.authenticateToken,
  security.fileUploadRateLimit,
  fileUpload.verificationDocumentUpload(),
  fileUpload.virusScanMiddleware(),
  fileUpload.imageValidationMiddleware({
    maxSize: 10 * 1024 * 1024, // 10MB
    minWidth: 300,
    minHeight: 200,
    maxWidth: 4000,
    maxHeight: 4000
  }),
  fileUpload.handleMulterError(),
  validation.verificationDocumentValidation(),
  verificationController.resubmitVerification
);

// Phone verification endpoints

// Verify phone number (initiate)
router.post('/me/verify-phone',
  auth.authenticateToken,
  security.strictRateLimit,
  validation.phoneVerificationValidation(),
  verificationController.verifyPhoneNumber
);

// Confirm phone verification
router.post('/me/verify-phone/confirm',
  auth.authenticateToken,
  security.strictRateLimit,
  validation.phoneVerificationConfirmValidation(),
  verificationController.confirmPhoneVerification
);

// Admin endpoints

// Approve verification document
router.post('/verification/:verificationId/approve',
  auth.authenticateToken,
  auth.requireUserType('admin'),
  validation.uuidParamValidation('verificationId'),
  verificationController.approveVerification
);

// Reject verification document
router.post('/verification/:verificationId/reject',
  auth.authenticateToken,
  auth.requireUserType('admin'),
  validation.uuidParamValidation('verificationId'),
  verificationController.rejectVerification
);

// Get pending verifications
router.get('/verification/pending',
  auth.authenticateToken,
  auth.requireUserType('admin'),
  validation.paginationValidation(),
  verificationController.getPendingVerifications
);

// Get verification statistics
router.get('/verification/statistics',
  auth.authenticateToken,
  auth.requireUserType('admin'),
  verificationController.getVerificationStatistics
);

module.exports = router;