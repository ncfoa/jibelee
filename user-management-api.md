# User Management Service API

Base URL: `/api/v1/users`

## Endpoints

### 1. Get Current User Profile

**GET** `/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "dateOfBirth": "1990-01-01",
    "profilePicture": "https://cdn.example.com/pic.jpg",
    "userType": "traveler",
    "status": "active",
    "verificationLevel": "verified",
    "rating": {
      "average": 4.8,
      "count": 156,
      "breakdown": {
        "5": 120,
        "4": 30,
        "3": 5,
        "2": 1,
        "1": 0
      }
    },
    "statistics": {
      "totalTrips": 45,
      "totalDeliveries": 123,
      "successfulDeliveries": 121,
      "totalEarnings": 2450.50,
      "joinedDate": "2024-01-01T00:00:00Z"
    },
    "preferences": {
      "language": "en",
      "currency": "USD",
      "timezone": "UTC",
      "notifications": {
        "email": true,
        "push": true,
        "sms": false
      },
      "privacy": {
        "showRealName": true,
        "showPhoneNumber": false,
        "showRating": true
      }
    },
    "documents": {
      "idVerified": true,
      "phoneVerified": true,
      "emailVerified": true,
      "backgroundCheckStatus": "approved"
    },
    "addresses": [
      {
        "id": "address_uuid",
        "type": "home|work|other",
        "label": "Home",
        "street": "123 Main St",
        "city": "New York",
        "state": "NY",
        "country": "US",
        "postalCode": "10001",
        "coordinates": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "isDefault": true
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### 2. Update User Profile

**PUT** `/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "bio": "Frequent traveler, happy to help with deliveries",
  "preferences": {
    "language": "en",
    "currency": "USD",
    "timezone": "UTC",
    "notifications": {
      "email": true,
      "push": true,
      "sms": false
    },
    "privacy": {
      "showRealName": true,
      "showPhoneNumber": false,
      "showRating": true
    }
  }
}
```

### 3. Upload Profile Picture

**POST** `/me/profile-picture`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
profilePicture: <file> (max 5MB, jpg/png)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profilePicture": "https://cdn.example.com/pic.jpg",
    "thumbnails": {
      "small": "https://cdn.example.com/pic_small.jpg",
      "medium": "https://cdn.example.com/pic_medium.jpg",
      "large": "https://cdn.example.com/pic_large.jpg"
    }
  }
}
```

### 4. Get User by ID

**GET** `/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "https://cdn.example.com/pic.jpg",
    "userType": "traveler",
    "rating": {
      "average": 4.8,
      "count": 156
    },
    "statistics": {
      "totalDeliveries": 123,
      "successfulDeliveries": 121,
      "joinedDate": "2024-01-01T00:00:00Z"
    },
    "verificationLevel": "verified",
    "lastActive": "2025-01-01T00:00:00Z"
  }
}
```

### 5. Search Users

**GET** `/search`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `q`: Search query (name, email)
- `userType`: Filter by user type (traveler|customer|both)
- `verificationLevel`: Filter by verification level
- `minRating`: Minimum rating filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.example.com/pic.jpg",
      "userType": "traveler",
      "rating": {
        "average": 4.8,
        "count": 156
      },
      "verificationLevel": "verified"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 6. Add Address

**POST** `/me/addresses`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "type": "home|work|other",
  "label": "Home",
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "country": "US",
  "postalCode": "10001",
  "coordinates": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "isDefault": false
}
```

### 7. Update Address

**PUT** `/me/addresses/{addressId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "type": "home",
  "label": "Updated Home",
  "street": "456 Oak St",
  "city": "New York",
  "state": "NY",
  "country": "US",
  "postalCode": "10002",
  "isDefault": true
}
```

### 8. Delete Address

**DELETE** `/me/addresses/{addressId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 9. Get User Addresses

**GET** `/me/addresses`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 10. Identity Verification

**POST** `/me/verify-identity`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
documentType: "passport|driving_license|national_id"
frontImage: <file>
backImage: <file> (optional, for driving license)
selfieImage: <file>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "verification_uuid",
    "status": "pending",
    "estimatedProcessingTime": "24-48 hours"
  }
}
```

### 11. Phone Verification

**POST** `/me/verify-phone`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "verification_uuid",
    "method": "sms",
    "expiresIn": 300
  }
}
```

### 12. Confirm Phone Verification

**POST** `/me/verify-phone/confirm`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "verificationId": "verification_uuid",
  "code": "123456"
}
```

### 13. Get User Reviews

**GET** `/{userId}/reviews`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `type`: Review type (received|given)
- `rating`: Filter by rating
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "review_uuid",
      "rating": 5,
      "comment": "Excellent delivery service!",
      "reviewer": {
        "id": "reviewer_uuid",
        "firstName": "Jane",
        "lastName": "Smith",
        "profilePicture": "https://cdn.example.com/pic2.jpg"
      },
      "deliveryId": "delivery_uuid",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### 14. Submit Review

**POST** `/reviews`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "revieweeId": "user_uuid",
  "rating": 5,
  "comment": "Excellent service, very professional!",
  "categories": {
    "communication": 5,
    "punctuality": 5,
    "carefulness": 4,
    "friendliness": 5
  }
}
```

### 15. Get User Statistics

**GET** `/{userId}/statistics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter|year|all)
- `year`: Specific year
- `month`: Specific month

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "totalDeliveries": 15,
    "successfulDeliveries": 14,
    "cancelledDeliveries": 1,
    "totalEarnings": 450.75,
    "averageRating": 4.8,
    "responseTime": "2.5 hours",
    "completionRate": 93.3,
    "repeatCustomers": 8,
    "topDestinations": [
      {
        "city": "New York",
        "count": 8
      },
      {
        "city": "Boston",
        "count": 4
      }
    ]
  }
}
```

### 16. Block User

**POST** `/me/blocked-users`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "reason": "inappropriate_behavior|spam|harassment|other",
  "comment": "Optional reason description"
}
```

### 17. Unblock User

**DELETE** `/me/blocked-users/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 18. Get Blocked Users

**GET** `/me/blocked-users`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 19. Report User

**POST** `/reports`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reportedUserId": "user_uuid",
  "deliveryId": "delivery_uuid",
  "category": "inappropriate_behavior|fraud|harassment|spam|other",
  "description": "Detailed description of the issue",
  "evidence": [
    {
      "type": "image|video|text",
      "url": "https://evidence.com/file.jpg",
      "description": "Screenshot of inappropriate message"
    }
  ]
}
```

### 20. Get Favorite Travelers

**GET** `/me/favorites`

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
      "id": "user_uuid",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.example.com/pic.jpg",
      "rating": {
        "average": 4.9,
        "count": 200
      },
      "totalDeliveries": 150,
      "addedAt": "2024-12-01T00:00:00Z"
    }
  ]
}
```

### 21. Add to Favorites

**POST** `/me/favorites`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid"
}
```

### 22. Remove from Favorites

**DELETE** `/me/favorites/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

### 23. Get User Activity

**GET** `/me/activity`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `type`: Activity type (delivery|trip|review|payment)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "activity_uuid",
      "type": "delivery_completed",
      "title": "Delivery completed successfully",
      "description": "Package delivered to Jane Smith in Boston",
      "relatedId": "delivery_uuid",
      "metadata": {
        "earnings": 45.50,
        "rating": 5
      },
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 24. Update Notification Preferences

**PUT** `/me/notifications`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "email": {
    "newDeliveryRequest": true,
    "deliveryUpdates": true,
    "paymentNotifications": true,
    "reviewNotifications": true,
    "promotions": false
  },
  "push": {
    "newDeliveryRequest": true,
    "deliveryUpdates": true,
    "paymentNotifications": true,
    "reviewNotifications": true,
    "locationUpdates": true
  },
  "sms": {
    "deliveryUpdates": false,
    "paymentNotifications": true,
    "securityAlerts": true
  }
}
```

### 25. Delete Account

**DELETE** `/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "password": "CurrentPassword123!",
  "reason": "privacy_concerns|not_useful|too_expensive|other",
  "feedback": "Optional feedback"
}
```