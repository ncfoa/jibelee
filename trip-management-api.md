# Trip Management Service API

Base URL: `/api/v1/trips`

## Endpoints

### 1. Create Trip

**POST** `/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "NYC to Boston Business Trip",
  "description": "Regular business trip, happy to help with deliveries",
  "type": "flight|train|bus|car|other",
  "origin": {
    "address": "New York, NY, USA",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "airport": "JFK", // For flights
    "terminal": "Terminal 4", // Optional
    "details": "Gate information will be updated"
  },
  "destination": {
    "address": "Boston, MA, USA",
    "coordinates": {
      "lat": 42.3601,
      "lng": -71.0589
    },
    "airport": "BOS", // For flights
    "terminal": "Terminal B"
  },
  "departureTime": "2025-02-01T10:00:00Z",
  "arrivalTime": "2025-02-01T11:30:00Z",
  "estimatedDuration": 90, // minutes
  "capacity": {
    "weight": 5, // kg
    "volume": 10, // liters
    "items": 3 // number of items
  },
  "pricing": {
    "basePrice": 15.00,
    "pricePerKg": 5.00,
    "pricePerKm": 0.50,
    "expressDeliveryMultiplier": 1.5,
    "fragileItemMultiplier": 1.3
  },
  "restrictions": {
    "noFragile": false,
    "noLiquids": true,
    "noElectronics": false,
    "maxItemValue": 500.00,
    "prohibitedItems": ["weapons", "drugs", "alcohol"]
  },
  "preferences": {
    "meetingPreference": "airport|home|public_place|flexible",
    "communicationPreference": "app_only|phone|email",
    "advanceNotice": 24 // hours
  },
  "isRecurring": false,
  "recurringPattern": {
    "frequency": "weekly|monthly|custom",
    "daysOfWeek": [1, 3, 5], // Monday, Wednesday, Friday
    "endDate": "2025-06-01T00:00:00Z"
  },
  "visibility": "public|private|friends_only",
  "autoAccept": false,
  "tags": ["business", "frequent", "reliable"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "trip_uuid",
    "title": "NYC to Boston Business Trip",
    "status": "upcoming",
    "traveler": {
      "id": "user_uuid",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.example.com/pic.jpg",
      "rating": {
        "average": 4.8,
        "count": 156
      }
    },
    "origin": {
      "address": "New York, NY, USA",
      "coordinates": {
        "lat": 40.7128,
        "lng": -74.0060
      }
    },
    "destination": {
      "address": "Boston, MA, USA",
      "coordinates": {
        "lat": 42.3601,
        "lng": -71.0589
      }
    },
    "departureTime": "2025-02-01T10:00:00Z",
    "arrivalTime": "2025-02-01T11:30:00Z",
    "availableCapacity": {
      "weight": 5,
      "volume": 10,
      "items": 3
    },
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### 2. Get Trip Details

**GET** `/{tripId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "trip_uuid",
    "title": "NYC to Boston Business Trip",
    "description": "Regular business trip, happy to help with deliveries",
    "type": "flight",
    "status": "upcoming",
    "traveler": {
      "id": "user_uuid",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.example.com/pic.jpg",
      "rating": {
        "average": 4.8,
        "count": 156
      },
      "verificationLevel": "verified"
    },
    "route": {
      "origin": {
        "address": "New York, NY, USA",
        "coordinates": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "airport": "JFK",
        "terminal": "Terminal 4"
      },
      "destination": {
        "address": "Boston, MA, USA",
        "coordinates": {
          "lat": 42.3601,
          "lng": -71.0589
        },
        "airport": "BOS",
        "terminal": "Terminal B"
      },
      "distance": 306, // km
      "duration": 90 // minutes
    },
    "schedule": {
      "departureTime": "2025-02-01T10:00:00Z",
      "arrivalTime": "2025-02-01T11:30:00Z",
      "timezone": "America/New_York"
    },
    "capacity": {
      "total": {
        "weight": 5,
        "volume": 10,
        "items": 3
      },
      "available": {
        "weight": 3,
        "volume": 7,
        "items": 2
      },
      "reserved": {
        "weight": 2,
        "volume": 3,
        "items": 1
      }
    },
    "pricing": {
      "basePrice": 15.00,
      "pricePerKg": 5.00,
      "pricePerKm": 0.50
    },
    "deliveryRequests": [
      {
        "id": "request_uuid",
        "status": "accepted",
        "customer": {
          "id": "customer_uuid",
          "firstName": "Jane",
          "lastName": "Smith"
        },
        "item": {
          "name": "Documents",
          "weight": 0.5,
          "value": 100.00
        },
        "price": 25.00
      }
    ],
    "restrictions": {
      "noFragile": false,
      "noLiquids": true,
      "maxItemValue": 500.00
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### 3. Update Trip

**PUT** `/{tripId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Updated NYC to Boston Trip",
  "description": "Updated description",
  "departureTime": "2025-02-01T11:00:00Z",
  "arrivalTime": "2025-02-01T12:30:00Z",
  "capacity": {
    "weight": 6,
    "volume": 12,
    "items": 4
  },
  "pricing": {
    "basePrice": 18.00,
    "pricePerKg": 5.50
  }
}
```

### 4. Cancel Trip

**POST** `/{tripId}/cancel`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "personal_emergency|schedule_change|weather|other",
  "message": "Flight cancelled due to weather conditions",
  "refundPolicy": "full|partial|none"
}
```

### 5. Search Trips

**GET** `/search`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `origin`: Origin city/address
- `destination`: Destination city/address
- `originLat`: Origin latitude
- `originLng`: Origin longitude
- `destinationLat`: Destination latitude
- `destinationLng`: Destination longitude
- `radius`: Search radius in km (default: 50)
- `departureDate`: Departure date (YYYY-MM-DD)
- `departureDateFrom`: Departure date range start
- `departureDateTo`: Departure date range end
- `type`: Trip type (flight|train|bus|car)
- `minCapacityWeight`: Minimum weight capacity
- `minCapacityVolume`: Minimum volume capacity
- `maxPrice`: Maximum price
- `minRating`: Minimum traveler rating
- `sortBy`: Sort by (price|departure|rating|distance)
- `sortOrder`: Sort order (asc|desc)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "trip_uuid",
      "title": "NYC to Boston Business Trip",
      "traveler": {
        "id": "user_uuid",
        "firstName": "John",
        "lastName": "Doe",
        "profilePicture": "https://cdn.example.com/pic.jpg",
        "rating": {
          "average": 4.8,
          "count": 156
        }
      },
      "route": {
        "origin": {
          "address": "New York, NY",
          "coordinates": {
            "lat": 40.7128,
            "lng": -74.0060
          }
        },
        "destination": {
          "address": "Boston, MA",
          "coordinates": {
            "lat": 42.3601,
            "lng": -71.0589
          }
        },
        "distance": 306
      },
      "schedule": {
        "departureTime": "2025-02-01T10:00:00Z",
        "arrivalTime": "2025-02-01T11:30:00Z"
      },
      "availableCapacity": {
        "weight": 3,
        "volume": 7,
        "items": 2
      },
      "estimatedPrice": 25.50,
      "type": "flight"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "filters": {
    "appliedFilters": {
      "origin": "New York",
      "destination": "Boston",
      "departureDate": "2025-02-01"
    }
  }
}
```

### 6. Get My Trips

**GET** `/my-trips`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Trip status (upcoming|active|completed|cancelled)
- `type`: Trip type
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "trip_uuid",
      "title": "NYC to Boston Business Trip",
      "status": "upcoming",
      "route": {
        "origin": {
          "address": "New York, NY"
        },
        "destination": {
          "address": "Boston, MA"
        }
      },
      "schedule": {
        "departureTime": "2025-02-01T10:00:00Z"
      },
      "deliveryRequests": {
        "total": 3,
        "pending": 1,
        "accepted": 2
      },
      "estimatedEarnings": 125.50,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 7. Start Trip

**POST** `/{tripId}/start`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentLocation": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "actualDepartureTime": "2025-02-01T10:15:00Z",
  "notes": "Delayed departure due to traffic"
}
```

### 8. Update Trip Status

**POST** `/{tripId}/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "active|completed|delayed|cancelled",
  "currentLocation": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "estimatedArrival": "2025-02-01T12:00:00Z",
  "message": "Running 30 minutes late due to weather"
}
```

### 9. Complete Trip

**POST** `/{tripId}/complete`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "actualArrivalTime": "2025-02-01T11:45:00Z",
  "finalLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "notes": "Trip completed successfully"
}
```

### 10. Get Trip Analytics

**GET** `/{tripId}/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tripId": "trip_uuid",
    "performance": {
      "onTimePerformance": 95.2,
      "deliverySuccessRate": 98.5,
      "customerSatisfaction": 4.8
    },
    "financials": {
      "totalEarnings": 245.50,
      "totalDeliveries": 8,
      "averageEarningPerDelivery": 30.69,
      "platformFee": 24.55,
      "netEarnings": 220.95
    },
    "deliveries": {
      "requested": 12,
      "accepted": 10,
      "completed": 8,
      "cancelled": 2
    },
    "timeline": [
      {
        "timestamp": "2025-02-01T09:45:00Z",
        "event": "trip_started",
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        }
      }
    ]
  }
}
```

### 11. Get Trip Reviews

**GET** `/{tripId}/reviews`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "review_uuid",
      "rating": 5,
      "comment": "Excellent service, very professional!",
      "reviewer": {
        "id": "customer_uuid",
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "deliveryId": "delivery_uuid",
      "createdAt": "2025-02-01T15:00:00Z"
    }
  ]
}
```

### 12. Share Trip

**POST** `/{tripId}/share`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "method": "link|qr|social",
  "platform": "whatsapp|telegram|facebook|twitter", // for social sharing
  "message": "Check out my upcoming trip!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shareUrl": "https://app.p2pdelivery.com/trips/trip_uuid",
    "qrCode": "data:image/png;base64,iVBOR...",
    "deepLink": "p2pdelivery://trip/trip_uuid"
  }
}
```

### 13. Duplicate Trip

**POST** `/{tripId}/duplicate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "departureTime": "2025-02-15T10:00:00Z",
  "arrivalTime": "2025-02-15T11:30:00Z",
  "modifications": {
    "title": "Updated title",
    "capacity": {
      "weight": 6
    }
  }
}
```

### 14. Get Trip Templates

**GET** `/templates`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "template_uuid",
      "name": "NYC-Boston Regular",
      "route": {
        "origin": "New York, NY",
        "destination": "Boston, MA"
      },
      "type": "flight",
      "defaultCapacity": {
        "weight": 5,
        "volume": 10
      },
      "usageCount": 15,
      "lastUsed": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 15. Create Trip Template

**POST** `/templates`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "NYC-Boston Regular",
  "tripData": {
    "title": "NYC to Boston Business Trip",
    "type": "flight",
    "origin": {
      "address": "New York, NY, USA"
    },
    "destination": {
      "address": "Boston, MA, USA"
    },
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
}
```

### 16. Get Popular Routes

**GET** `/popular-routes`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter)
- `limit`: Number of routes to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "route": {
        "origin": "New York, NY",
        "destination": "Boston, MA"
      },
      "tripCount": 45,
      "averagePrice": 28.50,
      "averageRating": 4.7,
      "demand": "high"
    }
  ]
}
```

### 17. Get Trip Recommendations

**GET** `/recommendations`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `origin`: Current location
- `destination`: Destination preference
- `type`: Preferred trip type

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "route": {
          "origin": "New York, NY",
          "destination": "Boston, MA"
        },
        "suggestedTimes": [
          {
            "departureTime": "2025-02-01T08:00:00Z",
            "demand": "high",
            "estimatedEarnings": 150.00
          }
        ],
        "reason": "High demand route with good earnings potential"
      }
    ]
  }
}
```

### 18. Export Trip Data

**GET** `/{tripId}/export`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `format`: Export format (json|csv|pdf)

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://exports.p2pdelivery.com/trip_uuid.pdf",
    "expiresAt": "2025-01-02T00:00:00Z"
  }
}
```

### 19. Get Trip Weather

**GET** `/{tripId}/weather`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "origin": {
      "current": {
        "temperature": 15,
        "condition": "partly_cloudy",
        "humidity": 65
      },
      "forecast": {
        "temperature": 18,
        "condition": "sunny",
        "precipitation": 0
      }
    },
    "destination": {
      "forecast": {
        "temperature": 12,
        "condition": "cloudy",
        "precipitation": 20
      }
    },
    "travelConditions": "good",
    "alerts": []
  }
}
```

### 20. Get Trip Statistics

**GET** `/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter|year)
- `groupBy`: Group by (month|week|day)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTrips": 45,
      "completedTrips": 42,
      "cancelledTrips": 3,
      "totalEarnings": 2450.75,
      "totalDeliveries": 156,
      "averageRating": 4.8
    },
    "trends": [
      {
        "period": "2025-01",
        "trips": 15,
        "earnings": 850.25,
        "deliveries": 52
      }
    ],
    "topRoutes": [
      {
        "origin": "New York",
        "destination": "Boston",
        "count": 12,
        "earnings": 650.50
      }
    ]
  }
}
```