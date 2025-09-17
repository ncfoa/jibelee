# Location & Mapping Service API

Base URL: `/api/v1/location`

## Endpoints

### 1. Real-time Location Tracking

**POST** `/track`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "tripId": "trip_uuid", // Optional
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10, // meters
    "altitude": 15.5, // meters (optional)
    "bearing": 45.0, // degrees (optional)
    "speed": 25.5 // km/h (optional)
  },
  "timestamp": "2025-02-01T12:00:00Z",
  "batteryLevel": 85, // percentage (optional)
  "networkType": "wifi|cellular|offline", // optional
  "deviceInfo": {
    "platform": "ios|android",
    "appVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trackingId": "tracking_uuid",
    "deliveryId": "delivery_uuid",
    "status": "tracking_active",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060,
      "accuracy": 10,
      "timestamp": "2025-02-01T12:00:00Z"
    },
    "route": {
      "progress": 35.5, // percentage
      "remainingDistance": 198.5, // km
      "estimatedArrival": "2025-02-01T14:30:00Z"
    },
    "notifications": {
      "customerNotified": true,
      "milestoneReached": "halfway_point"
    }
  }
}
```

### 2. Get Current Location

**GET** `/current/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "delivery_uuid",
    "traveler": {
      "id": "traveler_uuid",
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
      "totalDistance": 306, // km
      "remainingDistance": 165.5,
      "progress": 45.9, // percentage
      "estimatedArrival": "2025-02-01T14:15:00Z",
      "delayStatus": "on_time|delayed|early",
      "delayMinutes": 0
    },
    "status": "in_transit",
    "lastUpdate": "2025-02-01T12:30:00Z",
    "batteryLevel": 78,
    "networkStatus": "good"
  }
}
```

### 3. Get Location History

**GET** `/history/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `from`: Start timestamp
- `to`: End timestamp
- `interval`: Data point interval (1m|5m|15m|1h)
- `format`: Response format (json|gpx|kml)

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "delivery_uuid",
    "trackingPeriod": {
      "start": "2025-02-01T11:00:00Z",
      "end": "2025-02-01T14:00:00Z",
      "duration": "3 hours"
    },
    "route": {
      "totalDistance": 306,
      "actualDistance": 312.5,
      "averageSpeed": 85.2, // km/h
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
      },
      {
        "lat": 40.7589,
        "lng": -73.9851,
        "timestamp": "2025-02-01T11:15:00Z",
        "accuracy": 12,
        "speed": 45.5,
        "event": "route_progress"
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
      },
      {
        "type": "state_border_crossed",
        "timestamp": "2025-02-01T12:30:00Z",
        "location": {
          "lat": 40.9176,
          "lng": -74.1718
        },
        "description": "Entered New Jersey"
      }
    ]
  }
}
```

### 4. Search Available Travelers

**GET** `/travelers/nearby`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `lat`: Latitude
- `lng`: Longitude
- `radius`: Search radius in km (default: 50)
- `destination`: Optional destination filter
- `departureTimeFrom`: Departure time range start
- `departureTimeTo`: Departure time range end
- `minRating`: Minimum traveler rating
- `capacity`: Required capacity (weight in kg)
- `limit`: Maximum results (default: 20)

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
          "fromSearchCenter": 4.2, // km
          "routeMatch": 98.5 // percentage match
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

### 5. Get Route Optimization

**POST** `/route/optimize`

**Headers:**
```
Authorization: Bearer <access_token>
```

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
      "type": "pickup|delivery|stop",
      "timeWindow": {
        "start": "2025-02-01T11:00:00Z",
        "end": "2025-02-01T12:00:00Z"
      },
      "duration": 10 // minutes
    }
  ],
  "preferences": {
    "avoidTolls": false,
    "avoidHighways": false,
    "optimize": "time|distance|fuel",
    "vehicleType": "car|truck|motorcycle"
  },
  "constraints": {
    "maxDetour": 20, // km
    "maxTimeIncrease": 30 // minutes
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizedRoute": {
      "totalDistance": 315.2, // km
      "totalDuration": 195, // minutes
      "totalDetour": 9.2, // km additional
      "fuelCost": 25.50, // estimated
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

### 6. Geocoding Service

**GET** `/geocode`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `address`: Address to geocode
- `lat`: Latitude for reverse geocoding
- `lng`: Longitude for reverse geocoding
- `type`: forward|reverse
- `country`: Country code filter (optional)
- `limit`: Maximum results (default: 5)

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

### 7. Get Geofence Status

**POST** `/geofence/check`

**Headers:**
```
Authorization: Bearer <access_token>
```

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
      "radius": 100, // meters
      "type": "pickup|delivery|restricted"
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
        "distance": 25.5, // meters from center
        "type": "pickup",
        "enteredAt": "2025-02-01T11:28:00Z",
        "dwellTime": "2 minutes"
      }
    ],
    "nearbyPois": [
      {
        "name": "Central Park",
        "type": "park",
        "distance": 1.2, // km
        "location": {
          "lat": 40.7829,
          "lng": -73.9654
        }
      }
    ]
  }
}
```

### 8. Create Geofence

**POST** `/geofence`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Pickup Zone - Central Park",
  "type": "pickup|delivery|restricted|safe_zone",
  "deliveryId": "delivery_uuid", // Optional, for delivery-specific geofences
  "geometry": {
    "type": "circle|polygon",
    "center": {
      "lat": 40.7829,
      "lng": -73.9654
    },
    "radius": 200, // meters (for circle)
    "coordinates": [ // for polygon
      [
        [-73.9654, 40.7829],
        [-73.9644, 40.7839],
        [-73.9634, 40.7829],
        [-73.9654, 40.7829]
      ]
    ]
  },
  "notifications": {
    "onEnter": true,
    "onExit": true,
    "onDwell": true,
    "dwellTime": 300 // seconds
  },
  "schedule": {
    "active": true,
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

### 9. Get Traffic Information

**GET** `/traffic`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `route`: Encoded route polyline
- `origin`: Origin coordinates (lat,lng)
- `destination`: Destination coordinates (lat,lng)
- `departureTime`: Departure time (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "origin": "New York, NY",
      "destination": "Boston, MA",
      "distance": 306.0 // km
    },
    "traffic": {
      "overall": "moderate",
      "duration": {
        "normal": 180, // minutes
        "current": 195, // minutes with traffic
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
          "delay": 8, // minutes
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
          "averageSpeed": 95.5 // km/h
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

### 10. Get ETA Updates

**GET** `/eta/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "delivery_uuid",
    "currentEta": {
      "pickup": "2025-02-01T11:30:00Z",
      "delivery": "2025-02-01T14:15:00Z"
    },
    "originalEta": {
      "pickup": "2025-02-01T11:00:00Z",
      "delivery": "2025-02-01T14:00:00Z"
    },
    "changes": {
      "pickupDelay": 30, // minutes
      "deliveryDelay": 15,
      "reason": "traffic_congestion",
      "lastUpdate": "2025-02-01T12:30:00Z"
    },
    "confidence": {
      "pickup": 85, // percentage
      "delivery": 78
    },
    "factors": [
      {
        "factor": "traffic",
        "impact": 12, // minutes delay
        "description": "Heavy traffic on I-95"
      },
      {
        "factor": "weather",
        "impact": 3,
        "description": "Light rain reducing speed"
      }
    ],
    "notifications": {
      "customerNotified": true,
      "notificationSent": "2025-02-01T12:35:00Z"
    }
  }
}
```

### 11. Get Location Analytics

**GET** `/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (day|week|month|quarter)
- `metric`: Specific metric (accuracy|battery|coverage)
- `userId`: Filter by user (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "week",
    "summary": {
      "totalDeliveries": 45,
      "averageAccuracy": 12.5, // meters
      "trackingUptime": 98.2, // percentage
      "batteryUsage": {
        "average": 15, // percentage per hour
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
      "urban": 99.1, // percentage
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

### 12. Emergency Location Services

**POST** `/emergency`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "emergencyType": "accident|breakdown|theft|medical|other",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 5
  },
  "description": "Vehicle breakdown on highway",
  "contactNumber": "+1234567890",
  "requiresAssistance": true,
  "severity": "low|medium|high|critical"
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
        "distance": 2.5, // km
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

### 13. Location Privacy Settings

**PUT** `/privacy`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "trackingLevel": "precise|approximate|minimal",
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

### 14. Offline Location Cache

**POST** `/cache/sync`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "cachedLocations": [
    {
      "lat": 40.7128,
      "lng": -74.0060,
      "timestamp": "2025-02-01T11:30:00Z",
      "accuracy": 10,
      "speed": 65.5,
      "cached": true
    }
  ],
  "syncReason": "network_restored|manual_sync|scheduled",
  "deviceInfo": {
    "batteryLevel": 45,
    "storageUsed": "2.5 MB"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "syncResult": {
      "locationsProcessed": 15,
      "locationsAccepted": 14,
      "locationsRejected": 1,
      "duplicatesSkipped": 2
    },
    "tracking": {
      "gapsDetected": 1,
      "gapDuration": "5 minutes",
      "interpolated": true
    },
    "nextSync": "2025-02-01T13:00:00Z",
    "cacheStatus": {
      "cleared": true,
      "freeSpace": "15.2 MB"
    }
  }
}
```

### 15. Location-based Recommendations

**GET** `/recommendations`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `lat`: Current latitude
- `lng`: Current longitude
- `type`: Recommendation type (pickup|delivery|route|poi)
- `radius`: Search radius in km

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "lat": 40.7128,
      "lng": -74.0060,
      "address": "Financial District, NYC"
    },
    "recommendations": [
      {
        "type": "delivery_opportunity",
        "title": "High-demand delivery zone nearby",
        "description": "3 pending delivery requests within 2km",
        "location": {
          "lat": 40.7282,
          "lng": -74.0776,
          "address": "Tribeca, NYC"
        },
        "distance": 1.8,
        "estimatedEarnings": 125.50,
        "confidence": 85
      },
      {
        "type": "optimal_route",
        "title": "Efficient multi-pickup route",
        "description": "Combine 2 pickups for 15% time savings",
        "waypoints": [
          {
            "lat": 40.7505,
            "lng": -73.9934,
            "type": "pickup"
          },
          {
            "lat": 40.7614,
            "lng": -73.9776,
            "type": "pickup"
          }
        ],
        "timeSavings": 22, // minutes
        "additionalEarnings": 45.00
      },
      {
        "type": "poi",
        "title": "Popular meeting spot",
        "description": "Starbucks - commonly used for handoffs",
        "location": {
          "lat": 40.7141,
          "lng": -74.0063,
          "address": "Starbucks, 150 Broadway"
        },
        "distance": 0.2,
        "rating": 4.5,
        "features": ["wifi", "parking", "restroom"]
      }
    ]
  }
}
```