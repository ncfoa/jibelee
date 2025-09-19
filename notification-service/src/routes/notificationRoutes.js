const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { 
  authenticateToken, 
  authenticateAdmin, 
  authorizeUser,
  rateLimitByUser 
} = require('../middleware/authMiddleware');
const {
  sendNotificationValidation,
  sendCustomNotificationValidation,
  sendBulkNotificationsValidation,
  deviceTokenValidation,
  testNotificationValidation,
  uuidParam,
  paginationQuery,
  dateRangeQuery
} = require('../middleware/validationMiddleware');

const notificationController = new NotificationController();

// Apply rate limiting to all routes
router.use(rateLimitByUser(100, 15 * 60 * 1000)); // 100 requests per 15 minutes

// Send single notification
router.post('/send', 
  authenticateToken,
  sendNotificationValidation,
  notificationController.sendNotification.bind(notificationController)
);

// Send custom notification
router.post('/send-custom',
  authenticateToken,
  sendCustomNotificationValidation,
  notificationController.sendCustomNotification.bind(notificationController)
);

// Send bulk notifications (admin only)
router.post('/send-bulk',
  authenticateAdmin,
  sendBulkNotificationsValidation,
  notificationController.sendBulkNotifications.bind(notificationController)
);

// Test notification (admin only)
router.post('/test',
  authenticateAdmin,
  testNotificationValidation,
  notificationController.testNotification.bind(notificationController)
);

// Get user notifications
router.get('/user/:userId',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  paginationQuery,
  dateRangeQuery,
  notificationController.getUserNotifications.bind(notificationController)
);

// Mark notification as read
router.post('/:notificationId/read',
  authenticateToken,
  ...uuidParam('notificationId'),
  notificationController.markAsRead.bind(notificationController)
);

// Mark notification as clicked
router.post('/:notificationId/clicked',
  authenticateToken,
  ...uuidParam('notificationId'),
  notificationController.markAsClicked.bind(notificationController)
);

// Mark all notifications as read
router.put('/user/:userId/read-all',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  notificationController.markAllAsRead.bind(notificationController)
);

// Delete notification
router.delete('/:notificationId',
  authenticateToken,
  ...uuidParam('notificationId'),
  notificationController.deleteNotification.bind(notificationController)
);

// Device token management
router.post('/device-tokens',
  authenticateToken,
  deviceTokenValidation,
  notificationController.registerDeviceToken.bind(notificationController)
);

router.put('/device-tokens/:tokenId',
  authenticateToken,
  ...uuidParam('tokenId'),
  notificationController.updateDeviceToken.bind(notificationController)
);

// Get notification statistics
router.get('/stats/:userId',
  authenticateToken,
  authorizeUser,
  ...uuidParam('userId'),
  notificationController.getNotificationStats.bind(notificationController)
);

// Health check
router.get('/health',
  notificationController.getHealth.bind(notificationController)
);

module.exports = router;