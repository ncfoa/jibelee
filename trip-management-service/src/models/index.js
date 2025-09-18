const { sequelize, testConnection, syncDatabase, closeConnection } = require('../config/database');
const { logger } = require('../config/logger');

// Import all models
const Trip = require('./Trip');
const TripTemplate = require('./TripTemplate');
const TripWeather = require('./TripWeather');

// Initialize models
const models = {
  Trip: Trip(sequelize),
  TripTemplate: TripTemplate(sequelize),
  TripWeather: TripWeather(sequelize)
};

// Define associations
const defineAssociations = () => {
  const { Trip, TripTemplate, TripWeather } = models;

  // Trip associations
  Trip.hasMany(TripWeather, {
    foreignKey: 'trip_id',
    as: 'weather',
    onDelete: 'CASCADE'
  });

  Trip.belongsTo(Trip, {
    foreignKey: 'parent_trip_id',
    as: 'parentTrip',
    onDelete: 'SET NULL'
  });

  Trip.hasMany(Trip, {
    foreignKey: 'parent_trip_id',
    as: 'childTrips',
    onDelete: 'SET NULL'
  });

  // TripTemplate associations
  TripTemplate.hasMany(Trip, {
    foreignKey: 'template_id',
    as: 'trips',
    onDelete: 'SET NULL'
  });

  // TripWeather associations
  TripWeather.belongsTo(Trip, {
    foreignKey: 'trip_id',
    as: 'trip',
    onDelete: 'CASCADE'
  });

  logger.info('Model associations defined successfully');
};

// Define associations
defineAssociations();

// Export models and database utilities
module.exports = {
  sequelize,
  models,
  testConnection,
  syncDatabase,
  closeConnection,
  
  // Individual model exports for convenience
  Trip: models.Trip,
  TripTemplate: models.TripTemplate,
  TripWeather: models.TripWeather
};