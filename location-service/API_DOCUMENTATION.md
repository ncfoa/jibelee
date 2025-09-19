# Location Service API Documentation

## Overview

The Location Service provides comprehensive real-time location tracking, geofencing, route optimization, and emergency services for P2P delivery platforms. This document covers all API endpoints, request/response formats, and usage examples.

## Base URL

```
http://localhost:3008/api/v1/location
```

## Authentication

All API endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": [
    {
      "field": "fieldName",
      "message": "Field-specific error message"
    }
  ]
}
```

## Endpoints

### 1. Location Tracking

#### Start/Update Location Tracking
Track location updates for a delivery in real-time.

**Endpoint:** `POST /track`

**Request Body:**
```json
{
  "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
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
  "networkType": "wifi",
  "deviceInfo": {
    "platform": "ios",
    "appVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trackingId": "track_123456",
    "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "tracking_active",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060,
      "accuracy": 10,
      "timestamp": "2025-02-01T12:00:00Z"
    },
    "route": {
      "progress": 35.5,
      "remainingDistance": 198.5,
      "estimatedArrival": "2025-02-01T14:30:00Z"
    },
    "notifications": {
      "customerNotified": true,
      "milestoneReached": "halfway_point"
    }
  }
}
```

#### Get Current Location
Retrieve the most recent location for a delivery.

**Endpoint:** `GET /current/{deliveryId}`

**Path Parameters:**
- `deliveryId` (string, required): UUID of the delivery

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
    "traveler": {
      "id": "user_123",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "currentLocation": {
      "lat": 41.2033,
      "lng": -77.1945,
      "accuracy": 15,
      "timestamp": "2025-02-01T12:30:00Z",
      "address": "Somewhere on I-80, Pennsylvania"
    },
    "route": {
      "totalDistance": 306,
      "remainingDistance": 165.5,
      "progress": 45.9,
      "estimatedArrival": "2025-02-01T14:15:00Z",
      "delayStatus": "on_time",
      "delayMinutes": 0
    },
    "status": "in_transit",
    "lastUpdate": "2025-02-01T12:30:00Z",
    "batteryLevel": 78,
    "networkStatus": "good"
  }
}
```

#### Get Location History
Retrieve historical location data for a delivery.

**Endpoint:** `GET /history/{deliveryId}`

**Path Parameters:**
- `deliveryId` (string, required): UUID of the delivery

**Query Parameters:**
- `from` (string, optional): Start timestamp (ISO 8601)
- `to` (string, optional): End timestamp (ISO 8601)
- `interval` (string, optional): Data point interval (1m|5m|15m|1h)
- `format` (string, optional): Response format (json|gpx|kml)

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
    "trackingPeriod": {
      "start": "2025-02-01T11:00:00Z",
      "end": "2025-02-01T14:00:00Z",
      "duration": "3 hours"
    },
    "route": {
      "totalDistance": 306,
      "actualDistance": 312.5,
      "averageSpeed": 85.2,
      "maxSpeed": 120.5,
      "stops": 2,
      "totalStopTime": "15 minutes"
    },
    "locations": [
      {
        "lat": 40.7128,
        "lng": -74.0060,
        "timestamp": "2025-02-01T11:00:00Z",
        "accuracy": 8,
        "speed": 0,
        "event": "pickup_location"
      }
    ],
    "milestones": [
      {
        "type": "pickup_completed",
        "timestamp": "2025-02-01T11:05:00Z",
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        }
      }
    ]
  }
}
```

#### Search Available Travelers
Find nearby travelers available for deliveries.

**Endpoint:** `GET /travelers/nearby`

**Query Parameters:**
- `lat` (number, required): Latitude
- `lng` (number, required): Longitude
- `radius` (number, optional): Search radius in km (default: 50)
- `destination` (string, optional): Destination filter
- `departureTimeFrom` (string, optional): Departure time range start
- `departureTimeTo` (string, optional): Departure time range end
- `minRating` (number, optional): Minimum traveler rating
- `capacity` (number, optional): Required capacity (weight in kg)
- `limit` (number, optional): Maximum results (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "searchCriteria": {
      "center": {
        "lat": 40.7128,
        "lng": -74.0060
      },
      "radius": 50,
      "filters": {
        "minRating": 4.0,
        "capacity": 2.5
      }
    },
    "travelers": [
      {
        "id": "traveler_uuid",
        "user": {
          "firstName": "Jane",
          "lastName": "Doe",
          "profilePicture": "https://cdn.example.com/pic.jpg",
          "rating": {
            "average": 4.8,
            "count": 156
          }
        },
        "trip": {
          "id": "trip_uuid",
          "title": "NYC to Boston Flight",
          "type": "flight",
          "departureTime": "2025-02-01T15:00:00Z",
          "arrivalTime": "2025-02-01T16:30:00Z"
        },
        "location": {
          "current": {
            "lat": 40.7589,
            "lng": -73.9851,
            "address": "Manhattan, NY",
            "lastUpdate": "2025-02-01T12:00:00Z"
          },
          "pickup": {
            "lat": 40.7128,
            "lng": -74.0060,
            "address": "Financial District, NY"
          },
          "destination": {
            "lat": 42.3601,
            "lng": -71.0589,
            "address": "Boston, MA"
          }
        },
        "distance": {
          "fromSearchCenter": 4.2,
          "routeMatch": 98.5
        },
        "capacity": {
          "available": {
            "weight": 3.5,
            "volume": 8,
            "items": 2
          }
        },
        "pricing": {
          "estimatedPrice": 28.50,
          "priceRange": {
            "min": 25.00,
            "max": 35.00
          }
        },
        "status": "available",
        "responseTime": "2.5 hours average"
      }
    ],
    "summary": {
      "totalFound": 12,
      "averageDistance": 15.2,
      "averagePrice": 32.50,
      "availableCapacity": 45.5
    }
  }
}
```

### 2. Geofencing

#### Create Geofence
Create a new geographical boundary with notification rules.

**Endpoint:** `POST /geofence`

**Request Body:**
```json
{
  "name": "Pickup Zone - Central Park",
  "type": "pickup",
  "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
  "geometry": {
    "type": "circle",
    "center": {
      "lat": 40.7829,
      "lng": -73.9654
    },
    "radius": 200
  },
  "notifications": {
    "onEntry": true,
    "onExit": true,
    "onDwell": {
      "enabled": true,
      "duration": 300
    }
  },
  "schedule": {
    "startTime": "2025-02-01T09:00:00Z",
    "endTime": "2025-02-01T18:00:00Z",
    "timezone": "America/New_York"
  },
  "metadata": {
    "description": "Pickup zone for Central Park deliveries",
    "instructions": "Meet at the main entrance"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "geofenceId": "geofence_uuid",
    "name": "Pickup Zone - Central Park",
    "type": "pickup",
    "status": "active",
    "geometry": {
      "type": "circle",
      "center": {
        "lat": 40.7829,
        "lng": -73.9654
      },
      "radius": 200
    },
    "createdAt": "2025-02-01T10:00:00Z",
    "expiresAt": "2025-02-01T18:00:00Z"
  }
}
```

#### Get Active Geofences
Retrieve active geofences for a delivery or location.

**Endpoint:** `GET /geofences/active`

**Query Parameters:**
- `deliveryId` (string, optional): Filter by delivery ID
- `type` (string, optional): Filter by type (pickup|delivery|restricted|safe_zone)
- `lat` (number, optional): Latitude for proximity search
- `lng` (number, optional): Longitude for proximity search
- `radius` (number, optional): Search radius in meters (default: 5000)

**Response:**
```json
{
  "success": true,
  "data": {
    "geofences": [
      {
        "id": "geofence_uuid",
        "name": "Pickup Zone - Central Park",
        "type": "pickup",
        "geometry": {
          "type": "circle",
          "center": {
            "lat": 40.7829,
            "lng": -73.9654
          },
          "radius": 200
        },
        "notifications": {
          "onEntry": true,
          "onExit": true,
          "onDwell": {
            "enabled": true,
            "duration": 300
          }
        },
        "active": true,
        "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
        "distance": 150.5
      }
    ],
    "total": 1
  }
}
```

#### Check Geofence Status
Check if a location is within specified geofences.

**Endpoint:** `POST /geofence/check`

**Request Body:**
```json
{
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "geofences": [
    {
      "id": "pickup_zone",
      "center": {
        "lat": 40.7130,
        "lng": -74.0062
      },
      "radius": 100,
      "type": "pickup"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "geofenceStatus": [
      {
        "geofenceId": "pickup_zone",
        "status": "inside",
        "distance": 25.5,
        "type": "pickup",
        "enteredAt": "2025-02-01T11:28:00Z",
        "dwellTime": "2 minutes"
      }
    ],
    "nearbyPois": [
      {
        "name": "Central Park",
        "type": "park",
        "distance": 1.2,
        "location": {
          "lat": 40.7829,
          "lng": -73.9654
        }
      }
    ]
  }
}
```

### 3. Route Optimization

#### Optimize Route
Calculate optimal route with waypoints and preferences.

**Endpoint:** `POST /route/optimize`

**Request Body:**
```json
{
  "origin": {
    "lat": 40.7128,
    "lng": -74.0060,
    "address": "New York, NY"
  },
  "destination": {
    "lat": 42.3601,
    "lng": -71.0589,
    "address": "Boston, MA"
  },
  "waypoints": [
    {
      "lat": 40.9176,
      "lng": -74.1718,
      "type": "pickup",
      "timeWindow": {
        "start": "2025-02-01T11:00:00Z",
        "end": "2025-02-01T12:00:00Z"
      },
      "duration": 10
    }
  ],
  "preferences": {
    "avoidTolls": false,
    "avoidHighways": false,
    "optimize": "time",
    "vehicleType": "car"
  },
  "constraints": {
    "maxDetour": 20,
    "maxTimeIncrease": 30
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizedRoute": {
      "totalDistance": 315.2,
      "totalDuration": 195,
      "totalDetour": 9.2,
      "fuelCost": 25.50,
      "tollCost": 8.75
    },
    "segments": [
      {
        "from": {
          "lat": 40.7128,
          "lng": -74.0060,
          "address": "New York, NY"
        },
        "to": {
          "lat": 40.9176,
          "lng": -74.1718,
          "address": "Newark, NJ"
        },
        "distance": 18.5,
        "duration": 25,
        "instructions": "Take I-95 North towards Newark"
      }
    ],
    "waypoints": [
      {
        "lat": 40.9176,
        "lng": -74.1718,
        "type": "pickup",
        "estimatedArrival": "2025-02-01T11:25:00Z",
        "estimatedDeparture": "2025-02-01T11:35:00Z",
        "address": "Newark, NJ"
      }
    ],
    "alternatives": [
      {
        "name": "Fastest Route",
        "distance": 306.0,
        "duration": 180,
        "savings": {
          "time": "15 minutes",
          "distance": "9.2 km"
        }
      }
    ],
    "polyline": "encoded_polyline_string",
    "bbox": {
      "north": 42.4,
      "south": 40.7,
      "east": -71.0,
      "west": -74.2
    }
  }
}
```

#### Get Traffic Information
Retrieve real-time traffic data for a route.

**Endpoint:** `GET /traffic`

**Query Parameters:**
- `route` (string, optional): Encoded route polyline
- `origin` (string, optional): Origin coordinates (lat,lng)
- `destination` (string, optional): Destination coordinates (lat,lng)
- `departureTime` (string, optional): Departure time (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "origin": "New York, NY",
      "destination": "Boston, MA",
      "distance": 306.0
    },
    "traffic": {
      "overall": "moderate",
      "duration": {
        "normal": 180,
        "current": 195,
        "delay": 15
      },
      "incidents": [
        {
          "type": "accident",
          "severity": "moderate",
          "location": {
            "lat": 41.0534,
            "lng": -73.5387,
            "description": "I-95 North near Stamford, CT"
          },
          "delay": 8,
          "lanesBlocked": 1,
          "estimatedClearTime": "2025-02-01T13:30:00Z"
        }
      ],
      "segments": [
        {
          "name": "I-95 North",
          "distance": 156.2,
          "normalTime": 90,
          "currentTime": 98,
          "trafficLevel": "moderate",
          "averageSpeed": 95.5
        }
      ]
    },
    "alternatives": [
      {
        "name": "Via I-84",
        "distance": 325.5,
        "duration": 185,
        "trafficLevel": "light",
        "tollCost": 12.50
      }
    ],
    "lastUpdated": "2025-02-01T12:00:00Z"
  }
}
```

### 4. Emergency Services

#### Report Emergency
Report an emergency incident with location context.

**Endpoint:** `POST /emergency`

**Request Body:**
```json
{
  "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
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

**Response:**
```json
{
  "success": true,
  "data": {
    "emergencyId": "emergency_uuid",
    "status": "reported",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060,
      "address": "I-95 North, Mile Marker 23"
    },
    "nearestServices": [
      {
        "type": "tow_service",
        "name": "AAA Roadside Assistance",
        "distance": 2.5,
        "phone": "+1800555HELP",
        "eta": "25 minutes"
      },
      {
        "type": "hospital",
        "name": "General Hospital",
        "distance": 8.2,
        "phone": "+1234567890",
        "eta": "15 minutes"
      }
    ],
    "notifications": {
      "customerNotified": true,
      "adminNotified": true,
      "emergencyContactsNotified": false
    },
    "caseNumber": "EMG-2025-001234",
    "supportContact": "+1800SUPPORT"
  }
}
```

#### Get Nearby Emergency Services
Find emergency services near a location.

**Endpoint:** `GET /emergency/services`

**Query Parameters:**
- `lat` (number, required): Latitude
- `lng` (number, required): Longitude
- `radius` (number, optional): Search radius in meters (default: 10000)
- `type` (string, optional): Service type (hospital|police|fire|tow)

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "radius": 10000,
    "services": [
      {
        "type": "hospital",
        "name": "General Hospital",
        "location": {
          "lat": 40.7200,
          "lng": -74.0100
        },
        "phone": "+1234567890",
        "specialties": ["emergency", "trauma"],
        "availability": "24/7",
        "distance": 1.2,
        "eta": "8 minutes"
      }
    ],
    "total": 1
  }
}
```

### 5. Geocoding Services

#### Forward/Reverse Geocoding
Convert between addresses and coordinates.

**Endpoint:** `GET /geocode`

**Query Parameters:**
- `address` (string, conditional): Address to geocode (for forward geocoding)
- `lat` (number, conditional): Latitude (for reverse geocoding)
- `lng` (number, conditional): Longitude (for reverse geocoding)
- `type` (string, required): Type (forward|reverse)
- `country` (string, optional): Country code filter
- `limit` (number, optional): Maximum results (default: 5)

**Forward Geocoding Request:**
```http
GET /geocode?type=forward&address=123 Main St, New York, NY&limit=5
```

**Reverse Geocoding Request:**
```http
GET /geocode?type=reverse&lat=40.7128&lng=-74.0060&limit=5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "123 Main St, New York, NY",
    "results": [
      {
        "formattedAddress": "123 Main St, New York, NY 10001, USA",
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "addressComponents": {
          "streetNumber": "123",
          "streetName": "Main St",
          "city": "New York",
          "state": "NY",
          "postalCode": "10001",
          "country": "USA",
          "countryCode": "US"
        },
        "placeId": "place_uuid",
        "confidence": 0.95,
        "accuracy": "rooftop",
        "types": ["street_address"]
      }
    ],
    "bounds": {
      "north": 40.7138,
      "south": 40.7118,
      "east": -74.0050,
      "west": -74.0070
    }
  }
}
```

### 6. Privacy Settings

#### Update Privacy Settings
Configure location sharing and data retention preferences.

**Endpoint:** `PUT /privacy`

**Request Body:**
```json
{
  "trackingLevel": "precise",
  "shareWith": {
    "customers": true,
    "platform": true,
    "emergencyContacts": true,
    "thirdParties": false
  },
  "dataRetention": {
    "period": 90,
    "deleteAfterDelivery": false
  },
  "anonymization": {
    "enabled": true,
    "delay": 24
  },
  "notifications": {
    "locationSharing": true,
    "dataUsage": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "privacySettings": {
      "trackingLevel": "precise",
      "shareWith": {
        "customers": true,
        "platform": true,
        "emergencyContacts": true,
        "thirdParties": false
      },
      "dataRetention": {
        "period": 90,
        "deleteAfterDelivery": false
      },
      "anonymization": {
        "enabled": true,
        "delay": 24
      }
    },
    "updatedAt": "2025-02-01T12:00:00Z",
    "effectiveImmediately": true
  }
}
```

### 7. Analytics

#### Get Location Analytics
Retrieve location tracking and performance analytics.

**Endpoint:** `GET /analytics`

**Query Parameters:**
- `period` (string, optional): Time period (day|week|month|quarter)
- `metric` (string, optional): Specific metric (accuracy|battery|coverage)
- `userId` (string, optional): Filter by user

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "week",
    "summary": {
      "totalDeliveries": 45,
      "averageAccuracy": 12.5,
      "trackingUptime": 98.2,
      "batteryUsage": {
        "average": 15,
        "optimized": true
      }
    },
    "accuracy": {
      "gps": {
        "average": 8.5,
        "best": 3.2,
        "worst": 25.0
      },
      "network": {
        "wifi": 5.2,
        "cellular": 12.8
      }
    },
    "coverage": {
      "urban": 99.1,
      "suburban": 96.8,
      "rural": 87.3,
      "indoor": 45.2
    },
    "performance": {
      "updateFrequency": "30 seconds average",
      "dataUsage": "2.5 MB per delivery",
      "batteryOptimization": "active"
    },
    "heatmap": {
      "popularRoutes": [
        {
          "route": "NYC → Boston",
          "frequency": 12,
          "averageAccuracy": 9.2
        }
      ],
      "problemAreas": [
        {
          "area": "Tunnel sections",
          "issue": "GPS signal loss",
          "frequency": 8
        }
      ]
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Access denied |
| `TRACKING_NOT_ACTIVE` | Location tracking not active |
| `GEOFENCE_ERROR` | Geofence operation failed |
| `LOCATION_ACCURACY_ERROR` | Location accuracy insufficient |
| `EMERGENCY_SERVICE_ERROR` | Emergency service operation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_SERVER_ERROR` | Server error |

## Rate Limits

- **Default**: 1000 requests per 15 minutes per IP
- **Location Updates**: 10 requests per second per user
- **Geofence Checks**: 100 requests per minute per user
- **Emergency Reports**: 5 requests per hour per user

## WebSocket Events

### Client Events

```javascript
// Join delivery room for real-time updates
socket.emit('join_delivery', deliveryId);

// Leave delivery room
socket.emit('leave_delivery', deliveryId);

// Send location update
socket.emit('location_update', {
  deliveryId: 'delivery_uuid',
  userId: 'user_uuid',
  location: { lat: 40.7128, lng: -74.0060 }
});
```

### Server Events

```javascript
// Location updated
socket.on('location_updated', (data) => {
  // { deliveryId, location, timestamp }
});

// Geofence event
socket.on('geofence_event', (data) => {
  // { geofenceId, eventType, deliveryId, timestamp }
});

// Tracking status changes
socket.on('tracking_started', (data) => {
  // { deliveryId, userId, sessionId }
});

socket.on('tracking_stopped', (data) => {
  // { deliveryId, userId, summary }
});
```

## SDKs and Libraries

### JavaScript/Node.js
```javascript
const LocationService = require('@p2p-delivery/location-service-client');

const client = new LocationService({
  baseUrl: 'http://localhost:3008/api/v1/location',
  apiKey: 'your-api-key'
});

// Track location
await client.trackLocation({
  deliveryId: 'delivery-123',
  location: { lat: 40.7128, lng: -74.0060 }
});
```

### Mobile (React Native)
```javascript
import LocationService from '@p2p-delivery/location-service-mobile';

const locationService = new LocationService({
  apiUrl: 'http://localhost:3008/api/v1/location',
  wsUrl: 'ws://localhost:3008'
});

// Start tracking
locationService.startTracking('delivery-123');
```

## Postman Collection

Import the Postman collection for easy API testing:

```json
{
  "info": {
    "name": "Location Service API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{jwt_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3008/api/v1/location"
    }
  ]
}
```

## Support

For API support:
- Check the [GitHub repository](https://github.com/p2p-delivery/location-service)
- Review the [documentation](https://docs.p2p-delivery.com/location-service)
- Create an issue for bug reports or feature requests