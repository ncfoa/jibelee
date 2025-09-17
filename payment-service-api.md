# Payment & Pricing Service API

Base URL: `/api/v1/payments`

## Endpoints

### 1. Calculate Delivery Price

**POST** `/calculate-price`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryRequest": {
    "id": "request_uuid", // Optional, for existing request
    "route": {
      "origin": {
        "lat": 40.7128,
        "lng": -74.0060,
        "address": "New York, NY"
      },
      "destination": {
        "lat": 42.3601,
        "lng": -71.0589,
        "address": "Boston, MA"
      }
    },
    "item": {
      "weight": 2.5, // kg
      "dimensions": {
        "length": 30,
        "width": 20,
        "height": 10
      },
      "value": 500.00,
      "category": "electronics|documents|clothing|fragile|other",
      "fragile": true,
      "hazardous": false
    },
    "urgency": "standard|express|urgent",
    "timeWindow": {
      "pickup": {
        "start": "2025-02-01T09:00:00Z",
        "end": "2025-02-01T18:00:00Z"
      },
      "delivery": {
        "start": "2025-02-01T10:00:00Z",
        "end": "2025-02-01T20:00:00Z"
      }
    }
  },
  "trip": {
    "id": "trip_uuid", // Optional, for specific trip
    "type": "flight|train|bus|car",
    "departureTime": "2025-02-01T10:00:00Z",
    "arrivalTime": "2025-02-01T11:30:00Z"
  },
  "traveler": {
    "id": "traveler_uuid", // Optional, for traveler-specific pricing
    "rating": 4.8,
    "experienceLevel": "novice|experienced|expert",
    "specializations": ["fragile_items", "electronics", "documents"]
  },
  "options": {
    "includeInsurance": true,
    "expeditedService": false,
    "whiteGloveService": false,
    "photoUpdates": true,
    "signatureRequired": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pricing": {
      "basePrice": 15.00,
      "breakdown": {
        "baseFee": 15.00,
        "distanceFee": 15.30, // $0.05 per km * 306 km
        "weightFee": 12.50, // $5.00 per kg * 2.5 kg
        "urgencyMultiplier": 0.00, // 0% for standard
        "fragileMultiplier": 4.50, // 30% of base components
        "categoryFee": 5.00, // Electronics premium
        "timingFee": 0.00, // No peak time
        "travelerExperienceFee": 2.00, // High-rated traveler premium
        "insuranceFee": 5.00,
        "serviceFeesTotal": 2.50,
        "platformFee": 5.93 // 10% of subtotal
        
      },
      "subtotal": 59.30,
      "platformFee": 5.93,
      "total": 65.23,
      "currency": "USD"
    },
    "priceRange": {
      "minimum": 45.00,
      "maximum": 85.00,
      "recommended": 65.23,
      "marketAverage": 62.50
    },
    "factors": {
      "distance": {
        "km": 306,
        "impact": "high",
        "multiplier": 1.0
      },
      "weight": {
        "kg": 2.5,
        "impact": "medium",
        "multiplier": 1.0
      },
      "urgency": {
        "level": "standard",
        "impact": "none",
        "multiplier": 1.0
      },
      "timing": {
        "isPeakTime": false,
        "demandLevel": "medium",
        "multiplier": 1.0
      },
      "route": {
        "popularity": "high",
        "competition": "medium",
        "multiplier": 0.95
      },
      "item": {
        "category": "electronics",
        "fragile": true,
        "riskLevel": "medium",
        "multiplier": 1.3
      }
    },
    "recommendations": {
      "suggestedPrice": 65.23,
      "competitiveRange": {
        "min": 60.00,
        "max": 70.00
      },
      "demandForecast": "medium",
      "tips": [
        "Consider offering photo updates for better customer satisfaction",
        "Your price is competitive for this route",
        "Electronics delivery typically has higher acceptance rates"
      ]
    }
  }
}
```

### 2. Get Market Pricing Analysis

**GET** `/market-analysis`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `origin`: Origin location
- `destination`: Destination location
- `category`: Item category
- `weight`: Item weight
- `urgency`: Urgency level
- `period`: Analysis period (week|month|quarter)

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "origin": "New York, NY",
      "destination": "Boston, MA",
      "distance": 306
    },
    "marketData": {
      "averagePrice": 62.50,
      "medianPrice": 58.00,
      "priceRange": {
        "min": 35.00,
        "max": 120.00,
        "q25": 50.00,
        "q75": 75.00
      },
      "totalDeliveries": 156,
      "successRate": 94.2,
      "averageRating": 4.6
    },
    "trends": {
      "priceChange": "+5.2%", // vs previous period
      "demandChange": "+12.5%",
      "competitionLevel": "medium",
      "seasonalFactor": 1.1
    },
    "categoryBreakdown": [
      {
        "category": "electronics",
        "averagePrice": 75.50,
        "volume": 45,
        "successRate": 96.2
      },
      {
        "category": "documents",
        "averagePrice": 45.20,
        "volume": 67,
        "successRate": 98.1
      }
    ],
    "competitorAnalysis": {
      "totalCompetitors": 23,
      "averageRating": 4.5,
      "priceDistribution": {
        "budget": 8, // competitors
        "mid-range": 12,
        "premium": 3
      }
    }
  }
}
```

### 3. Create Payment Intent

**POST** `/intents`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "deliveryId": "delivery_uuid",
  "amount": 65.23,
  "currency": "USD",
  "paymentMethod": "card|wallet|bank_transfer|crypto",
  "paymentMethodId": "pm_1234567890", // Stripe payment method ID
  "escrow": {
    "enabled": true,
    "releaseCondition": "delivery_confirmed|qr_scanned|manual_release",
    "holdPeriod": 24 // hours after delivery
  },
  "fees": {
    "platformFee": 5.93,
    "processingFee": 2.15,
    "insuranceFee": 5.00
  },
  "metadata": {
    "deliveryRequestId": "request_uuid",
    "tripId": "trip_uuid",
    "customerId": "customer_uuid",
    "travelerId": "traveler_uuid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_1234567890",
    "clientSecret": "pi_1234567890_secret_abc123",
    "status": "requires_payment_method",
    "amount": 6523, // in cents
    "currency": "usd",
    "escrow": {
      "escrowId": "escrow_uuid",
      "status": "pending",
      "releaseCondition": "delivery_confirmed",
      "holdPeriod": 24
    },
    "fees": {
      "platformFee": 593,
      "processingFee": 215,
      "insuranceFee": 500,
      "totalFees": 1308
    },
    "timeline": {
      "createdAt": "2025-02-01T10:00:00Z",
      "expiresAt": "2025-02-01T11:00:00Z"
    }
  }
}
```

### 4. Confirm Payment

**POST** `/intents/{paymentIntentId}/confirm`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "paymentMethodId": "pm_1234567890",
  "billingDetails": {
    "name": "John Smith",
    "email": "john@example.com",
    "address": {
      "line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "US"
    }
  },
  "savePaymentMethod": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_1234567890",
    "status": "succeeded",
    "chargeId": "ch_1234567890",
    "amount": 6523,
    "amountReceived": 6523,
    "escrow": {
      "escrowId": "escrow_uuid",
      "status": "held",
      "amount": 5215, // minus platform fees
      "releaseDate": "2025-02-02T14:00:00Z"
    },
    "receipt": {
      "receiptUrl": "https://receipts.p2pdelivery.com/receipt_uuid.pdf",
      "receiptNumber": "RCP-2025-001234"
    },
    "transaction": {
      "transactionId": "txn_uuid",
      "timestamp": "2025-02-01T10:30:00Z"
    }
  }
}
```

### 5. Get Payment Status

**GET** `/intents/{paymentIntentId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_1234567890",
    "status": "succeeded",
    "amount": 6523,
    "currency": "usd",
    "deliveryId": "delivery_uuid",
    "customer": {
      "id": "customer_uuid",
      "name": "John Smith",
      "email": "john@example.com"
    },
    "traveler": {
      "id": "traveler_uuid",
      "name": "Jane Doe"
    },
    "escrow": {
      "escrowId": "escrow_uuid",
      "status": "held",
      "amount": 5215,
      "holdUntil": "2025-02-02T14:00:00Z",
      "releaseCondition": "delivery_confirmed"
    },
    "timeline": [
      {
        "status": "created",
        "timestamp": "2025-02-01T10:00:00Z"
      },
      {
        "status": "payment_method_attached",
        "timestamp": "2025-02-01T10:15:00Z"
      },
      {
        "status": "succeeded",
        "timestamp": "2025-02-01T10:30:00Z"
      }
    ]
  }
}
```

### 6. Release Escrow Payment

**POST** `/escrow/{escrowId}/release`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "releaseReason": "delivery_confirmed|qr_scanned|manual_approval|dispute_resolved",
  "deliveryConfirmation": {
    "qrScanId": "qr_scan_uuid",
    "timestamp": "2025-02-01T14:00:00Z",
    "location": {
      "lat": 42.3601,
      "lng": -71.0589
    }
  },
  "releaseAmount": 5215, // Full amount or partial
  "deductions": {
    "damages": 0,
    "penalties": 0,
    "additionalFees": 0
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "escrowId": "escrow_uuid",
    "status": "released",
    "releaseAmount": 5215,
    "recipient": {
      "id": "traveler_uuid",
      "name": "Jane Doe",
      "accountId": "acct_1234567890"
    },
    "transaction": {
      "transferId": "tr_1234567890",
      "timestamp": "2025-02-01T14:05:00Z",
      "expectedArrival": "2025-02-02T14:05:00Z"
    },
    "receipt": {
      "payoutReceiptUrl": "https://receipts.p2pdelivery.com/payout_uuid.pdf"
    }
  }
}
```

### 7. Process Refund

**POST** `/refunds`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_1234567890",
  "amount": 6523, // Full or partial refund
  "reason": "delivery_cancelled|item_damaged|service_not_provided|customer_request|dispute_resolution",
  "description": "Delivery cancelled due to weather conditions",
  "refundBreakdown": {
    "customerRefund": 5000,
    "travelerCompensation": 1000,
    "platformFeeRefund": 523
  },
  "metadata": {
    "deliveryId": "delivery_uuid",
    "cancellationReason": "weather"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "refundId": "re_1234567890",
    "status": "succeeded",
    "amount": 6523,
    "currency": "usd",
    "reason": "delivery_cancelled",
    "breakdown": {
      "customerRefund": 5000,
      "travelerCompensation": 1000,
      "platformFeeRefund": 523
    },
    "timeline": {
      "requestedAt": "2025-02-01T15:00:00Z",
      "processedAt": "2025-02-01T15:05:00Z",
      "expectedArrival": "2025-02-03T15:05:00Z"
    },
    "receipt": {
      "refundReceiptUrl": "https://receipts.p2pdelivery.com/refund_uuid.pdf"
    }
  }
}
```

### 8. Get Payment History

**GET** `/history`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `type`: Filter by type (payment|payout|refund)
- `status`: Filter by status
- `dateFrom`: Date range start
- `dateTo`: Date range end
- `deliveryId`: Filter by delivery
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pi_1234567890",
      "type": "payment",
      "status": "succeeded",
      "amount": 6523,
      "currency": "usd",
      "description": "Payment for Legal Documents Delivery",
      "delivery": {
        "id": "delivery_uuid",
        "title": "Legal Documents Delivery",
        "route": {
          "origin": "New York, NY",
          "destination": "Boston, MA"
        }
      },
      "counterpart": {
        "id": "traveler_uuid",
        "name": "Jane Doe",
        "type": "traveler"
      },
      "timestamp": "2025-02-01T10:30:00Z",
      "receiptUrl": "https://receipts.p2pdelivery.com/receipt_uuid.pdf"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "summary": {
    "totalPayments": 15,
    "totalAmount": 1250.75,
    "totalRefunds": 2,
    "totalRefunded": 125.50
  }
}
```

### 9. Setup Payout Account

**POST** `/payout-accounts`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "accountType": "individual|business",
  "country": "US",
  "currency": "USD",
  "individual": {
    "firstName": "Jane",
    "lastName": "Doe",
    "dateOfBirth": {
      "day": 15,
      "month": 6,
      "year": 1990
    },
    "address": {
      "line1": "456 Oak St",
      "city": "Boston",
      "state": "MA",
      "postalCode": "02101",
      "country": "US"
    },
    "phone": "+1234567890",
    "email": "jane@example.com",
    "ssn": "123456789" // Last 4 digits
  },
  "bankAccount": {
    "accountNumber": "000123456789",
    "routingNumber": "110000000",
    "accountHolderName": "Jane Doe",
    "accountType": "checking|savings"
  },
  "tosAcceptance": {
    "date": "2025-02-01T10:00:00Z",
    "ip": "192.168.1.1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountId": "acct_1234567890",
    "status": "pending",
    "country": "US",
    "currency": "USD",
    "capabilities": {
      "transfers": "pending"
    },
    "requirements": {
      "currently_due": ["individual.verification.document"],
      "eventually_due": [],
      "past_due": []
    },
    "verification": {
      "status": "pending",
      "documentsRequired": ["identity_document"]
    }
  }
}
```

### 10. Get Payout Account Status

**GET** `/payout-accounts/{accountId}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountId": "acct_1234567890",
    "status": "active",
    "country": "US",
    "currency": "USD",
    "capabilities": {
      "transfers": "active"
    },
    "balance": {
      "available": 1250.75,
      "pending": 325.50,
      "currency": "USD"
    },
    "payoutSchedule": {
      "interval": "daily",
      "monthlyAnchor": null,
      "weeklyAnchor": null
    },
    "verification": {
      "status": "verified",
      "verifiedAt": "2025-01-15T10:00:00Z"
    },
    "requirements": {
      "currently_due": [],
      "eventually_due": [],
      "past_due": []
    }
  }
}
```

### 11. Get Earnings Summary

**GET** `/earnings`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter|year)
- `year`: Specific year
- `month`: Specific month

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "year": 2025,
    "month": 2,
    "summary": {
      "grossEarnings": 2450.75,
      "platformFees": 245.08,
      "processingFees": 73.52,
      "netEarnings": 2132.15,
      "totalDeliveries": 45,
      "averageEarningPerDelivery": 47.40
    },
    "breakdown": {
      "deliveryPayments": 2200.50,
      "tips": 150.25,
      "bonuses": 100.00,
      "penalties": -25.00,
      "adjustments": 25.00
    },
    "trends": [
      {
        "date": "2025-02-01",
        "grossEarnings": 125.50,
        "netEarnings": 108.25,
        "deliveries": 3
      }
    ],
    "topRoutes": [
      {
        "route": "New York → Boston",
        "earnings": 450.75,
        "deliveries": 8,
        "averagePrice": 56.34
      }
    ],
    "payoutHistory": [
      {
        "payoutId": "po_1234567890",
        "amount": 850.25,
        "status": "paid",
        "paidAt": "2025-02-01T00:00:00Z",
        "method": "bank_transfer"
      }
    ]
  }
}
```

### 12. Request Instant Payout

**POST** `/instant-payout`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "amount": 500.00,
  "currency": "USD",
  "destination": "acct_1234567890",
  "description": "Instant payout for urgent expenses"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payoutId": "po_instant_1234567890",
    "amount": 500.00,
    "currency": "USD",
    "fee": 15.00, // Instant payout fee
    "netAmount": 485.00,
    "status": "in_transit",
    "estimatedArrival": "2025-02-01T11:00:00Z", // Within 30 minutes
    "destination": {
      "type": "bank_account",
      "last4": "6789"
    }
  }
}
```

### 13. Create Dispute

**POST** `/disputes`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_1234567890",
  "deliveryId": "delivery_uuid",
  "category": "item_not_delivered|item_damaged|service_not_as_described|unauthorized_charge|other",
  "description": "Item was delivered damaged despite fragile handling request",
  "evidence": [
    {
      "type": "photo",
      "url": "https://evidence.com/damage1.jpg",
      "description": "Photo showing damaged electronics"
    },
    {
      "type": "document",
      "url": "https://evidence.com/receipt.pdf",
      "description": "Original purchase receipt showing item value"
    }
  ],
  "requestedAmount": 500.00,
  "requestedAction": "full_refund|partial_refund|replacement|compensation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "disputeId": "dp_1234567890",
    "status": "under_review",
    "category": "item_damaged",
    "amount": 500.00,
    "currency": "USD",
    "createdAt": "2025-02-01T16:00:00Z",
    "estimatedResolution": "2025-02-08T16:00:00Z",
    "caseNumber": "DISP-2025-001234",
    "nextSteps": [
      "We will review your evidence within 24 hours",
      "The traveler will be notified to provide their response",
      "A resolution will be provided within 7 business days"
    ]
  }
}
```

### 14. Get Tax Documents

**GET** `/tax-documents`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `year`: Tax year
- `type`: Document type (1099|summary|detailed)

**Response:**
```json
{
  "success": true,
  "data": {
    "taxYear": 2025,
    "documents": [
      {
        "type": "1099-K",
        "description": "Payment Card and Third Party Network Transactions",
        "amount": 12450.75,
        "downloadUrl": "https://tax-docs.p2pdelivery.com/1099k_2025.pdf",
        "issuedDate": "2026-01-31T00:00:00Z"
      }
    ],
    "summary": {
      "totalEarnings": 12450.75,
      "totalFees": 1245.08,
      "netEarnings": 11205.67,
      "totalDeliveries": 156,
      "taxableIncome": 11205.67
    },
    "quarterlyBreakdown": [
      {
        "quarter": "Q1",
        "earnings": 3200.25,
        "fees": 320.03,
        "net": 2880.22
      }
    ]
  }
}
```

### 15. Payment Analytics

**GET** `/analytics`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Time period (week|month|quarter|year)
- `metric`: Specific metric (revenue|volume|conversion)

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRevenue": 15620.50,
      "totalVolume": 234,
      "averageTransactionValue": 66.75,
      "conversionRate": 94.2,
      "refundRate": 2.1
    },
    "trends": [
      {
        "date": "2025-02-01",
        "revenue": 520.75,
        "volume": 8,
        "averageValue": 65.09,
        "conversions": 7
      }
    ],
    "paymentMethods": [
      {
        "method": "card",
        "volume": 189,
        "percentage": 80.8,
        "averageValue": 68.25,
        "successRate": 96.3
      },
      {
        "method": "wallet",
        "volume": 32,
        "percentage": 13.7,
        "averageValue": 58.50,
        "successRate": 98.1
      }
    ],
    "geographicBreakdown": [
      {
        "region": "Northeast",
        "revenue": 6240.75,
        "volume": 89,
        "averageValue": 70.12
      }
    ]
  }
}
```

### 16. Pricing Optimization

**POST** `/optimize-pricing`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "route": {
    "origin": "New York, NY",
    "destination": "Boston, MA"
  },
  "itemCategory": "electronics",
  "currentPrice": 65.00,
  "goals": {
    "maximizeAcceptance": true,
    "maximizeRevenue": false,
    "targetMargin": 0.15
  },
  "constraints": {
    "minPrice": 45.00,
    "maxPrice": 85.00
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": {
      "optimizedPrice": 58.50,
      "priceChange": -6.50,
      "expectedOutcome": {
        "acceptanceProbability": 87.5,
        "expectedRevenue": 51.12,
        "marketPosition": "competitive"
      }
    },
    "analysis": {
      "currentPrice": {
        "acceptanceProbability": 72.3,
        "marketPosition": "above_average",
        "competitorComparison": "+12.5%"
      },
      "alternatives": [
        {
          "price": 55.00,
          "acceptanceProbability": 89.2,
          "revenue": 49.06,
          "description": "Maximum acceptance"
        },
        {
          "price": 62.00,
          "acceptanceProbability": 79.8,
          "revenue": 49.48,
          "description": "Balanced approach"
        }
      ]
    },
    "factors": {
      "seasonality": "neutral",
      "demand": "high",
      "competition": "medium",
      "routePopularity": "very_high"
    }
  }
}
```

### 17. Subscription Management

**GET** `/subscriptions`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPlan": {
      "id": "plan_premium",
      "name": "Premium Traveler",
      "price": 29.99,
      "currency": "USD",
      "interval": "month",
      "status": "active",
      "currentPeriodStart": "2025-02-01T00:00:00Z",
      "currentPeriodEnd": "2025-03-01T00:00:00Z",
      "features": [
        "Reduced platform fees (5% instead of 10%)",
        "Priority matching",
        "Advanced analytics",
        "Instant payouts included",
        "24/7 premium support"
      ]
    },
    "usage": {
      "deliveriesThisMonth": 12,
      "savingsFromReducedFees": 45.25,
      "priorityMatchesUsed": 8
    },
    "availablePlans": [
      {
        "id": "plan_basic",
        "name": "Basic",
        "price": 0,
        "features": ["Standard platform fees", "Basic support"]
      },
      {
        "id": "plan_pro",
        "name": "Professional",
        "price": 19.99,
        "features": ["Reduced fees (7%)", "Priority support"]
      }
    ]
  }
}
```

### 18. Promotional Credits

**GET** `/credits`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": {
      "total": 25.50,
      "currency": "USD",
      "expiringAmount": 10.00,
      "expiringDate": "2025-03-01T00:00:00Z"
    },
    "credits": [
      {
        "id": "credit_uuid",
        "type": "referral_bonus",
        "amount": 15.00,
        "description": "Referral bonus for inviting John Smith",
        "earnedAt": "2025-01-15T00:00:00Z",
        "expiresAt": "2025-04-15T00:00:00Z",
        "status": "active"
      },
      {
        "id": "credit_uuid_2",
        "type": "first_delivery_bonus",
        "amount": 10.50,
        "description": "Welcome bonus for first successful delivery",
        "earnedAt": "2025-01-05T00:00:00Z",
        "expiresAt": "2025-03-01T00:00:00Z",
        "status": "active"
      }
    ],
    "usage": [
      {
        "id": "usage_uuid",
        "amount": 5.00,
        "description": "Applied to delivery #DEL-001234",
        "usedAt": "2025-01-20T00:00:00Z",
        "deliveryId": "delivery_uuid"
      }
    ]
  }
}
```

### 19. Financial Reporting

**GET** `/reports/financial`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `period`: Reporting period (month|quarter|year)
- `year`: Specific year
- `format`: Export format (json|csv|pdf)

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report_uuid",
    "period": "2025-Q1",
    "summary": {
      "totalRevenue": 15620.50,
      "totalCosts": 1875.25,
      "netIncome": 13745.25,
      "totalTransactions": 234,
      "refundsIssued": 125.50,
      "chargebacks": 0.00
    },
    "monthlyBreakdown": [
      {
        "month": "2025-01",
        "revenue": 5240.75,
        "costs": 628.89,
        "netIncome": 4611.86,
        "transactions": 78
      }
    ],
    "categoryBreakdown": [
      {
        "category": "electronics",
        "revenue": 6248.20,
        "transactions": 89,
        "averageValue": 70.20
      }
    ],
    "downloadUrl": "https://reports.p2pdelivery.com/financial_q1_2025.pdf",
    "generatedAt": "2025-04-01T00:00:00Z"
  }
}
```

### 20. Currency Exchange

**GET** `/exchange-rates`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `from`: Source currency (USD, EUR, GBP, etc.)
- `to`: Target currency
- `amount`: Amount to convert

**Response:**
```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "EUR",
    "rate": 0.85,
    "amount": 100.00,
    "convertedAmount": 85.00,
    "fee": 2.50,
    "netAmount": 82.50,
    "timestamp": "2025-02-01T12:00:00Z",
    "validUntil": "2025-02-01T12:15:00Z"
  }
}
```