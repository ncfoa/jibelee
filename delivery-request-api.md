# Delivery Request & Matching Service API

Base URL: `/api/v1/deliveries`

## Endpoints

### 1. Create Delivery Request

**POST** `/requests`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Important Documents Delivery",
  "description": "Legal documents that need urgent delivery",
  "category": "documents|electronics|clothing|food|fragile|other",
  "item": {
    "name": "Legal Documents",
    "description": "Sealed envelope with contracts",
    "quantity": 1,
    "weight": 0.5, // kg
    "dimensions": {
      "length": 30, // cm
      "width": 20,
      "height": 2
    },
    "value": 500.00, // USD
    "fragile": false,
    "perishable": false,
    "hazardous": false,
    "requiresSignature": true,
    "images": [
      "https://images.example.com/item1.jpg",
      "https://images.example.com/item2.jpg"
    ]
  },
  "pickup": {
    "address": "123 Main St, New York, NY 10001",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "contactPerson": "John Smith",
    "phoneNumber": "+1234567890",
    "instructions": "Ring doorbell, apartment 3B",
    "timeWindow": {
      "start": "2025-02-01T09:00:00Z",
      "end": "2025-02-01T18:00:00Z"
    },
    "flexibleTiming": true,
    "preferredDays": ["monday", "tuesday", "wednesday"]
  },
  "delivery": {
    "address": "456 Oak St, Boston, MA 02101",
    "coordinates": {
      "lat": 42.3601,
      "lng": -71.0589
    },
    "contactPerson": "Jane Doe",
    "phoneNumber": "+0987654321",
    "instructions": "Leave with building concierge",
    "timeWindow": {
      "start": "2025-02-01T10:00:00Z",
      "end": "2025-02-01T20:00:00Z"
    },
    "requiresRecipientPresence": true
  },
  "urgency": "standard|express|urgent",
  "maxPrice": 50.00,
  "autoAcceptPrice": 30.00, // Auto-accept offers at or below this price
  "preferredTravelers": ["traveler_uuid1", "traveler_uuid2"],
  "blacklistedTravelers": ["traveler_uuid3"],
  "requirements": {
    "minTravelerRating": 4.5,
    "verificationRequired": true,
    "insuranceRequired": false,
    "backgroundCheckRequired": false
  },
  "notifications": {
    "sms": true,
    "email": true,
    "push": true
  },
  "specialInstructions": "Handle with care, very important documents",
  "tags": ["urgent", "documents", "business"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "request_uuid",
    "title": "Important Documents Delivery",
    "status": "pending",
    "customer": {
      "id": "customer_uuid",
      "firstName": "John",
      "lastName": "Smith"
    },
    "item": {
      "name": "Legal Documents",
      "weight": 0.5,
      "value": 500.00
    },
    "route": {
      "origin": "New York, NY",
      "destination": "Boston, MA",
      "distance": 306 // km
    },
    "estimatedPrice": {
      "min": 25.00,
      "max": 45.00,
      "recommended": 35.00
    },
    "urgency": "standard",
    "createdAt": "2025-01-01T00:00:00Z",
    "expiresAt": "2025-01-08T00:00:00Z"
  }
}
```

### 2. Get Delivery Request Details

**GET** `/requests/{requestId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "request_uuid",
    "title": "Important Documents Delivery",
    "description": "Legal documents that need urgent delivery",
    "status": "pending",
    "customer": {
      "id": "customer_uuid",
      "firstName": "John",
      "lastName": "Smith",
      "profilePicture": "https://cdn.example.com/pic.jpg",
      "rating": {
        "average": 4.6,
        "count": 23
      },
      "verificationLevel": "verified"
    },
    "item": {
      "name": "Legal Documents",
      "description": "Sealed envelope with contracts",
      "weight": 0.5,
      "dimensions": {
        "length": 30,
        "width": 20,
        "height": 2
      },
      "value": 500.00,
      "images": ["https://images.example.com/item1.jpg"]
    },
    "route": {
      "pickup": {
        "address": "123 Main St, New York, NY 10001",
        "coordinates": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "timeWindow": {
          "start": "2025-02-01T09:00:00Z",
          "end": "2025-02-01T18:00:00Z"
        }
      },
      "delivery": {
        "address": "456 Oak St, Boston, MA 02101",
        "coordinates": {
          "lat": 42.3601,
          "lng": -71.0589
        },
        "timeWindow": {
          "start": "2025-02-01T10:00:00Z",
          "end": "2025-02-01T20:00:00Z"
        }
      },
      "distance": 306
    },
    "pricing": {
      "maxPrice": 50.00,
      "autoAcceptPrice": 30.00,
      "estimatedPrice": 35.00
    },
    "offers": [
      {
        "id": "offer_uuid",
        "traveler": {
          "id": "traveler_uuid",
          "firstName": "Jane",
          "lastName": "Doe",
          "rating": {
            "average": 4.8,
            "count": 156
          }
        },
        "price": 28.00,
        "message": "I can deliver this safely and on time",
        "estimatedPickupTime": "2025-02-01T11:00:00Z",
        "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
        "status": "pending",
        "createdAt": "2025-01-01T01:00:00Z"
      }
    ],
    "matchedTrips": 3,
    "urgency": "standard",
    "createdAt": "2025-01-01T00:00:00Z",
    "expiresAt": "2025-01-08T00:00:00Z"
  }
}
```

### 3. Search Delivery Requests

**GET** `/requests/search`

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
- `radius`: Search radius in km
- `category`: Item category
- `urgency`: Urgency level
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `maxWeight`: Maximum weight
- `pickupDateFrom`: Pickup date range start
- `pickupDateTo`: Pickup date range end
- `sortBy`: Sort by (price|distance|created|urgency)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "request_uuid",
      "title": "Important Documents Delivery",
      "customer": {
        "id": "customer_uuid",
        "firstName": "John",
        "lastName": "Smith",
        "rating": {
          "average": 4.6,
          "count": 23
        }
      },
      "item": {
        "name": "Legal Documents",
        "weight": 0.5,
        "category": "documents"
      },
      "route": {
        "origin": "New York, NY",
        "destination": "Boston, MA",
        "distance": 306
      },
      "pricing": {
        "maxPrice": 50.00,
        "estimatedPrice": 35.00
      },
      "urgency": "standard",
      "pickupWindow": {
        "start": "2025-02-01T09:00:00Z",
        "end": "2025-02-01T18:00:00Z"
      },
      "offers": 2,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### 4. Get My Delivery Requests

**GET** `/requests/my-requests`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Filter by status
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "request_uuid",
      "title": "Important Documents Delivery",
      "status": "pending",
      "item": {
        "name": "Legal Documents",
        "weight": 0.5
      },
      "route": {
        "origin": "New York, NY",
        "destination": "Boston, MA"
      },
      "offers": {
        "total": 3,
        "pending": 2,
        "accepted": 0,
        "declined": 1
      },
      "estimatedPrice": 35.00,
      "createdAt": "2025-01-01T00:00:00Z",
      "expiresAt": "2025-01-08T00:00:00Z"
    }
  ]
}
```

### 5. Update Delivery Request

**PUT** `/requests/{requestId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Updated Documents Delivery",
  "maxPrice": 55.00,
  "pickup": {
    "timeWindow": {
      "start": "2025-02-01T10:00:00Z",
      "end": "2025-02-01T19:00:00Z"
    }
  },
  "specialInstructions": "Updated instructions"
}
```

### 6. Cancel Delivery Request

**POST** `/requests/{requestId}/cancel`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "no_longer_needed|found_alternative|too_expensive|other",
  "message": "No longer needed, found local solution"
}
```

### 7. Create Delivery Offer

**POST** `/requests/{requestId}/offers`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "price": 28.00,
  "message": "I can deliver this safely and on time. I have experience with important documents.",
  "tripId": "trip_uuid", // Optional, if offering from existing trip
  "estimatedPickupTime": "2025-02-01T11:00:00Z",
  "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
  "guarantees": {
    "insurance": 1000.00, // Coverage amount
    "onTimeDelivery": true,
    "safeHandling": true
  },
  "specialServices": {
    "photoUpdates": true,
    "signatureRequired": true,
    "realTimeTracking": true
  },
  "validUntil": "2025-01-03T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "offer_uuid",
    "requestId": "request_uuid",
    "traveler": {
      "id": "traveler_uuid",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "price": 28.00,
    "status": "pending",
    "estimatedPickupTime": "2025-02-01T11:00:00Z",
    "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
    "createdAt": "2025-01-01T01:00:00Z"
  }
}
```

### 8. Get Delivery Offers

**GET** `/requests/{requestId}/offers`

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
      "id": "offer_uuid",
      "traveler": {
        "id": "traveler_uuid",
        "firstName": "Jane",
        "lastName": "Doe",
        "profilePicture": "https://cdn.example.com/pic.jpg",
        "rating": {
          "average": 4.8,
          "count": 156
        },
        "verificationLevel": "verified",
        "statistics": {
          "totalDeliveries": 156,
          "successRate": 98.7,
          "onTimeRate": 95.5
        }
      },
      "price": 28.00,
      "message": "I can deliver this safely and on time",
      "trip": {
        "id": "trip_uuid",
        "title": "NYC to Boston Flight",
        "type": "flight",
        "departureTime": "2025-02-01T10:00:00Z"
      },
      "timeline": {
        "estimatedPickupTime": "2025-02-01T11:00:00Z",
        "estimatedDeliveryTime": "2025-02-01T13:30:00Z"
      },
      "guarantees": {
        "insurance": 1000.00,
        "onTimeDelivery": true
      },
      "status": "pending",
      "createdAt": "2025-01-01T01:00:00Z",
      "validUntil": "2025-01-03T00:00:00Z"
    }
  ]
}
```

### 9. Accept Delivery Offer

**POST** `/offers/{offerId}/accept`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "message": "Great! Looking forward to working with you.",
  "paymentMethod": "card|wallet|bank_transfer",
  "specialRequests": "Please send photo updates during transit"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryId": "delivery_uuid",
    "status": "accepted",
    "traveler": {
      "id": "traveler_uuid",
      "firstName": "Jane",
      "lastName": "Doe",
      "phoneNumber": "+1234567890"
    },
    "finalPrice": 28.00,
    "estimatedPickupTime": "2025-02-01T11:00:00Z",
    "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
    "qrCodes": {
      "pickup": "pickup_qr_code_data",
      "delivery": "delivery_qr_code_data"
    },
    "contractId": "contract_uuid"
  }
}
```

### 10. Decline Delivery Offer

**POST** `/offers/{offerId}/decline`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "price_too_high|timing_not_suitable|prefer_other_traveler|other",
  "message": "Thank you for the offer, but the timing doesn't work for me"
}
```

### 11. Get My Offers

**GET** `/offers/my-offers`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status`: Filter by status (pending|accepted|declined|expired)
- `type`: Filter by type (sent|received)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "offer_uuid",
      "type": "sent", // or "received"
      "deliveryRequest": {
        "id": "request_uuid",
        "title": "Important Documents Delivery",
        "customer": {
          "firstName": "John",
          "lastName": "Smith"
        }
      },
      "price": 28.00,
      "status": "pending",
      "createdAt": "2025-01-01T01:00:00Z",
      "validUntil": "2025-01-03T00:00:00Z"
    }
  ]
}
```

### 12. Update Delivery Offer

**PUT** `/offers/{offerId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "price": 30.00,
  "message": "Updated offer with better pricing",
  "estimatedPickupTime": "2025-02-01T12:00:00Z",
  "validUntil": "2025-01-04T00:00:00Z"
}
```

### 13. Withdraw Delivery Offer

**DELETE** `/offers/{offerId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "schedule_changed|found_better_option|no_longer_available|other",
  "message": "My travel plans have changed"
}
```

### 14. Get Matching Algorithm Results

**POST** `/requests/{requestId}/matches`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "algorithm": "distance|price|rating|time|combined",
  "preferences": {
    "maxDistance": 50, // km from route
    "minRating": 4.0,
    "maxPrice": 50.00,
    "timeFlexibility": 2 // hours
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "trip": {
          "id": "trip_uuid",
          "title": "NYC to Boston Flight",
          "traveler": {
            "id": "traveler_uuid",
            "firstName": "Jane",
            "lastName": "Doe",
            "rating": {
              "average": 4.8,
              "count": 156
            }
          },
          "departureTime": "2025-02-01T10:00:00Z",
          "route": {
            "origin": "New York, NY",
            "destination": "Boston, MA"
          }
        },
        "compatibility": {
          "score": 95.5,
          "factors": {
            "route": 98.0,
            "timing": 92.0,
            "capacity": 100.0,
            "price": 90.0,
            "rating": 96.0
          }
        },
        "estimatedPrice": 28.50,
        "estimatedPickupTime": "2025-02-01T11:00:00Z",
        "estimatedDeliveryTime": "2025-02-01T13:30:00Z"
      }
    ],
    "totalMatches": 12,
    "algorithmUsed": "combined"
  }
}
```

### 15. Get Delivery Request Analytics

**GET** `/requests/{requestId}/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "request_uuid",
    "views": 45,
    "offers": {
      "total": 8,
      "pending": 3,
      "accepted": 1,
      "declined": 4
    },
    "priceAnalysis": {
      "yourMaxPrice": 50.00,
      "averageOffer": 32.50,
      "lowestOffer": 25.00,
      "highestOffer": 45.00,
      "marketRate": 35.00
    },
    "timeline": [
      {
        "timestamp": "2025-01-01T00:00:00Z",
        "event": "request_created"
      },
      {
        "timestamp": "2025-01-01T01:00:00Z",
        "event": "first_offer_received",
        "data": {
          "price": 28.00
        }
      }
    ]
  }
}
```

### 16. Duplicate Delivery Request

**POST** `/requests/{requestId}/duplicate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "modifications": {
    "pickup": {
      "timeWindow": {
        "start": "2025-02-15T09:00:00Z",
        "end": "2025-02-15T18:00:00Z"
      }
    },
    "maxPrice": 55.00
  }
}
```

### 17. Get Popular Delivery Routes

**GET** `/popular-routes`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter)
- `category`: Item category filter

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
      "requestCount": 156,
      "averagePrice": 32.50,
      "averageWeight": 1.2,
      "popularCategories": ["documents", "electronics", "clothing"],
      "demandLevel": "high"
    }
  ]
}
```

### 18. Get Delivery Request Recommendations

**GET** `/requests/recommendations`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "type": "similar_requests",
        "title": "Similar requests in your area",
        "requests": [
          {
            "id": "request_uuid",
            "title": "Electronics Delivery",
            "route": {
              "origin": "New York, NY",
              "destination": "Philadelphia, PA"
            },
            "estimatedPrice": 25.00
          }
        ]
      },
      {
        "type": "price_suggestions",
        "title": "Optimize your pricing",
        "suggestions": [
          {
            "currentPrice": 50.00,
            "suggestedPrice": 35.00,
            "reason": "Market rate analysis shows 30% more offers at this price"
          }
        ]
      }
    ]
  }
}
```

### 19. Report Delivery Request

**POST** `/requests/{requestId}/report`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "category": "inappropriate_content|spam|fraud|prohibited_item|other",
  "description": "This request seems to be for prohibited items",
  "evidence": [
    {
      "type": "screenshot",
      "url": "https://evidence.com/screenshot.jpg"
    }
  ]
}
```

### 20. Get Delivery Request Statistics

**GET** `/requests/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter|year)
- `groupBy`: Group by (category|route|price_range)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRequests": 45,
      "activeRequests": 12,
      "completedRequests": 30,
      "cancelledRequests": 3,
      "averagePrice": 32.50,
      "averageOffers": 4.2
    },
    "trends": [
      {
        "period": "2025-01",
        "requests": 15,
        "averagePrice": 35.00,
        "completionRate": 85.5
      }
    ],
    "categories": [
      {
        "name": "documents",
        "count": 18,
        "averagePrice": 28.50
      },
      {
        "name": "electronics",
        "count": 12,
        "averagePrice": 45.00
      }
    ]
  }
}
```