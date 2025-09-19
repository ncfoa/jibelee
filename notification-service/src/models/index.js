const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Import all models
const NotificationTemplate = require('./NotificationTemplate');
const Notification = require('./Notification');
const NotificationPreference = require('./NotificationPreference');
const DeviceToken = require('./DeviceToken');
const BulkNotification = require('./BulkNotification');
const NotificationWebhook = require('./NotificationWebhook');
const NotificationAnalytics = require('./NotificationAnalytics');
const EmailTemplate = require('./EmailTemplate');
const NotificationQueue = require('./NotificationQueue');
const UserNotificationSetting = require('./UserNotificationSetting');

// Initialize models
const models = {
  NotificationTemplate: NotificationTemplate(sequelize, DataTypes),
  Notification: Notification(sequelize, DataTypes),
  NotificationPreference: NotificationPreference(sequelize, DataTypes),
  DeviceToken: DeviceToken(sequelize, DataTypes),
  BulkNotification: BulkNotification(sequelize, DataTypes),
  NotificationWebhook: NotificationWebhook(sequelize, DataTypes),
  NotificationAnalytics: NotificationAnalytics(sequelize, DataTypes),
  EmailTemplate: EmailTemplate(sequelize, DataTypes),
  NotificationQueue: NotificationQueue(sequelize, DataTypes),
  UserNotificationSetting: UserNotificationSetting(sequelize, DataTypes)
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Add sequelize instance to models
models.sequelize = sequelize;
models.Sequelize = require('sequelize');

module.exports = models;