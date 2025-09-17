# QR Code Service API

Base URL: `/api/v1/qr`

## Endpoints

### 1. Generate Pickup QR Code

**POST** `/pickup/generate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "expirationTime": "2025-02-01T12:00:00Z", // Optional, defaults to 24 hours
  "securityLevel": "standard|high|maximum",
  "additionalData": {
    "itemDescription": "Legal Documents",
    "expectedWeight": 0.5,
    "specialInstructions": "Handle with care"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCodeId": "qr_pickup_uuid",
    "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
    "qrCodeImage": "data:image/png;base64,iVBOR...",
    "downloadUrl": "https://qr.p2pdelivery.com/pickup_uuid.png",
    "expiresAt": "2025-02-01T12:00:00Z",
    "scanInstructions": "Show this QR code to the traveler for item pickup verification",
    "backupCode": "PICKUP-123-456-789", // In case QR scan fails
    "securityFeatures": {
      "encrypted": true,
      "timestamped": true,
      "locationBound": false,
      "singleUse": true
    }
  }
}
```

### 2. Generate Delivery QR Code

**POST** `/delivery/generate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "pickupQrId": "qr_pickup_uuid", // Links to pickup QR for verification chain
  "expirationTime": "2025-02-01T15:00:00Z",
  "securityLevel": "standard|high|maximum",
  "requiresSignature": true,
  "requiresPhoto": true,
  "locationVerification": {
    "required": true,
    "radius": 100 // meters
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCodeId": "qr_delivery_uuid",
    "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
    "qrCodeImage": "data:image/png;base64,iVBOR...",
    "downloadUrl": "https://qr.p2pdelivery.com/delivery_uuid.png",
    "expiresAt": "2025-02-01T15:00:00Z",
    "scanInstructions": "Show this QR code to the recipient for delivery confirmation",
    "backupCode": "DELIVERY-987-654-321",
    "securityFeatures": {
      "encrypted": true,
      "timestamped": true,
      "locationBound": true,
      "requiresSignature": true,
      "requiresPhoto": true,
      "singleUse": true
    }
  }
}
```

### 3. Validate Pickup QR Code

**POST** `/pickup/validate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "QR_ENCRYPTED_DATA_STRING", // Or use qrCodeId + backupCode
  "qrCodeId": "qr_pickup_uuid", // Alternative method
  "backupCode": "PICKUP-123-456-789", // Alternative method
  "scannerLocation": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10 // meters
  },
  "deviceInfo": {
    "deviceId": "device_uuid",
    "platform": "ios|android|web",
    "appVersion": "1.0.0"
  },
  "additionalVerification": {
    "photoTaken": true,
    "photoUrl": "https://photos.example.com/pickup.jpg",
    "notes": "Item received in good condition"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "deliveryId": "delivery_uuid",
    "verification": {
      "verificationId": "verification_uuid",
      "timestamp": "2025-02-01T11:30:00Z",
      "location": {
        "lat": 40.7128,
        "lng": -74.0060
      },
      "verifiedBy": {
        "id": "traveler_uuid",
        "firstName": "Jane",
        "lastName": "Doe"
      }
    },
    "delivery": {
      "id": "delivery_uuid",
      "status": "picked_up",
      "item": {
        "name": "Legal Documents",
        "expectedWeight": 0.5
      },
      "customer": {
        "firstName": "John",
        "lastName": "Smith"
      }
    },
    "nextSteps": {
      "deliveryQrRequired": true,
      "estimatedDeliveryTime": "2025-02-01T13:30:00Z",
      "deliveryInstructions": "Contact recipient 30 minutes before arrival"
    },
    "blockchain": {
      "transactionHash": "0x1234...abcd",
      "blockNumber": 12345678
    }
  }
}
```

### 4. Validate Delivery QR Code

**POST** `/delivery/validate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
  "qrCodeId": "qr_delivery_uuid", // Alternative method
  "backupCode": "DELIVERY-987-654-321", // Alternative method
  "scannerLocation": {
    "lat": 42.3601,
    "lng": -71.0589,
    "accuracy": 5
  },
  "recipientVerification": {
    "recipientPresent": true,
    "recipientId": "recipient_uuid", // If registered user
    "recipientName": "Jane Doe",
    "recipientSignature": "data:image/png;base64,signature...",
    "idVerification": {
      "method": "photo_id|biometric|none",
      "photoUrl": "https://photos.example.com/id.jpg"
    }
  },
  "deliveryEvidence": {
    "photoUrl": "https://photos.example.com/delivery.jpg",
    "videoUrl": "https://videos.example.com/delivery.mp4",
    "notes": "Delivered to recipient in person",
    "condition": "excellent|good|fair|damaged"
  },
  "deviceInfo": {
    "deviceId": "device_uuid",
    "platform": "ios|android|web",
    "appVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "deliveryId": "delivery_uuid",
    "verification": {
      "verificationId": "verification_uuid",
      "timestamp": "2025-02-01T13:45:00Z",
      "location": {
        "lat": 42.3601,
        "lng": -71.0589
      },
      "deliveredBy": {
        "id": "traveler_uuid",
        "firstName": "Jane",
        "lastName": "Doe"
      },
      "receivedBy": {
        "name": "Jane Doe",
        "signature": "data:image/png;base64,signature..."
      }
    },
    "delivery": {
      "id": "delivery_uuid",
      "status": "completed",
      "completedAt": "2025-02-01T13:45:00Z",
      "timeline": {
        "requested": "2025-01-01T00:00:00Z",
        "accepted": "2025-01-01T01:00:00Z",
        "pickedUp": "2025-02-01T11:30:00Z",
        "completed": "2025-02-01T13:45:00Z"
      }
    },
    "payment": {
      "status": "processing",
      "amount": 28.00,
      "currency": "USD",
      "releaseTime": "2025-02-01T14:45:00Z"
    },
    "blockchain": {
      "transactionHash": "0x5678...efgh",
      "blockNumber": 12345679
    }
  }
}
```

### 5. Get QR Code Details

**GET** `/{qrCodeId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "qr_pickup_uuid",
    "type": "pickup|delivery",
    "deliveryId": "delivery_uuid",
    "status": "active|used|expired|revoked",
    "createdAt": "2025-02-01T10:00:00Z",
    "expiresAt": "2025-02-01T12:00:00Z",
    "usedAt": null,
    "securityLevel": "standard",
    "features": {
      "encrypted": true,
      "timestamped": true,
      "locationBound": false,
      "singleUse": true
    },
    "scanHistory": [
      {
        "timestamp": "2025-02-01T11:15:00Z",
        "scannedBy": "traveler_uuid",
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "result": "invalid_location"
      }
    ],
    "delivery": {
      "item": {
        "name": "Legal Documents"
      },
      "customer": {
        "firstName": "John",
        "lastName": "Smith"
      },
      "traveler": {
        "firstName": "Jane",
        "lastName": "Doe"
      }
    }
  }
}
```

### 6. Regenerate QR Code

**POST** `/{qrCodeId}/regenerate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "expired|compromised|lost|damaged",
  "newExpirationTime": "2025-02-01T15:00:00Z",
  "securityLevel": "high"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "newQrCodeId": "qr_pickup_uuid_v2",
    "qrCodeData": "NEW_QR_ENCRYPTED_DATA_STRING",
    "qrCodeImage": "data:image/png;base64,iVBOR...",
    "downloadUrl": "https://qr.p2pdelivery.com/pickup_uuid_v2.png",
    "expiresAt": "2025-02-01T15:00:00Z",
    "backupCode": "PICKUP-111-222-333",
    "previousQrRevoked": true
  }
}
```

### 7. Revoke QR Code

**POST** `/{qrCodeId}/revoke`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "security_concern|delivery_cancelled|duplicate_generated|other",
  "message": "Delivery was cancelled by customer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCodeId": "qr_pickup_uuid",
    "status": "revoked",
    "revokedAt": "2025-02-01T12:00:00Z",
    "reason": "delivery_cancelled"
  }
}
```

### 8. Get QR Code History

**GET** `/history`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `deliveryId`: Filter by delivery ID
- `type`: Filter by QR type (pickup|delivery)
- `status`: Filter by status
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
      "id": "qr_pickup_uuid",
      "type": "pickup",
      "deliveryId": "delivery_uuid",
      "status": "used",
      "createdAt": "2025-02-01T10:00:00Z",
      "usedAt": "2025-02-01T11:30:00Z",
      "delivery": {
        "item": {
          "name": "Legal Documents"
        },
        "route": {
          "origin": "New York, NY",
          "destination": "Boston, MA"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

### 9. Bulk Generate QR Codes

**POST** `/bulk-generate`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveries": [
    {
      "deliveryId": "delivery_uuid_1",
      "type": "pickup",
      "expirationTime": "2025-02-01T12:00:00Z"
    },
    {
      "deliveryId": "delivery_uuid_1",
      "type": "delivery",
      "expirationTime": "2025-02-01T15:00:00Z"
    }
  ],
  "securityLevel": "standard",
  "downloadFormat": "png|pdf|svg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batchId": "batch_uuid",
    "qrCodes": [
      {
        "deliveryId": "delivery_uuid_1",
        "type": "pickup",
        "qrCodeId": "qr_pickup_uuid_1",
        "downloadUrl": "https://qr.p2pdelivery.com/pickup_uuid_1.png"
      },
      {
        "deliveryId": "delivery_uuid_1",
        "type": "delivery",
        "qrCodeId": "qr_delivery_uuid_1",
        "downloadUrl": "https://qr.p2pdelivery.com/delivery_uuid_1.png"
      }
    ],
    "bulkDownloadUrl": "https://qr.p2pdelivery.com/batch_uuid.zip",
    "expiresAt": "2025-02-02T00:00:00Z"
  }
}
```

### 10. Verify QR Code Integrity

**POST** `/verify-integrity`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrCodeData": "QR_ENCRYPTED_DATA_STRING",
  "expectedDeliveryId": "delivery_uuid",
  "expectedType": "pickup|delivery"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "integrity": "verified",
    "deliveryId": "delivery_uuid",
    "type": "pickup",
    "issuedAt": "2025-02-01T10:00:00Z",
    "expiresAt": "2025-02-01T12:00:00Z",
    "securityChecks": {
      "signatureValid": true,
      "timestampValid": true,
      "notExpired": true,
      "notRevoked": true,
      "checksumValid": true
    }
  }
}
```

### 11. Get QR Code Analytics

**GET** `/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (day|week|month|quarter)
- `type`: QR type filter
- `groupBy`: Group by (day|week|month)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalGenerated": 156,
      "totalScanned": 142,
      "successfulScans": 138,
      "failedScans": 4,
      "scanSuccessRate": 97.2,
      "averageTimeToScan": "2.5 minutes"
    },
    "breakdown": {
      "pickup": {
        "generated": 78,
        "scanned": 76,
        "successRate": 97.4
      },
      "delivery": {
        "generated": 78,
        "scanned": 66,
        "successRate": 84.6
      }
    },
    "trends": [
      {
        "date": "2025-02-01",
        "generated": 12,
        "scanned": 11,
        "successRate": 91.7
      }
    ],
    "failureReasons": [
      {
        "reason": "expired",
        "count": 2,
        "percentage": 50.0
      },
      {
        "reason": "invalid_location",
        "count": 1,
        "percentage": 25.0
      }
    ]
  }
}
```

### 12. Test QR Code Scanner

**POST** `/test-scanner`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "testType": "pickup|delivery|both",
  "mockData": {
    "deliveryId": "test_delivery_uuid",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "deviceInfo": {
      "platform": "ios",
      "appVersion": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "testResults": {
      "pickup": {
        "qrGenerated": true,
        "scanSuccessful": true,
        "validationPassed": true,
        "responseTime": "245ms"
      },
      "delivery": {
        "qrGenerated": true,
        "scanSuccessful": true,
        "validationPassed": true,
        "responseTime": "267ms"
      }
    },
    "systemHealth": {
      "qrGenerationService": "healthy",
      "validationService": "healthy",
      "blockchainService": "healthy",
      "databaseService": "healthy"
    }
  }
}
```

### 13. Get Security Audit Log

**GET** `/security-audit`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `deliveryId`: Filter by delivery
- `eventType`: Filter by event type
- `severity`: Filter by severity level
- `dateFrom`: Date range start
- `dateTo`: Date range end

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit_uuid",
      "timestamp": "2025-02-01T11:30:00Z",
      "eventType": "qr_scan_attempt",
      "severity": "info",
      "qrCodeId": "qr_pickup_uuid",
      "deliveryId": "delivery_uuid",
      "userId": "traveler_uuid",
      "details": {
        "scanResult": "success",
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "deviceInfo": {
          "platform": "ios",
          "appVersion": "1.0.0"
        }
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "P2PDelivery/1.0.0 (iOS)"
    }
  ]
}
```

### 14. Emergency QR Override

**POST** `/emergency-override`

**Headers:**
```
Authorization: Bearer <access_token>
X-Admin-Token: <admin_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "qrCodeId": "qr_pickup_uuid",
  "overrideReason": "technical_failure|emergency_situation|customer_request",
  "description": "QR scanner hardware failure at pickup location",
  "alternativeVerification": {
    "method": "manual_code|photo_verification|video_call",
    "evidence": [
      {
        "type": "photo",
        "url": "https://evidence.com/photo.jpg",
        "description": "Photo of item and parties involved"
      }
    ]
  },
  "approvedBy": "admin_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overrideId": "override_uuid",
    "status": "approved",
    "deliveryId": "delivery_uuid",
    "alternativeCode": "EMERGENCY-999-888-777",
    "validFor": "30 minutes",
    "expiresAt": "2025-02-01T12:30:00Z",
    "auditTrail": {
      "requestedBy": "traveler_uuid",
      "approvedBy": "admin_uuid",
      "timestamp": "2025-02-01T12:00:00Z"
    }
  }
}
```

### 15. QR Code Performance Metrics

**GET** `/performance-metrics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "realTime": {
      "activeQrCodes": 45,
      "scansPerMinute": 2.3,
      "averageResponseTime": "234ms",
      "successRate": 97.8
    },
    "daily": {
      "qrCodesGenerated": 156,
      "totalScans": 142,
      "uniqueUsers": 78,
      "peakHour": "14:00-15:00"
    },
    "systemLoad": {
      "cpuUsage": "12%",
      "memoryUsage": "45%",
      "storageUsage": "23%",
      "networkLatency": "45ms"
    },
    "blockchain": {
      "transactionsPerSecond": 15.2,
      "averageConfirmationTime": "2.3 seconds",
      "gasPrice": "20 gwei"
    }
  }
}
```