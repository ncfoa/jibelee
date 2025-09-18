const express = require('express');
const preferencesController = require('../controllers/preferencesController');
const { auth, validation } = require('../middleware');

const router = express.Router();

// Get user preferences
router.get('/me/preferences',
  auth.authenticateToken,
  preferencesController.getUserPreferences
);

// Update user preferences
router.put('/me/preferences',
  auth.authenticateToken,
  validation.preferencesValidation(),
  preferencesController.updatePreferences
);

// Update notification preferences specifically
router.put('/me/notifications',
  auth.authenticateToken,
  preferencesController.updateNotificationPreferences
);

// Get specific preference setting
router.get('/me/preferences/:category/:setting',
  auth.authenticateToken,
  preferencesController.getPreferenceSetting
);

// Update specific preference setting
router.put('/me/preferences/:category/:setting',
  auth.authenticateToken,
  preferencesController.updatePreferenceSetting
);

// Reset preferences to default
router.post('/me/preferences/reset',
  auth.authenticateToken,
  preferencesController.resetPreferences
);

module.exports = router;