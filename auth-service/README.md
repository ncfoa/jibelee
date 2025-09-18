# P2P Delivery Platform - Authentication Service

A comprehensive authentication microservice built with Node.js, Express, and PostgreSQL. This service handles user registration, login, two-factor authentication, session management, and security features for the P2P Delivery Platform.

## Features

### Core Authentication
- ✅ User registration with email verification
- ✅ Secure login with JWT tokens
- ✅ Password reset and change functionality
- ✅ Token refresh mechanism
- ✅ Account deactivation and deletion

### Two-Factor Authentication
- ✅ TOTP-based 2FA with QR codes
- ✅ Backup codes for recovery
- ✅ 2FA setup, enable, disable, and verification

### Social Authentication
- ✅ Google OAuth integration
- ✅ Facebook OAuth integration
- ✅ Apple Sign-In support
- ✅ Social account linking/unlinking

### Session Management
- ✅ Multi-device session tracking
- ✅ Session revocation (single/all devices)
- ✅ Suspicious activity detection
- ✅ Device fingerprinting

### Security Features
- ✅ Rate limiting (per IP, per user, per endpoint)
- ✅ Password strength validation
- ✅ Account lockout protection
- ✅ Security headers (Helmet.js)
- ✅ Input validation and sanitization
- ✅ Audit logging

### API Endpoints (18 Total)

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/verify-email` - Email verification
- `POST /api/v1/auth/resend-verification` - Resend verification code
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/validate` - Validate token

#### Password Management
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with code
- `POST /api/v1/auth/change-password` - Change password (authenticated)

#### Two-Factor Authentication
- `POST /api/v1/auth/2fa/setup` - Setup 2FA (generate QR code)
- `POST /api/v1/auth/2fa/enable` - Enable 2FA
- `POST /api/v1/auth/2fa/disable` - Disable 2FA
- `POST /api/v1/auth/2fa/verify` - Verify 2FA code
- `POST /api/v1/auth/2fa/login` - Login with 2FA
- `GET /api/v1/auth/2fa/status` - Get 2FA status

#### Session Management
- `GET /api/v1/auth/sessions` - Get user sessions
- `DELETE /api/v1/auth/sessions/{sessionId}` - Revoke specific session

#### Social Authentication
- `POST /api/v1/auth/social/login` - Social login

#### Account Management
- `POST /api/v1/auth/account/deactivate` - Deactivate account
- `DELETE /api/v1/auth/account` - Delete account

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd auth-service
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Update environment variables in `.env`:
```env
DATABASE_URL=postgresql://auth_user:auth_password@localhost:5432/auth_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
```

5. Run database migrations:
```bash
npm run migrate
```

6. Seed initial data:
```bash
npm run seed
```

7. Start the service:
```bash
npm run dev
```

The service will be available at `http://localhost:3001`

### Using Docker

1. Build and start with Docker Compose:
```bash
docker-compose up -d
```

This will start:
- Auth service on port 3001
- PostgreSQL on port 5432
- Redis on port 6379

## API Documentation

### Authentication Flow

1. **Register**: `POST /api/v1/auth/register`
2. **Verify Email**: `POST /api/v1/auth/verify-email`
3. **Login**: `POST /api/v1/auth/login`
4. **Use Access Token**: Include `Authorization: Bearer <token>` header
5. **Refresh Token**: `POST /api/v1/auth/refresh` when token expires

### Example Requests

#### Register User
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "userType": "customer",
    "acceptedTerms": true,
    "acceptedPrivacy": true
  }'
```

#### Login User
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### Validate Token
```bash
curl -X GET http://localhost:3001/api/v1/auth/validate \
  -H "Authorization: Bearer <your-access-token>"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3001 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `ACCESS_TOKEN_EXPIRY` | Access token expiration | 30m |
| `REFRESH_TOKEN_EXPIRY` | Refresh token expiration | 7d |
| `BCRYPT_ROUNDS` | Password hashing rounds | 12 |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | 900000 |
| `RATE_LIMIT_MAX` | Max requests per window | 5 |

### Rate Limits

| Endpoint Type | Window | Max Requests |
|---------------|--------|--------------|
| General API | 15 minutes | 1000 |
| Authentication | 15 minutes | 5 |
| Password Reset | 1 hour | 3 |
| Email Verification | 1 hour | 5 |
| Registration | 1 hour | 3 |

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot contain user information

### JWT Security
- Short-lived access tokens (30 minutes)
- Longer-lived refresh tokens (7 days)
- Token rotation on refresh
- Token blacklisting for logout

### Rate Limiting
- IP-based rate limiting
- User-based rate limiting
- Endpoint-specific limits
- Progressive rate limiting for failed attempts

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### Metrics
```bash
curl http://localhost:3001/metrics
```

### Logs
Logs are written to:
- Console (development)
- `logs/combined-YYYY-MM-DD.log` (all logs)
- `logs/error-YYYY-MM-DD.log` (errors only)
- `logs/auth-events-YYYY-MM-DD.log` (auth events)

## Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── models/          # Database models
├── routes/          # Route definitions
├── services/        # Business logic
├── scripts/         # Utility scripts
├── tests/           # Test files
└── app.js           # Main application file
```

### Adding New Endpoints

1. Create controller method in appropriate controller file
2. Add route in corresponding route file
3. Add validation middleware if needed
4. Add tests for the new endpoint
5. Update API documentation

### Database Migrations

Create new migration:
```bash
npm run migrate
```

Force recreate (development only):
```bash
npm run migrate -- --force
```

## Deployment

### Production Checklist
- [ ] Set strong JWT secrets
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Configure log aggregation
- [ ] Set up backup procedures
- [ ] Configure environment variables

### Docker Deployment
```bash
# Build image
docker build -t auth-service .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=... \
  auth-service
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please contact the development team or create an issue in the repository.