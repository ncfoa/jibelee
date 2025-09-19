const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Import all models
const AdminUser = require('./AdminUser');
const AdminActivityLog = require('./AdminActivityLog');
const SystemConfiguration = require('./SystemConfiguration');
const Dispute = require('./Dispute');
const DisputeEvidence = require('./DisputeEvidence');
const DisputeMessage = require('./DisputeMessage');
const SystemBackup = require('./SystemBackup');
const DataExport = require('./DataExport');
const DailyMetric = require('./DailyMetric');

// Initialize models
const models = {
  AdminUser: AdminUser(sequelize, DataTypes),
  AdminActivityLog: AdminActivityLog(sequelize, DataTypes),
  SystemConfiguration: SystemConfiguration(sequelize, DataTypes),
  Dispute: Dispute(sequelize, DataTypes),
  DisputeEvidence: DisputeEvidence(sequelize, DataTypes),
  DisputeMessage: DisputeMessage(sequelize, DataTypes),
  SystemBackup: SystemBackup(sequelize, DataTypes),
  DataExport: DataExport(sequelize, DataTypes),
  DailyMetric: DailyMetric(sequelize, DataTypes)
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Add sequelize instance and constructor to models object
models.sequelize = sequelize;
models.Sequelize = require('sequelize');

module.exports = models;