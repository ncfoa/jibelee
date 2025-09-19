const { sequelize } = require('../config/database');
const redisService = require('../config/redis');
const logger = require('../config/logger');

// Test database setup
beforeAll(async () => {
  try {
    // Connect to test database
    await sequelize.authenticate();
    logger.info('Test database connected');
    
    // Connect to Redis
    await redisService.connect();
    logger.info('Test Redis connected');
    
    // Sync database (create tables)
    await sequelize.sync({ force: true });
    logger.info('Test database synced');
  } catch (error) {
    logger.error('Test setup failed:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Close database connection
    await sequelize.close();
    logger.info('Test database connection closed');
    
    // Close Redis connection
    await redisService.disconnect();
    logger.info('Test Redis connection closed');
  } catch (error) {
    logger.error('Test cleanup failed:', error);
  }
});

// Clear data before each test
beforeEach(async () => {
  // Clear Redis cache
  await redisService.flushAll();
});

module.exports = {
  sequelize,
  redisService
};