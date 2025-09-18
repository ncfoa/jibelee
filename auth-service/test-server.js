require('dotenv').config();

// Mock database and Redis for testing
jest.mock('./src/config/redis', () => ({
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

// Mock database connection
jest.mock('./src/models', () => ({
  testConnection: jest.fn().mockResolvedValue(true),
  syncDatabase: jest.fn().mockResolvedValue(true),
  sequelize: {
    close: jest.fn().mockResolvedValue(true)
  },
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
  },
  UserSession: {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn()
  },
  EmailVerificationToken: {
    createForUser: jest.fn().mockResolvedValue({ code: '123456' }),
    findValidToken: jest.fn()
  },
  PasswordResetToken: {
    createForUser: jest.fn().mockResolvedValue({ token: 'reset123' }),
    findValidToken: jest.fn()
  }
}));

// Mock email service
jest.mock('./src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmailVerification: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordReset: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordChanged: jest.fn().mockResolvedValue({ success: true }),
  sendLoginAlert: jest.fn().mockResolvedValue({ success: true })
}));

const app = require('./src/app');

const PORT = process.env.PORT || 3001;

console.log('🚀 Starting P2P Delivery Auth Service Test Server...');
console.log(`📍 Server will be available at: http://localhost:${PORT}`);
console.log('🔧 Running in test mode with mocked dependencies');
console.log('');
console.log('📋 Available endpoints:');
console.log('  GET  /health - Health check');
console.log('  GET  /metrics - Service metrics');
console.log('  POST /api/v1/auth/register - User registration');
console.log('  POST /api/v1/auth/login - User login');
console.log('  POST /api/v1/auth/forgot-password - Password reset request');
console.log('  GET  /api/v1/auth/validate - Token validation');
console.log('  ... and 14 more auth endpoints');
console.log('');

app.listen(PORT, () => {
  console.log(`✅ Auth Service test server started on port ${PORT}`);
  console.log('');
  console.log('🧪 Test the API with curl:');
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl -X POST http://localhost:${PORT}/api/v1/auth/register \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"email":"test@example.com","password":"SecurePass123!","confirmPassword":"SecurePass123!","firstName":"John","lastName":"Doe","acceptedTerms":true,"acceptedPrivacy":true}'`);
});