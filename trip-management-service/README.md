# Trip Management Service

A comprehensive microservice for managing trips, routes, and capacity in the P2P Delivery Platform.

## 🚀 Features

### Core Trip Management
- **Complete CRUD Operations**: Create, read, update, and delete trips
- **Multi-Modal Support**: Flight, train, bus, car, ship, and other transportation types
- **Dynamic Capacity Management**: Real-time tracking of weight, volume, and item capacity
- **Route Optimization**: Integration with Google Maps and Mapbox for optimal routing
- **Weather Integration**: Real-time weather data and travel alerts

### Advanced Features
- **Trip Templates**: Save and reuse frequent travel patterns
- **Recurring Trips**: Automated creation of recurring travel schedules
- **Smart Search**: Geospatial search with radius-based filtering
- **Analytics & Reporting**: Comprehensive trip performance analytics
- **Caching**: Redis-based caching for improved performance
- **Real-time Updates**: Live capacity and status updates

### API Endpoints (20+ Routes)

#### Trip Management
- `POST /api/v1/trips` - Create new trip
- `GET /api/v1/trips/{id}` - Get trip details
- `PUT /api/v1/trips/{id}` - Update trip
- `DELETE /api/v1/trips/{id}` - Cancel trip
- `GET /api/v1/trips/search` - Search public trips
- `GET /api/v1/trips/my-trips` - Get user's trips

#### Trip Status & Operations
- `POST /api/v1/trips/{id}/start` - Start trip
- `POST /api/v1/trips/{id}/status` - Update trip status
- `POST /api/v1/trips/{id}/complete` - Complete trip
- `POST /api/v1/trips/{id}/cancel` - Cancel trip with reason

#### Trip Templates
- `GET /api/v1/trips/templates` - Get user templates
- `POST /api/v1/trips/templates` - Create template
- `POST /api/v1/trips/{id}/duplicate` - Duplicate trip
- `DELETE /api/v1/trips/templates/{id}` - Delete template

#### Analytics & Insights
- `GET /api/v1/trips/analytics` - Trip analytics
- `GET /api/v1/trips/{id}/analytics` - Trip performance
- `GET /api/v1/trips/statistics` - Trip statistics
- `GET /api/v1/trips/popular-routes` - Popular routes
- `GET /api/v1/trips/recommendations` - Trip recommendations

#### Weather & Route Info
- `GET /api/v1/trips/{id}/weather` - Trip weather data
- `POST /api/v1/trips/route/optimize` - Route optimization
- `GET /api/v1/trips/{id}/traffic` - Traffic information

#### Data Export & Sharing
- `GET /api/v1/trips/{id}/export` - Export trip data
- `POST /api/v1/trips/{id}/share` - Share trip
- `GET /api/v1/trips/{id}/reviews` - Trip reviews

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with PostGIS
- **Cache**: Redis
- **ORM**: Sequelize

### External APIs
- **Google Maps API**: Routing, geocoding, traffic data
- **Mapbox API**: Alternative mapping service
- **OpenWeatherMap**: Weather data and alerts
- **AccuWeather**: Additional weather provider

### Key Dependencies
```json
{
  "express": "^4.18.2",
  "sequelize": "^6.35.0",
  "pg": "^8.11.3",
  "ioredis": "^5.3.2",
  "@googlemaps/google-maps-services-js": "^3.3.42",
  "@mapbox/mapbox-sdk": "^0.15.3",
  "moment-timezone": "^0.5.43",
  "geolib": "^3.3.4",
  "joi": "^17.11.0",
  "winston": "^3.11.0"
}
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with PostGIS
- Redis 7+
- Docker & Docker Compose (optional)

### Environment Setup
1. Copy environment file:
```bash
cp .env.example .env
```

2. Configure environment variables:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trip_db
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
MAPBOX_ACCESS_TOKEN=your-mapbox-access-token
OPENWEATHER_API_KEY=your-openweather-api-key

# JWT
JWT_SECRET=your-super-secret-jwt-key
```

### Installation & Running

#### Option 1: Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f trip-service

# Stop services
docker-compose down
```

#### Option 2: Manual Setup
```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Start production server
npm start
```

### Service URLs
- **API**: http://localhost:3003
- **Health Check**: http://localhost:3003/health
- **Metrics**: http://localhost:3003/metrics
- **API Docs**: http://localhost:3003/api/v1/docs

## 📊 Database Schema

### Core Tables
- **trips**: Main trip data with geospatial coordinates
- **trip_templates**: Reusable trip templates
- **trip_weather**: Weather data cache for trips

### Key Features
- **PostGIS Integration**: Advanced geospatial queries and indexing
- **JSONB Fields**: Flexible storage for preferences and restrictions
- **Optimized Indexes**: High-performance queries for search and analytics
- **Soft Deletes**: Data retention with paranoid deletions

## 🔧 Configuration

### Database Configuration
```javascript
// Automatic PostGIS setup
// Geospatial indexes for location-based queries
// Optimized for trip search and capacity management
```

### Redis Caching
```javascript
// Trip data caching (5 minutes)
// Search result caching (1 minute)
// Weather data caching (30 minutes)
// Route optimization caching (1 hour)
```

### API Rate Limiting
```javascript
// Standard: 100 requests per 15 minutes
// Authenticated: 1000 requests per 15 minutes
// Premium: 5000 requests per 15 minutes
```

## 🧪 Testing

### Run Tests
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

### Test Coverage
- **Controllers**: 90%+
- **Services**: 95%+
- **Utilities**: 90%+
- **Models**: 85%+

## 📈 Performance & Monitoring

### Key Metrics
- **Response Time**: <200ms average
- **Throughput**: 200+ requests/second
- **Cache Hit Rate**: 80%+
- **Database Query Time**: <50ms average

### Health Checks
- Database connectivity
- Redis connectivity
- External API availability
- Memory and CPU usage

### Monitoring Endpoints
```bash
GET /health          # Service health status
GET /metrics         # Performance metrics
GET /api/v1/docs     # API documentation
```

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Request rate limiting
- Input validation and sanitization

### Data Security
- Encrypted sensitive data
- SQL injection prevention
- XSS protection
- CORS configuration

## 🌍 Geospatial Features

### Location Services
- Address geocoding (Google Maps, Mapbox, OSM)
- Reverse geocoding
- Distance calculations
- Radius-based search
- Route optimization

### PostGIS Integration
- Spatial indexing (GIST)
- Geographic queries
- Distance calculations
- Bounding box searches

## 📱 API Usage Examples

### Create a Trip
```javascript
POST /api/v1/trips
{
  "title": "NYC to Boston Business Trip",
  "type": "flight",
  "origin": {
    "address": "New York, NY, USA",
    "coordinates": {"lat": 40.7128, "lng": -74.0060}
  },
  "destination": {
    "address": "Boston, MA, USA", 
    "coordinates": {"lat": 42.3601, "lng": -71.0589}
  },
  "departureTime": "2025-02-01T10:00:00Z",
  "arrivalTime": "2025-02-01T11:30:00Z",
  "capacity": {
    "weight": 5,
    "volume": 10,
    "items": 3
  },
  "pricing": {
    "basePrice": 15.00,
    "pricePerKg": 5.00
  }
}
```

### Search Trips
```javascript
GET /api/v1/trips/search?origin=New York&destination=Boston&departureDate=2025-02-01&radius=50
```

### Get Trip Weather
```javascript
GET /api/v1/trips/{tripId}/weather
```

## 🔄 Integration with Other Services

### Service Dependencies
- **Auth Service**: User authentication and authorization
- **User Service**: User profile and preferences
- **Notification Service**: Trip alerts and updates
- **Payment Service**: Trip pricing and payments

### Event-Driven Architecture
- Trip status updates
- Capacity changes
- Weather alerts
- Route modifications

## 🚀 Deployment

### Docker Deployment
```bash
# Build production image
docker build -t trip-management-service .

# Run container
docker run -p 3003:3003 trip-management-service
```

### Environment-Specific Configs
- **Development**: Full logging, debug mode
- **Staging**: Production-like with test data
- **Production**: Optimized performance, security hardened

## 📚 API Documentation

Comprehensive API documentation is available at:
- **Local**: http://localhost:3003/api/v1/docs
- **Swagger/OpenAPI**: Coming soon
- **Postman Collection**: Available in `/docs` folder

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

### Code Standards
- ESLint configuration
- Prettier formatting
- Jest testing
- JSDoc documentation

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- **Issues**: GitHub Issues
- **Documentation**: `/docs` folder
- **API Reference**: Built-in documentation

---

**Trip Management Service** - Part of the P2P Delivery Platform Ecosystem