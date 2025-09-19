# Delivery Request Service

The Delivery Request Service is a core microservice of the P2P Delivery Platform that handles delivery requests, intelligent matching algorithms, offer management, and delivery lifecycle tracking.

## 🚀 Features

### Core Functionality
- **Delivery Request Management**: Complete CRUD operations for delivery requests
- **AI-Powered Matching**: Intelligent algorithm to match requests with suitable trips
- **Offer Management**: Handle traveler offers and customer acceptance/rejection
- **Real-time Notifications**: Live updates for all parties involved
- **Market Analysis**: Dynamic pricing recommendations and market insights

### Key Capabilities
- **Smart Matching Algorithm**: ML-based matching considering 15+ factors
- **Real-time Offer System**: Instant offer notifications and responses
- **Automated Acceptance**: Optional auto-accept based on criteria
- **Geospatial Matching**: Location-based matching with radius optimization
- **Performance Analytics**: Success rates and optimization insights

## 🏗️ Architecture

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with PostGIS
- **Cache**: Redis
- **ML/AI**: TensorFlow.js (planned)
- **Authentication**: JWT tokens
- **Real-time**: Socket.io (planned)

### Database Schema
- **delivery_requests**: Customer delivery requests
- **delivery_offers**: Traveler offers for requests
- **deliveries**: Active delivery tracking

## 📋 API Endpoints

### Delivery Requests
- `POST /api/v1/delivery-requests` - Create delivery request
- `GET /api/v1/delivery-requests/:id` - Get request details
- `GET /api/v1/delivery-requests/my-requests` - Get customer's requests
- `PUT /api/v1/delivery-requests/:id` - Update request
- `POST /api/v1/delivery-requests/:id/cancel` - Cancel request
- `GET /api/v1/delivery-requests/search` - Search requests
- `POST /api/v1/delivery-requests/:id/find-matches` - Find matching trips

### Offers
- `POST /api/v1/delivery-requests/:id/offers` - Submit offer
- `GET /api/v1/delivery-requests/:id/offers` - Get request offers
- `GET /api/v1/offers/my-offers` - Get traveler's offers
- `PUT /api/v1/offers/:id` - Update offer
- `POST /api/v1/offers/:id/accept` - Accept offer
- `POST /api/v1/offers/:id/decline` - Decline offer
- `DELETE /api/v1/offers/:id` - Withdraw offer

### Analytics
- `GET /api/v1/delivery-requests/popular-routes` - Popular routes
- `GET /api/v1/delivery-requests/:id/analytics` - Request analytics
- `GET /api/v1/delivery-requests/statistics` - Request statistics
- `GET /api/v1/offers/statistics` - Offer statistics

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with PostGIS
- Redis 6+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone and Install**
   ```bash
   cd delivery-request-service
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Create database and user
   createdb delivery_db
   createuser delivery_user
   
   # Run migrations (if available)
   npm run migrate
   ```

4. **Start Services**
   ```bash
   # Start Redis
   redis-server
   
   # Start the service
   npm run dev
   ```

### Docker Development

1. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **View Logs**
   ```bash
   docker-compose logs -f delivery-request-service
   ```

3. **Stop Services**
   ```bash
   docker-compose down
   ```

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3004
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=delivery_db
DB_USER=delivery_user
DB_PASSWORD=delivery_password

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# External Services
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
TRIP_SERVICE_URL=http://localhost:3003
PAYMENT_SERVICE_URL=http://localhost:3007
NOTIFICATION_SERVICE_URL=http://localhost:3009
LOCATION_SERVICE_URL=http://localhost:3008
```

### Rate Limiting
- **General API**: 100 requests per 15 minutes
- **Creation**: 10 requests per 5 minutes
- **Offers**: 20 requests per 10 minutes
- **Search**: 30 requests per minute

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Test with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Manual Testing
```bash
# Health check
curl http://localhost:3004/health

# Create delivery request (requires auth)
curl -X POST http://localhost:3004/api/v1/delivery-requests \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

## 📊 Monitoring

### Health Check
- **Endpoint**: `GET /health`
- **Response**: Service status, uptime, version

### Logging
- **Development**: Console output with colors
- **Production**: File-based logging (logs/error.log, logs/combined.log)
- **Format**: Structured JSON logging with Winston

### Metrics
- HTTP request/response metrics
- Database query performance
- Cache hit/miss ratios
- Background job processing

## 🔄 Matching Algorithm

### Rule-Based Scoring (Current)
- **Distance Factor**: Proximity to pickup/delivery locations
- **Route Efficiency**: Minimal detour for travelers
- **Time Compatibility**: Alignment with travel schedules
- **Capacity Utilization**: Optimal use of available space
- **Traveler Rating**: Higher-rated travelers get priority
- **Experience Bonus**: Route and category experience

### ML-Based Scoring (Planned)
- **Training Data**: Historical successful matches
- **Features**: 15+ factors including user behavior
- **Model**: TensorFlow.js neural network
- **Continuous Learning**: Model updates based on outcomes

## 🚦 Performance

### Expected Metrics
- **Request Creation**: < 300ms average response time
- **Matching Algorithm**: < 2s for complex matches
- **Offer Submission**: < 150ms average response time
- **Search Queries**: < 200ms average response time
- **Throughput**: 300+ requests/second per instance

### Optimization Strategies
- **Database Indexing**: Strategic indexes for common queries
- **Caching**: Multi-layer caching with Redis
- **Connection Pooling**: Optimized database connections
- **Geospatial Queries**: PostGIS for efficient location searches

## 🔐 Security

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **Role-Based Access**: Customer/Traveler/Admin roles
- **Token Validation**: Distributed token verification
- **Rate Limiting**: Multiple layers of protection

### Data Protection
- **Input Validation**: Comprehensive request validation
- **SQL Injection**: Parameterized queries with Sequelize
- **XSS Protection**: Helmet.js security headers
- **CORS**: Configured cross-origin resource sharing

## 🚀 Deployment

### Production Build
```bash
# Build for production
npm run build

# Start production server
npm start
```

### Docker Production
```bash
# Build production image
docker build -t delivery-request-service:latest .

# Run production container
docker run -d \
  --name delivery-request-service \
  -p 3004:3004 \
  --env-file .env.production \
  delivery-request-service:latest
```

### Environment Requirements
- **CPU**: 2+ cores recommended
- **Memory**: 1GB+ RAM
- **Storage**: SSD recommended for database
- **Network**: Low latency to other services

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Standards
- **ESLint**: Airbnb configuration
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Jest**: Testing framework

## 📞 Support

### Documentation
- **API Docs**: Available at `/api/v1/docs` (planned)
- **Architecture**: See `docs/architecture.md`
- **Database**: See `docs/database.md`

### Troubleshooting
- **Connection Issues**: Check database and Redis connectivity
- **Performance**: Monitor logs for slow queries
- **Rate Limits**: Review rate limiting configuration
- **Memory**: Monitor heap usage and optimize queries

## 📈 Roadmap

### Phase 1 (Current)
- ✅ Core delivery request management
- ✅ Basic offer system
- ✅ Rule-based matching
- ✅ REST API endpoints

### Phase 2 (Next)
- 🔄 ML-based matching algorithm
- 🔄 Real-time notifications
- 🔄 Advanced analytics
- 🔄 Background job processing

### Phase 3 (Future)
- 📋 Multi-region deployment
- 📋 Advanced fraud detection
- 📋 Predictive analytics
- 📋 API rate limiting optimization

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**P2P Delivery Platform** - Connecting travelers with delivery needs worldwide.