const request = require('supertest');
const app = require('../app');
const { User, syncDatabase } = require('../models');

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    // Setup test database
    await syncDatabase(true); // Force recreate for tests
  });

  afterAll(async () => {
    // Cleanup
    const { sequelize } = require('../models');
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await User.destroy({ where: {}, force: true });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer',
        acceptedTerms: true,
        acceptedPrivacy: true
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
      expect(response.body.data.verificationRequired).toBe(true);
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        firstName: 'John',
        lastName: 'Doe',
        acceptedTerms: true,
        acceptedPrivacy: true
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject registration with duplicate email', async () => {
      // Create first user
      await User.create({
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date()
      });

      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Doe',
        acceptedTerms: true,
        acceptedPrivacy: true
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer',
        status: 'active',
        emailVerifiedAt: new Date(),
        verificationLevel: 'email_verified',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date()
      });
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.email);
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer',
        status: 'active',
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date()
      });
    });

    it('should always return success for security', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If the email address exists');
    });

    it('should return success even for non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If the email address exists');
    });
  });

  describe('GET /api/v1/auth/validate', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer',
        status: 'active',
        emailVerifiedAt: new Date(),
        verificationLevel: 'email_verified',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date()
      });

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!'
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should validate valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });
  });
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.services).toBeDefined();
  });
});

describe('404 Handler', () => {
  it('should return 404 for non-existent endpoints', async () => {
    const response = await request(app)
      .get('/api/v1/non-existent')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Endpoint not found');
  });
});