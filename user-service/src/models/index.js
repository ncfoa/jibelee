const { sequelize, testConnection, syncDatabase } = require('../config/database');
const { logger } = require('../config/logger');

// Import models
const User = require('./User');
const UserAddress = require('./UserAddress');
const UserPreferences = require('./UserPreferences');
const UserStatistics = require('./UserStatistics');
const UserVerificationDocument = require('./UserVerificationDocument');
const Review = require('./Review');
const UserBlock = require('./UserBlock');
const UserFavorite = require('./UserFavorite');

// Initialize models
const models = {
  User: User(sequelize),
  UserAddress: UserAddress(sequelize),
  UserPreferences: UserPreferences(sequelize),
  UserStatistics: UserStatistics(sequelize),
  UserVerificationDocument: UserVerificationDocument(sequelize),
  Review: Review(sequelize),
  UserBlock: UserBlock(sequelize),
  UserFavorite: UserFavorite(sequelize)
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Add sequelize instance and Sequelize constructor to models object
models.sequelize = sequelize;
models.Sequelize = require('sequelize');

// Export test and sync functions
models.testConnection = testConnection;
models.syncDatabase = syncDatabase;

// Add hooks for logging
sequelize.addHook('beforeCreate', (instance, options) => {
  logger.debug('Creating new record', {
    model: instance.constructor.name,
    id: instance.id
  });
});

sequelize.addHook('beforeUpdate', (instance, options) => {
  logger.debug('Updating record', {
    model: instance.constructor.name,
    id: instance.id,
    changed: instance.changed()
  });
});

sequelize.addHook('beforeDestroy', (instance, options) => {
  logger.debug('Deleting record', {
    model: instance.constructor.name,
    id: instance.id
  });
});

module.exports = models;