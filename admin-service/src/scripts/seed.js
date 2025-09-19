const { sequelize } = require('../config/database');
const logger = require('../config/logger');
const { faker } = require('@faker-js/faker');

// Import models
const {
  AdminUser,
  AdminActivityLog,
  SystemConfiguration,
  Dispute,
  DisputeEvidence,
  DisputeMessage,
  SystemBackup,
  DataExport,
  DailyMetric
} = require('../models');

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');
    
    // Check if we're in development mode
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Seeding is not recommended in production environment');
      return;
    }
    
    // Clear existing data (optional)
    if (process.env.CLEAR_DATA === 'true') {
      await clearExistingData();
    }
    
    // Seed data
    await seedAdminUsers();
    await seedSystemConfiguration();
    await seedDisputes();
    await seedSystemBackups();
    await seedDataExports();
    await seedDailyMetrics();
    
    logger.info('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

async function clearExistingData() {
  logger.info('Clearing existing data...');
  
  // Clear in reverse order of dependencies
  await DailyMetric.destroy({ where: {} });
  await DataExport.destroy({ where: {} });
  await SystemBackup.destroy({ where: {} });
  await DisputeMessage.destroy({ where: {} });
  await DisputeEvidence.destroy({ where: {} });
  await Dispute.destroy({ where: {} });
  await AdminActivityLog.destroy({ where: {} });
  
  // Don't clear AdminUser and SystemConfiguration as they might be needed
  
  logger.info('Existing data cleared');
}

async function seedAdminUsers() {
  logger.info('Seeding admin users...');
  
  const adminUsers = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      user_id: '11111111-1111-1111-1111-111111111112',
      role: 'super_admin',
      permissions: ['*'],
      is_active: true,
      created_by: '00000000-0000-0000-0000-000000000000'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      user_id: '22222222-2222-2222-2222-222222222223',
      role: 'admin',
      permissions: ['users.read', 'users.write', 'finance.read', 'disputes.read'],
      is_active: true,
      created_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      user_id: '33333333-3333-3333-3333-333333333334',
      role: 'moderator',
      permissions: ['users.read', 'disputes.read', 'disputes.write', 'content.moderate'],
      is_active: true,
      created_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      user_id: '44444444-4444-4444-4444-444444444445',
      role: 'support',
      permissions: ['users.read', 'disputes.read'],
      is_active: true,
      created_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      user_id: '55555555-5555-5555-5555-555555555556',
      role: 'finance',
      permissions: ['finance.read', 'finance.write', 'finance.payouts', 'users.read'],
      is_active: true,
      created_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      user_id: '66666666-6666-6666-6666-666666666667',
      role: 'analyst',
      permissions: ['analytics.read', 'reports.generate', 'users.read', 'finance.read'],
      is_active: true,
      created_by: '11111111-1111-1111-1111-111111111111'
    }
  ];
  
  for (const adminData of adminUsers) {
    const [admin, created] = await AdminUser.findOrCreate({
      where: { user_id: adminData.user_id },
      defaults: adminData
    });
    
    if (created) {
      logger.info(`Created admin user: ${adminData.role} (${adminData.id})`);
      
      // Log the creation
      await AdminActivityLog.create({
        admin_id: adminData.created_by,
        action: 'admin_user_created',
        resource_type: 'admin_user',
        resource_id: admin.id,
        description: `Created ${adminData.role} admin user`,
        details: { role: adminData.role, permissions: adminData.permissions }
      });
    }
  }
  
  logger.info('Admin users seeded successfully');
}

async function seedSystemConfiguration() {
  logger.info('Seeding additional system configuration...');
  
  // Add some demo configurations
  const demoConfigs = [
    {
      category: 'demo',
      key: 'demo_mode',
      value: true,
      description: 'Enable demo mode with sample data',
      data_type: 'boolean',
      requires_restart: false,
      updated_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      category: 'demo',
      key: 'sample_data_size',
      value: 100,
      description: 'Number of sample records to generate',
      data_type: 'number',
      validation_rules: { min: 10, max: 1000 },
      requires_restart: false,
      updated_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      category: 'analytics',
      key: 'retention_days',
      value: 90,
      description: 'Number of days to retain analytics data',
      data_type: 'number',
      validation_rules: { min: 30, max: 365 },
      requires_restart: false,
      updated_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      category: 'backup',
      key: 'auto_backup_enabled',
      value: true,
      description: 'Enable automatic backups',
      data_type: 'boolean',
      requires_restart: false,
      updated_by: '11111111-1111-1111-1111-111111111111'
    },
    {
      category: 'backup',
      key: 'backup_schedule',
      value: '0 2 * * *',
      description: 'Cron expression for backup schedule',
      data_type: 'string',
      validation_rules: { pattern: '^[0-9\\*\\-\\,\\/\\s]+$' },
      requires_restart: false,
      updated_by: '11111111-1111-1111-1111-111111111111'
    }
  ];
  
  for (const config of demoConfigs) {
    const [configRecord, created] = await SystemConfiguration.findOrCreate({
      where: { category: config.category, key: config.key },
      defaults: config
    });
    
    if (created) {
      logger.info(`Created configuration: ${config.category}.${config.key}`);
    }
  }
  
  logger.info('System configuration seeded successfully');
}

async function seedDisputes() {
  logger.info('Seeding sample disputes...');
  
  const categories = ['item_not_delivered', 'item_damaged', 'service_not_as_described', 'payment_issue'];
  const statuses = ['open', 'under_review', 'resolved', 'closed'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  
  for (let i = 0; i < 50; i++) {
    const dispute = await Dispute.create({
      delivery_id: faker.string.uuid(),
      payment_intent_id: faker.string.uuid(),
      case_number: `DISP-2025-${String(i + 1).padStart(6, '0')}`,
      category: faker.helpers.arrayElement(categories),
      priority: faker.helpers.arrayElement(priorities),
      status: faker.helpers.arrayElement(statuses),
      complainant_id: faker.string.uuid(),
      respondent_id: faker.string.uuid(),
      amount: faker.number.int({ min: 1000, max: 50000 }), // in cents
      currency: 'USD',
      description: faker.lorem.paragraph(),
      requested_resolution: faker.helpers.arrayElement(['full_refund', 'partial_refund', 'replacement']),
      assignee_id: faker.helpers.arrayElement([
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
        null
      ]),
      assigned_at: faker.date.recent({ days: 30 }),
      due_date: faker.date.future({ days: 7 }),
      created_at: faker.date.recent({ days: 60 }),
      updated_at: faker.date.recent({ days: 30 })
    });
    
    // Add some evidence for each dispute
    if (faker.datatype.boolean({ probability: 0.7 })) {
      await DisputeEvidence.create({
        dispute_id: dispute.id,
        submitted_by: dispute.complainant_id,
        evidence_type: faker.helpers.arrayElement(['photo', 'document', 'text']),
        description: faker.lorem.sentence(),
        text_content: faker.helpers.arrayElement(['photo', 'document']) ? null : faker.lorem.paragraph(),
        file_url: faker.helpers.arrayElement(['photo', 'document']) ? faker.image.url() : null,
        file_name: faker.helpers.arrayElement(['photo', 'document']) ? faker.system.fileName() : null,
        is_verified: faker.datatype.boolean({ probability: 0.5 }),
        verified_by: faker.datatype.boolean({ probability: 0.5 }) ? '22222222-2222-2222-2222-222222222222' : null,
        verified_at: faker.datatype.boolean({ probability: 0.5 }) ? faker.date.recent({ days: 10 }) : null
      });
    }
    
    // Add some messages for each dispute
    const messageCount = faker.number.int({ min: 1, max: 5 });
    for (let j = 0; j < messageCount; j++) {
      await DisputeMessage.create({
        dispute_id: dispute.id,
        sender_id: faker.helpers.arrayElement([
          dispute.complainant_id,
          dispute.respondent_id,
          '22222222-2222-2222-2222-222222222222'
        ]),
        sender_type: faker.helpers.arrayElement(['user', 'admin']),
        message: faker.lorem.sentences(),
        message_type: 'text',
        is_internal: faker.datatype.boolean({ probability: 0.3 }),
        is_read: faker.datatype.boolean({ probability: 0.8 }),
        created_at: faker.date.recent({ days: 30 })
      });
    }
  }
  
  logger.info('Sample disputes seeded successfully');
}

async function seedSystemBackups() {
  logger.info('Seeding system backups...');
  
  const backupTypes = ['full', 'incremental', 'database_only'];
  const statuses = ['completed', 'failed', 'in_progress'];
  
  for (let i = 0; i < 20; i++) {
    const status = faker.helpers.arrayElement(statuses);
    const startedAt = faker.date.recent({ days: 30 });
    
    await SystemBackup.create({
      backup_type: faker.helpers.arrayElement(backupTypes),
      status,
      size_bytes: status === 'completed' ? faker.number.int({ min: 1000000, max: 10000000000 }) : null,
      file_path: status === 'completed' ? `/backups/backup_${Date.now()}.tar.gz` : null,
      download_url: status === 'completed' ? faker.internet.url() : null,
      description: faker.lorem.sentence(),
      include_uploads: faker.datatype.boolean({ probability: 0.7 }),
      include_logs: faker.datatype.boolean({ probability: 0.3 }),
      started_at: startedAt,
      completed_at: status === 'in_progress' ? null : faker.date.between({ from: startedAt, to: new Date() }),
      expires_at: status === 'completed' ? faker.date.future({ days: 30 }) : null,
      created_by: faker.helpers.arrayElement([
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
      ]),
      error_message: status === 'failed' ? faker.lorem.sentence() : null,
      is_scheduled: faker.datatype.boolean({ probability: 0.6 }),
      schedule_name: faker.datatype.boolean({ probability: 0.6 }) ? 'daily_backup' : null
    });
  }
  
  logger.info('System backups seeded successfully');
}

async function seedDataExports() {
  logger.info('Seeding data exports...');
  
  const exportTypes = ['users', 'deliveries', 'transactions', 'reviews'];
  const formats = ['csv', 'json', 'xlsx'];
  const statuses = ['completed', 'failed', 'processing'];
  
  for (let i = 0; i < 30; i++) {
    const status = faker.helpers.arrayElement(statuses);
    const createdAt = faker.date.recent({ days: 30 });
    
    await DataExport.create({
      export_type: faker.helpers.arrayElement(exportTypes),
      format: faker.helpers.arrayElement(formats),
      status,
      filters: {
        dateFrom: faker.date.recent({ days: 90 }).toISOString(),
        dateTo: faker.date.recent({ days: 1 }).toISOString(),
        status: faker.helpers.arrayElement(['active', 'inactive'])
      },
      fields: faker.helpers.arrayElements(['id', 'name', 'email', 'created_at', 'status'], { min: 2, max: 5 }),
      estimated_records: faker.number.int({ min: 100, max: 10000 }),
      actual_records: status === 'completed' ? faker.number.int({ min: 100, max: 10000 }) : null,
      file_size_bytes: status === 'completed' ? faker.number.int({ min: 1000, max: 100000000 }) : null,
      file_path: status === 'completed' ? `/exports/export_${Date.now()}.csv` : null,
      download_url: status === 'completed' ? faker.internet.url() : null,
      expires_at: status === 'completed' ? faker.date.future({ days: 7 }) : null,
      requested_by: faker.helpers.arrayElement([
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '66666666-6666-6666-6666-666666666666'
      ]),
      completed_at: status === 'processing' ? null : faker.date.between({ from: createdAt, to: new Date() }),
      error_message: status === 'failed' ? faker.lorem.sentence() : null,
      download_count: status === 'completed' ? faker.number.int({ min: 0, max: 5 }) : 0,
      last_downloaded_at: status === 'completed' && faker.datatype.boolean({ probability: 0.5 }) ? faker.date.recent({ days: 7 }) : null,
      progress_percentage: status === 'processing' ? faker.number.float({ min: 10, max: 90, precision: 0.01 }) : 100,
      created_at: createdAt
    });
  }
  
  logger.info('Data exports seeded successfully');
}

async function seedDailyMetrics() {
  logger.info('Seeding daily metrics...');
  
  const metricTypes = ['user', 'delivery', 'financial', 'system'];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90); // 90 days of data
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    for (const metricType of metricTypes) {
      const baseValue = faker.number.int({ min: 50, max: 200 });
      const trend = Math.sin(i / 10) * 0.2 + 1; // Simulate trends
      
      await DailyMetric.create({
        date: date.toISOString().split('T')[0],
        metric_type: metricType,
        new_users: metricType === 'user' ? Math.round(baseValue * trend * faker.number.float({ min: 0.8, max: 1.2 })) : 0,
        active_users: metricType === 'user' ? Math.round(baseValue * 10 * trend) : 0,
        verified_users: metricType === 'user' ? Math.round(baseValue * 0.3 * trend) : 0,
        new_requests: metricType === 'delivery' ? Math.round(baseValue * 2 * trend) : 0,
        completed_deliveries: metricType === 'delivery' ? Math.round(baseValue * 1.8 * trend) : 0,
        cancelled_deliveries: metricType === 'delivery' ? Math.round(baseValue * 0.2 * trend) : 0,
        average_delivery_time: metricType === 'delivery' ? faker.number.float({ min: 2, max: 48, precision: 0.1 }) : 0,
        total_revenue: metricType === 'financial' ? faker.number.float({ min: 1000, max: 50000, precision: 0.01 }) * trend : 0,
        platform_fees: metricType === 'financial' ? faker.number.float({ min: 100, max: 5000, precision: 0.01 }) * trend : 0,
        refunds: metricType === 'financial' ? faker.number.float({ min: 0, max: 1000, precision: 0.01 }) : 0,
        transaction_count: metricType === 'financial' ? Math.round(baseValue * 5 * trend) : 0,
        average_order_value: metricType === 'financial' ? faker.number.float({ min: 20, max: 200, precision: 0.01 }) : 0,
        api_calls: metricType === 'system' ? Math.round(baseValue * 1000 * trend) : 0,
        errors: metricType === 'system' ? Math.round(baseValue * 10 * faker.number.float({ min: 0.01, max: 0.05 })) : 0,
        average_response_time: metricType === 'system' ? faker.number.int({ min: 100, max: 500 }) : 0,
        success_rate: metricType === 'system' ? faker.number.float({ min: 95, max: 99.9, precision: 0.01 }) : 100,
        uptime_percentage: metricType === 'system' ? faker.number.float({ min: 98, max: 100, precision: 0.01 }) : 100,
        unique_visitors: metricType === 'system' ? Math.round(baseValue * 20 * trend) : 0,
        new_disputes: Math.round(baseValue * 0.1 * faker.number.float({ min: 0.5, max: 2 })),
        resolved_disputes: Math.round(baseValue * 0.08 * faker.number.float({ min: 0.5, max: 1.5 })),
        calculated_at: new Date(),
        is_final: i < 85 // Last 5 days are not final
      });
    }
  }
  
  logger.info('Daily metrics seeded successfully');
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
  clearExistingData,
  seedAdminUsers,
  seedSystemConfiguration,
  seedDisputes,
  seedSystemBackups,
  seedDataExports,
  seedDailyMetrics
};