# Admin Service - P2P Delivery Platform

The Admin Service provides comprehensive administrative operations and system management for the P2P Delivery Platform. It includes real-time monitoring, user management, financial reporting, dispute resolution, content moderation, and system configuration capabilities.

## 🚀 Features

### Core Functionality
- **Real-time Dashboard**: Live system metrics and alerts
- **User Management**: Complete user lifecycle management and moderation
- **Financial Operations**: Revenue tracking, payout management, and financial reporting
- **Dispute Resolution**: Comprehensive dispute management and resolution tools
- **Content Moderation**: Review and moderation system for user-generated content
- **Analytics & Reporting**: Business intelligence and operational insights
- **System Configuration**: Platform settings and feature flag management
- **Security Management**: Security monitoring, incident response, and compliance

### Key Features
- **Advanced Analytics**: Custom reports and data visualization
- **Role-based Access Control**: Granular permission management
- **Audit Trail**: Complete activity logging and compliance tracking
- **Automated Workflows**: Intelligent automation for common tasks
- **Real-time Updates**: WebSocket-based live updates
- **Data Export**: Flexible data export in multiple formats
- **System Backups**: Automated and manual backup management

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis for session management and caching
- **Real-time**: Socket.io for live updates
- **Queue**: Bull for background job processing
- **Security**: JWT with role-based permissions
- **Logging**: Winston with daily log rotation

### Service Port
- **Development**: 3010
- **Production**: 3010

## 📊 API Endpoints

### Authentication
All admin endpoints require authentication via:
- `Authorization: Bearer <admin_access_token>` header, OR
- `X-Admin-Token: <admin_api_token>` header

### Core Endpoints

#### Dashboard & Analytics
- `GET /api/v1/admin/dashboard` - Get dashboard overview
- `GET /api/v1/admin/analytics/system` - Get system analytics
- `GET /api/v1/admin/metrics/realtime` - Get real-time metrics

#### User Management
- `GET /api/v1/admin/users` - List users with filters
- `GET /api/v1/admin/users/:userId` - Get user details
- `PUT /api/v1/admin/users/:userId/status` - Update user status
- `POST /api/v1/admin/users/:userId/verify` - Verify user identity

#### Financial Management
- `GET /api/v1/admin/financials/overview` - Financial overview
- `GET /api/v1/admin/financials/transactions` - Transaction history
- `POST /api/v1/admin/financials/payouts/manual` - Process manual payout
- `POST /api/v1/admin/financials/reports/generate` - Generate financial report

#### Dispute Management
- `GET /api/v1/admin/disputes` - List disputes
- `GET /api/v1/admin/disputes/:disputeId` - Get dispute details
- `PUT /api/v1/admin/disputes/:disputeId/assign` - Assign dispute
- `PUT /api/v1/admin/disputes/:disputeId/resolve` - Resolve dispute

#### System Management
- `GET /api/v1/admin/config` - Get system configuration
- `PUT /api/v1/admin/config` - Update configuration
- `POST /api/v1/admin/backups` - Create system backup
- `POST /api/v1/admin/export` - Export data

## 🗄️ Database Schema

### Core Tables
- **admin_users**: Admin user accounts with roles and permissions
- **admin_activity_log**: Audit trail of all admin activities
- **system_configuration**: System-wide configuration settings
- **disputes**: Customer disputes and resolution tracking
- **dispute_evidence**: Evidence files attached to disputes
- **dispute_messages**: Communication within disputes
- **system_backups**: Backup records and metadata
- **data_exports**: Data export jobs and status
- **daily_metrics**: Aggregated daily metrics for analytics

### Roles & Permissions
- **super_admin**: Full system access
- **admin**: User management, financial operations, disputes
- **moderator**: User moderation, content review, basic disputes
- **support**: User support, basic dispute handling
- **finance**: Financial operations and reporting
- **analyst**: Analytics, reporting, read-only access

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Installation

1. **Clone and setup**
   ```bash
   cd admin-service
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   npm run migrate
   
   # Seed sample data (development only)
   npm run seed
   ```

4. **Start the Service**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Docker Setup

1. **Using Docker Compose**
   ```bash
   # Start all services
   docker-compose up -d
   
   # Start with admin tools (pgAdmin, Redis Commander)
   docker-compose --profile tools up -d
   
   # Start with frontend
   docker-compose --profile frontend up -d
   ```

2. **Individual Service**
   ```bash
   # Build image
   docker build -t admin-service .
   
   # Run container
   docker run -p 3010:3010 --env-file .env admin-service
   ```

### Service URLs
- **Admin Service**: http://localhost:3010
- **Health Check**: http://localhost:3010/health
- **API Documentation**: http://localhost:3010/api/v1/admin
- **pgAdmin** (with tools profile): http://localhost:5050
- **Redis Commander** (with tools profile): http://localhost:8081

## 🔧 Configuration

### Environment Variables

#### Server Configuration
- `NODE_ENV`: Environment (development/production)
- `PORT`: Service port (default: 3010)
- `HOST`: Service host (default: 0.0.0.0)

#### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_HOST`: Database host
- `DATABASE_PORT`: Database port
- `DATABASE_NAME`: Database name
- `DATABASE_USER`: Database user
- `DATABASE_PASSWORD`: Database password

#### Redis Configuration
- `REDIS_URL`: Redis connection string
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port
- `REDIS_PASSWORD`: Redis password

#### Authentication
- `JWT_SECRET`: JWT secret for user tokens
- `JWT_ADMIN_SECRET`: JWT secret for admin tokens
- `ADMIN_TOKEN_SECRET`: Secret for X-Admin-Token
- `JWT_EXPIRES_IN`: Token expiration time
- `ADMIN_SESSION_TIMEOUT`: Admin session timeout

#### External Services
- `AUTH_SERVICE_URL`: Auth service URL
- `USER_SERVICE_URL`: User service URL
- `PAYMENT_SERVICE_URL`: Payment service URL
- `NOTIFICATION_SERVICE_URL`: Notification service URL

#### Feature Flags
- `ENABLE_REAL_TIME_DASHBOARD`: Enable real-time features
- `ENABLE_AUTO_BACKUP`: Enable automatic backups
- `ENABLE_ADVANCED_ANALYTICS`: Enable advanced analytics

## 📈 Monitoring & Logging

### Health Checks
- **Endpoint**: `/health`
- **Database**: Connection status
- **Redis**: Connection status
- **External Services**: Service availability

### Logging
- **Winston**: Structured logging with daily rotation
- **Log Levels**: error, warn, info, debug
- **Log Files**: 
  - `logs/error-YYYY-MM-DD.log`: Error logs
  - `logs/combined-YYYY-MM-DD.log`: All logs
  - `logs/admin-activity-YYYY-MM-DD.log`: Admin activities

### Metrics
- **Real-time Metrics**: System performance and usage
- **Daily Metrics**: Aggregated daily statistics
- **Custom Analytics**: Business intelligence reports
- **Performance Monitoring**: API response times, error rates

## 🔒 Security

### Authentication & Authorization
- **JWT-based Authentication**: Secure token-based auth
- **Role-based Access Control**: Granular permissions
- **Multi-factor Authentication**: Optional 2FA support
- **Session Management**: Secure session handling

### Data Protection
- **Encryption**: AES-256 for sensitive data
- **HTTPS Only**: End-to-end encryption
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries

### Audit & Compliance
- **Complete Audit Trail**: All admin actions logged
- **GDPR Compliance**: Data protection and privacy
- **Security Monitoring**: Real-time security events
- **Access Logging**: Detailed access logs

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Linting
npm run lint
npm run lint:fix
```

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Service interaction testing
- **API Tests**: Endpoint functionality testing
- **Security Tests**: Authentication and authorization testing

## 🚀 Deployment

### Production Deployment
1. **Build and Deploy**
   ```bash
   # Install production dependencies
   npm ci --only=production
   
   # Run migrations
   npm run migrate
   
   # Start service
   npm start
   ```

2. **Docker Deployment**
   ```bash
   # Build production image
   docker build -t admin-service:latest .
   
   # Deploy with docker-compose
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Environment Setup
- **Database**: Set up PostgreSQL with proper user permissions
- **Redis**: Configure Redis with persistence and security
- **Load Balancer**: Configure load balancing for high availability
- **SSL/TLS**: Set up HTTPS with valid certificates
- **Monitoring**: Configure monitoring and alerting

## 📚 API Documentation

### Authentication
All admin endpoints require authentication. Use either:
- Bearer token in Authorization header
- X-Admin-Token header with admin API token

### Response Format
```json
{
  "success": true,
  "data": { /* response data */ },
  "pagination": { /* pagination info */ },
  "error": "error message if failed"
}
```

### Error Handling
- **400**: Bad Request - Invalid input
- **401**: Unauthorized - Authentication required
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource not found
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error - Server error

## 🤝 Contributing

### Development Guidelines
1. Follow the existing code style and patterns
2. Write comprehensive tests for new features
3. Update documentation for API changes
4. Use meaningful commit messages
5. Ensure all tests pass before submitting

### Code Style
- **ESLint**: Follow the configured ESLint rules
- **Prettier**: Use Prettier for code formatting
- **Comments**: Add JSDoc comments for functions
- **Naming**: Use descriptive variable and function names

## 📄 License

This project is part of the P2P Delivery Platform and is proprietary software.

## 🆘 Support

For support and questions:
- **Documentation**: Check the API documentation
- **Issues**: Create an issue in the project repository
- **Contact**: Reach out to the development team

---

**Admin Service** - Comprehensive administrative operations for the P2P Delivery Platform