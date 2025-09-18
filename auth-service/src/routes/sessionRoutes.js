const express = require('express');
const Joi = require('joi');
const sessionController = require('../controllers/sessionController');
const { validation, rateLimit, auth } = require('../middleware');

const router = express.Router();

// All session routes require authentication
router.use(auth.authenticate);

// Get user sessions
router.get('/',
  rateLimit.sessionRateLimit,
  sessionController.getSessions
);

// Get current session details
router.get('/current',
  rateLimit.sessionRateLimit,
  sessionController.getCurrentSession
);

// Get session statistics
router.get('/stats',
  rateLimit.sessionRateLimit,
  sessionController.getSessionStats
);

// Check for suspicious sessions
router.get('/suspicious',
  rateLimit.sessionRateLimit,
  sessionController.checkSuspiciousSessions
);

// Update current session info
router.patch('/current',
  rateLimit.sessionRateLimit,
  validation.validate(Joi.object({
    pushToken: Joi.string().max(500).optional(),
    location: Joi.string().max(255).optional()
  })),
  sessionController.updateCurrentSession
);

// Extend current session (refresh activity)
router.post('/current/extend',
  rateLimit.sessionRateLimit,
  sessionController.extendSession
);

// Revoke a specific session
router.delete('/:sessionId',
  rateLimit.sessionRateLimit,
  validation.validateUUID,
  sessionController.revokeSession
);

// Revoke all sessions except current
router.delete('/',
  rateLimit.sessionRateLimit,
  sessionController.revokeAllSessions
);

module.exports = router;