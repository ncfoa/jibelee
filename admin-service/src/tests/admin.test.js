const request = require('supertest');
const app = require('../app');
const { AdminUser } = require('../models');
const jwtService = require('../config/jwt');

describe('Admin Service', () => {
  let adminToken;
  let adminUser;

  beforeAll(async () => {
    // Create test admin user
    adminUser = await AdminUser.create({
      id: 'test-admin-id',
      user_id: 'test-user-id',
      role: 'admin',
      permissions: ['users.read', 'finance.read', 'disputes.read'],
      is_active: true,
      created_by: 'test-admin-id'
    });

    // Generate admin token
    adminToken = jwtService.generateAdminToken({
      adminId: adminUser.id,
      role: adminUser.role,
      permissions: adminUser.permissions
    });
  });

  afterAll(async () => {
    // Clean up test data
    await AdminUser.destroy({ where: { id: 'test-admin-id' } });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'admin-service');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for admin endpoints', async () => {
      await request(app.app)
        .get('/api/v1/admin/')
        .expect(401);
    });

    it('should accept valid admin token', async () => {
      const response = await request(app.app)
        .get('/api/v1/admin/')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('service', 'admin-service');
    });

    it('should reject invalid admin token', async () => {
      await request(app.app)
        .get('/api/v1/admin/')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Dashboard Endpoints', () => {
    it('should return dashboard overview', async () => {
      const response = await request(app.app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('realtimeMetrics');
    });
  });

  describe('User Management Endpoints', () => {
    it('should return user list', async () => {
      const response = await request(app.app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should validate user ID parameter', async () => {
      await request(app.app)
        .get('/api/v1/admin/users/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('Financial Endpoints', () => {
    it('should return financial overview', async () => {
      const response = await request(app.app)
        .get('/api/v1/admin/financials/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('transactions');
    });

    it('should require finance permissions for payout endpoints', async () => {
      await request(app.app)
        .post('/api/v1/admin/financials/payouts/manual')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'test-user-id',
          amount: 1000,
          currency: 'USD',
          reason: 'Test payout'
        })
        .expect(403); // Should be forbidden due to missing finance.payouts permission
    });
  });

  describe('Dispute Endpoints', () => {
    it('should return dispute list', async () => {
      const response = await request(app.app)
        .get('/api/v1/admin/disputes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('summary');
    });
  });

  describe('System Endpoints', () => {
    it('should return system configuration', async () => {
      const response = await request(app.app)
        .get('/api/v1/admin/system/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('platform');
      expect(response.body.data).toHaveProperty('features');
    });

    it('should require system.config permission for configuration updates', async () => {
      await request(app.app)
        .put('/api/v1/admin/system/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'platform',
          key: 'test_setting',
          value: true,
          dataType: 'boolean'
        })
        .expect(403); // Should be forbidden due to missing system.config permission
    });
  });

  describe('Analytics Endpoints', () => {
    it('should return system analytics', async () => {
      const response = await request(app.app)
        .get('/api/v1/admin/analytics/system')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('usage');
    });
  });

  describe('Validation', () => {
    it('should validate query parameters', async () => {
      await request(app.app)
        .get('/api/v1/admin/users?page=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should validate request body', async () => {
      await request(app.app)
        .post('/api/v1/admin/analytics/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'invalid-type',
          format: 'csv'
        })
        .expect(400);
    });
  });
});

describe('JWT Service', () => {
  describe('Admin Token Generation', () => {
    it('should generate valid admin token', () => {
      const payload = { adminId: 'test-id', role: 'admin' };
      const token = jwtService.generateAdminToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate valid admin API token', () => {
      const token = jwtService.generateAdminApiToken('test-id', ['users.read']);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('Token Verification', () => {
    it('should verify valid admin token', () => {
      const payload = { adminId: 'test-id', role: 'admin' };
      const token = jwtService.generateAdminToken(payload);
      const decoded = jwtService.verifyAdminToken(token);
      
      expect(decoded).toHaveProperty('adminId', 'test-id');
      expect(decoded).toHaveProperty('role', 'admin');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtService.verifyAdminToken('invalid-token');
      }).toThrow();
    });
  });
});