# Location Service - Detailed Architecture

## 🏗️ Service Overview

The Location Service provides real-time GPS tracking, geofencing, route optimization, and location-based services for the P2P Delivery Platform. It enables accurate tracking of deliveries, emergency location services, and privacy-controlled location sharing.

**Port:** 3008  
**Base URL:** `/api/v1/location`  
**Database:** `location_db` (PostgreSQL with PostGIS)

## 🎯 Core Responsibilities

### Primary Functions
- **Real-time GPS Tracking**: Continuous location tracking with offline sync
- **Geofencing**: Automated detection of pickup/delivery zone entry/exit
- **Route Optimization**: Intelligent routing with traffic integration
- **Emergency Services**: Critical location services for safety
- **Privacy Controls**: User-controlled location sharing and data retention
- **Location Analytics**: Movement patterns and delivery insights
- **Battery Optimization**: Efficient tracking algorithms to preserve device battery

### Key Features
- **High-Precision Tracking**: Sub-meter accuracy with multiple positioning sources
- **Offline Capability**: Store and sync location data when connectivity returns
- **Smart Geofencing**: Dynamic geofences with contextual triggers
- **Privacy-First Design**: Granular privacy controls and automatic data expiry
- **Emergency Integration**: Automatic emergency service integration
- **Performance Optimization**: Battery-aware tracking with adaptive intervals

## 🗄️ Database Schema

### Core Tables

#### 1. Location Tracking Table
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
    
    battery_level INTEGER,
    network_type VARCHAR(20),
    
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Geofences Table
```sql
CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type geofence_type_enum NOT NULL,
    delivery_id UUID,
    
    geometry_type geometry_type_enum NOT NULL,
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

#### 3. Geofence Events Table
```sql
CREATE TABLE geofence_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    geofence_id UUID NOT NULL,
    user_id UUID NOT NULL,
    delivery_id UUID,
    event_type geofence_event_type_enum NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326),
    dwell_time INTEGER, -- seconds
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Route Optimizations Table
```sql
CREATE TABLE route_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID,
    origin_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    destination_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    waypoints JSONB, -- Array of waypoint coordinates
    
    optimized_route JSONB NOT NULL, -- Route segments and instructions
    total_distance DECIMAL(10,2) NOT NULL, -- km
    total_duration INTEGER NOT NULL, -- minutes
    total_detour DECIMAL(10,2) DEFAULT 0.00, -- km
    
    fuel_cost DECIMAL(8,2),
    toll_cost DECIMAL(8,2),
    
    traffic_conditions JSONB,
    alternatives JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);
```

#### 5. Emergency Locations Table
```sql
CREATE TABLE emergency_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    user_id UUID NOT NULL,
    emergency_type emergency_type_enum NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(8,2),
    
    description TEXT NOT NULL,
    contact_number VARCHAR(20),
    requires_assistance BOOLEAN DEFAULT FALSE,
    severity emergency_severity_enum NOT NULL,
    
    status emergency_status_enum NOT NULL DEFAULT 'reported',
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Enums
```sql
CREATE TYPE geofence_type_enum AS ENUM ('pickup', 'delivery', 'restricted', 'safe_zone');
CREATE TYPE geometry_type_enum AS ENUM ('circle', 'polygon');
CREATE TYPE geofence_event_type_enum AS ENUM ('enter', 'exit', 'dwell');
CREATE TYPE emergency_type_enum AS ENUM ('accident', 'breakdown', 'theft', 'medical', 'other');
CREATE TYPE emergency_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE emergency_status_enum AS ENUM ('reported', 'acknowledged', 'in_progress', 'resolved');
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js or Go for performance
const express = require('express');
const socketio = require('socket.io');
const turf = require('@turf/turf');
const geolib = require('geolib');
const bull = require('bull');
const moment = require('moment');
```

### Key Dependencies
- **Express.js/Go**: Web framework
- **Socket.io**: Real-time location streaming
- **PostGIS**: Advanced geospatial database functions
- **Turf.js**: Geospatial analysis and calculations
- **Geolib**: Distance and bearing calculations
- **Bull Queue**: Background job processing
- **Redis**: Real-time data caching and pub/sub
- **Google Maps/Mapbox**: Routing and geocoding APIs

### Geospatial Libraries
- **PostGIS**: Database-level geospatial operations
- **GEOS**: Geometric operations
- **PROJ**: Coordinate system transformations
- **GDAL**: Geospatial data processing

## 📊 API Endpoints (15 Total)

### Location Tracking Endpoints

#### 1. Start Location Tracking
```http
POST /api/v1/location/tracking/start
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "trackingSettings": {
    "interval": 30, // seconds
    "accuracy": "high", // low|medium|high
    "batteryOptimization": true,
    "backgroundTracking": true
  },
  "privacySettings": {
    "shareWithCustomer": true,
    "shareWithTraveler": true,
    "anonymizeAfterHours": 24
  }
}
```

#### 2. Update Location
```http
POST /api/v1/location/tracking/update
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 5.0,
    "altitude": 10.5,
    "bearing": 45.0,
    "speed": 25.5
  },
  "deviceInfo": {
    "batteryLevel": 85,
    "networkType": "wifi",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

#### 3. Batch Update Locations
```http
POST /api/v1/location/tracking/batch-update
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "locations": [
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "accuracy": 5.0,
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "latitude": 40.7130,
      "longitude": -74.0062,
      "accuracy": 4.0,
      "timestamp": "2025-01-15T10:31:00Z"
    }
  ]
}
```

#### 4. Stop Location Tracking
```http
POST /api/v1/location/tracking/stop
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "reason": "delivery_completed"
}
```

#### 5. Get Current Location
```http
GET /api/v1/location/current/:deliveryId
Authorization: Bearer <access_token>
```

#### 6. Get Location History
```http
GET /api/v1/location/history/:deliveryId
Authorization: Bearer <access_token>
Query Parameters:
- startTime: 2025-01-15T10:00:00Z
- endTime: 2025-01-15T12:00:00Z
- interval: 60 (seconds, for data sampling)
- format: geojson|coordinates
```

### Geofencing Endpoints

#### 7. Create Geofence
```http
POST /api/v1/location/geofences
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Pickup Location - 123 Main St",
  "type": "pickup",
  "deliveryId": "delivery-uuid",
  "geometry": {
    "type": "circle",
    "center": { "lat": 40.7128, "lng": -74.0060 },
    "radius": 100
  },
  "notifications": {
    "onEntry": true,
    "onExit": true,
    "onDwell": { "enabled": true, "duration": 300 }
  },
  "schedule": {
    "startTime": "2025-01-15T09:00:00Z",
    "endTime": "2025-01-15T18:00:00Z",
    "timezone": "America/New_York"
  }
}
```

#### 8. Get Active Geofences
```http
GET /api/v1/location/geofences/active
Authorization: Bearer <access_token>
Query Parameters:
- deliveryId: delivery-uuid
- type: pickup|delivery|safe_zone
- lat: 40.7128
- lng: -74.0060
- radius: 1000 (meters, search radius)
```

#### 9. Update Geofence
```http
PUT /api/v1/location/geofences/:geofenceId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "radius": 150,
  "notifications": {
    "onEntry": true,
    "onExit": false,
    "onDwell": { "enabled": false }
  }
}
```

#### 10. Delete Geofence
```http
DELETE /api/v1/location/geofences/:geofenceId
Authorization: Bearer <access_token>
```

### Route Optimization Endpoints

#### 11. Optimize Route
```http
POST /api/v1/location/routes/optimize
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "origin": { "lat": 40.7128, "lng": -74.0060 },
  "destination": { "lat": 42.3601, "lng": -71.0589 },
  "waypoints": [
    { "lat": 41.2033, "lng": -77.1945, "type": "pickup" },
    { "lat": 41.4993, "lng": -81.6944, "type": "delivery" }
  ],
  "preferences": {
    "optimize": "time", // time|distance|cost
    "avoidTolls": false,
    "avoidHighways": false,
    "departureTime": "2025-01-15T10:00:00Z"
  },
  "vehicle": {
    "type": "car",
    "fuelType": "gasoline",
    "fuelEfficiency": 25 // mpg
  }
}
```

#### 12. Get Route Traffic
```http
GET /api/v1/location/routes/:routeId/traffic
Authorization: Bearer <access_token>
```

### Emergency Services Endpoints

#### 13. Report Emergency
```http
POST /api/v1/location/emergency/report
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "emergencyType": "breakdown",
  "severity": "medium",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 3.0
  },
  "description": "Vehicle broke down on highway, need assistance",
  "contactNumber": "+1234567890",
  "requiresAssistance": true
}
```

#### 14. Update Emergency Status
```http
PUT /api/v1/location/emergency/:emergencyId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "in_progress",
  "notes": "Emergency services dispatched, ETA 15 minutes"
}
```

#### 15. Get Nearby Emergency Services
```http
GET /api/v1/location/emergency/services
Authorization: Bearer <access_token>
Query Parameters:
- lat: 40.7128
- lng: -74.0060
- radius: 5000 (meters)
- type: hospital|police|fire|tow
```

## 🏗️ Service Architecture

### Directory Structure
```
location-service/
├── src/
│   ├── controllers/
│   │   ├── trackingController.js
│   │   ├── geofenceController.js
│   │   ├── routeController.js
│   │   ├── emergencyController.js
│   │   └── analyticsController.js
│   ├── models/
│   │   ├── LocationTracking.js
│   │   ├── Geofence.js
│   │   ├── GeofenceEvent.js
│   │   ├── RouteOptimization.js
│   │   └── EmergencyLocation.js
│   ├── services/
│   │   ├── trackingService.js
│   │   ├── geofenceService.js
│   │   ├── routeOptimizationService.js
│   │   ├── emergencyService.js
│   │   ├── privacyService.js
│   │   └── batteryOptimizationService.js
│   ├── providers/
│   │   ├── googleMapsProvider.js
│   │   ├── mapboxProvider.js
│   │   └── emergencyServicesProvider.js
│   ├── realtime/
│   │   ├── locationStreaming.js
│   │   ├── geofenceMonitoring.js
│   │   └── emergencyAlerts.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── validationMiddleware.js
│   │   ├── privacyMiddleware.js
│   │   └── rateLimitMiddleware.js
│   ├── routes/
│   │   ├── trackingRoutes.js
│   │   ├── geofenceRoutes.js
│   │   ├── routeRoutes.js
│   │   └── emergencyRoutes.js
│   ├── utils/
│   │   ├── geoUtils.js
│   │   ├── routeUtils.js
│   │   ├── privacyUtils.js
│   │   └── batteryUtils.js
│   ├── jobs/
│   │   ├── locationCleanupJob.js
│   │   ├── geofenceMonitoringJob.js
│   │   └── emergencyResponseJob.js
│   ├── config/
│   │   ├── database.js
│   │   ├── maps.js
│   │   ├── realtime.js
│   │   └── privacy.js
│   └── app.js
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. Location Tracking Service
```javascript
class LocationTrackingService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.io = require('socket.io')(server);
    this.batteryOptimization = new BatteryOptimizationService();
    this.privacyService = new PrivacyService();
  }

  async startTracking(userId, deliveryId, settings) {
    // Validate tracking permissions
    await this.validateTrackingPermissions(userId, deliveryId);
    
    // Create tracking session
    const trackingSession = {
      userId,
      deliveryId,
      settings,
      startedAt: new Date(),
      isActive: true
    };

    // Store session in Redis for fast access
    await this.redis.setex(
      `tracking:${deliveryId}:${userId}`, 
      86400, // 24 hours
      JSON.stringify(trackingSession)
    );

    // Set up real-time room
    const roomName = `delivery:${deliveryId}`;
    
    // Notify connected clients about tracking start
    this.io.to(roomName).emit('tracking_started', {
      deliveryId,
      userId,
      settings: this.filterSettingsForPrivacy(settings, userId)
    });

    // Set up geofences for this delivery
    await this.setupDeliveryGeofences(deliveryId);

    return {
      trackingId: `${deliveryId}:${userId}`,
      settings: this.batteryOptimization.optimizeSettings(settings),
      geofences: await this.getActiveGeofences(deliveryId)
    };
  }

  async updateLocation(userId, deliveryId, locationData) {
    const trackingSession = await this.getTrackingSession(deliveryId, userId);
    
    if (!trackingSession || !trackingSession.isActive) {
      throw new TrackingNotActiveError('Location tracking is not active for this delivery');
    }

    // Validate location data
    const validatedLocation = this.validateLocationData(locationData);
    
    // Apply privacy filters
    const filteredLocation = await this.privacyService.filterLocationData(
      validatedLocation,
      trackingSession.settings.privacySettings
    );

    // Store in database
    const locationRecord = await this.locationRepository.create({
      deliveryId,
      userId,
      coordinates: `POINT(${validatedLocation.longitude} ${validatedLocation.latitude})`,
      accuracy: validatedLocation.accuracy,
      altitude: validatedLocation.altitude,
      bearing: validatedLocation.bearing,
      speed: validatedLocation.speed,
      batteryLevel: locationData.deviceInfo?.batteryLevel,
      networkType: locationData.deviceInfo?.networkType,
      timestamp: new Date(validatedLocation.timestamp)
    });

    // Cache current location in Redis
    await this.redis.setex(
      `current_location:${deliveryId}:${userId}`,
      300, // 5 minutes
      JSON.stringify(filteredLocation)
    );

    // Check geofences
    await this.checkGeofences(deliveryId, userId, validatedLocation);

    // Emit real-time update
    const roomName = `delivery:${deliveryId}`;
    this.io.to(roomName).emit('location_update', {
      deliveryId,
      userId,
      location: filteredLocation,
      timestamp: validatedLocation.timestamp
    });

    // Update tracking session with last update time
    trackingSession.lastUpdate = new Date();
    await this.redis.setex(
      `tracking:${deliveryId}:${userId}`,
      86400,
      JSON.stringify(trackingSession)
    );

    return {
      status: 'updated',
      locationId: locationRecord.id,
      geofenceEvents: await this.getRecentGeofenceEvents(deliveryId, userId)
    };
  }

  async batchUpdateLocations(userId, deliveryId, locations) {
    const trackingSession = await this.getTrackingSession(deliveryId, userId);
    
    if (!trackingSession || !trackingSession.isActive) {
      throw new TrackingNotActiveError('Location tracking is not active');
    }

    const results = [];
    
    // Process locations in chronological order
    const sortedLocations = locations.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (const locationData of sortedLocations) {
      try {
        const result = await this.updateLocation(userId, deliveryId, locationData);
        results.push({ success: true, locationId: result.locationId });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return {
      processed: locations.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  validateLocationData(locationData) {
    const { location } = locationData;
    
    // Basic validation
    if (!location.latitude || !location.longitude) {
      throw new ValidationError('Latitude and longitude are required');
    }

    // Range validation
    if (location.latitude < -90 || location.latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90');
    }

    if (location.longitude < -180 || location.longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180');
    }

    // Accuracy validation
    if (location.accuracy && location.accuracy < 0) {
      throw new ValidationError('Accuracy must be non-negative');
    }

    // Speed validation (reasonable limits)
    if (location.speed && (location.speed < 0 || location.speed > 300)) {
      throw new ValidationError('Speed must be between 0 and 300 km/h');
    }

    return location;
  }
}
```

#### 2. Geofence Service
```javascript
class GeofenceService {
  constructor() {
    this.turf = require('@turf/turf');
    this.eventEmitter = new EventEmitter();
  }

  async createGeofence(geofenceData) {
    const {
      name,
      type,
      deliveryId,
      geometry,
      notifications,
      schedule
    } = geofenceData;

    // Validate geometry
    this.validateGeometry(geometry);

    let geofence;
    
    if (geometry.type === 'circle') {
      geofence = await this.geofenceRepository.create({
        name,
        type,
        deliveryId,
        geometryType: 'circle',
        centerCoordinates: `POINT(${geometry.center.lng} ${geometry.center.lat})`,
        radius: geometry.radius,
        notifications,
        startTime: schedule?.startTime,
        endTime: schedule?.endTime,
        timezone: schedule?.timezone
      });
    } else if (geometry.type === 'polygon') {
      const polygonWKT = this.convertPolygonToWKT(geometry.coordinates);
      
      geofence = await this.geofenceRepository.create({
        name,
        type,
        deliveryId,
        geometryType: 'polygon',
        polygonCoordinates: polygonWKT,
        notifications,
        startTime: schedule?.startTime,
        endTime: schedule?.endTime,
        timezone: schedule?.timezone
      });
    }

    // Add to active monitoring
    await this.addToActiveMonitoring(geofence.id);

    return geofence;
  }

  async checkGeofences(deliveryId, userId, location) {
    // Get active geofences for this delivery
    const activeGeofences = await this.getActiveGeofences(deliveryId);
    
    const events = [];

    for (const geofence of activeGeofences) {
      const isInside = await this.isLocationInsideGeofence(location, geofence);
      const wasInside = await this.wasUserInsideGeofence(userId, geofence.id);
      
      let eventType = null;
      
      if (isInside && !wasInside) {
        eventType = 'enter';
      } else if (!isInside && wasInside) {
        eventType = 'exit';
      } else if (isInside && wasInside) {
        // Check for dwell event
        const dwellTime = await this.calculateDwellTime(userId, geofence.id);
        const dwellThreshold = geofence.notifications?.onDwell?.duration || 300;
        
        if (dwellTime >= dwellThreshold) {
          eventType = 'dwell';
        }
      }

      if (eventType) {
        const event = await this.createGeofenceEvent(
          geofence.id,
          userId,
          deliveryId,
          eventType,
          location
        );
        
        events.push(event);
        
        // Send notifications if enabled
        if (this.shouldSendNotification(geofence, eventType)) {
          await this.sendGeofenceNotification(geofence, event);
        }
      }

      // Update user's geofence status
      await this.updateUserGeofenceStatus(userId, geofence.id, isInside);
    }

    return events;
  }

  async isLocationInsideGeofence(location, geofence) {
    if (geofence.geometryType === 'circle') {
      const center = this.parseCoordinates(geofence.centerCoordinates);
      const distance = this.turf.distance(
        [location.longitude, location.latitude],
        [center.lng, center.lat],
        { units: 'meters' }
      );
      
      return distance <= geofence.radius;
    } else if (geofence.geometryType === 'polygon') {
      const polygon = this.parsePolygon(geofence.polygonCoordinates);
      const point = this.turf.point([location.longitude, location.latitude]);
      
      return this.turf.booleanPointInPolygon(point, polygon);
    }

    return false;
  }

  async createGeofenceEvent(geofenceId, userId, deliveryId, eventType, location) {
    const event = await this.geofenceEventRepository.create({
      geofenceId,
      userId,
      deliveryId,
      eventType,
      coordinates: `POINT(${location.longitude} ${location.latitude})`,
      triggeredAt: new Date()
    });

    // Emit event for real-time processing
    this.eventEmitter.emit('geofence_event', {
      event,
      geofenceId,
      userId,
      deliveryId,
      eventType,
      location
    });

    return event;
  }

  async sendGeofenceNotification(geofence, event) {
    const delivery = await this.deliveryRepository.findById(geofence.deliveryId);
    
    const notificationData = {
      type: 'geofence_event',
      geofenceName: geofence.name,
      eventType: event.eventType,
      deliveryId: geofence.deliveryId,
      deliveryNumber: delivery.deliveryNumber,
      location: {
        lat: event.coordinates.coordinates[1],
        lng: event.coordinates.coordinates[0]
      },
      timestamp: event.triggeredAt
    };

    // Notify relevant parties based on geofence type
    if (geofence.type === 'pickup') {
      await this.notificationService.sendGeofenceNotification(
        delivery.customerId,
        notificationData
      );
    } else if (geofence.type === 'delivery') {
      await this.notificationService.sendGeofenceNotification(
        delivery.customerId,
        notificationData
      );
    }

    // Always notify the traveler
    await this.notificationService.sendGeofenceNotification(
      delivery.travelerId,
      notificationData
    );
  }
}
```

#### 3. Route Optimization Service
```javascript
class RouteOptimizationService {
  constructor() {
    this.googleMaps = new GoogleMapsProvider();
    this.mapbox = new MapboxProvider();
    this.trafficService = new TrafficService();
  }

  async optimizeRoute(routeRequest) {
    const {
      origin,
      destination,
      waypoints = [],
      preferences = {},
      vehicle = {}
    } = routeRequest;

    // Get multiple route options from different providers
    const [googleRoute, mapboxRoute] = await Promise.allSettled([
      this.getGoogleRoute(origin, destination, waypoints, preferences),
      this.getMapboxRoute(origin, destination, waypoints, preferences)
    ]);

    // Select best route based on preferences and current conditions
    const bestRoute = await this.selectBestRoute([googleRoute, mapboxRoute], preferences);
    
    // Calculate additional metrics
    const routeMetrics = await this.calculateRouteMetrics(bestRoute, vehicle);
    
    // Get real-time traffic data
    const trafficData = await this.trafficService.getTrafficData(bestRoute);
    
    // Store optimization result
    const optimization = await this.routeOptimizationRepository.create({
      originCoordinates: `POINT(${origin.lng} ${origin.lat})`,
      destinationCoordinates: `POINT(${destination.lng} ${destination.lat})`,
      waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng, type: wp.type })),
      optimizedRoute: bestRoute,
      totalDistance: routeMetrics.distance,
      totalDuration: routeMetrics.duration,
      totalDetour: routeMetrics.detour,
      fuelCost: routeMetrics.fuelCost,
      tollCost: routeMetrics.tollCost,
      trafficConditions: trafficData,
      alternatives: this.generateAlternatives([googleRoute, mapboxRoute], bestRoute),
      expiresAt: moment().add(1, 'hour').toDate()
    });

    return {
      optimizationId: optimization.id,
      route: bestRoute,
      metrics: routeMetrics,
      traffic: trafficData,
      alternatives: optimization.alternatives,
      recommendations: await this.generateRouteRecommendations(bestRoute, trafficData)
    };
  }

  async getGoogleRoute(origin, destination, waypoints, preferences) {
    const waypointStrings = waypoints.map(wp => `${wp.lat},${wp.lng}`);
    
    const request = {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      waypoints: waypointStrings,
      optimize: true,
      mode: 'driving',
      departure_time: preferences.departureTime ? 
        moment(preferences.departureTime).unix() : 'now',
      traffic_model: 'best_guess',
      avoid: this.buildAvoidanceString(preferences)
    };

    const response = await this.googleMaps.getDirections(request);
    return this.parseGoogleRoute(response.data.routes[0]);
  }

  async getMapboxRoute(origin, destination, waypoints, preferences) {
    const coordinates = [
      [origin.lng, origin.lat],
      ...waypoints.map(wp => [wp.lng, wp.lat]),
      [destination.lng, destination.lat]
    ];

    const request = {
      coordinates,
      profile: 'driving-traffic',
      geometries: 'geojson',
      overview: 'full',
      steps: true,
      annotations: ['duration', 'distance', 'speed'],
      exclude: this.buildMapboxExclusions(preferences)
    };

    const response = await this.mapbox.getDirections(request);
    return this.parseMapboxRoute(response.body.routes[0]);
  }

  async selectBestRoute(routes, preferences) {
    const validRoutes = routes
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    if (validRoutes.length === 0) {
      throw new NoRouteFoundError('No valid routes found');
    }

    // Score routes based on preferences
    const scoredRoutes = validRoutes.map(route => ({
      route,
      score: this.scoreRoute(route, preferences)
    }));

    // Return highest scoring route
    return scoredRoutes
      .sort((a, b) => b.score - a.score)[0]
      .route;
  }

  scoreRoute(route, preferences) {
    let score = 0;
    
    // Time optimization
    if (preferences.optimize === 'time') {
      score += (1 / route.duration) * 1000;
    }
    
    // Distance optimization
    if (preferences.optimize === 'distance') {
      score += (1 / route.distance) * 100;
    }
    
    // Cost optimization
    if (preferences.optimize === 'cost') {
      const estimatedCost = route.tollCost + (route.distance * 0.1); // $0.10 per km
      score += (1 / estimatedCost) * 10;
    }
    
    // Traffic consideration
    if (route.trafficDelay) {
      score -= route.trafficDelay / 60; // Penalty for traffic delays
    }
    
    // Road quality (fewer turns preferred)
    score -= route.steps.length * 0.1;
    
    return score;
  }

  async calculateRouteMetrics(route, vehicle) {
    const distance = route.distance / 1000; // Convert to km
    const duration = route.duration / 60; // Convert to minutes
    
    // Calculate fuel cost
    let fuelCost = 0;
    if (vehicle.fuelEfficiency) {
      const fuelNeeded = distance / (vehicle.fuelEfficiency * 1.60934); // Convert MPG to KM/L
      const fuelPrice = await this.getFuelPrice(vehicle.fuelType || 'gasoline');
      fuelCost = fuelNeeded * fuelPrice;
    }
    
    // Calculate toll cost (if route includes toll roads)
    const tollCost = await this.calculateTollCost(route);
    
    return {
      distance,
      duration,
      detour: 0, // Would be calculated if comparing to direct route
      fuelCost,
      tollCost,
      estimatedCO2: this.calculateCO2Emissions(distance, vehicle)
    };
  }
}
```

#### 4. Emergency Service
```javascript
class EmergencyService {
  constructor() {
    this.emergencyProviders = new EmergencyProvidersService();
    this.notificationService = new NotificationService();
  }

  async reportEmergency(userId, emergencyData) {
    const {
      deliveryId,
      emergencyType,
      severity,
      location,
      description,
      contactNumber,
      requiresAssistance
    } = emergencyData;

    // Create emergency record
    const emergency = await this.emergencyRepository.create({
      deliveryId,
      userId,
      emergencyType,
      coordinates: `POINT(${location.lng} ${location.lat})`,
      accuracy: location.accuracy,
      description,
      contactNumber,
      requiresAssistance,
      severity,
      status: 'reported'
    });

    // Get delivery details for context
    const delivery = await this.deliveryRepository.findById(deliveryId);

    // Immediate notifications based on severity
    if (severity === 'critical' || severity === 'high') {
      // Notify emergency services immediately
      await this.notifyEmergencyServices(emergency, delivery);
      
      // Notify platform administrators
      await this.notifyAdministrators(emergency, delivery);
    }

    // Notify relevant parties
    await this.notifyRelevantParties(emergency, delivery);

    // Find nearby emergency services
    const nearbyServices = await this.findNearbyEmergencyServices(
      location,
      emergencyType
    );

    // Start monitoring the emergency
    await this.startEmergencyMonitoring(emergency.id);

    return {
      emergencyId: emergency.id,
      status: 'reported',
      nearbyServices,
      estimatedResponseTime: this.estimateResponseTime(location, emergencyType),
      emergencyNumber: this.getEmergencyNumber(location.country || 'US')
    };
  }

  async findNearbyEmergencyServices(location, emergencyType) {
    const searchRadius = 10000; // 10km
    
    const serviceTypes = this.getServiceTypesForEmergency(emergencyType);
    const services = [];

    for (const serviceType of serviceTypes) {
      const nearbyServices = await this.emergencyProviders.findNearbyServices(
        location,
        serviceType,
        searchRadius
      );
      
      services.push(...nearbyServices.map(service => ({
        ...service,
        distance: this.geoUtils.calculateDistance(location, service.location),
        estimatedArrival: this.estimateArrivalTime(location, service.location)
      })));
    }

    // Sort by distance and return top 5
    return services
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }

  getServiceTypesForEmergency(emergencyType) {
    const serviceMap = {
      accident: ['hospital', 'police', 'tow'],
      breakdown: ['tow', 'mechanic'],
      theft: ['police'],
      medical: ['hospital', 'ambulance'],
      other: ['police', 'hospital']
    };

    return serviceMap[emergencyType] || ['police'];
  }

  async notifyEmergencyServices(emergency, delivery) {
    // This would integrate with local emergency service APIs
    // For now, we'll log and send to admin monitoring
    
    console.log('CRITICAL EMERGENCY REPORTED:', {
      emergencyId: emergency.id,
      type: emergency.emergencyType,
      severity: emergency.severity,
      location: emergency.coordinates,
      deliveryId: delivery.id,
      deliveryNumber: delivery.deliveryNumber
    });

    // In a real implementation, this would:
    // 1. Call local emergency services API
    // 2. Send automated alert to emergency dispatch
    // 3. Provide delivery and user context
    
    await this.notificationService.sendCriticalAlert('emergency_services', {
      emergency,
      delivery,
      message: `Critical emergency reported: ${emergency.emergencyType} - ${emergency.description}`
    });
  }

  async startEmergencyMonitoring(emergencyId) {
    // Set up automated monitoring and follow-up
    const monitoringJob = await this.emergencyQueue.add('monitor_emergency', {
      emergencyId
    }, {
      repeat: { every: 300000 }, // Every 5 minutes
      removeOnComplete: false
    });

    // Schedule automatic escalation if not resolved
    await this.emergencyQueue.add('escalate_emergency', {
      emergencyId
    }, {
      delay: 1800000 // 30 minutes
    });

    return monitoringJob.id;
  }

  async updateEmergencyStatus(emergencyId, statusUpdate) {
    const { status, notes, resolvedBy } = statusUpdate;
    
    const emergency = await this.emergencyRepository.update(emergencyId, {
      status,
      resolutionNotes: notes,
      resolvedAt: status === 'resolved' ? new Date() : null
    });

    // Notify relevant parties of status change
    const delivery = await this.deliveryRepository.findById(emergency.deliveryId);
    
    await this.notificationService.sendEmergencyStatusUpdate(
      [delivery.customerId, delivery.travelerId],
      emergency,
      statusUpdate
    );

    // If resolved, stop monitoring
    if (status === 'resolved') {
      await this.stopEmergencyMonitoring(emergencyId);
    }

    return emergency;
  }
}
```

#### 5. Privacy Service
```javascript
class PrivacyService {
  async filterLocationData(locationData, privacySettings) {
    const {
      shareWithCustomer = true,
      shareWithTraveler = true,
      accuracyLevel = 'high',
      anonymizeAfterHours = 24
    } = privacySettings;

    let filteredLocation = { ...locationData };

    // Apply accuracy filtering
    if (accuracyLevel === 'low') {
      filteredLocation = this.reduceAccuracy(filteredLocation, 100); // 100m accuracy
    } else if (accuracyLevel === 'medium') {
      filteredLocation = this.reduceAccuracy(filteredLocation, 10); // 10m accuracy
    }
    // 'high' accuracy uses original data

    // Remove sensitive metadata
    delete filteredLocation.deviceInfo;
    delete filteredLocation.batteryLevel;
    delete filteredLocation.networkType;

    return filteredLocation;
  }

  reduceAccuracy(location, targetAccuracy) {
    // Add random offset to reduce precision
    const offsetDistance = targetAccuracy / 111000; // Convert meters to degrees (approximate)
    const randomAngle = Math.random() * 2 * Math.PI;
    const randomDistance = Math.random() * offsetDistance;

    return {
      ...location,
      latitude: location.latitude + (Math.cos(randomAngle) * randomDistance),
      longitude: location.longitude + (Math.sin(randomAngle) * randomDistance),
      accuracy: Math.max(location.accuracy || 0, targetAccuracy)
    };
  }

  async scheduleDataAnonymization(deliveryId, hoursDelay) {
    await this.dataCleanupQueue.add('anonymize_location_data', {
      deliveryId
    }, {
      delay: hoursDelay * 60 * 60 * 1000 // Convert hours to milliseconds
    });
  }

  async anonymizeLocationData(deliveryId) {
    // Remove personally identifiable location data
    await this.locationRepository.anonymizeByDeliveryId(deliveryId);
    
    // Keep aggregated, non-identifiable data for analytics
    const summary = await this.createLocationSummary(deliveryId);
    await this.locationSummaryRepository.create(summary);
  }
}
```

## 🔐 Privacy & Security

### 1. Location Data Protection
```javascript
class LocationSecurityService {
  async encryptSensitiveLocation(locationData) {
    const sensitiveFields = ['coordinates', 'accuracy', 'altitude'];
    const encrypted = { ...locationData };
    
    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = await this.encrypt(JSON.stringify(encrypted[field]));
      }
    }
    
    return encrypted;
  }

  async validateLocationPermissions(userId, deliveryId, action) {
    const delivery = await this.deliveryRepository.findById(deliveryId);
    const userRole = this.getUserRole(userId, delivery);
    
    const permissions = {
      track: ['customer', 'traveler'],
      view_history: ['customer', 'traveler', 'admin'],
      export_data: ['customer', 'traveler'],
      emergency_access: ['admin', 'emergency_services']
    };
    
    return permissions[action]?.includes(userRole) || false;
  }
}
```

### 2. Data Retention Policies
```javascript
class DataRetentionService {
  async applyRetentionPolicies() {
    // Delete location data older than 90 days
    await this.locationRepository.deleteOlderThan(90, 'days');
    
    // Anonymize data older than 30 days
    const oldDeliveries = await this.deliveryRepository.findCompletedOlderThan(30, 'days');
    
    for (const delivery of oldDeliveries) {
      await this.privacyService.anonymizeLocationData(delivery.id);
    }
  }
}
```

## 📈 Performance Optimization

### 1. Location Data Indexing
```sql
-- Geospatial indexes for fast location queries
CREATE INDEX idx_location_tracking_coordinates ON location_tracking USING GIST(coordinates);
CREATE INDEX idx_location_tracking_delivery_time ON location_tracking(delivery_id, timestamp);
CREATE INDEX idx_location_tracking_user_time ON location_tracking(user_id, timestamp);

-- Geofence indexes
CREATE INDEX idx_geofences_center ON geofences USING GIST(center_coordinates);
CREATE INDEX idx_geofences_polygon ON geofences USING GIST(polygon_coordinates);
CREATE INDEX idx_geofences_delivery_active ON geofences(delivery_id, active) WHERE active = true;

-- Emergency location indexes
CREATE INDEX idx_emergency_locations_coordinates ON emergency_locations USING GIST(coordinates);
CREATE INDEX idx_emergency_locations_status ON emergency_locations(status, created_at);
```

### 2. Real-time Optimization
```javascript
class LocationCacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async cacheCurrentLocation(deliveryId, userId, location) {
    const key = `location:current:${deliveryId}:${userId}`;
    await this.redis.setex(key, 300, JSON.stringify(location)); // 5 min cache
  }

  async getCachedLocation(deliveryId, userId) {
    const key = `location:current:${deliveryId}:${userId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheGeofenceChecks(userId, geofenceId, isInside) {
    const key = `geofence:status:${userId}:${geofenceId}`;
    await this.redis.setex(key, 60, isInside.toString()); // 1 min cache
  }
}
```

## 🧪 Testing Strategy

### 1. Geospatial Testing
```javascript
describe('GeofenceService', () => {
  describe('isLocationInsideGeofence', () => {
    it('should detect when location is inside circular geofence', async () => {
      const geofence = {
        geometryType: 'circle',
        centerCoordinates: 'POINT(-74.0060 40.7128)',
        radius: 100
      };
      
      const location = { latitude: 40.7128, longitude: -74.0060 };
      
      const isInside = await geofenceService.isLocationInsideGeofence(location, geofence);
      expect(isInside).toBe(true);
    });
  });
});
```

### 2. Performance Testing
```javascript
describe('Location Tracking Performance', () => {
  it('should handle high-frequency location updates', async () => {
    const startTime = Date.now();
    const locations = generateTestLocations(1000);
    
    for (const location of locations) {
      await trackingService.updateLocation('user-id', 'delivery-id', location);
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **Location Update**: < 100ms average response time
- **Geofence Check**: < 50ms average response time
- **Route Optimization**: < 2s for complex routes
- **Real-time Streaming**: < 50ms latency
- **Emergency Response**: < 10s for critical alerts
- **Throughput**: 10,000+ location updates/second per instance

This Location Service architecture provides comprehensive real-time tracking, intelligent geofencing, and privacy-controlled location services for the P2P Delivery Platform.