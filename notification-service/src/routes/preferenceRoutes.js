const express = require('express');
const router = express.Router();
const PreferenceController = require('../controllers/preferenceController');
const { 
  authenticateToken, 
  authenticateAdmin, 
  authorizeUser,
  rateLimitByUser 
} = require('../middleware/authMiddleware');
const {
  updatePreferencesValidation,
  updateChannelPreferencesValidation,
  updateQuietHoursValidation,
  updateUserSettingValidation,
  bulkUpdateUserSettingsValidation,
  uuidParam
} = require('../middleware/validationMiddleware');

const preferenceController = new PreferenceController();

// Apply rate limiting
router.use(rateLimitByUser(50, 15 * 60 * 1000)); // 50 requests per 15 minutes

// Get user notification preferences
router.get('/:userId',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  preferenceController.getUserPreferences.bind(preferenceController)
);

// Update user notification preferences
router.put('/:userId',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  updatePreferencesValidation,
  preferenceController.updateUserPreferences.bind(preferenceController)
);

// Update specific channel preferences
router.put('/:userId/channels/:channel',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  updateChannelPreferencesValidation,
  preferenceController.updateChannelPreferences.bind(preferenceController)
);

// Update quiet hours
router.put('/:userId/quiet-hours',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  updateQuietHoursValidation,
  preferenceController.updateQuietHours.bind(preferenceController)
);

// Get user notification settings
router.get('/:userId/settings',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  preferenceController.getUserSettings.bind(preferenceController)
);

// Update specific user setting
router.put('/:userId/settings/:settingKey',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  updateUserSettingValidation,
  preferenceController.updateUserSetting.bind(preferenceController)
);

// Bulk update user settings
router.put('/:userId/settings',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  bulkUpdateUserSettingsValidation,
  preferenceController.bulkUpdateUserSettings.bind(preferenceController)
);

// Reset preferences to default
router.post('/:userId/reset',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  preferenceController.resetPreferences.bind(preferenceController)
);

// Export user preferences
router.get('/:userId/export',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  preferenceController.exportPreferences.bind(preferenceController)
);

// Import user preferences
router.post('/:userId/import',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  preferenceController.importPreferences.bind(preferenceController)
);

// Get preference statistics (admin only)
router.get('/stats/overview',
  authenticateAdmin,
  preferenceController.getPreferenceStats.bind(preferenceController)
);

module.exports = router;