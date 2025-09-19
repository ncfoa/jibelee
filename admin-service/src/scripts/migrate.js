const { sequelize } = require('../config/database');
const logger = require('../config/logger');

// Import all models to ensure they are registered
require('../models');

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Run migrations (sync database)
    await sequelize.sync({ alter: true });
    logger.info('Database migrations completed successfully');
    
    // Create initial data if needed
    await createInitialData();
    
    logger.info('Migration process completed');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

async function createInitialData() {
  const { SystemConfiguration } = require('../models');
  
  try {
    logger.info('Creating initial system configuration...');
    
    // Default system configurations
    const defaultConfigs = [
      // Platform settings
      {
        category: 'platform',
        key: 'maintenance_mode',
        value: false,
        description: 'Enable/disable maintenance mode',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000' // System user
      },
      {
        category: 'platform',
        key: 'registration_enabled',
        value: true,
        description: 'Allow new user registrations',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'platform',
        key: 'api_rate_limit',
        value: 1000,
        description: 'API rate limit (requests per minute)',
        data_type: 'number',
        validation_rules: { min: 100, max: 10000 },
        requires_restart: true,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'platform',
        key: 'max_file_upload_size',
        value: 10,
        description: 'Maximum file upload size in MB',
        data_type: 'number',
        validation_rules: { min: 1, max: 100 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'platform',
        key: 'supported_countries',
        value: ['US', 'CA', 'UK', 'DE', 'FR'],
        description: 'List of supported countries',
        data_type: 'array',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'platform',
        key: 'default_currency',
        value: 'USD',
        description: 'Default platform currency',
        data_type: 'string',
        validation_rules: { enum: ['USD', 'EUR', 'GBP', 'CAD'] },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'platform',
        key: 'platform_fee_rate',
        value: 0.10,
        description: 'Platform fee rate (decimal)',
        data_type: 'number',
        validation_rules: { min: 0.01, max: 0.30 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      
      // Feature flags
      {
        category: 'features',
        key: 'real_time_tracking',
        value: true,
        description: 'Enable real-time delivery tracking',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'features',
        key: 'qr_code_verification',
        value: true,
        description: 'Enable QR code verification',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'features',
        key: 'auto_matching',
        value: true,
        description: 'Enable automatic delivery matching',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'features',
        key: 'instant_payouts',
        value: true,
        description: 'Enable instant payouts',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'features',
        key: 'multi_language_support',
        value: true,
        description: 'Enable multi-language support',
        data_type: 'boolean',
        requires_restart: true,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      
      // Business limits
      {
        category: 'limits',
        key: 'max_delivery_value',
        value: 5000.00,
        description: 'Maximum delivery value in USD',
        data_type: 'number',
        validation_rules: { min: 100, max: 50000 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'limits',
        key: 'max_delivery_weight',
        value: 25.0,
        description: 'Maximum delivery weight in kg',
        data_type: 'number',
        validation_rules: { min: 1, max: 100 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'limits',
        key: 'max_delivery_distance',
        value: 1000,
        description: 'Maximum delivery distance in km',
        data_type: 'number',
        validation_rules: { min: 10, max: 10000 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'limits',
        key: 'max_active_deliveries',
        value: 10,
        description: 'Maximum active deliveries per user',
        data_type: 'number',
        validation_rules: { min: 1, max: 50 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      
      // Notification settings
      {
        category: 'notifications',
        key: 'email_enabled',
        value: true,
        description: 'Enable email notifications',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'notifications',
        key: 'sms_enabled',
        value: true,
        description: 'Enable SMS notifications',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'notifications',
        key: 'push_enabled',
        value: true,
        description: 'Enable push notifications',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'notifications',
        key: 'webhooks_enabled',
        value: true,
        description: 'Enable webhook notifications',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      
      // Security settings
      {
        category: 'security',
        key: 'two_factor_required',
        value: false,
        description: 'Require two-factor authentication',
        data_type: 'boolean',
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'security',
        key: 'password_min_length',
        value: 8,
        description: 'Minimum password length',
        data_type: 'number',
        validation_rules: { min: 6, max: 128 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'security',
        key: 'session_timeout',
        value: 3600,
        description: 'Session timeout in seconds',
        data_type: 'number',
        validation_rules: { min: 300, max: 86400 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        category: 'security',
        key: 'max_login_attempts',
        value: 5,
        description: 'Maximum login attempts before lockout',
        data_type: 'number',
        validation_rules: { min: 3, max: 20 },
        requires_restart: false,
        updated_by: '00000000-0000-0000-0000-000000000000'
      }
    ];
    
    // Create configurations if they don't exist
    for (const config of defaultConfigs) {
      const [configRecord, created] = await SystemConfiguration.findOrCreate({
        where: {
          category: config.category,
          key: config.key
        },
        defaults: config
      });
      
      if (created) {
        logger.info(`Created configuration: ${config.category}.${config.key}`);
      }
    }
    
    logger.info('Initial system configuration created successfully');
  } catch (error) {
    logger.error('Failed to create initial data:', error);
    throw error;
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations, createInitialData };