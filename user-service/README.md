# User Management Service

A comprehensive user management microservice for the P2P Delivery Platform, handling user profiles, verification, reviews, preferences, and relationships.

## Features

- **Profile Management**: Complete user profile CRUD operations with privacy controls
- **Identity Verification**: Document upload and AI-powered verification workflow
- **Address Management**: Multiple address storage with geocoding support
- **Review System**: Bidirectional rating system between users
- **User Preferences**: Comprehensive settings for notifications, privacy, and delivery preferences
- **User Relationships**: Favorites and blocking functionality
- **File Upload**: Secure image processing and storage with AWS S3
- **Real-time Features**: Redis caching and rate limiting
- **Security**: JWT authentication, input validation, and security headers

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with PostGIS
- **Cache**: Redis
- **File Storage**: AWS S3
- **Image Processing**: Sharp
- **Authentication**: JWT
- **Geocoding**: Mapbox/Google Maps
- **Validation**: Joi
- **Testing**: Jest
- **Containerization**: Docker

## API Endpoints

### Profile Management
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update user profile
- `POST /api/v1/users/me/profile-picture` - Upload profile picture
- `DELETE /api/v1/users/me/profile-picture` - Delete profile picture
- `GET /api/v1/users/:userId` - Get user profile by ID
- `GET /api/v1/users` - Search users
- `GET /api/v1/users/:userId/statistics` - Get user statistics

### Address Management
- `GET /api/v1/users/me/addresses` - Get user addresses
- `POST /api/v1/users/me/addresses` - Add new address
- `PUT /api/v1/users/me/addresses/:addressId` - Update address
- `DELETE /api/v1/users/me/addresses/:addressId` - Delete address
- `POST /api/v1/users/me/addresses/:addressId/default` - Set default address

### Verification
- `POST /api/v1/users/me/verify-identity` - Upload identity documents
- `GET /api/v1/users/me/verification/status` - Get verification status
- `POST /api/v1/users/me/verify-phone` - Initiate phone verification
- `POST /api/v1/users/me/verify-phone/confirm` - Confirm phone verification

### Reviews
- `POST /api/v1/users/reviews` - Submit review
- `GET /api/v1/users/:userId/reviews` - Get user reviews
- `GET /api/v1/users/:userId/review-statistics` - Get review statistics
- `POST /api/v1/users/reviews/:reviewId/response` - Add review response

### Preferences
- `GET /api/v1/users/me/preferences` - Get user preferences
- `PUT /api/v1/users/me/preferences` - Update preferences
- `PUT /api/v1/users/me/notifications` - Update notification preferences

### Relationships
- `POST /api/v1/users/me/blocked-users` - Block user
- `DELETE /api/v1/users/me/blocked-users/:userId` - Unblock user
- `GET /api/v1/users/me/blocked-users` - Get blocked users
- `POST /api/v1/users/me/favorites` - Add to favorites
- `DELETE /api/v1/users/me/favorites/:userId` - Remove from favorites
- `GET /api/v1/users/me/favorites` - Get favorite users

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- AWS S3 account (for file storage)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd user-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start dependencies with Docker**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start the service**
   ```bash
   npm run dev
   ```

### Docker Development

1. **Start all services**
   ```bash
   docker-compose up
   ```

2. **View logs**
   ```bash
   docker-compose logs -f user-service
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3002` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `user_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret | Required |
| `AWS_ACCESS_KEY_ID` | AWS access key | Required for file upload |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required for file upload |
| `S3_BUCKET_NAME` | S3 bucket for public files | Required for file upload |

### Database Setup

The service uses PostgreSQL with PostGIS extension for geographic data. The database schema includes:

- **Users**: Extended profile information
- **User Addresses**: Multiple addresses with geocoding
- **User Preferences**: Comprehensive user settings
- **User Statistics**: Performance metrics and analytics
- **Verification Documents**: Identity verification files
- **Reviews**: Rating and review system
- **User Relationships**: Blocks and favorites

## API Documentation

### Authentication

All endpoints except public ones require JWT authentication:

```bash
Authorization: Bearer <access_token>
```

### Response Format

All API responses follow this format:

```json
{
  "success": true|false,
  "message": "Human readable message",
  "data": {}, // Response data
  "errors": [], // Array of error messages
  "pagination": {}, // For paginated responses
  "meta": {} // Additional metadata
}
```

### Error Handling

- **400**: Bad Request - Validation errors
- **401**: Unauthorized - Authentication required
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource not found
- **409**: Conflict - Resource already exists
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error - Server error

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Monitoring

### Health Check

```bash
GET /health
```

### Metrics

```bash
GET /metrics
```

### Logging

The service uses structured logging with different log levels:

- **Error**: System errors and exceptions
- **Warn**: Warning conditions
- **Info**: General information
- **Debug**: Debug information

Logs are written to:
- Console (development)
- Daily rotating files (production)
- Centralized logging system (if configured)

## Security

### Features

- JWT authentication with refresh tokens
- Rate limiting (global and per-user)
- Input validation and sanitization
- File upload security (virus scanning, type validation)
- Security headers (CORS, CSP, etc.)
- Request/response logging
- Suspicious activity detection

### Best Practices

- Use HTTPS in production
- Keep JWT secrets secure
- Regularly rotate secrets
- Monitor security logs
- Keep dependencies updated
- Use strong database passwords

## Performance

### Caching

- Redis caching for frequently accessed data
- User profile caching (5 minutes)
- Address geocoding caching (24 hours)
- Preferences caching (10 minutes)

### Optimization

- Database indexing for common queries
- Image optimization and resizing
- Pagination for large datasets
- Connection pooling
- Lazy loading of related data

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure secure JWT secrets
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring and alerting
- [ ] Set up log aggregation
- [ ] Configure backup strategy
- [ ] Set resource limits
- [ ] Configure health checks
- [ ] Set up CI/CD pipeline

### Docker Production

```bash
# Build production image
docker build -t user-service:latest .

# Run with production environment
docker run -d \
  --name user-service \
  -p 3002:3002 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-production-secret \
  --restart unless-stopped \
  user-service:latest
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.