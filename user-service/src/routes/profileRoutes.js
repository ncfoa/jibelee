const express = require('express');
const profileController = require('../controllers/profileController');
const { auth, fileUpload, validation, security } = require('../middleware');

const router = express.Router();

// Get current user profile
router.get('/me', 
  auth.authenticateToken,
  profileController.getCurrentProfile
);

// Update current user profile
router.put('/me', 
  auth.authenticateToken,
  validation.profileUpdateValidation(),
  profileController.updateProfile
);

// Upload profile picture
router.post('/me/profile-picture',
  auth.authenticateToken,
  security.fileUploadRateLimit,
  fileUpload.profilePictureUpload(),
  fileUpload.virusScanMiddleware(),
  fileUpload.imageValidationMiddleware({
    maxSize: 5 * 1024 * 1024, // 5MB
    minWidth: 100,
    minHeight: 100,
    maxWidth: 2000,
    maxHeight: 2000
  }),
  fileUpload.handleMulterError(),
  profileController.uploadProfilePicture
);

// Delete profile picture
router.delete('/me/profile-picture',
  auth.authenticateToken,
  profileController.deleteProfilePicture
);

// Get user profile by ID
router.get('/:userId',
  auth.optionalAuth,
  validation.uuidParamValidation('userId'),
  profileController.getUserProfile
);

// Search users
router.get('/',
  auth.optionalAuth,
  validation.userSearchValidation(),
  profileController.searchUsers
);

// Get user statistics
router.get('/:userId/statistics',
  auth.authenticateToken,
  validation.uuidParamValidation('userId'),
  validation.statisticsPeriodValidation(),
  profileController.getUserStatistics
);

// Get user activity
router.get('/me/activity',
  auth.authenticateToken,
  validation.paginationValidation(),
  profileController.getUserActivity
);

// Delete user account
router.delete('/me',
  auth.authenticateToken,
  security.strictRateLimit,
  profileController.deleteAccount
);

module.exports = router;