require('dotenv').config();
const { User } = require('../models');
const { logger } = require('../config/logger');

const seedData = async () => {
  try {
    logger.info('Starting database seeding...');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      where: { email: 'admin@p2pdelivery.com' }
    });

    if (existingAdmin) {
      logger.info('Admin user already exists, skipping seed');
      process.exit(0);
    }

    // Create admin user
    const adminUser = await User.create({
      email: 'admin@p2pdelivery.com',
      passwordHash: 'admin123!', // Will be hashed by model hook
      firstName: 'System',
      lastName: 'Administrator',
      userType: 'super_admin',
      status: 'active',
      emailVerifiedAt: new Date(),
      verificationLevel: 'fully_verified',
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date()
    });

    logger.info('Admin user created successfully', {
      id: adminUser.id,
      email: adminUser.email
    });

    // Create test users if in development
    if (process.env.NODE_ENV === 'development') {
      const testUsers = [
        {
          email: 'customer@test.com',
          passwordHash: 'password123!',
          firstName: 'Test',
          lastName: 'Customer',
          userType: 'customer',
          status: 'active',
          emailVerifiedAt: new Date(),
          verificationLevel: 'email_verified',
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date()
        },
        {
          email: 'traveler@test.com',
          passwordHash: 'password123!',
          firstName: 'Test',
          lastName: 'Traveler',
          userType: 'traveler',
          status: 'active',
          emailVerifiedAt: new Date(),
          verificationLevel: 'email_verified',
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date()
        }
      ];

      for (const userData of testUsers) {
        const existingUser = await User.findOne({
          where: { email: userData.email }
        });

        if (!existingUser) {
          const user = await User.create(userData);
          logger.info('Test user created', {
            id: user.id,
            email: user.email,
            userType: user.userType
          });
        }
      }
    }

    logger.info('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
};

seedData();