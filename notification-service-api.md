# Notification Service API

Base URL: `/api/v1/notifications`

## Endpoints

### 1. Send Push Notification

**POST** `/push`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token> (for admin-sent notifications)
```

**Request Body:**
```json
{
  "recipients": [
    {
      "userId": "user_uuid",
      "deviceTokens": ["fcm_token_1", "fcm_token_2"],
      "platform": "ios|android|web"
    }
  ],
  "notification": {
    "title": "Delivery Update",
    "body": "Your package has been picked up and is on its way!",
    "icon": "https://cdn.p2pdelivery.com/icons/pickup.png",
    "image": "https://cdn.p2pdelivery.com/images/delivery-truck.jpg",
    "sound": "default|custom_sound.wav",
    "badge": 5,
    "category": "delivery_update",
    "priority": "high|normal|low"
  },
  "data": {
    "type": "delivery_update",
    "deliveryId": "delivery_uuid",
    "status": "picked_up",
    "deepLink": "p2pdelivery://delivery/delivery_uuid",
    "customData": {
      "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid",
      "estimatedArrival": "2025-02-01T14:30:00Z"
    }
  },
  "targeting": {
    "userTypes": ["customer", "traveler"],
    "locations": [
      {
        "lat": 40.7128,
        "lng": -74.0060,
        "radius": 10000 // meters
      }
    ],
    "segments": ["premium_users", "frequent_customers"]
  },
  "scheduling": {
    "sendAt": "2025-02-01T13:00:00Z", // Optional, for scheduled notifications
    "timezone": "America/New_York"
  },
  "options": {
    "collapse_key": "delivery_updates", // Android
    "time_to_live": 3600, // seconds
    "dry_run": false,
    "analytics": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "notification_uuid",
    "status": "sent",
    "recipientCount": 2,
    "results": [
      {
        "userId": "user_uuid",
        "deviceToken": "fcm_token_1",
        "status": "success",
        "messageId": "msg_uuid_1"
      },
      {
        "userId": "user_uuid",
        "deviceToken": "fcm_token_2",
        "status": "failed",
        "error": "invalid_token"
      }
    ],
    "analytics": {
      "sent": 1,
      "failed": 1,
      "failureReasons": {
        "invalid_token": 1
      }
    },
    "sentAt": "2025-02-01T12:00:00Z"
  }
}
```

### 2. Send Email Notification

**POST** `/email`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "recipients": [
    {
      "email": "user@example.com",
      "name": "John Doe",
      "userId": "user_uuid"
    }
  ],
  "email": {
    "subject": "Your Delivery is On Its Way!",
    "templateId": "delivery_update_template",
    "templateData": {
      "customerName": "John",
      "deliveryId": "DEL-001234",
      "itemName": "Legal Documents",
      "travelerName": "Jane Doe",
      "estimatedArrival": "2025-02-01T14:30:00Z",
      "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid"
    },
    "htmlContent": "<html>...</html>", // Alternative to template
    "textContent": "Plain text version...", // Alternative to template
    "attachments": [
      {
        "filename": "receipt.pdf",
        "content": "base64_encoded_content",
        "contentType": "application/pdf"
      }
    ]
  },
  "options": {
    "priority": "high|normal|low",
    "tracking": {
      "opens": true,
      "clicks": true,
      "unsubscribes": true
    },
    "sendAt": "2025-02-01T13:00:00Z", // Optional scheduling
    "timezone": "America/New_York"
  },
  "branding": {
    "fromName": "P2P Delivery",
    "fromEmail": "noreply@p2pdelivery.com",
    "replyTo": "support@p2pdelivery.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "emailId": "email_uuid",
    "status": "sent",
    "recipientCount": 1,
    "results": [
      {
        "email": "user@example.com",
        "status": "accepted",
        "messageId": "msg_uuid"
      }
    ],
    "sentAt": "2025-02-01T12:00:00Z",
    "tracking": {
      "trackingId": "track_uuid",
      "trackingUrl": "https://track.p2pdelivery.com/email/track_uuid"
    }
  }
}
```

### 3. Send SMS Notification

**POST** `/sms`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "recipients": [
    {
      "phoneNumber": "+1234567890",
      "userId": "user_uuid",
      "country": "US"
    }
  ],
  "message": {
    "text": "Your delivery DEL-001234 has been picked up! Track: https://track.p2pdelivery.com/delivery_uuid",
    "templateId": "delivery_update_sms",
    "templateData": {
      "deliveryId": "DEL-001234",
      "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid"
    }
  },
  "options": {
    "senderId": "P2PDelivery", // Custom sender ID where supported
    "priority": "high|normal",
    "unicode": false,
    "flashSms": false,
    "sendAt": "2025-02-01T13:00:00Z" // Optional scheduling
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "smsId": "sms_uuid",
    "status": "sent",
    "recipientCount": 1,
    "results": [
      {
        "phoneNumber": "+1234567890",
        "status": "accepted",
        "messageId": "msg_uuid",
        "cost": 0.05, // USD
        "segments": 1
      }
    ],
    "totalCost": 0.05,
    "sentAt": "2025-02-01T12:00:00Z"
  }
}
```

### 4. Send In-App Notification

**POST** `/in-app`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "recipients": [
    {
      "userId": "user_uuid"
    }
  ],
  "notification": {
    "title": "New Delivery Request",
    "message": "You have a new delivery request from New York to Boston",
    "type": "delivery_request|delivery_update|payment|system|promotional",
    "priority": "high|normal|low",
    "icon": "delivery_icon",
    "color": "#007AFF",
    "actions": [
      {
        "id": "view_request",
        "label": "View Request",
        "action": "navigate",
        "target": "/delivery-requests/request_uuid"
      },
      {
        "id": "dismiss",
        "label": "Dismiss",
        "action": "dismiss"
      }
    ]
  },
  "data": {
    "deliveryRequestId": "request_uuid",
    "customerId": "customer_uuid",
    "estimatedPrice": 45.00,
    "urgency": "standard"
  },
  "persistence": {
    "persistent": true,
    "expiresAt": "2025-02-08T12:00:00Z",
    "maxRetries": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "inapp_uuid",
    "status": "sent",
    "recipientCount": 1,
    "results": [
      {
        "userId": "user_uuid",
        "status": "delivered",
        "deliveredAt": "2025-02-01T12:00:00Z"
      }
    ]
  }
}
```

### 5. Get User Notifications

**GET** `/user/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `type`: Filter by type (push|email|sms|in_app)
- `status`: Filter by status (sent|delivered|read|failed)
- `category`: Filter by category
- `dateFrom`: Date range start
- `dateTo`: Date range end
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "notification_uuid",
      "type": "push",
      "category": "delivery_update",
      "title": "Delivery Update",
      "message": "Your package has been picked up and is on its way!",
      "status": "delivered",
      "sentAt": "2025-02-01T12:00:00Z",
      "deliveredAt": "2025-02-01T12:00:05Z",
      "readAt": "2025-02-01T12:05:00Z",
      "data": {
        "deliveryId": "delivery_uuid",
        "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid"
      },
      "actions": [
        {
          "id": "track_delivery",
          "label": "Track Delivery",
          "clicked": true,
          "clickedAt": "2025-02-01T12:06:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "summary": {
    "unread": 3,
    "total": 45,
    "byType": {
      "push": 25,
      "email": 15,
      "sms": 3,
      "in_app": 2
    }
  }
}
```

### 6. Mark Notification as Read

**PUT** `/user/{userId}/{notificationId}/read`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "notification_uuid",
    "status": "read",
    "readAt": "2025-02-01T12:30:00Z"
  }
}
```

### 7. Mark All Notifications as Read

**PUT** `/user/{userId}/read-all`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "category": "delivery_update", // Optional, to mark specific category
  "type": "push" // Optional, to mark specific type
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markedAsRead": 12,
    "timestamp": "2025-02-01T12:30:00Z"
  }
}
```

### 8. Delete Notification

**DELETE** `/user/{userId}/{notificationId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "notification_uuid",
    "deleted": true,
    "deletedAt": "2025-02-01T12:30:00Z"
  }
}
```

### 9. Update Notification Preferences

**PUT** `/preferences/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "channels": {
    "push": {
      "enabled": true,
      "categories": {
        "delivery_updates": true,
        "new_requests": true,
        "payment_notifications": true,
        "promotional": false,
        "system_alerts": true
      },
      "quiet_hours": {
        "enabled": true,
        "start": "22:00",
        "end": "08:00",
        "timezone": "America/New_York"
      }
    },
    "email": {
      "enabled": true,
      "categories": {
        "delivery_updates": true,
        "receipts": true,
        "weekly_summary": true,
        "promotional": false,
        "system_alerts": true
      },
      "frequency": "immediate|daily|weekly"
    },
    "sms": {
      "enabled": false,
      "categories": {
        "delivery_updates": false,
        "payment_notifications": true,
        "security_alerts": true
      }
    },
    "in_app": {
      "enabled": true,
      "categories": {
        "delivery_updates": true,
        "new_requests": true,
        "system_alerts": true
      }
    }
  },
  "language": "en",
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_uuid",
    "preferences": {
      "channels": {
        "push": {
          "enabled": true,
          "categories": {
            "delivery_updates": true,
            "new_requests": true,
            "payment_notifications": true,
            "promotional": false,
            "system_alerts": true
          }
        }
      }
    },
    "updatedAt": "2025-02-01T12:30:00Z"
  }
}
```

### 10. Get Notification Preferences

**GET** `/preferences/{userId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_uuid",
    "preferences": {
      "channels": {
        "push": {
          "enabled": true,
          "categories": {
            "delivery_updates": true,
            "new_requests": true,
            "payment_notifications": true,
            "promotional": false,
            "system_alerts": true
          },
          "quiet_hours": {
            "enabled": true,
            "start": "22:00",
            "end": "08:00",
            "timezone": "America/New_York"
          }
        },
        "email": {
          "enabled": true,
          "categories": {
            "delivery_updates": true,
            "receipts": true,
            "weekly_summary": true,
            "promotional": false,
            "system_alerts": true
          },
          "frequency": "immediate"
        },
        "sms": {
          "enabled": false,
          "categories": {
            "delivery_updates": false,
            "payment_notifications": true,
            "security_alerts": true
          }
        }
      },
      "language": "en",
      "timezone": "America/New_York"
    },
    "lastUpdated": "2025-02-01T12:30:00Z"
  }
}
```

### 11. Create Notification Template

**POST** `/templates`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "name": "delivery_picked_up",
  "description": "Notification when item is picked up",
  "category": "delivery_update",
  "channels": {
    "push": {
      "title": "📦 Delivery Update",
      "body": "Your {{itemName}} has been picked up by {{travelerName}} and is on its way to {{destination}}!",
      "icon": "pickup_icon",
      "sound": "default"
    },
    "email": {
      "subject": "Your {{itemName}} is on its way!",
      "htmlTemplate": "<html>...</html>",
      "textTemplate": "Your {{itemName}} has been picked up..."
    },
    "sms": {
      "message": "Your delivery {{deliveryId}} has been picked up! Track: {{trackingUrl}}"
    },
    "in_app": {
      "title": "Item Picked Up",
      "message": "{{travelerName}} has picked up your {{itemName}}",
      "actions": [
        {
          "id": "track",
          "label": "Track Delivery",
          "action": "navigate",
          "target": "/deliveries/{{deliveryId}}"
        }
      ]
    }
  },
  "variables": [
    {
      "name": "itemName",
      "type": "string",
      "required": true,
      "description": "Name of the item being delivered"
    },
    {
      "name": "travelerName",
      "type": "string",
      "required": true,
      "description": "Name of the traveler"
    },
    {
      "name": "destination",
      "type": "string",
      "required": true,
      "description": "Delivery destination"
    },
    {
      "name": "deliveryId",
      "type": "string",
      "required": true,
      "description": "Delivery tracking ID"
    },
    {
      "name": "trackingUrl",
      "type": "url",
      "required": true,
      "description": "URL to track the delivery"
    }
  ],
  "targeting": {
    "userTypes": ["customer"],
    "conditions": [
      {
        "field": "delivery.status",
        "operator": "equals",
        "value": "picked_up"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templateId": "template_uuid",
    "name": "delivery_picked_up",
    "status": "active",
    "version": 1,
    "createdAt": "2025-02-01T12:00:00Z",
    "createdBy": "admin_uuid"
  }
}
```

### 12. Send Automated Notification

**POST** `/automated`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "templateId": "template_uuid",
  "triggerId": "delivery_uuid", // ID of the entity that triggered this
  "triggerType": "delivery_status_change",
  "recipients": [
    {
      "userId": "user_uuid",
      "channels": ["push", "email"]
    }
  ],
  "templateData": {
    "itemName": "Legal Documents",
    "travelerName": "Jane Doe",
    "destination": "Boston, MA",
    "deliveryId": "DEL-001234",
    "trackingUrl": "https://track.p2pdelivery.com/delivery_uuid"
  },
  "options": {
    "priority": "normal",
    "deduplication": {
      "enabled": true,
      "window": 300 // seconds
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "auto_notification_uuid",
    "templateId": "template_uuid",
    "status": "sent",
    "channels": ["push", "email"],
    "recipientCount": 1,
    "sentAt": "2025-02-01T12:00:00Z"
  }
}
```

### 13. Get Notification Analytics

**GET** `/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `period`: Time period (day|week|month|quarter)
- `channel`: Filter by channel (push|email|sms|in_app)
- `category`: Filter by category
- `templateId`: Filter by template

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "week",
    "summary": {
      "totalSent": 15420,
      "totalDelivered": 14856,
      "totalOpened": 8934,
      "totalClicked": 3567,
      "deliveryRate": 96.3,
      "openRate": 60.1,
      "clickRate": 23.1
    },
    "byChannel": {
      "push": {
        "sent": 8520,
        "delivered": 8234,
        "opened": 6187,
        "clicked": 2456,
        "deliveryRate": 96.6,
        "openRate": 75.1,
        "clickRate": 28.8
      },
      "email": {
        "sent": 4200,
        "delivered": 4015,
        "opened": 2145,
        "clicked": 856,
        "deliveryRate": 95.6,
        "openRate": 53.4,
        "clickRate": 20.4
      },
      "sms": {
        "sent": 1500,
        "delivered": 1467,
        "clicked": 234,
        "deliveryRate": 97.8,
        "clickRate": 15.6
      },
      "in_app": {
        "sent": 1200,
        "delivered": 1140,
        "opened": 402,
        "clicked": 21,
        "deliveryRate": 95.0,
        "openRate": 35.3,
        "clickRate": 1.8
      }
    },
    "byCategory": [
      {
        "category": "delivery_updates",
        "sent": 6780,
        "deliveryRate": 97.2,
        "openRate": 78.5,
        "clickRate": 35.2
      },
      {
        "category": "new_requests",
        "sent": 3240,
        "deliveryRate": 95.8,
        "openRate": 45.3,
        "clickRate": 18.7
      }
    ],
    "trends": [
      {
        "date": "2025-02-01",
        "sent": 2205,
        "delivered": 2134,
        "opened": 1278,
        "clicked": 510
      }
    ],
    "topPerforming": [
      {
        "templateId": "delivery_picked_up",
        "name": "Delivery Picked Up",
        "sent": 1250,
        "openRate": 85.2,
        "clickRate": 42.1
      }
    ]
  }
}
```

### 14. Bulk Notification Operations

**POST** `/bulk`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "operation": "send|cancel|reschedule",
  "notifications": [
    {
      "templateId": "template_uuid",
      "recipients": [
        {
          "userId": "user_uuid_1",
          "channels": ["push", "email"]
        },
        {
          "userId": "user_uuid_2",
          "channels": ["push"]
        }
      ],
      "templateData": {
        "itemName": "Electronics",
        "travelerName": "John Smith"
      }
    }
  ],
  "options": {
    "batchSize": 100,
    "delayBetweenBatches": 10, // seconds
    "priority": "normal",
    "sendAt": "2025-02-01T15:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bulkOperationId": "bulk_uuid",
    "status": "processing",
    "totalNotifications": 2,
    "estimatedCompletion": "2025-02-01T15:05:00Z",
    "progress": {
      "processed": 0,
      "successful": 0,
      "failed": 0
    }
  }
}
```

### 15. Get Bulk Operation Status

**GET** `/bulk/{bulkOperationId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bulkOperationId": "bulk_uuid",
    "status": "completed",
    "createdAt": "2025-02-01T14:00:00Z",
    "completedAt": "2025-02-01T15:05:00Z",
    "totalNotifications": 2,
    "progress": {
      "processed": 2,
      "successful": 2,
      "failed": 0
    },
    "results": [
      {
        "notificationId": "notification_uuid_1",
        "status": "sent",
        "channels": ["push", "email"],
        "sentAt": "2025-02-01T15:02:00Z"
      },
      {
        "notificationId": "notification_uuid_2",
        "status": "sent",
        "channels": ["push"],
        "sentAt": "2025-02-01T15:03:00Z"
      }
    ]
  }
}
```

### 16. Notification Webhooks

**POST** `/webhooks`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/notifications",
  "events": [
    "notification.sent",
    "notification.delivered",
    "notification.opened",
    "notification.clicked",
    "notification.failed"
  ],
  "secret": "webhook_secret_key",
  "active": true,
  "filters": {
    "categories": ["delivery_updates", "payment"],
    "channels": ["push", "email"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhookId": "webhook_uuid",
    "url": "https://your-app.com/webhooks/notifications",
    "events": [
      "notification.sent",
      "notification.delivered",
      "notification.opened",
      "notification.clicked",
      "notification.failed"
    ],
    "active": true,
    "createdAt": "2025-02-01T12:00:00Z"
  }
}
```

### 17. Test Notification

**POST** `/test`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "channel": "push|email|sms|in_app",
  "templateId": "template_uuid",
  "templateData": {
    "itemName": "Test Item",
    "travelerName": "Test Traveler"
  },
  "testMode": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "testNotificationId": "test_notification_uuid",
    "status": "sent",
    "channel": "push",
    "sentAt": "2025-02-01T12:00:00Z",
    "preview": {
      "title": "📦 Delivery Update",
      "body": "Your Test Item has been picked up by Test Traveler and is on its way!"
    }
  }
}
```

### 18. Unsubscribe from Notifications

**POST** `/unsubscribe`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "channel": "email|sms|all",
  "category": "promotional|all", // Optional
  "token": "unsubscribe_token" // From email/sms unsubscribe link
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_uuid",
    "unsubscribed": {
      "channel": "email",
      "category": "promotional"
    },
    "unsubscribedAt": "2025-02-01T12:00:00Z"
  }
}
```

### 19. Get Notification Delivery Report

**GET** `/reports/delivery`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Query Parameters:**
- `dateFrom`: Report start date
- `dateTo`: Report end date
- `format`: Report format (json|csv|pdf)
- `groupBy`: Group by (day|week|channel|category)

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report_uuid",
    "period": {
      "from": "2025-01-01T00:00:00Z",
      "to": "2025-01-31T23:59:59Z"
    },
    "summary": {
      "totalNotifications": 45620,
      "deliveryRate": 96.3,
      "averageDeliveryTime": "2.3 seconds",
      "failureRate": 3.7
    },
    "byChannel": [
      {
        "channel": "push",
        "sent": 25340,
        "delivered": 24567,
        "failed": 773,
        "deliveryRate": 96.9
      }
    ],
    "failures": [
      {
        "reason": "invalid_token",
        "count": 1250,
        "percentage": 2.7
      },
      {
        "reason": "network_error",
        "count": 445,
        "percentage": 1.0
      }
    ],
    "downloadUrl": "https://reports.p2pdelivery.com/delivery_report.pdf",
    "generatedAt": "2025-02-01T12:00:00Z"
  }
}
```

### 20. Smart Notification Optimization

**POST** `/optimize`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "optimizationGoal": "engagement|delivery_rate|cost_efficiency",
  "analysisWindow": "30 days",
  "channels": ["push", "email", "sms"],
  "categories": ["delivery_updates", "new_requests"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_uuid",
    "currentPerformance": {
      "deliveryRate": 94.2,
      "openRate": 67.8,
      "clickRate": 23.5
    },
    "recommendations": [
      {
        "type": "channel_optimization",
        "description": "Switch promotional notifications from SMS to email",
        "expectedImprovement": {
          "costReduction": "45%",
          "engagementIncrease": "12%"
        }
      },
      {
        "type": "timing_optimization",
        "description": "Send delivery updates 2 hours earlier for better engagement",
        "expectedImprovement": {
          "openRateIncrease": "18%"
        }
      },
      {
        "type": "frequency_optimization",
        "description": "Reduce notification frequency by 25% to prevent fatigue",
        "expectedImprovement": {
          "unsubscribeReduction": "30%",
          "engagementIncrease": "8%"
        }
      }
    ],
    "optimalSettings": {
      "channels": {
        "push": {
          "categories": ["delivery_updates", "urgent_alerts"],
          "timing": "immediate"
        },
        "email": {
          "categories": ["receipts", "summaries", "promotional"],
          "timing": "batch_daily"
        }
      },
      "quiet_hours": {
        "start": "22:00",
        "end": "07:00"
      }
    }
  }
}
```