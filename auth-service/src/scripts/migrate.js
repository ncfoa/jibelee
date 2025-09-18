require('dotenv').config();
const { syncDatabase } = require('../models');
const { logger } = require('../config/logger');

const migrate = async () => {
  try {
    logger.info('Starting database migration...');
    
    const force = process.argv.includes('--force');
    if (force) {
      logger.warn('WARNING: Force migration will drop all existing tables!');
      
      // Wait 5 seconds to give user a chance to cancel
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await syncDatabase(force);
    
    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed:', error);
    process.exit(1);
  }
};

migrate();