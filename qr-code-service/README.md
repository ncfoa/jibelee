# QR Code Service

A secure, enterprise-grade QR code generation and validation microservice for the P2P Delivery Platform.

## 🚀 Features

- **Secure QR Code Generation**: Military-grade AES-256 encryption with multiple security levels
- **Dual QR System**: Separate codes for pickup and delivery verification
- **Emergency Override System**: Admin-approved backup access when QR codes fail
- **Location-Based Validation**: Geofenced verification for enhanced security
- **Real-time Analytics**: Comprehensive monitoring and reporting
- **Multi-format Support**: PNG, JPEG, WebP, and SVG output formats
- **Rate Limiting**: Advanced rate limiting and abuse prevention
- **Audit Trail**: Complete logging of all operations for compliance

## 🏗️ Architecture

The service follows a microservices architecture with:

- **Express.js** - Web framework
- **PostgreSQL** - Primary database with PostGIS for geospatial data
- **Redis** - Caching and session management
- **Docker** - Containerization and deployment

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 15+ with PostGIS extension
- Redis 7+
- Docker & Docker Compose (optional)

## 🛠️ Installation

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd qr-code-service
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration

4. Start the services:
```bash
docker-compose up -d
```

The service will be available at `http://localhost:3006`

### Manual Installation

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
# Create PostgreSQL database
createdb qr_db

# Run initialization script
psql -d qr_db -f init.sql
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the service:
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Service port | 3006 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | qr_db |
| `DB_USER` | Database user | qr_user |
| `DB_PASSWORD` | Database password | qr_password |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `JWT_SECRET` | JWT secret key | (required) |
| `QR_ENCRYPTION_KEY_STANDARD` | Standard security encryption key | (required) |
| `QR_ENCRYPTION_KEY_HIGH` | High security encryption key | (required) |
| `QR_ENCRYPTION_KEY_MAXIMUM` | Maximum security encryption key | (required) |

### Security Configuration

Generate secure encryption keys:
```bash
# Generate 256-bit keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📚 API Documentation

### Base URL
```
http://localhost:3006/api/v1
```

### Authentication
All endpoints require JWT authentication via Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Generate Pickup QR Code
```http
POST /qr/pickup/generate
Content-Type: application/json

{
  "deliveryId": "uuid",
  "securityLevel": "standard|high|maximum",
  "expirationHours": 24,
  "locationBinding": {
    "enabled": true,
    "coordinates": { "lat": 40.7128, "lng": -74.0060 },
    "radius": 100
  }
}
```

#### Generate Delivery QR Code
```http
POST /qr/delivery/generate
Content-Type: application/json

{
  "deliveryId": "uuid",
  "securityLevel": "high",
  "expirationHours": 48,
  "additionalSecurity": {
    "requiresPhoto": true,
    "requiresSignature": true
  }
}
```

#### Validate QR Code
```http
POST /qr/validate
Content-Type: application/json

{
  "qrCodeData": "encrypted-qr-data",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10
  },
  "additionalVerification": {
    "photo": "base64-encoded-photo",
    "signature": "base64-encoded-signature"
  }
}
```

#### Emergency Override
```http
POST /qr/emergency-override
Content-Type: application/json

{
  "deliveryId": "uuid",
  "reason": "Device malfunction - cannot scan QR code",
  "alternativeVerification": {
    "idPhoto": "base64-encoded-id",
    "selfiePhoto": "base64-encoded-selfie"
  },
  "contactPhone": "+1234567890"
}
```

### Response Format

Successful responses:
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    // Validation errors if applicable
  ]
}
```

## 🔒 Security Features

### Encryption Levels

1. **Standard**: AES-256-GCM encryption
2. **High**: AES-256-GCM + checksum verification
3. **Maximum**: AES-256-GCM + checksum + blockchain verification

### Security Controls

- **Rate Limiting**: Configurable limits per endpoint
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CORS**: Configurable cross-origin policies
- **Security Headers**: Helmet.js security headers

## 📊 Monitoring & Analytics

### Health Check
```http
GET /health
```

### Service Info
```http
GET /api/v1/info
```

### Performance Metrics
```http
GET /api/v1/qr/performance-metrics
```

### Analytics
```http
GET /api/v1/qr/analytics
```

## 🧪 Testing

Run the test suite:
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🚀 Deployment

### Docker Deployment

1. Build the image:
```bash
docker build -t qr-code-service .
```

2. Run the container:
```bash
docker run -d \
  --name qr-code-service \
  -p 3006:3006 \
  --env-file .env \
  qr-code-service
```

### Production Considerations

- Use environment-specific encryption keys
- Enable SSL/TLS termination
- Configure proper logging levels
- Set up monitoring and alerting
- Implement backup strategies
- Use connection pooling for databases

## 🔧 Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
└── app.js           # Main application
```

### Adding New Features

1. Create models in `src/models/`
2. Implement services in `src/services/`
3. Add controllers in `src/controllers/`
4. Define routes in `src/routes/`
5. Add middleware if needed
6. Write tests

### Code Style

The project uses ESLint with Airbnb configuration:
```bash
npm run lint
npm run lint:fix
```

## 📝 Changelog

### v1.0.0 (Initial Release)
- Secure QR code generation and validation
- Emergency override system
- Location-based verification
- Real-time analytics
- Docker support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation at `/api/v1/info`

## 🙏 Acknowledgments

- Express.js community
- PostgreSQL and PostGIS teams
- Node.js security community
- QR code specification contributors