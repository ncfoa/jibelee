const passwordService = require('../services/passwordService');
const jwtService = require('../services/jwtService');

describe('Password Service', () => {
  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const result = passwordService.validatePasswordStrength('SecurePass123!');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('strong');
    });

    it('should reject weak password', () => {
      const result = passwordService.validatePasswordStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = passwordService.validatePasswordStrength('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without special character', () => {
      const result = passwordService.validatePasswordStrength('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('calculatePasswordStrength', () => {
    it('should calculate password strength correctly', () => {
      expect(passwordService.calculatePasswordStrength('weak')).toBe('weak');
      expect(passwordService.calculatePasswordStrength('Medium123')).toBe('medium');
      expect(passwordService.calculatePasswordStrength('StrongPass123!')).toBe('strong');
      expect(passwordService.calculatePasswordStrength('VeryStrongPassword123!@#$')).toBe('very_strong');
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate secure password with correct length', () => {
      const password = passwordService.generateSecurePassword(16);
      expect(password.length).toBe(16);
      
      const validation = passwordService.validatePasswordStrength(password);
      expect(validation.isValid).toBe(true);
    });
  });
});

describe('JWT Service', () => {
  const testPayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    userType: 'customer',
    deviceId: 'test-device'
  };

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', () => {
      const tokens = jwtService.generateTokenPair(testPayload);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const accessToken = jwtService.generateAccessToken(testPayload);
      const decoded = jwtService.verifyAccessToken(accessToken);
      
      expect(decoded.sub).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.type).toBe('access');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const refreshToken = jwtService.generateRefreshToken(testPayload);
      const decoded = jwtService.verifyRefreshToken(refreshToken);
      
      expect(decoded.sub).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('isTokenExpired', () => {
    it('should detect expired token', () => {
      // Create an expired token by manually setting exp in the past
      const jwt = require('jsonwebtoken');
      const expiredPayload = {
        ...testPayload,
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      
      const expiredToken = jwt.sign(expiredPayload, process.env.JWT_SECRET);
      
      expect(jwtService.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should detect valid token', () => {
      const validToken = jwtService.generateAccessToken(testPayload);
      expect(jwtService.isTokenExpired(validToken)).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const header = 'Bearer test-token-123';
      const token = jwtService.extractTokenFromHeader(header);
      expect(token).toBe('test-token-123');
    });

    it('should return null for invalid header', () => {
      expect(jwtService.extractTokenFromHeader('Invalid header')).toBeNull();
      expect(jwtService.extractTokenFromHeader(null)).toBeNull();
      expect(jwtService.extractTokenFromHeader('')).toBeNull();
    });
  });

  describe('getTokenExpiry', () => {
    it('should calculate token expiry correctly', () => {
      expect(jwtService.getTokenExpiry('access')).toBe(1800); // 30 minutes
      expect(jwtService.getTokenExpiry('refresh')).toBe(604800); // 7 days
    });
  });
});