const { Sequelize } = require('sequelize');
const logger = require('./logger');

// Database configuration
const config = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME || 'admin_db',
  username: process.env.DATABASE_USER || 'admin_user',
  password: process.env.DATABASE_PASSWORD || 'admin_password',
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
};

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DATABASE_URL || `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`,
  config
);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
};

// Sync database models
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    logger.info(`Database synced ${force ? 'with force' : 'successfully'}`);
  } catch (error) {
    logger.error('Database sync failed:', error);
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

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  closeConnection,
  authenticate: () => sequelize.authenticate(),
  close: () => sequelize.close()
};