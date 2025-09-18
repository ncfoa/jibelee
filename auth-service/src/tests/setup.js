// Test setup file
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://auth_user:auth_password@localhost:5432/auth_test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use database 1 for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';

// Mock console methods to reduce test noise
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Mock Redis client to avoid connection issues in tests
jest.mock('../config/redis', () => ({
  client: {
    isReady: true,
    connect: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue(true)
  },
  connectRedis: jest.fn().mockResolvedValue(true),
  redisUtils: {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    setnx: jest.fn().mockResolvedValue(true),
    incr: jest.fn().mockResolvedValue(1)
  }
}));

// Mock email service to avoid sending emails during tests
jest.mock('../services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmailVerification: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordReset: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordChanged: jest.fn().mockResolvedValue({ success: true }),
  sendLoginAlert: jest.fn().mockResolvedValue({ success: true }),
  send2FAEnabled: jest.fn().mockResolvedValue({ success: true }),
  send2FADisabled: jest.fn().mockResolvedValue({ success: true }),
  sendSuspiciousActivity: jest.fn().mockResolvedValue({ success: true }),
  sendAccountDeactivated: jest.fn().mockResolvedValue({ success: true }),
  sendAccountReactivated: jest.fn().mockResolvedValue({ success: true }),
  sendSessionRevoked: jest.fn().mockResolvedValue({ success: true }),
  sendAllSessionsRevoked: jest.fn().mockResolvedValue({ success: true }),
  sendBackupCodesGenerated: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));