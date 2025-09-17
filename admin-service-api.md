# Admin & Management Service API

Base URL: `/api/v1/admin`

**Note**: All admin endpoints require `X-Admin-Token` header with valid admin authentication token.

## Endpoints

### 1. Admin Dashboard Overview

**GET** `/dashboard`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 12450,
      "activeUsers": 8932,
      "totalDeliveries": 45620,
      "activeDeliveries": 234,
      "totalRevenue": 1245067.50,
      "monthlyRevenue": 125450.75,
      "platformGrowth": "+12.5%" // vs previous month
    },
    "realtimeMetrics": {
      "onlineUsers": 1245,
      "activeDeliveries": 234,
      "newSignups": 45,
      "completedDeliveries": 156,
      "systemLoad": "normal",
      "serverStatus": "healthy"
    },
    "alerts": [
      {
        "id": "alert_uuid",
        "type": "high_refund_rate",
        "severity": "medium",
        "message": "Refund rate increased by 15% in the last 24 hours",
        "count": 23,
        "timestamp": "2025-02-01T12:00:00Z"
      }
    ],
    "quickStats": {
      "newUsers": {
        "today": 45,
        "week": 312,
        "month": 1456
      },
      "deliveries": {
        "today": 156,
        "week": 1234,
        "month": 5678
      },
      "revenue": {
        "today": 5234.50,
        "week": 45678.90,
        "month": 125450.75
      }
    }
  }
}
```

### 2. User Management

**GET** `/users`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `search`: Search by name, email, or ID
- `status`: Filter by status (active|suspended|banned|pending)
- `userType`: Filter by type (customer|traveler|both)
- `verificationLevel`: Filter by verification level
- `registrationDate`: Filter by registration date range
- `sortBy`: Sort by (created|lastActive|rating|deliveries)
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "userType": "traveler",
      "status": "active",
      "verificationLevel": "verified",
      "rating": {
        "average": 4.8,
        "count": 156
      },
      "statistics": {
        "totalDeliveries": 156,
        "successRate": 98.7,
        "totalEarnings": 5234.50,
        "joinedDate": "2024-01-15T00:00:00Z",
        "lastActive": "2025-02-01T10:30:00Z"
      },
      "flags": {
        "isVip": false,
        "hasWarnings": false,
        "riskLevel": "low"
      },
      "location": {
        "city": "New York",
        "country": "USA",
        "timezone": "America/New_York"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12450,
    "totalPages": 249
  },
  "filters": {
    "activeFilters": {
      "status": "active",
      "userType": "traveler"
    }
  }
}
```

### 3. User Details

**GET** `/users/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_uuid",
      "personalInfo": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phoneNumber": "+1234567890",
        "dateOfBirth": "1990-01-15",
        "profilePicture": "https://cdn.example.com/pic.jpg"
      },
      "account": {
        "status": "active",
        "userType": "traveler",
        "verificationLevel": "verified",
        "joinedDate": "2024-01-15T00:00:00Z",
        "lastActive": "2025-02-01T10:30:00Z",
        "ipAddress": "192.168.1.1",
        "deviceInfo": {
          "platform": "ios",
          "appVersion": "1.0.0"
        }
      },
      "verification": {
        "email": {
          "verified": true,
          "verifiedAt": "2024-01-15T10:00:00Z"
        },
        "phone": {
          "verified": true,
          "verifiedAt": "2024-01-15T11:00:00Z"
        },
        "identity": {
          "status": "approved",
          "documentType": "passport",
          "verifiedAt": "2024-01-16T09:00:00Z",
          "verifiedBy": "admin_uuid"
        },
        "backgroundCheck": {
          "status": "passed",
          "completedAt": "2024-01-17T14:00:00Z"
        }
      },
      "statistics": {
        "deliveries": {
          "total": 156,
          "completed": 154,
          "cancelled": 2,
          "successRate": 98.7
        },
        "financial": {
          "totalEarnings": 5234.50,
          "totalSpent": 1234.75,
          "averageEarningPerDelivery": 33.95,
          "outstandingBalance": 234.50
        },
        "ratings": {
          "asCustomer": {
            "average": 4.9,
            "count": 45
          },
          "asTraveler": {
            "average": 4.8,
            "count": 156
          }
        }
      },
      "flags": {
        "isVip": false,
        "hasWarnings": false,
        "riskLevel": "low",
        "tags": ["frequent_traveler", "reliable"]
      },
      "addresses": [
        {
          "id": "address_uuid",
          "type": "home",
          "address": "123 Main St, New York, NY 10001",
          "isDefault": true
        }
      ]
    },
    "recentActivity": [
      {
        "type": "delivery_completed",
        "timestamp": "2025-02-01T10:00:00Z",
        "description": "Completed delivery DEL-001234",
        "deliveryId": "delivery_uuid"
      }
    ],
    "warnings": [],
    "notes": [
      {
        "id": "note_uuid",
        "content": "Excellent traveler, very reliable",
        "createdBy": "admin_uuid",
        "createdAt": "2024-06-15T10:00:00Z",
        "visibility": "admin_only"
      }
    ]
  }
}
```

### 4. Update User Status

**PUT** `/users/{userId}/status`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "status": "active|suspended|banned|pending",
  "reason": "violation_of_terms|suspicious_activity|user_request|other",
  "description": "Suspended due to multiple customer complaints",
  "duration": 7, // days (for temporary suspension)
  "notifyUser": true,
  "internalNotes": "Multiple complaints about late deliveries"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_uuid",
    "previousStatus": "active",
    "newStatus": "suspended",
    "reason": "violation_of_terms",
    "effectiveDate": "2025-02-01T12:00:00Z",
    "expirationDate": "2025-02-08T12:00:00Z",
    "actionBy": "admin_uuid",
    "notificationSent": true
  }
}
```

### 5. Delivery Management

**GET** `/deliveries`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `status`: Filter by status
- `priority`: Filter by priority (high|medium|low)
- `dateFrom`: Date range start
- `dateTo`: Date range end
- `customerId`: Filter by customer
- `travelerId`: Filter by traveler
- `search`: Search by delivery ID or item name
- `sortBy`: Sort criteria
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "delivery_uuid",
      "deliveryId": "DEL-001234",
      "status": "in_transit",
      "priority": "normal",
      "customer": {
        "id": "customer_uuid",
        "name": "John Smith",
        "email": "john@example.com"
      },
      "traveler": {
        "id": "traveler_uuid",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "item": {
        "name": "Legal Documents",
        "category": "documents",
        "value": 500.00
      },
      "route": {
        "origin": "New York, NY",
        "destination": "Boston, MA",
        "distance": 306
      },
      "pricing": {
        "amount": 45.50,
        "platformFee": 4.55,
        "status": "paid"
      },
      "timeline": {
        "requested": "2025-01-30T10:00:00Z",
        "accepted": "2025-01-30T11:00:00Z",
        "pickedUp": "2025-02-01T10:00:00Z",
        "estimatedDelivery": "2025-02-01T14:00:00Z"
      },
      "flags": {
        "isUrgent": false,
        "hasIssues": false,
        "requiresAttention": false
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 45620,
    "totalPages": 913
  },
  "summary": {
    "byStatus": {
      "pending": 1245,
      "active": 234,
      "completed": 43567,
      "cancelled": 574
    }
  }
}
```

### 6. Delivery Details

**GET** `/deliveries/{deliveryId}`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "delivery": {
      "id": "delivery_uuid",
      "deliveryId": "DEL-001234",
      "status": "in_transit",
      "customer": {
        "id": "customer_uuid",
        "name": "John Smith",
        "email": "john@example.com",
        "phoneNumber": "+1234567890"
      },
      "traveler": {
        "id": "traveler_uuid",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phoneNumber": "+0987654321"
      },
      "item": {
        "name": "Legal Documents",
        "description": "Important legal contracts",
        "category": "documents",
        "weight": 0.5,
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
          "instructions": "Ring doorbell, apartment 3B"
        },
        "delivery": {
          "address": "456 Oak St, Boston, MA 02101",
          "coordinates": {
            "lat": 42.3601,
            "lng": -71.0589
          },
          "instructions": "Leave with concierge"
        },
        "distance": 306
      },
      "pricing": {
        "baseAmount": 40.95,
        "platformFee": 4.55,
        "totalAmount": 45.50,
        "paymentStatus": "paid",
        "escrowStatus": "held"
      },
      "timeline": {
        "requested": "2025-01-30T10:00:00Z",
        "accepted": "2025-01-30T11:00:00Z",
        "pickedUp": "2025-02-01T10:00:00Z",
        "inTransit": "2025-02-01T10:15:00Z",
        "estimatedDelivery": "2025-02-01T14:00:00Z"
      }
    },
    "tracking": {
      "currentLocation": {
        "lat": 41.2033,
        "lng": -77.1945,
        "timestamp": "2025-02-01T12:00:00Z",
        "address": "I-80, Pennsylvania"
      },
      "progress": 45.5,
      "estimatedArrival": "2025-02-01T14:15:00Z"
    },
    "qrCodes": {
      "pickup": {
        "id": "qr_pickup_uuid",
        "status": "used",
        "usedAt": "2025-02-01T10:05:00Z"
      },
      "delivery": {
        "id": "qr_delivery_uuid",
        "status": "active",
        "expiresAt": "2025-02-01T18:00:00Z"
      }
    },
    "communications": [
      {
        "type": "message",
        "from": "customer",
        "to": "traveler",
        "content": "Please handle with care",
        "timestamp": "2025-01-30T11:30:00Z"
      }
    ],
    "issues": [],
    "adminNotes": [
      {
        "id": "note_uuid",
        "content": "Customer requested priority handling",
        "createdBy": "admin_uuid",
        "createdAt": "2025-01-30T12:00:00Z"
      }
    ]
  }
}
```

### 7. Financial Management

**GET** `/financials/overview`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `period`: Time period (day|week|month|quarter|year)
- `year`: Specific year
- `month`: Specific month

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "revenue": {
      "gross": 125450.75,
      "net": 112905.68,
      "platformFees": 12545.07,
      "processingFees": 3768.15,
      "refunds": 2245.50,
      "chargebacks": 125.00
    },
    "transactions": {
      "total": 5678,
      "successful": 5534,
      "failed": 144,
      "successRate": 97.5
    },
    "payouts": {
      "total": 98765.43,
      "pending": 5234.50,
      "completed": 93530.93,
      "failed": 0.00
    },
    "escrow": {
      "totalHeld": 15678.90,
      "averageHoldTime": "24.5 hours",
      "disputedAmount": 1234.50
    },
    "trends": [
      {
        "date": "2025-02-01",
        "revenue": 4567.89,
        "transactions": 189,
        "payouts": 3456.78
      }
    ],
    "topEarners": [
      {
        "userId": "traveler_uuid",
        "name": "Jane Doe",
        "earnings": 2345.67,
        "deliveries": 45
      }
    ]
  }
}
```

### 8. Transaction Details

**GET** `/financials/transactions`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `type`: Filter by type (payment|payout|refund|chargeback)
- `status`: Filter by status
- `userId`: Filter by user
- `amountFrom`: Amount range start
- `amountTo`: Amount range end
- `dateFrom`: Date range start
- `dateTo`: Date range end

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "transaction_uuid",
      "type": "payment",
      "status": "completed",
      "amount": 45.50,
      "currency": "USD",
      "customer": {
        "id": "customer_uuid",
        "name": "John Smith"
      },
      "traveler": {
        "id": "traveler_uuid",
        "name": "Jane Doe"
      },
      "deliveryId": "delivery_uuid",
      "paymentMethod": "card",
      "platformFee": 4.55,
      "processingFee": 1.37,
      "netAmount": 39.58,
      "timestamp": "2025-02-01T10:30:00Z",
      "paymentIntentId": "pi_1234567890",
      "metadata": {
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25678,
    "totalPages": 514
  }
}
```

### 9. Dispute Management

**GET** `/disputes`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `status`: Filter by status (open|under_review|resolved|escalated)
- `category`: Filter by category
- `priority`: Filter by priority
- `assignee`: Filter by assigned admin

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "dispute_uuid",
      "caseNumber": "DISP-2025-001234",
      "status": "under_review",
      "category": "item_damaged",
      "priority": "medium",
      "amount": 500.00,
      "currency": "USD",
      "customer": {
        "id": "customer_uuid",
        "name": "John Smith",
        "email": "john@example.com"
      },
      "traveler": {
        "id": "traveler_uuid",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "delivery": {
        "id": "delivery_uuid",
        "deliveryId": "DEL-001234",
        "itemName": "Electronics"
      },
      "description": "Item was delivered damaged despite fragile handling request",
      "evidence": [
        {
          "type": "photo",
          "url": "https://evidence.com/damage1.jpg",
          "uploadedBy": "customer"
        }
      ],
      "assignee": {
        "id": "admin_uuid",
        "name": "Admin User"
      },
      "createdAt": "2025-02-01T16:00:00Z",
      "updatedAt": "2025-02-01T17:30:00Z",
      "dueDate": "2025-02-08T16:00:00Z"
    }
  ],
  "summary": {
    "byStatus": {
      "open": 45,
      "under_review": 23,
      "resolved": 567,
      "escalated": 12
    },
    "averageResolutionTime": "3.2 days"
  }
}
```

### 10. Resolve Dispute

**PUT** `/disputes/{disputeId}/resolve`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "resolution": "refund_customer|compensate_traveler|no_action|partial_refund",
  "amount": 250.00, // For partial refund/compensation
  "reason": "Evidence supports customer claim of damage",
  "customerRefund": 250.00,
  "travelerCompensation": 0.00,
  "platformLoss": 250.00,
  "internalNotes": "Clear evidence of damage, customer deserves refund",
  "customerMessage": "We've processed a partial refund for the damaged item",
  "travelerMessage": "Please ensure better packaging for fragile items",
  "preventiveMeasures": [
    "Additional training on fragile item handling",
    "Improved packaging guidelines"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "disputeId": "dispute_uuid",
    "resolution": "partial_refund",
    "status": "resolved",
    "resolvedBy": "admin_uuid",
    "resolvedAt": "2025-02-01T18:00:00Z",
    "refund": {
      "refundId": "refund_uuid",
      "amount": 250.00,
      "status": "processing"
    },
    "notifications": {
      "customerNotified": true,
      "travelerNotified": true
    }
  }
}
```

### 11. System Analytics

**GET** `/analytics/system`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `metric`: Specific metric (performance|usage|errors|security)
- `period`: Time period
- `granularity`: Data granularity (hour|day|week)

**Response:**
```json
{
  "success": true,
  "data": {
    "performance": {
      "apiResponseTime": {
        "average": 245, // ms
        "p95": 567,
        "p99": 1234
      },
      "databasePerformance": {
        "queryTime": 45, // ms average
        "connectionPool": 85, // % utilization
        "slowQueries": 12
      },
      "serverHealth": {
        "cpuUsage": 45.2, // %
        "memoryUsage": 67.8,
        "diskUsage": 34.5,
        "networkLatency": 23 // ms
      }
    },
    "usage": {
      "apiCalls": {
        "total": 1245678,
        "perMinute": 867,
        "byEndpoint": {
          "/api/v1/deliveries": 456789,
          "/api/v1/users": 234567
        }
      },
      "activeConnections": 2345,
      "concurrentUsers": 1234
    },
    "errors": {
      "errorRate": 0.15, // %
      "byType": {
        "4xx": 1234,
        "5xx": 89
      },
      "topErrors": [
        {
          "endpoint": "/api/v1/payments",
          "error": "payment_failed",
          "count": 45
        }
      ]
    },
    "security": {
      "failedLogins": 234,
      "blockedIps": 12,
      "suspiciousActivity": 5,
      "ddosAttempts": 0
    }
  }
}
```

### 12. Content Moderation

**GET** `/moderation/queue`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `type`: Content type (profile|review|message|image)
- `status`: Moderation status (pending|approved|rejected)
- `priority`: Priority level
- `reporter`: User who reported content

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "moderation_uuid",
      "type": "review",
      "status": "pending",
      "priority": "medium",
      "content": {
        "id": "review_uuid",
        "text": "This traveler was unprofessional and rude",
        "rating": 1,
        "author": {
          "id": "user_uuid",
          "name": "John Smith"
        },
        "target": {
          "id": "traveler_uuid",
          "name": "Jane Doe"
        }
      },
      "reports": [
        {
          "reportedBy": "traveler_uuid",
          "reason": "harassment",
          "description": "False and defamatory review",
          "reportedAt": "2025-02-01T14:00:00Z"
        }
      ],
      "aiAnalysis": {
        "toxicityScore": 0.15,
        "sentiment": "negative",
        "flags": ["potential_harassment"],
        "confidence": 0.85
      },
      "assignee": null,
      "createdAt": "2025-02-01T14:30:00Z",
      "dueDate": "2025-02-03T14:30:00Z"
    }
  ],
  "summary": {
    "pending": 45,
    "overdue": 5,
    "avgProcessingTime": "4.2 hours"
  }
}
```

### 13. Moderate Content

**PUT** `/moderation/{moderationId}/action`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "action": "approve|reject|edit|escalate",
  "reason": "inappropriate_content|spam|harassment|false_information",
  "moderatorNotes": "Content contains inappropriate language",
  "editedContent": "This traveler could have been more professional", // For edit action
  "userAction": {
    "warnUser": true,
    "suspendUser": false,
    "duration": 0 // days
  },
  "notifyReporter": true,
  "notifyAuthor": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "moderationId": "moderation_uuid",
    "action": "reject",
    "moderatedBy": "admin_uuid",
    "moderatedAt": "2025-02-01T15:00:00Z",
    "contentStatus": "hidden",
    "userActions": {
      "warningIssued": true,
      "suspensionApplied": false
    },
    "notifications": {
      "reporterNotified": true,
      "authorNotified": true
    }
  }
}
```

### 14. System Configuration

**GET** `/config`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "platform": {
      "maintenanceMode": false,
      "registrationEnabled": true,
      "apiRateLimit": 1000, // requests per minute
      "maxFileUploadSize": 10, // MB
      "supportedCountries": ["US", "CA", "UK", "DE", "FR"],
      "defaultCurrency": "USD",
      "platformFeeRate": 0.10 // 10%
    },
    "features": {
      "realTimeTracking": true,
      "qrCodeVerification": true,
      "autoMatching": true,
      "instantPayouts": true,
      "multiLanguageSupport": true
    },
    "limits": {
      "maxDeliveryValue": 5000.00,
      "maxDeliveryWeight": 25.0, // kg
      "maxDeliveryDistance": 1000, // km
      "maxActiveDeliveries": 10 // per user
    },
    "notifications": {
      "emailEnabled": true,
      "smsEnabled": true,
      "pushEnabled": true,
      "webhooksEnabled": true
    },
    "security": {
      "twoFactorRequired": false,
      "passwordMinLength": 8,
      "sessionTimeout": 3600, // seconds
      "maxLoginAttempts": 5
    }
  }
}
```

### 15. Update System Configuration

**PUT** `/config`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "platform": {
    "maintenanceMode": true,
    "maintenanceMessage": "System maintenance in progress. We'll be back shortly.",
    "platformFeeRate": 0.12,
    "apiRateLimit": 1200
  },
  "limits": {
    "maxDeliveryValue": 6000.00,
    "maxActiveDeliveries": 15
  },
  "security": {
    "twoFactorRequired": true,
    "sessionTimeout": 7200
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "configUpdated": true,
    "updatedBy": "admin_uuid",
    "updatedAt": "2025-02-01T16:00:00Z",
    "changes": [
      {
        "field": "platform.maintenanceMode",
        "oldValue": false,
        "newValue": true
      },
      {
        "field": "platform.platformFeeRate",
        "oldValue": 0.10,
        "newValue": 0.12
      }
    ],
    "effectiveImmediately": true
  }
}
```

### 16. System Logs

**GET** `/logs`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `level`: Log level (error|warn|info|debug)
- `service`: Service name (auth|payment|delivery|etc)
- `userId`: Filter by user
- `dateFrom`: Date range start
- `dateTo`: Date range end
- `search`: Search in log messages

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_uuid",
      "timestamp": "2025-02-01T12:00:00Z",
      "level": "error",
      "service": "payment",
      "message": "Payment processing failed for user user_uuid",
      "userId": "user_uuid",
      "requestId": "req_uuid",
      "metadata": {
        "paymentIntentId": "pi_1234567890",
        "errorCode": "card_declined",
        "amount": 45.50
      },
      "stackTrace": "Error: Card declined at PaymentProcessor.process()...",
      "ipAddress": "192.168.1.1",
      "userAgent": "P2PDelivery/1.0.0 (iOS)"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 15678,
    "totalPages": 157
  }
}
```

### 17. Backup Management

**GET** `/backups`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduled": {
      "frequency": "daily",
      "time": "02:00",
      "timezone": "UTC",
      "retention": 30, // days
      "nextBackup": "2025-02-02T02:00:00Z"
    },
    "recent": [
      {
        "id": "backup_uuid",
        "type": "full",
        "status": "completed",
        "size": "2.5 GB",
        "createdAt": "2025-02-01T02:00:00Z",
        "duration": "45 minutes",
        "downloadUrl": "https://backups.p2pdelivery.com/backup_uuid.tar.gz"
      }
    ],
    "storage": {
      "used": "75.2 GB",
      "available": "924.8 GB",
      "utilization": 7.5 // %
    }
  }
}
```

### 18. Create Manual Backup

**POST** `/backups`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "type": "full|incremental|database_only|files_only",
  "description": "Pre-deployment backup",
  "includeUploads": true,
  "includeLogs": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backupId": "backup_uuid",
    "type": "full",
    "status": "in_progress",
    "estimatedCompletion": "2025-02-01T13:45:00Z",
    "progress": 0 // %
  }
}
```

### 19. Admin Activity Log

**GET** `/activity-log`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `adminId`: Filter by admin user
- `action`: Filter by action type
- `resource`: Filter by resource type
- `dateFrom`: Date range start
- `dateTo`: Date range end

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "activity_uuid",
      "admin": {
        "id": "admin_uuid",
        "name": "Admin User",
        "email": "admin@p2pdelivery.com"
      },
      "action": "user_suspended",
      "resource": "user",
      "resourceId": "user_uuid",
      "description": "Suspended user John Doe for 7 days",
      "details": {
        "reason": "violation_of_terms",
        "duration": 7,
        "previousStatus": "active",
        "newStatus": "suspended"
      },
      "ipAddress": "10.0.0.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2025-02-01T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2345,
    "totalPages": 47
  }
}
```

### 20. Export Data

**POST** `/export`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "type": "users|deliveries|transactions|reviews|all",
  "format": "csv|json|xlsx",
  "filters": {
    "dateFrom": "2025-01-01T00:00:00Z",
    "dateTo": "2025-01-31T23:59:59Z",
    "status": "active",
    "includeDeleted": false
  },
  "fields": [
    "id", "name", "email", "createdAt", "status"
  ],
  "compression": "zip|gzip|none"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exportId": "export_uuid",
    "status": "processing",
    "type": "users",
    "format": "csv",
    "estimatedRecords": 12450,
    "estimatedSize": "5.2 MB",
    "estimatedCompletion": "2025-02-01T17:15:00Z",
    "downloadUrl": null, // Available when completed
    "expiresAt": "2025-02-08T17:00:00Z" // Download link expiration
  }
}
```