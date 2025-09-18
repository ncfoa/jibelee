require('dotenv').config();
const { Sequelize } = require('sequelize');
const { logger } = require('./logger');

// Database configuration
const config = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'user_db',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 20,
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
    idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    evict: parseInt(process.env.DB_POOL_EVICT) || 1000
  },
  retry: {
    max: 3
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    connectTimeout: 60000,
    acquireConnectionTimeout: 60000,
    timeout: 60000
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
};

// Create Sequelize instance
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully', {
      database: config.database,
      host: config.host,
      port: config.port
    });
    return true;
  } catch (error) {
    logger.error('Unable to connect to database:', {
      error: error.message,
      database: config.database,
      host: config.host,
      port: config.port
    });
    return false;
  }
};

// Sync database
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    logger.info(`Database synchronized ${force ? '(forced)' : '(alter mode)'}`);
    return true;
  } catch (error) {
    logger.error('Database sync failed:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  config
};