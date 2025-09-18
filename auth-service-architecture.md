# Authentication Service - Detailed Architecture

## 🏗️ Service Overview

The Authentication Service is a critical microservice responsible for user authentication, authorization, and session management in the P2P Delivery Platform. It serves as the security gateway for all user interactions.

**Port:** 3001  
**Base URL:** `/api/v1/auth`  
**Database:** `auth_db` (PostgreSQL)

## 🎯 Core Responsibilities

### Primary Functions
- **User Authentication**: JWT-based login/logout with refresh tokens
- **Two-Factor Authentication**: TOTP-based 2FA implementation
- **Social Authentication**: Google, Facebook, Apple login integration
- **Session Management**: Device tracking and session control
- **Password Management**: Secure password reset and recovery
- **Email Verification**: Account activation and email confirmation
- **Security Monitoring**: Rate limiting and fraud detection

### Security Features
- **JWT Token Management**: Access tokens (15-30 min) + Refresh tokens (7-30 days)
- **Token Rotation**: Automatic refresh token rotation for security
- **Rate Limiting**: Per-user and per-endpoint protection
- **Device Fingerprinting**: Track and manage user devices
- **IP Whitelisting**: Optional IP-based access control
- **Audit Logging**: Complete authentication event tracking

## 🗄️ Database Schema

### Core Tables

#### 1. Users Table (Basic Auth Info)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP,
    phone_number VARCHAR(20),
    phone_verified_at TIMESTAMP,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    user_type user_type_enum NOT NULL DEFAULT 'customer',
    status user_status_enum NOT NULL DEFAULT 'pending',
    verification_level verification_level_enum NOT NULL DEFAULT 'unverified',
    terms_accepted_at TIMESTAMP,
    privacy_accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

#### 2. User Sessions Table
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    device_id VARCHAR(255),
    device_type device_type_enum,
    platform platform_enum,
    app_version VARCHAR(20),
    push_token VARCHAR(500),
    ip_address INET,
    location VARCHAR(255),
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);
```

#### 3. Two-Factor Authentication Table
```sql
CREATE TABLE user_two_factor_auth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    secret_key VARCHAR(255) NOT NULL,
    backup_codes TEXT[],
    enabled BOOLEAN DEFAULT FALSE,
    enabled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Password Reset Tokens Table
```sql
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. Email Verification Tokens Table
```sql
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
```

### Key Dependencies
- **Express.js**: Web framework
- **Helmet**: Security headers
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT token management
- **speakeasy**: TOTP 2FA implementation
- **passport**: Social authentication
- **express-rate-limit**: Rate limiting
- **joi**: Request validation
- **winston**: Logging

### Database Layer
- **PostgreSQL**: Primary database
- **Redis**: Session storage and caching
- **Prisma/TypeORM**: ORM layer

## 📊 API Endpoints (18 Total)

### Authentication Endpoints

#### 1. User Registration
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "userType": "traveler|customer|both",
  "acceptedTerms": true,
  "acceptedPrivacy": true
}
```

#### 2. User Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "deviceInfo": {
    "deviceId": "device_uuid",
    "deviceType": "mobile",
    "platform": "ios",
    "appVersion": "1.0.0"
  },
  "rememberMe": true
}
```

#### 3. Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_string"
}
```

#### 4. Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>

{
  "allDevices": false
}
```

### Two-Factor Authentication Endpoints

#### 5. Setup 2FA
```http
POST /api/v1/auth/2fa/setup
Authorization: Bearer <access_token>
```

#### 6. Enable 2FA
```http
POST /api/v1/auth/2fa/enable
Authorization: Bearer <access_token>

{
  "token": "123456",
  "backupCodes": ["code1", "code2", ...]
}
```

#### 7. Verify 2FA
```http
POST /api/v1/auth/2fa/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "token": "123456"
}
```

### Social Authentication Endpoints

#### 8. Google OAuth
```http
GET /api/v1/auth/google
```

#### 9. Facebook OAuth
```http
GET /api/v1/auth/facebook
```

#### 10. Apple OAuth
```http
POST /api/v1/auth/apple
Content-Type: application/json

{
  "identityToken": "apple_identity_token",
  "authorizationCode": "apple_auth_code"
}
```

### Password Management Endpoints

#### 11. Forgot Password
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### 12. Reset Password
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token",
  "password": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

#### 13. Change Password
```http
POST /api/v1/auth/change-password
Authorization: Bearer <access_token>

{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

### Email Verification Endpoints

#### 14. Send Verification Email
```http
POST /api/v1/auth/send-verification
Authorization: Bearer <access_token>

{
  "email": "newemail@example.com"
}
```

#### 15. Verify Email
```http
POST /api/v1/auth/verify-email
Content-Type: application/json

{
  "token": "verification_token"
}
```

### Session Management Endpoints

#### 16. Get Active Sessions
```http
GET /api/v1/auth/sessions
Authorization: Bearer <access_token>
```

#### 17. Revoke Session
```http
DELETE /api/v1/auth/sessions/:sessionId
Authorization: Bearer <access_token>
```

#### 18. Validate Token
```http
POST /api/v1/auth/validate
Authorization: Bearer <access_token>
```

## 🏗️ Service Architecture

### Directory Structure
```
auth-service/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── sessionController.js
│   │   ├── twoFactorController.js
│   │   └── socialAuthController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Session.js
│   │   ├── TwoFactorAuth.js
│   │   └── PasswordResetToken.js
│   ├── services/
│   │   ├── jwtService.js
│   │   ├── passwordService.js
│   │   ├── socialAuthService.js
│   │   ├── emailService.js
│   │   └── twoFactorService.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── rateLimitMiddleware.js
│   │   ├── validationMiddleware.js
│   │   └── securityMiddleware.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── sessionRoutes.js
│   │   └── socialRoutes.js
│   ├── utils/
│   │   ├── tokenUtils.js
│   │   ├── cryptoUtils.js
│   │   └── validationUtils.js
│   ├── config/
│   │   ├── database.js
│   │   ├── jwt.js
│   │   ├── redis.js
│   │   └── social.js
│   └── app.js
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. JWT Service
```javascript
class JWTService {
  generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '30m',
      issuer: 'p2p-delivery-platform',
      audience: 'p2p-delivery-users'
    });
  }

  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
      issuer: 'p2p-delivery-platform'
    });
  }

  verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  }
}
```

#### 2. Password Service
```javascript
class PasswordService {
  async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  validatePasswordStrength(password) {
    const requirements = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    };

    return this.checkPasswordRequirements(password, requirements);
  }
}
```

#### 3. Two-Factor Authentication Service
```javascript
class TwoFactorService {
  generateSecret(userEmail) {
    return speakeasy.generateSecret({
      name: `P2P Delivery (${userEmail})`,
      issuer: 'P2P Delivery Platform',
      length: 32
    });
  }

  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps tolerance
    });
  }

  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
}
```

#### 4. Session Management Service
```javascript
class SessionService {
  async createSession(userId, deviceInfo, refreshToken) {
    const session = {
      userId,
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType,
      platform: deviceInfo.platform,
      appVersion: deviceInfo.appVersion,
      refreshTokenHash: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: deviceInfo.ipAddress,
      location: deviceInfo.location
    };

    return this.sessionRepository.create(session);
  }

  async validateSession(sessionId, refreshToken) {
    const session = await this.sessionRepository.findById(sessionId);
    
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    const isValidToken = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    return isValidToken ? session : null;
  }

  async revokeSession(sessionId) {
    return this.sessionRepository.update(sessionId, {
      revokedAt: new Date()
    });
  }
}
```

## 🔐 Security Implementation

### 1. Rate Limiting
```javascript
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  keyGenerator: (req) => req.body.email
});
```

### 2. Input Validation
```javascript
const registerValidation = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
    userType: Joi.string().valid('customer', 'traveler', 'both').required(),
    acceptedTerms: Joi.boolean().valid(true).required(),
    acceptedPrivacy: Joi.boolean().valid(true).required()
  })
};
```

### 3. Security Headers
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## 📈 Performance & Scalability

### 1. Caching Strategy
- **Redis**: Session storage and rate limiting
- **In-Memory**: JWT public keys for validation
- **Database**: Query result caching

### 2. Database Optimization
```sql
-- Optimized indexes for authentication queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_sessions_user_active ON user_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_password_reset_tokens ON password_reset_tokens(token_hash, expires_at);
```

### 3. Horizontal Scaling
- **Stateless Design**: All session data stored in Redis/Database
- **Load Balancing**: Multiple service instances
- **Database Connection Pooling**: Optimized database connections

## 🔍 Monitoring & Logging

### 1. Authentication Events
```javascript
const authLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'auth-events.log' })
  ]
});

// Log authentication events
authLogger.info('User login attempt', {
  userId: user.id,
  email: user.email,
  ipAddress: req.ip,
  userAgent: req.get('User-Agent'),
  success: true,
  timestamp: new Date().toISOString()
});
```

### 2. Security Metrics
- **Failed Login Attempts**: Track and alert on suspicious activity
- **Token Usage**: Monitor token generation and validation rates
- **Device Tracking**: New device registrations and usage patterns
- **2FA Adoption**: Track two-factor authentication usage

### 3. Health Checks
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabaseConnection(),
      redis: await checkRedisConnection(),
      external: await checkExternalServices()
    }
  };

  const isHealthy = Object.values(health.services).every(service => service.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## 🚀 Deployment Configuration

### 1. Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/auth_db
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
ACCESS_TOKEN_EXPIRY=30m
REFRESH_TOKEN_EXPIRY=7d

# Social Authentication
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=5

# Email Service
EMAIL_SERVICE_URL=http://notification-service:3009
```

### 2. Docker Configuration
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "start"]
```

### 3. Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: p2p-delivery/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-service-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🧪 Testing Strategy

### 1. Unit Tests
```javascript
describe('AuthController', () => {
  describe('register', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer'
      };

      const result = await authController.register(userData);
      
      expect(result.success).toBe(true);
      expect(result.data.user.email).toBe(userData.email);
    });
  });
});
```

### 2. Integration Tests
```javascript
describe('Authentication Flow', () => {
  it('should complete full authentication flow', async () => {
    // Register user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(validUserData);

    // Verify email
    const verifyResponse = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: emailToken });

    // Login
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUserData.email, password: validUserData.password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.accessToken).toBeDefined();
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **Login Endpoint**: < 200ms average response time
- **Token Validation**: < 50ms average response time
- **Registration**: < 500ms average response time
- **Throughput**: 1000+ requests/second per instance
- **Availability**: 99.9% uptime SLA

### Load Testing Configuration
```javascript
// Artillery.js load test configuration
module.exports = {
  config: {
    target: 'http://localhost:3001',
    phases: [
      { duration: '2m', arrivalRate: 10 },
      { duration: '5m', arrivalRate: 50 },
      { duration: '2m', arrivalRate: 100 }
    ]
  },
  scenarios: [
    {
      name: 'Login flow',
      weight: 70,
      flow: [
        { post: { url: '/api/v1/auth/login', json: { email: '{{ email }}', password: '{{ password }}' } } }
      ]
    },
    {
      name: 'Token validation',
      weight: 30,
      flow: [
        { post: { url: '/api/v1/auth/validate', headers: { Authorization: 'Bearer {{ token }}' } } }
      ]
    }
  ]
};
```

This Authentication Service architecture provides a robust, secure, and scalable foundation for user authentication in the P2P Delivery Platform, supporting modern authentication patterns while maintaining high performance and security standards.