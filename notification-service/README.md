# Notification Service

A comprehensive multi-channel notification delivery service for the P2P Delivery Platform, providing push notifications, email, SMS, and in-app messaging capabilities with intelligent delivery optimization, template management, and analytics.

## 🚀 Features

### Core Capabilities
- **Multi-Channel Delivery**: Push notifications (FCM), email (SendGrid), SMS (Twilio), and in-app notifications
- **Template Management**: Dynamic template system with Handlebars templating engine
- **Smart Delivery**: Intelligent timing, channel selection, and quiet hours support
- **User Preferences**: Comprehensive preference management with category-based controls
- **Analytics & Tracking**: Detailed delivery and engagement metrics
- **Webhook Integration**: External system integration capabilities
- **Bulk Operations**: Mass notification campaigns and announcements

### Advanced Features
- **Real-time Delivery**: Sub-second push notification delivery via Socket.IO
- **Template Engine**: Dynamic content generation with 20+ helper functions
- **A/B Testing**: Message optimization and performance testing capabilities
- **Delivery Optimization**: Best time and channel selection based on user behavior
- **International Support**: Multi-language and timezone-aware delivery
- **Fallback Mechanisms**: Automatic channel failover for critical messages
- **Rate Limiting**: Comprehensive rate limiting to prevent abuse
- **Caching**: Multi-layer caching with Redis for optimal performance

## 🏗️ Architecture

### Service Overview
- **Port**: 3009
- **Base URL**: `/api/v1/notifications`
- **Database**: PostgreSQL with comprehensive schema
- **Cache**: Redis for session management and caching
- **Queue**: Bull queue system for background processing

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis with ioredis client
- **Templating**: Handlebars with custom helpers
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Email**: SendGrid with Nodemailer fallback
- **SMS**: Twilio with AWS SNS fallback
- **Real-time**: Socket.IO for in-app notifications
- **Queue**: Bull for background job processing

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Docker & Docker Compose (optional)

### Local Development Setup

1. **Clone and Install Dependencies**
```bash
cd notification-service
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database Setup**
```bash
# Start PostgreSQL and create database
createdb notification_db

# Run database initialization
psql -d notification_db -f init.sql
```

4. **Start Redis**
```bash
redis-server
```

5. **Run the Service**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Docker Setup

1. **Using Docker Compose**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f notification-service

# Stop services
docker-compose down
```

2. **Production Deployment**
```bash
# Build production image
docker build -t notification-service:latest .

# Run with external database
docker run -d \
  --name notification-service \
  -p 3009:3009 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e REDIS_HOST=your-redis-host \
  notification-service:latest
```

## 🔧 Configuration

### Environment Variables

#### Core Configuration
```env
NODE_ENV=production
PORT=3009
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=notification_db
DB_USER=notification_user
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your-super-secret-jwt-key
```

#### Provider Configuration
```env
# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com

# SendGrid
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890

# SMTP Fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## 📚 API Documentation

### Core Endpoints

#### Send Notification
```http
POST /api/v1/notifications/send
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "templateId": "template-uuid",
  "channels": ["push", "email"],
  "variables": {
    "userName": "John Doe",
    "deliveryId": "delivery-123"
  },
  "priority": "high"
}
```

#### User Preferences
```http
GET /api/v1/notifications/preferences/{userId}
PUT /api/v1/notifications/preferences/{userId}
```

#### Device Token Management
```http
POST /api/v1/notifications/device-tokens
PUT /api/v1/notifications/device-tokens/{tokenId}
```

### Response Format
```json
{
  "success": true,
  "data": {
    "notificationId": "notification-uuid",
    "status": "sent",
    "results": [
      {
        "channel": "push",
        "success": true,
        "externalId": "fcm-message-id"
      }
    ]
  }
}
```

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### Manual Testing
```bash
# Health check
curl http://localhost:3009/health

# Send test notification
curl -X POST http://localhost:3009/api/v1/notifications/test \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "channel": "push",
    "templateId": "test-template-id",
    "testMode": true
  }'
```

## 📊 Monitoring & Analytics

### Health Checks
- **Endpoint**: `/health`
- **Database**: Connection status
- **Redis**: Connection status
- **Providers**: FCM, SendGrid, Twilio status

### Metrics
- **Delivery Rates**: By channel and template
- **Engagement Rates**: Open and click rates
- **Error Rates**: Failed deliveries by reason
- **Performance**: Response times and throughput

### Logging
- **Structured Logging**: JSON format with Winston
- **Log Levels**: Error, Warn, Info, Debug
- **Log Rotation**: Daily rotation with retention
- **Centralized**: Ready for ELK stack integration

## 🔐 Security

### Authentication
- **JWT Tokens**: Access and refresh token support
- **Admin Tokens**: Separate admin authentication
- **Service Tokens**: Service-to-service authentication
- **API Keys**: Webhook endpoint authentication

### Rate Limiting
- **Global**: 1000 requests per 15 minutes per IP
- **User**: 100 requests per 15 minutes per user
- **Admin**: Higher limits for admin operations

### Data Protection
- **Encryption**: Sensitive data encrypted at rest
- **Privacy**: GDPR compliance features
- **Audit Trail**: Comprehensive activity logging
- **Input Validation**: Comprehensive request validation

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis cluster configured
- [ ] SSL certificates installed
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested
- [ ] Load balancer configured
- [ ] CDN configured for static assets

### Scaling Considerations
- **Horizontal Scaling**: Stateless design supports multiple instances
- **Database**: Read replicas for high read loads
- **Redis**: Cluster mode for high availability
- **Queue**: Separate worker processes for background jobs
- **Load Balancing**: Nginx or cloud load balancer

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Use conventional commit messages
- Ensure backward compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- API Documentation: `/api/v1/notifications/health`
- Architecture: See `ARCHITECTURE.md`
- API Specification: See `notification-service-api.md`

### Getting Help
- Create an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide detailed reproduction steps
- Include relevant logs and configuration

### Troubleshooting

#### Common Issues

**Database Connection Failed**
```bash
# Check database status
docker-compose ps notification-db
docker-compose logs notification-db

# Test connection manually
psql -h localhost -p 5434 -U notification_user -d notification_db
```

**Redis Connection Failed**
```bash
# Check Redis status
docker-compose ps notification-redis
redis-cli -h localhost -p 6380 ping
```

**Push Notifications Not Working**
- Verify Firebase credentials
- Check device token validity
- Ensure FCM is enabled for your project
- Check network connectivity

**Email Delivery Issues**
- Verify SendGrid API key
- Check sender domain verification
- Review email content for spam triggers
- Check SMTP fallback configuration

---

**P2P Delivery Platform - Notification Service v1.0.0**