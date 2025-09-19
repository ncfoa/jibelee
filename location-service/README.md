# Location Service

A comprehensive Node.js microservice for real-time location tracking, geofencing, and geospatial services in a P2P delivery platform. Built with Express.js, PostgreSQL with PostGIS, Redis, and Socket.IO.

## 🚀 Features

### Core Functionality
- **Real-time GPS Tracking**: Continuous location tracking with offline sync capability
- **Geofencing**: Automated detection of pickup/delivery zone entry/exit with notifications
- **Route Optimization**: Intelligent routing with traffic integration and waypoint optimization
- **Emergency Services**: Critical location services for safety with automatic emergency service integration
- **Privacy Controls**: User-controlled location sharing and data retention with GDPR compliance

### Advanced Features
- **High-Precision Tracking**: Sub-meter accuracy with multiple positioning sources
- **Offline Capability**: Store and sync location data when connectivity returns
- **Smart Geofencing**: Dynamic geofences with contextual triggers and dwell time detection
- **Privacy-First Design**: Granular privacy controls and automatic data expiry
- **Battery Optimization**: Efficient tracking algorithms to preserve device battery
- **Real-time WebSocket**: Live location streaming and event notifications

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [WebSocket Events](#websocket-events)
- [Privacy & Security](#privacy--security)
- [Performance](#performance)
- [Deployment](#deployment)
- [Development](#development)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Contributing](#contributing)

## 🛠 Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 13+ with PostGIS extension
- Redis 6+
- Docker & Docker Compose (optional)

### Local Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd location-service
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

4. **Set up PostgreSQL with PostGIS**
```bash
# Install PostGIS extension
sudo apt-get install postgresql-contrib postgis postgresql-13-postgis-3

# Create database
createdb location_db
psql -d location_db -c "CREATE EXTENSION postgis;"
```

5. **Run database migrations**
```bash
npm run db:migrate
```

6. **Start the service**
```bash
npm run dev
```

### Docker Setup

1. **Start all services with Docker Compose**
```bash
docker-compose up -d
```

2. **Check service health**
```bash
curl http://localhost:3008/api/v1/location/health
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `3008` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `location_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | `required` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | `optional` |
| `MAPBOX_ACCESS_TOKEN` | Mapbox access token | `optional` |

### Service Configuration

```javascript
// config/default.js
module.exports = {
  server: {
    port: process.env.PORT || 3008,
    host: '0.0.0.0'
  },
  database: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  redis: {
    url: process.env.REDIS_URL
  },
  tracking: {
    defaultInterval: 30, // seconds
    maxBatchSize: 100,
    accuracyThreshold: 100 // meters
  },
  geofencing: {
    checkInterval: 5, // seconds
    maxRadius: 10000 // meters
  }
};
```

## 📚 API Documentation

### Base URL
```
http://localhost:3008/api/v1/location
```

### Authentication
All endpoints require JWT authentication via Authorization header:
```
Authorization: Bearer <access_token>
```

### Core Endpoints

#### Location Tracking

**Start/Update Location Tracking**
```http
POST /track
Content-Type: application/json

{
  "deliveryId": "delivery_uuid",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10,
    "altitude": 15.5,
    "bearing": 45.0,
    "speed": 25.5
  },
  "timestamp": "2025-02-01T12:00:00Z",
  "batteryLevel": 85,
  "networkType": "wifi"
}
```

**Get Current Location**
```http
GET /current/{deliveryId}
```

**Get Location History**
```http
GET /history/{deliveryId}?from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z&interval=60
```

#### Geofencing

**Create Geofence**
```http
POST /geofence
Content-Type: application/json

{
  "name": "Pickup Zone - Central Park",
  "type": "pickup",
  "deliveryId": "delivery_uuid",
  "geometry": {
    "type": "circle",
    "center": { "lat": 40.7829, "lng": -73.9654 },
    "radius": 200
  },
  "notifications": {
    "onEntry": true,
    "onExit": true,
    "onDwell": { "enabled": true, "duration": 300 }
  }
}
```

**Check Geofence Status**
```http
POST /geofence/check
Content-Type: application/json

{
  "location": { "lat": 40.7128, "lng": -74.0060 },
  "geofences": [
    {
      "id": "geofence_uuid",
      "center": { "lat": 40.7130, "lng": -74.0062 },
      "radius": 100,
      "type": "pickup"
    }
  ]
}
```

#### Emergency Services

**Report Emergency**
```http
POST /emergency
Content-Type: application/json

{
  "deliveryId": "delivery_uuid",
  "emergencyType": "breakdown",
  "severity": "medium",
  "location": { "lat": 40.7128, "lng": -74.0060, "accuracy": 3.0 },
  "description": "Vehicle broke down on highway, need assistance",
  "contactNumber": "+1234567890",
  "requiresAssistance": true
}
```

#### Route Optimization

**Optimize Route**
```http
POST /route/optimize
Content-Type: application/json

{
  "origin": { "latitude": 40.7128, "longitude": -74.0060 },
  "destination": { "latitude": 42.3601, "longitude": -71.0589 },
  "waypoints": [
    {
      "latitude": 40.9176,
      "longitude": -74.1718,
      "type": "pickup",
      "timeWindow": {
        "start": "2025-02-01T11:00:00Z",
        "end": "2025-02-01T12:00:00Z"
      }
    }
  ],
  "preferences": {
    "optimize": "time",
    "avoidTolls": false,
    "vehicleType": "car"
  }
}
```

### Response Format

All API responses follow this format:
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional message",
  "timestamp": "2025-02-01T12:00:00Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

## 🗄️ Database Schema

### Core Tables

#### location_tracking
Stores GPS tracking data with high precision.

```sql
CREATE TABLE location_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    user_id UUID NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(8,2), -- meters
    altitude DECIMAL(10,2), -- meters
    bearing DECIMAL(6,2), -- degrees
    speed DECIMAL(8,2), -- km/h
    battery_level INTEGER, -- percentage
    network_type VARCHAR(20), -- wifi, cellular, offline
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### geofences
Defines geographical boundaries with notification rules.

```sql
CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type geofence_type_enum NOT NULL, -- pickup, delivery, restricted, safe_zone
    delivery_id UUID,
    geometry_type geometry_type_enum NOT NULL, -- circle, polygon
    center_coordinates GEOGRAPHY(POINT, 4326),
    radius INTEGER, -- meters (for circle)
    polygon_coordinates GEOGRAPHY(POLYGON, 4326), -- for polygon
    notifications JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    timezone VARCHAR(50) DEFAULT 'UTC',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### emergency_locations
Tracks emergency incidents with location context.

```sql
CREATE TABLE emergency_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    user_id UUID NOT NULL,
    emergency_type emergency_type_enum NOT NULL, -- accident, breakdown, theft, medical, other
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(8,2),
    description TEXT NOT NULL,
    contact_number VARCHAR(20),
    requires_assistance BOOLEAN DEFAULT FALSE,
    severity emergency_severity_enum NOT NULL, -- low, medium, high, critical
    status emergency_status_enum NOT NULL DEFAULT 'reported', -- reported, acknowledged, in_progress, resolved
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

Optimized for geospatial queries and time-based lookups:

```sql
-- Spatial indexes
CREATE INDEX idx_location_tracking_coordinates ON location_tracking USING GIST(coordinates);
CREATE INDEX idx_geofences_center ON geofences USING GIST(center_coordinates);
CREATE INDEX idx_geofences_polygon ON geofences USING GIST(polygon_coordinates);

-- Time-based indexes
CREATE INDEX idx_location_tracking_delivery_time ON location_tracking(delivery_id, timestamp);
CREATE INDEX idx_geofence_events_triggered_at ON geofence_events(triggered_at);

-- Composite indexes
CREATE INDEX idx_geofences_delivery_active ON geofences(delivery_id, active) WHERE active = true;
```

## 🔌 WebSocket Events

### Client Events

**Connect to delivery room**
```javascript
socket.emit('join_delivery', deliveryId);
```

**Send location update**
```javascript
socket.emit('location_update', {
  deliveryId: 'delivery_uuid',
  userId: 'user_uuid',
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 10
  }
});
```

### Server Events

**Location updated**
```javascript
socket.on('location_updated', (data) => {
  console.log('New location:', data);
  // { deliveryId, location, timestamp }
});
```

**Geofence event**
```javascript
socket.on('geofence_event', (data) => {
  console.log('Geofence event:', data);
  // { geofenceId, eventType, deliveryId, timestamp }
});
```

**Tracking status**
```javascript
socket.on('tracking_started', (data) => {
  console.log('Tracking started:', data);
});

socket.on('tracking_stopped', (data) => {
  console.log('Tracking stopped:', data);
});
```

## 🔒 Privacy & Security

### Data Protection

- **Encryption**: All sensitive location data is encrypted at rest and in transit
- **Access Control**: Role-based access with granular permissions
- **Data Minimization**: Only necessary data is collected and stored
- **Retention Policies**: Automatic data expiry based on user preferences

### Privacy Controls

```javascript
// User privacy settings
{
  "trackingLevel": "precise", // precise, approximate, minimal
  "shareWith": {
    "customers": true,
    "platform": true,
    "emergencyContacts": true,
    "thirdParties": false
  },
  "dataRetention": {
    "period": 90, // days
    "deleteAfterDelivery": false
  },
  "anonymization": {
    "enabled": true,
    "delay": 24 // hours after delivery
  }
}
```

### Security Features

- JWT-based authentication
- Rate limiting and DDoS protection
- Input validation and sanitization
- SQL injection prevention
- CORS configuration
- Security headers (Helmet.js)

## ⚡ Performance

### Optimization Strategies

- **Database Indexing**: Optimized spatial and temporal indexes
- **Caching**: Redis for frequently accessed data
- **Connection Pooling**: Efficient database connections
- **Batch Processing**: Bulk location updates
- **Compression**: Response compression for large datasets

### Performance Metrics

- Location update: < 100ms average response time
- Geofence check: < 50ms average response time
- Route optimization: < 2s for complex routes
- Real-time streaming: < 50ms latency
- Throughput: 10,000+ location updates/second per instance

### Monitoring

Built-in performance monitoring with:
- Request/response metrics
- Database query performance
- Memory and CPU usage
- Error rates and types
- WebSocket connection metrics

## 🚀 Deployment

### Docker Deployment

1. **Build and run with Docker Compose**
```bash
docker-compose up -d
```

2. **Scale the service**
```bash
docker-compose up -d --scale location-service=3
```

3. **Check logs**
```bash
docker-compose logs -f location-service
```

### Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  location-service:
    build: .
    environment:
      - NODE_ENV=production
      - DB_SSL=true
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    restart: unless-stopped
```

### Health Checks

The service includes comprehensive health checks:

```bash
# Check service health
curl http://localhost:3008/api/v1/location/health

# Response
{
  "success": true,
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-02-01T12:00:00Z",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

## 👨‍💻 Development

### Project Structure

```
location-service/
├── src/
│   ├── controllers/          # Request handlers
│   ├── models/              # Database models
│   ├── services/            # Business logic
│   ├── middleware/          # Express middleware
│   ├── routes/              # API routes
│   ├── utils/               # Utility functions
│   └── app.js              # Main application
├── migrations/              # Database migrations
├── tests/                   # Test files
├── logs/                    # Application logs
├── docker-compose.yml       # Docker configuration
├── Dockerfile              # Container definition
└── README.md               # Documentation
```

### Development Scripts

```bash
# Development server with auto-reload
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Database operations
npm run db:migrate
npm run db:seed
npm run db:reset
```

### Code Style

- ESLint with Standard configuration
- Prettier for code formatting
- Conventional commits for git messages
- JSDoc for function documentation

## 🧪 Testing

### Test Coverage

- Unit tests for business logic
- Integration tests for API endpoints
- Geospatial query testing
- WebSocket event testing
- Performance benchmarks

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "LocationService"

# Run with coverage
npm run test:coverage

# Performance tests
npm run test:performance
```

### Test Example

```javascript
describe('LocationService', () => {
  describe('updateLocation', () => {
    it('should update location successfully', async () => {
      const locationData = {
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        accuracy: 10,
        timestamp: new Date()
      };
      
      const result = await locationService.updateLocation(
        'user-id', 
        'delivery-id', 
        locationData
      );
      
      expect(result.status).toBe('updated');
      expect(result.locationId).toBeDefined();
    });
  });
});
```

## 📊 Monitoring

### Metrics Collection

The service collects comprehensive metrics:

- **System Metrics**: Memory, CPU, uptime
- **API Metrics**: Request/response times, status codes
- **Database Metrics**: Query performance, connection pool
- **Location Metrics**: Update frequency, accuracy distribution
- **Geofence Metrics**: Event rates, processing times

### Dashboards

Grafana dashboards for monitoring:
- Service overview
- Location tracking performance
- Geofence activity
- Emergency incidents
- System resource usage

### Alerting

Automated alerts for:
- Service downtime
- High error rates
- Performance degradation
- Critical emergencies
- Resource exhaustion

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Guidelines

- Follow the existing code style
- Write comprehensive tests
- Document new features
- Use meaningful commit messages
- Update documentation as needed

### Issue Reporting

When reporting issues, please include:
- Environment details
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review existing issues and discussions

---

**Location Service** - Real-time location tracking and geospatial services for modern delivery platforms.

Built with ❤️ using Node.js, PostGIS, Redis, and Socket.IO.