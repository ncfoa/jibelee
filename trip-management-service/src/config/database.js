require('dotenv').config();
const { Sequelize } = require('sequelize');
const { logger } = require('./logger');

// Database configuration
const config = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'trip_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: process.env.DB_LOGGING === 'true' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true, // Enable soft deletes
      freezeTableName: true
    },
    dialectOptions: {
      useUTC: true,
      dateStrings: true,
      typeCast: true,
      timezone: '+00:00'
    },
    timezone: '+00:00'
  },
  test: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: `${process.env.DB_NAME || 'trip_db'}_test`,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
      freezeTableName: true
    },
    dialectOptions: {
      useUTC: true,
      dateStrings: true,
      typeCast: true,
      timezone: '+00:00'
    },
    timezone: '+00:00'
  },
  production: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
      freezeTableName: true
    },
    dialectOptions: {
      useUTC: true,
      dateStrings: true,
      typeCast: true,
      timezone: '+00:00',
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    timezone: '+00:00'
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig
);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully', {
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port
    });
    return true;
  } catch (error) {
    logger.error('Unable to connect to database:', {
      error: error.message,
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port
    });
    return false;
  }
};

// Sync database models
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    logger.info(`Database synchronized successfully${force ? ' (forced)' : ''}`);
    return true;
  } catch (error) {
    logger.error('Database synchronization failed:', error);
    throw error;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
};

// Execute raw SQL query
const executeQuery = async (query, replacements = {}, options = {}) => {
  try {
    const [results, metadata] = await sequelize.query(query, {
      replacements,
      type: Sequelize.QueryTypes.SELECT,
      ...options
    });
    return results;
  } catch (error) {
    logger.error('Query execution failed:', {
      error: error.message,
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      replacements
    });
    throw error;
  }
};

// Transaction wrapper
const withTransaction = async (callback) => {
  const transaction = await sequelize.transaction();
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Health check for database
const healthCheck = async () => {
  try {
    await sequelize.authenticate();
    const result = await sequelize.query('SELECT NOW() as current_time', {
      type: Sequelize.QueryTypes.SELECT
    });
    return {
      status: 'healthy',
      timestamp: result[0].current_time,
      connection_pool: {
        total: sequelize.connectionManager.pool.size,
        idle: sequelize.connectionManager.pool.available,
        used: sequelize.connectionManager.pool.using
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

module.exports = {
  sequelize,
  config: dbConfig,
  testConnection,
  syncDatabase,
  closeConnection,
  executeQuery,
  withTransaction,
  healthCheck,
  Sequelize
};