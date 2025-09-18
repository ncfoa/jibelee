# Payment Service - Detailed Architecture

## 🏗️ Service Overview

The Payment Service handles all financial operations in the P2P Delivery Platform, including dynamic pricing, escrow management, payment processing, payouts, and financial compliance. It integrates with multiple payment providers and implements sophisticated pricing algorithms.

**Port:** 3007  
**Base URL:** `/api/v1/payments`  
**Database:** `payment_db` (PostgreSQL)

## 🎯 Core Responsibilities

### Primary Functions
- **Dynamic Pricing Engine**: AI-driven pricing based on 15+ market factors
- **Payment Processing**: Secure payment handling with multiple providers
- **Escrow Management**: Secure fund holding until delivery completion
- **Payout System**: Automated and on-demand payouts to travelers
- **Multi-currency Support**: Global currency handling with real-time conversion
- **Dispute Resolution**: Financial dispute management and resolution
- **Tax Compliance**: Automated tax document generation and reporting
- **Subscription Management**: Premium feature subscriptions

### Key Features
- **Smart Escrow**: Automated release based on delivery milestones
- **Real-time Pricing**: Dynamic pricing updates based on market conditions
- **Fraud Prevention**: Advanced fraud detection and prevention
- **Instant Payouts**: Same-day payouts for verified travelers
- **Multi-provider Support**: Stripe, PayPal, and direct bank integration
- **Regulatory Compliance**: PCI DSS, AML, and KYC compliance

## 🗄️ Database Schema

### Core Tables

#### 1. Payment Intents Table
```sql
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status payment_status_enum NOT NULL DEFAULT 'requires_payment_method',
    payment_method_id VARCHAR(255),
    client_secret VARCHAR(255),
    
    -- Fee breakdown
    platform_fee INTEGER NOT NULL,
    processing_fee INTEGER NOT NULL,
    insurance_fee INTEGER DEFAULT 0,
    total_fees INTEGER NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT
);
```

#### 2. Escrow Accounts Table
```sql
CREATE TABLE escrow_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id UUID NOT NULL,
    delivery_id UUID NOT NULL,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL,
    status escrow_status_enum NOT NULL DEFAULT 'pending',
    
    hold_until TIMESTAMP NOT NULL,
    release_condition VARCHAR(50) NOT NULL,
    auto_release_enabled BOOLEAN DEFAULT TRUE,
    
    released_at TIMESTAMP,
    released_amount INTEGER,
    release_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Payout Accounts Table
```sql
CREATE TABLE payout_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    stripe_account_id VARCHAR(255) UNIQUE NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    country VARCHAR(2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status payout_account_status_enum NOT NULL DEFAULT 'pending',
    
    capabilities JSONB DEFAULT '{}',
    requirements JSONB DEFAULT '{}',
    verification_status VARCHAR(20),
    verification_details JSONB,
    
    balance_available INTEGER DEFAULT 0, -- in cents
    balance_pending INTEGER DEFAULT 0,
    
    payout_schedule JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);
```

#### 4. Payouts Table
```sql
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    payout_account_id UUID NOT NULL,
    stripe_payout_id VARCHAR(255),
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL,
    type payout_type_enum NOT NULL DEFAULT 'standard',
    status payout_status_enum NOT NULL DEFAULT 'pending',
    
    fee INTEGER DEFAULT 0,
    net_amount INTEGER NOT NULL,
    
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT
);
```

#### 5. Pricing Factors Table
```sql
CREATE TABLE pricing_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_hash VARCHAR(64) NOT NULL, -- Hash of origin-destination
    item_category item_category_enum,
    urgency urgency_level_enum,
    
    base_price DECIMAL(10,2) NOT NULL,
    distance_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    weight_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    urgency_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    category_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    demand_multiplier DECIMAL(8,4) DEFAULT 1.0000,
    
    market_data JSONB DEFAULT '{}',
    
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. Refunds Table
```sql
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id UUID NOT NULL,
    stripe_refund_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL,
    reason refund_reason_enum NOT NULL,
    status refund_status_enum NOT NULL DEFAULT 'pending',
    
    customer_refund INTEGER NOT NULL,
    traveler_compensation INTEGER DEFAULT 0,
    platform_fee_refund INTEGER DEFAULT 0,
    
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);
```

#### 7. Subscriptions Table
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    plan_id VARCHAR(100) NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    status subscription_status_enum NOT NULL,
    
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    
    price INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    interval subscription_interval_enum NOT NULL,
    
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    
    canceled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Enums
```sql
CREATE TYPE payment_status_enum AS ENUM (
    'requires_payment_method', 'requires_confirmation', 'requires_action', 
    'processing', 'succeeded', 'failed', 'canceled'
);

CREATE TYPE escrow_status_enum AS ENUM ('pending', 'held', 'released', 'disputed', 'refunded');

CREATE TYPE payout_account_status_enum AS ENUM ('pending', 'active', 'restricted', 'inactive');

CREATE TYPE payout_type_enum AS ENUM ('standard', 'instant');

CREATE TYPE payout_status_enum AS ENUM ('pending', 'in_transit', 'paid', 'failed', 'canceled');

CREATE TYPE refund_reason_enum AS ENUM (
    'delivery_cancelled', 'item_damaged', 'service_not_provided', 
    'customer_request', 'dispute_resolution', 'duplicate'
);

CREATE TYPE refund_status_enum AS ENUM ('pending', 'succeeded', 'failed', 'canceled');

CREATE TYPE subscription_status_enum AS ENUM (
    'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid'
);

CREATE TYPE subscription_interval_enum AS ENUM ('month', 'year');
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js or Java Spring Boot
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');
const axios = require('axios');
const moment = require('moment');
const bull = require('bull');
```

### Key Dependencies
- **Express.js/Spring Boot**: Web framework
- **Stripe SDK**: Primary payment processor
- **PayPal SDK**: Alternative payment processor
- **Bull Queue**: Background job processing
- **Axios**: HTTP client for external APIs
- **Moment.js**: Date/time manipulation
- **Winston**: Logging
- **Joi**: Request validation

### External Integrations
- **Stripe**: Payment processing, Connect accounts, payouts
- **PayPal**: Alternative payment processing
- **Currency APIs**: Real-time exchange rates
- **Banking APIs**: Direct bank transfers
- **Tax Services**: Automated tax calculation
- **Fraud Detection**: Advanced fraud prevention

## 📊 API Endpoints (20 Total)

### Pricing Endpoints

#### 1. Calculate Delivery Price
```http
POST /api/v1/payments/calculate-price
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryRequest": {
    "route": {
      "origin": { "lat": 40.7128, "lng": -74.0060, "address": "New York, NY" },
      "destination": { "lat": 42.3601, "lng": -71.0589, "address": "Boston, MA" }
    },
    "item": {
      "weight": 2.5,
      "dimensions": { "length": 30, "width": 20, "height": 10 },
      "value": 500.00,
      "category": "electronics",
      "fragile": true
    },
    "urgency": "express",
    "timeWindow": {
      "pickup": { "start": "2025-02-01T09:00:00Z", "end": "2025-02-01T18:00:00Z" },
      "delivery": { "start": "2025-02-02T09:00:00Z", "end": "2025-02-02T17:00:00Z" }
    }
  },
  "travelerPreferences": {
    "acceptFragile": true,
    "insuranceLevel": "premium"
  }
}
```

#### 2. Get Market Analysis
```http
GET /api/v1/payments/market-analysis
Authorization: Bearer <access_token>
Query Parameters:
- origin: "New York, NY"
- destination: "Boston, MA"
- category: electronics
- timeframe: week|month|quarter
```

#### 3. Get Pricing Factors
```http
GET /api/v1/payments/pricing-factors
Authorization: Bearer <access_token>
Query Parameters:
- routeHash: abc123def456
- category: electronics
- urgency: express
```

### Payment Processing Endpoints

#### 4. Create Payment Intent
```http
POST /api/v1/payments/create-intent
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "amount": 3500, // in cents
  "currency": "USD",
  "paymentMethodId": "pm_1234567890",
  "savePaymentMethod": true,
  "metadata": {
    "deliveryNumber": "DEL-001234",
    "customerEmail": "customer@example.com"
  }
}
```

#### 5. Confirm Payment
```http
POST /api/v1/payments/confirm/:paymentIntentId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "paymentMethodId": "pm_1234567890",
  "returnUrl": "https://app.example.com/payment-success"
}
```

#### 6. Get Payment Status
```http
GET /api/v1/payments/status/:paymentIntentId
Authorization: Bearer <access_token>
```

### Escrow Management Endpoints

#### 7. Create Escrow Account
```http
POST /api/v1/payments/escrow/create
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "paymentIntentId": "pi_1234567890",
  "deliveryId": "delivery-uuid",
  "holdDuration": 72, // hours
  "releaseCondition": "delivery_completed",
  "autoRelease": true
}
```

#### 8. Release Escrow Funds
```http
POST /api/v1/payments/escrow/:escrowId/release
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "releaseReason": "delivery_completed",
  "releaseAmount": 3000, // in cents, optional (full amount if not specified)
  "notes": "Delivery completed successfully"
}
```

#### 9. Get Escrow Status
```http
GET /api/v1/payments/escrow/:escrowId
Authorization: Bearer <access_token>
```

### Payout Management Endpoints

#### 10. Create Payout Account
```http
POST /api/v1/payments/payout-accounts
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "accountType": "express",
  "country": "US",
  "currency": "USD",
  "businessProfile": {
    "mcc": "4214", // Merchant category code
    "url": "https://traveler-profile.com"
  },
  "tosAcceptance": {
    "date": 1609459200,
    "ip": "192.168.1.1"
  }
}
```

#### 11. Get Payout Account Status
```http
GET /api/v1/payments/payout-accounts/me
Authorization: Bearer <access_token>
```

#### 12. Update Payout Account
```http
PUT /api/v1/payments/payout-accounts/:accountId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "payoutSchedule": {
    "interval": "daily",
    "weeklyAnchor": "monday",
    "delayDays": 2
  }
}
```

#### 13. Request Instant Payout
```http
POST /api/v1/payments/payouts/instant
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "amount": 5000, // in cents
  "currency": "USD",
  "description": "Instant payout for completed deliveries"
}
```

#### 14. Get Payout History
```http
GET /api/v1/payments/payouts/history
Authorization: Bearer <access_token>
Query Parameters:
- status: pending|paid|failed
- startDate: 2025-01-01
- endDate: 2025-01-31
- page: 1
- limit: 50
```

### Refund & Dispute Endpoints

#### 15. Process Refund
```http
POST /api/v1/payments/refunds
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "paymentIntentId": "pi_1234567890",
  "amount": 2000, // in cents, optional (full refund if not specified)
  "reason": "delivery_cancelled",
  "refundBreakdown": {
    "customerRefund": 1800,
    "travelerCompensation": 200,
    "platformFeeRefund": 0
  },
  "description": "Delivery cancelled due to weather"
}
```

#### 16. Get Refund Status
```http
GET /api/v1/payments/refunds/:refundId
Authorization: Bearer <access_token>
```

### Subscription Management Endpoints

#### 17. Create Subscription
```http
POST /api/v1/payments/subscriptions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "planId": "premium_monthly",
  "paymentMethodId": "pm_1234567890",
  "trialPeriodDays": 14,
  "couponId": "NEWUSER20"
}
```

#### 18. Get Subscription Status
```http
GET /api/v1/payments/subscriptions/me
Authorization: Bearer <access_token>
```

#### 19. Cancel Subscription
```http
POST /api/v1/payments/subscriptions/:subscriptionId/cancel
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "cancelAtPeriodEnd": true,
  "cancellationReason": "No longer needed"
}
```

### Financial Analytics Endpoints

#### 20. Get Financial Analytics
```http
GET /api/v1/payments/analytics
Authorization: Bearer <access_token>
Query Parameters:
- role: customer|traveler
- period: week|month|quarter|year
- startDate: 2025-01-01
- endDate: 2025-01-31
- currency: USD
```

## 🏗️ Service Architecture

### Directory Structure
```
payment-service/
├── src/
│   ├── controllers/
│   │   ├── pricingController.js
│   │   ├── paymentController.js
│   │   ├── escrowController.js
│   │   ├── payoutController.js
│   │   ├── refundController.js
│   │   └── subscriptionController.js
│   ├── models/
│   │   ├── PaymentIntent.js
│   │   ├── EscrowAccount.js
│   │   ├── PayoutAccount.js
│   │   ├── Payout.js
│   │   ├── Refund.js
│   │   └── Subscription.js
│   ├── services/
│   │   ├── pricingService.js
│   │   ├── paymentService.js
│   │   ├── escrowService.js
│   │   ├── payoutService.js
│   │   ├── refundService.js
│   │   ├── subscriptionService.js
│   │   ├── fraudDetectionService.js
│   │   └── currencyService.js
│   ├── providers/
│   │   ├── stripeProvider.js
│   │   ├── paypalProvider.js
│   │   └── bankingProvider.js
│   ├── pricing/
│   │   ├── engines/
│   │   │   ├── dynamicPricingEngine.js
│   │   │   ├── marketAnalysisEngine.js
│   │   │   └── demandForecastEngine.js
│   │   └── models/
│   │       ├── pricingModel.js
│   │       └── demandModel.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── validationMiddleware.js
│   │   ├── fraudMiddleware.js
│   │   └── complianceMiddleware.js
│   ├── routes/
│   │   ├── pricingRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── escrowRoutes.js
│   │   ├── payoutRoutes.js
│   │   └── subscriptionRoutes.js
│   ├── utils/
│   │   ├── currencyUtils.js
│   │   ├── pricingUtils.js
│   │   ├── validationUtils.js
│   │   └── complianceUtils.js
│   ├── jobs/
│   │   ├── escrowReleaseJob.js
│   │   ├── payoutProcessingJob.js
│   │   ├── fraudDetectionJob.js
│   │   └── complianceReportingJob.js
│   ├── config/
│   │   ├── database.js
│   │   ├── stripe.js
│   │   ├── paypal.js
│   │   └── compliance.js
│   └── app.js
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. Dynamic Pricing Engine
```javascript
class DynamicPricingEngine {
  constructor() {
    this.mlModel = new PricingModel();
    this.marketAnalysis = new MarketAnalysisEngine();
    this.demandForecast = new DemandForecastEngine();
  }

  async calculatePrice(deliveryRequest, options = {}) {
    // Extract pricing features
    const features = await this.extractPricingFeatures(deliveryRequest);
    
    // Get base price from ML model
    const basePrice = await this.mlModel.predict(features);
    
    // Apply dynamic multipliers
    const multipliers = await this.calculateMultipliers(deliveryRequest, features);
    
    // Calculate final price
    const finalPrice = this.applyMultipliers(basePrice, multipliers);
    
    // Add market adjustments
    const marketAdjustment = await this.getMarketAdjustment(deliveryRequest);
    const adjustedPrice = finalPrice * marketAdjustment;
    
    // Apply minimum/maximum constraints
    const constrainedPrice = this.applyPriceConstraints(adjustedPrice, deliveryRequest);
    
    return {
      basePrice,
      finalPrice: constrainedPrice,
      breakdown: {
        distance: multipliers.distance,
        weight: multipliers.weight,
        urgency: multipliers.urgency,
        category: multipliers.category,
        demand: multipliers.demand,
        market: marketAdjustment
      },
      confidence: await this.calculateConfidence(features),
      alternatives: await this.generatePriceAlternatives(constrainedPrice, deliveryRequest)
    };
  }

  async extractPricingFeatures(deliveryRequest) {
    const route = deliveryRequest.route;
    const item = deliveryRequest.item;
    
    // Calculate distance
    const distance = this.geoUtils.calculateDistance(route.origin, route.destination);
    
    // Get historical data for this route
    const routeHistory = await this.getRouteHistory(route);
    
    // Market conditions
    const marketConditions = await this.marketAnalysis.getCurrentConditions(route);
    
    // Time-based features
    const timeFeatures = this.extractTimeFeatures(deliveryRequest.timeWindow);
    
    return {
      // Distance features
      distance,
      routePopularity: routeHistory.requestCount,
      averageRoutePrice: routeHistory.averagePrice,
      
      // Item features
      weight: item.weight,
      volume: this.calculateVolume(item.dimensions),
      value: item.value || 0,
      category: item.category,
      isFragile: item.fragile || false,
      isPerishable: item.perishable || false,
      
      // Urgency features
      urgency: deliveryRequest.urgency,
      timeFlexibility: timeFeatures.flexibility,
      
      // Market features
      supply: marketConditions.availableCapacity,
      demand: marketConditions.pendingRequests,
      seasonality: marketConditions.seasonalityFactor,
      
      // Time features
      dayOfWeek: timeFeatures.dayOfWeek,
      hourOfDay: timeFeatures.hourOfDay,
      isWeekend: timeFeatures.isWeekend,
      isHoliday: timeFeatures.isHoliday,
      
      // Economic features
      fuelPrice: marketConditions.fuelPrice,
      economicIndex: marketConditions.economicIndex
    };
  }

  async calculateMultipliers(deliveryRequest, features) {
    return {
      distance: this.calculateDistanceMultiplier(features.distance),
      weight: this.calculateWeightMultiplier(features.weight),
      urgency: this.calculateUrgencyMultiplier(deliveryRequest.urgency),
      category: this.calculateCategoryMultiplier(features.category),
      demand: await this.calculateDemandMultiplier(features),
      time: this.calculateTimeMultiplier(features),
      value: this.calculateValueMultiplier(features.value),
      complexity: this.calculateComplexityMultiplier(features)
    };
  }

  calculateDistanceMultiplier(distance) {
    // Base rate + per-km rate with diminishing returns
    const baseRate = 1.0;
    const perKmRate = 0.02;
    const diminishingFactor = Math.log(1 + distance / 100); // Logarithmic scaling
    
    return baseRate + (distance * perKmRate * diminishingFactor);
  }

  calculateUrgencyMultiplier(urgency) {
    const multipliers = {
      standard: 1.0,
      express: 1.5,
      urgent: 2.0
    };
    
    return multipliers[urgency] || 1.0;
  }

  async calculateDemandMultiplier(features) {
    const supplyDemandRatio = features.supply / Math.max(features.demand, 1);
    
    // High demand (low ratio) increases price
    if (supplyDemandRatio < 0.5) return 1.3;
    if (supplyDemandRatio < 1.0) return 1.1;
    if (supplyDemandRatio > 2.0) return 0.9;
    
    return 1.0;
  }

  async getMarketAdjustment(deliveryRequest) {
    const route = deliveryRequest.route;
    const routeHash = this.generateRouteHash(route);
    
    // Get recent pricing data for this route
    const recentPrices = await this.pricingRepository.getRecentPrices(routeHash, 7); // 7 days
    
    if (recentPrices.length === 0) return 1.0;
    
    // Calculate market trend
    const avgPrice = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;
    const recentAvg = recentPrices.slice(-3).reduce((sum, p) => sum + p.price, 0) / 3;
    
    const trend = recentAvg / avgPrice;
    
    // Apply trending adjustment (max ±20%)
    return Math.max(0.8, Math.min(1.2, trend));
  }
}
```

#### 2. Payment Service
```javascript
class PaymentService {
  constructor() {
    this.stripe = new StripeProvider();
    this.paypal = new PayPalProvider();
    this.fraudDetection = new FraudDetectionService();
  }

  async createPaymentIntent(paymentData) {
    const {
      deliveryId,
      amount,
      currency,
      customerId,
      paymentMethodId,
      metadata
    } = paymentData;

    // Fraud detection check
    const fraudCheck = await this.fraudDetection.analyzePayment(paymentData);
    if (fraudCheck.riskLevel === 'high') {
      throw new FraudDetectedError('Payment blocked due to high fraud risk');
    }

    // Calculate fees
    const fees = this.calculateFees(amount, currency);
    
    // Create Stripe payment intent
    const stripeIntent = await this.stripe.createPaymentIntent({
      amount: amount + fees.total,
      currency,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: false,
      metadata: {
        ...metadata,
        deliveryId,
        customerId
      }
    });

    // Store payment intent in database
    const paymentIntent = await this.paymentIntentRepository.create({
      deliveryId,
      stripePaymentIntentId: stripeIntent.id,
      amount,
      currency,
      status: stripeIntent.status,
      clientSecret: stripeIntent.client_secret,
      platformFee: fees.platform,
      processingFee: fees.processing,
      insuranceFee: fees.insurance,
      totalFees: fees.total,
      metadata
    });

    return {
      id: paymentIntent.id,
      clientSecret: stripeIntent.client_secret,
      status: stripeIntent.status,
      amount: amount + fees.total,
      fees: fees
    };
  }

  async confirmPayment(paymentIntentId, confirmationData) {
    const paymentIntent = await this.paymentIntentRepository.findById(paymentIntentId);
    
    if (!paymentIntent) {
      throw new PaymentNotFoundError('Payment intent not found');
    }

    try {
      // Confirm with Stripe
      const confirmedIntent = await this.stripe.confirmPaymentIntent(
        paymentIntent.stripePaymentIntentId,
        confirmationData
      );

      // Update local record
      await this.paymentIntentRepository.update(paymentIntentId, {
        status: confirmedIntent.status,
        confirmedAt: new Date()
      });

      // If successful, create escrow account
      if (confirmedIntent.status === 'succeeded') {
        await this.createEscrowAccount(paymentIntent);
      }

      return {
        status: confirmedIntent.status,
        paymentMethodId: confirmedIntent.payment_method,
        amount: confirmedIntent.amount
      };

    } catch (error) {
      // Update payment status on failure
      await this.paymentIntentRepository.update(paymentIntentId, {
        status: 'failed',
        failedAt: new Date(),
        failureReason: error.message
      });

      throw new PaymentFailedError(error.message);
    }
  }

  calculateFees(amount, currency) {
    const platformFeeRate = 0.10; // 10%
    const stripeFeeRate = 0.029; // 2.9%
    const stripeFeeFixed = 30; // 30 cents
    
    const platformFee = Math.round(amount * platformFeeRate);
    const processingFee = Math.round(amount * stripeFeeRate) + stripeFeeFixed;
    const insuranceFee = 0; // Optional, based on item value
    
    return {
      platform: platformFee,
      processing: processingFee,
      insurance: insuranceFee,
      total: platformFee + processingFee + insuranceFee
    };
  }
}
```

#### 3. Escrow Service
```javascript
class EscrowService {
  async createEscrowAccount(paymentIntent) {
    const delivery = await this.deliveryRepository.findById(paymentIntent.deliveryId);
    
    // Calculate hold duration based on delivery timeline
    const estimatedDuration = this.calculateDeliveryDuration(delivery);
    const holdUntil = moment().add(estimatedDuration + 24, 'hours').toDate(); // +24h buffer
    
    const escrowAccount = await this.escrowRepository.create({
      paymentIntentId: paymentIntent.id,
      deliveryId: paymentIntent.deliveryId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'held',
      holdUntil,
      releaseCondition: 'delivery_completed',
      autoReleaseEnabled: true
    });

    // Schedule automatic release
    await this.scheduleAutoRelease(escrowAccount.id, holdUntil);
    
    return escrowAccount;
  }

  async releaseEscrowFunds(escrowId, releaseData) {
    return this.escrowRepository.transaction(async (trx) => {
      const escrow = await this.escrowRepository.findByIdForUpdate(escrowId, trx);
      
      if (!escrow || escrow.status !== 'held') {
        throw new EscrowNotFoundError('Escrow account not found or not in held status');
      }

      const releaseAmount = releaseData.releaseAmount || escrow.amount;
      
      // Calculate payout breakdown
      const payoutBreakdown = this.calculatePayoutBreakdown(escrow, releaseAmount);
      
      // Process payout to traveler
      const delivery = await this.deliveryRepository.findById(escrow.deliveryId, trx);
      await this.payoutService.processPayout(delivery.travelerId, payoutBreakdown.travelerAmount);
      
      // Update escrow status
      await this.escrowRepository.update(escrowId, {
        status: 'released',
        releasedAt: new Date(),
        releasedAmount: releaseAmount,
        releaseReason: releaseData.releaseReason
      }, trx);

      // Send notifications
      await this.notificationService.sendEscrowReleaseNotification(
        delivery.travelerId,
        payoutBreakdown.travelerAmount
      );

      return {
        status: 'released',
        releasedAmount: releaseAmount,
        travelerPayout: payoutBreakdown.travelerAmount,
        platformFee: payoutBreakdown.platformFee
      };
    });
  }

  calculatePayoutBreakdown(escrow, releaseAmount) {
    const paymentIntent = escrow.paymentIntent;
    const platformFeeRate = paymentIntent.platformFee / paymentIntent.amount;
    
    const platformFee = Math.round(releaseAmount * platformFeeRate);
    const travelerAmount = releaseAmount - platformFee;
    
    return {
      travelerAmount,
      platformFee,
      processingFee: 0 // Already deducted during payment
    };
  }

  async scheduleAutoRelease(escrowId, releaseDate) {
    const job = await this.escrowReleaseQueue.add('auto-release', {
      escrowId,
      releaseReason: 'auto_release_timeout'
    }, {
      delay: releaseDate.getTime() - Date.now()
    });

    return job.id;
  }
}
```

#### 4. Payout Service
```javascript
class PayoutService {
  async createPayoutAccount(userId, accountData) {
    const {
      accountType = 'express',
      country,
      currency,
      businessProfile,
      tosAcceptance
    } = accountData;

    // Create Stripe Connect account
    const stripeAccount = await this.stripe.createAccount({
      type: accountType,
      country,
      default_currency: currency,
      business_profile: businessProfile,
      tos_acceptance: tosAcceptance
    });

    // Store in database
    const payoutAccount = await this.payoutAccountRepository.create({
      userId,
      stripeAccountId: stripeAccount.id,
      accountType,
      country,
      currency,
      status: 'pending',
      capabilities: stripeAccount.capabilities,
      requirements: stripeAccount.requirements
    });

    return {
      id: payoutAccount.id,
      accountId: stripeAccount.id,
      status: stripeAccount.details_submitted ? 'pending' : 'incomplete',
      requirements: stripeAccount.requirements
    };
  }

  async processPayout(userId, amount, options = {}) {
    const payoutAccount = await this.payoutAccountRepository.findByUserId(userId);
    
    if (!payoutAccount || payoutAccount.status !== 'active') {
      throw new PayoutAccountError('Payout account not found or not active');
    }

    const {
      type = 'standard',
      description = 'Delivery earnings payout'
    } = options;

    // Check minimum payout amount
    const minimumAmount = type === 'instant' ? 500 : 100; // $5 instant, $1 standard
    if (amount < minimumAmount) {
      throw new PayoutAmountError(`Minimum payout amount is ${minimumAmount} cents`);
    }

    // Calculate fees
    const fees = this.calculatePayoutFees(amount, type);
    const netAmount = amount - fees;

    try {
      // Create Stripe payout
      const stripePayout = await this.stripe.createPayout({
        amount: netAmount,
        currency: payoutAccount.currency,
        method: type === 'instant' ? 'instant' : 'standard'
      }, {
        stripeAccount: payoutAccount.stripeAccountId
      });

      // Store payout record
      const payout = await this.payoutRepository.create({
        userId,
        payoutAccountId: payoutAccount.id,
        stripePayoutId: stripePayout.id,
        amount,
        currency: payoutAccount.currency,
        type,
        status: stripePayout.status,
        fee: fees,
        netAmount,
        description
      });

      // Send notification
      await this.notificationService.sendPayoutNotification(userId, payout);

      return {
        id: payout.id,
        amount: netAmount,
        currency: payoutAccount.currency,
        type,
        status: stripePayout.status,
        estimatedArrival: stripePayout.arrival_date
      };

    } catch (error) {
      console.error('Payout failed:', error);
      throw new PayoutFailedError(error.message);
    }
  }

  calculatePayoutFees(amount, type) {
    if (type === 'instant') {
      // Instant payout: 1.5% with $0.50 minimum
      return Math.max(50, Math.round(amount * 0.015));
    } else {
      // Standard payout: Free
      return 0;
    }
  }

  async getPayoutHistory(userId, filters = {}) {
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = filters;

    const payouts = await this.payoutRepository.findByUserWithFilters(userId, {
      status,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }, page, limit);

    return {
      payouts: payouts.data,
      pagination: {
        page,
        limit,
        total: payouts.total,
        totalPages: Math.ceil(payouts.total / limit)
      }
    };
  }
}
```

#### 5. Fraud Detection Service
```javascript
class FraudDetectionService {
  constructor() {
    this.riskScoreThreshold = {
      low: 0.3,
      medium: 0.6,
      high: 0.8
    };
  }

  async analyzePayment(paymentData) {
    const riskFactors = await this.calculateRiskFactors(paymentData);
    const riskScore = this.calculateRiskScore(riskFactors);
    const riskLevel = this.determineRiskLevel(riskScore);
    
    // Log risk analysis
    await this.logRiskAnalysis(paymentData, riskFactors, riskScore, riskLevel);
    
    return {
      riskScore,
      riskLevel,
      riskFactors,
      recommendation: this.getRecommendation(riskLevel),
      requiresManualReview: riskLevel === 'high'
    };
  }

  async calculateRiskFactors(paymentData) {
    const factors = {};
    
    // Payment method analysis
    factors.paymentMethodRisk = await this.analyzePaymentMethod(paymentData.paymentMethodId);
    
    // User behavior analysis
    factors.userBehaviorRisk = await this.analyzeUserBehavior(paymentData.customerId);
    
    // Amount analysis
    factors.amountRisk = this.analyzeAmount(paymentData.amount, paymentData.customerId);
    
    // Geographic analysis
    factors.geographicRisk = await this.analyzeGeography(paymentData);
    
    // Velocity analysis
    factors.velocityRisk = await this.analyzeVelocity(paymentData.customerId);
    
    // Device analysis
    factors.deviceRisk = await this.analyzeDevice(paymentData.deviceInfo);
    
    return factors;
  }

  calculateRiskScore(riskFactors) {
    const weights = {
      paymentMethodRisk: 0.25,
      userBehaviorRisk: 0.20,
      amountRisk: 0.15,
      geographicRisk: 0.15,
      velocityRisk: 0.15,
      deviceRisk: 0.10
    };

    let totalScore = 0;
    for (const [factor, score] of Object.entries(riskFactors)) {
      totalScore += score * (weights[factor] || 0);
    }

    return Math.min(1, Math.max(0, totalScore));
  }

  determineRiskLevel(riskScore) {
    if (riskScore >= this.riskScoreThreshold.high) return 'high';
    if (riskScore >= this.riskScoreThreshold.medium) return 'medium';
    return 'low';
  }

  async analyzeUserBehavior(userId) {
    const userHistory = await this.getUserPaymentHistory(userId);
    
    let riskScore = 0;
    
    // New user risk
    if (userHistory.totalPayments === 0) riskScore += 0.3;
    
    // Failed payment history
    const failureRate = userHistory.failedPayments / Math.max(userHistory.totalPayments, 1);
    riskScore += failureRate * 0.5;
    
    // Chargeback history
    if (userHistory.chargebacks > 0) riskScore += 0.4;
    
    // Account age
    const accountAge = moment().diff(userHistory.createdAt, 'days');
    if (accountAge < 7) riskScore += 0.2;
    
    return Math.min(1, riskScore);
  }

  async analyzeVelocity(userId) {
    const recentPayments = await this.getRecentPayments(userId, 24); // 24 hours
    
    let riskScore = 0;
    
    // Number of payments
    if (recentPayments.length > 10) riskScore += 0.5;
    else if (recentPayments.length > 5) riskScore += 0.3;
    
    // Total amount
    const totalAmount = recentPayments.reduce((sum, p) => sum + p.amount, 0);
    if (totalAmount > 100000) riskScore += 0.4; // $1000
    
    // Unusual patterns
    const amounts = recentPayments.map(p => p.amount);
    const uniqueAmounts = new Set(amounts);
    if (amounts.length > 3 && uniqueAmounts.size === 1) {
      riskScore += 0.3; // Same amount multiple times
    }
    
    return Math.min(1, riskScore);
  }
}
```

## 🔐 Security & Compliance

### 1. PCI DSS Compliance
```javascript
class PCIComplianceService {
  async validateCardData(cardData) {
    // Never store full card numbers
    const maskedNumber = this.maskCardNumber(cardData.number);
    
    // Validate card number using Luhn algorithm
    const isValidCard = this.luhnValidation(cardData.number);
    
    // Check against stolen card database
    const isStolenCard = await this.checkStolenCardDatabase(cardData.number);
    
    return {
      isValid: isValidCard && !isStolenCard,
      maskedNumber,
      cardType: this.detectCardType(cardData.number)
    };
  }

  maskCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    return cleaned.slice(0, 4) + '*'.repeat(cleaned.length - 8) + cleaned.slice(-4);
  }
}
```

### 2. AML/KYC Compliance
```javascript
class ComplianceService {
  async performKYCCheck(userId, kycData) {
    const checks = {
      identityVerification: await this.verifyIdentity(kycData.identity),
      addressVerification: await this.verifyAddress(kycData.address),
      sanctionsCheck: await this.checkSanctionsList(kycData.identity),
      pepCheck: await this.checkPEPList(kycData.identity),
      watchlistCheck: await this.checkWatchlists(kycData.identity)
    };

    const overallStatus = this.determineKYCStatus(checks);
    
    await this.kycRepository.create({
      userId,
      checks,
      status: overallStatus,
      completedAt: new Date()
    });

    return { status: overallStatus, checks };
  }
}
```

## 📈 Performance Optimization

### 1. Payment Caching
```javascript
class PaymentCacheService {
  async cachePricingData(routeHash, pricingData) {
    await this.redis.setex(`pricing:${routeHash}`, 300, JSON.stringify(pricingData));
  }

  async cacheExchangeRates(rates) {
    await this.redis.setex('exchange_rates', 3600, JSON.stringify(rates));
  }

  async cacheMarketData(marketData) {
    await this.redis.setex('market_data', 600, JSON.stringify(marketData));
  }
}
```

### 2. Database Optimization
```sql
-- Payment processing indexes
CREATE INDEX idx_payment_intents_delivery ON payment_intents(delivery_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status, created_at);
CREATE INDEX idx_payment_intents_stripe_id ON payment_intents(stripe_payment_intent_id);

-- Escrow management indexes
CREATE INDEX idx_escrow_status_hold_until ON escrow_accounts(status, hold_until);
CREATE INDEX idx_escrow_delivery_id ON escrow_accounts(delivery_id);

-- Payout indexes
CREATE INDEX idx_payouts_user_status ON payouts(user_id, status, created_at);
CREATE INDEX idx_payouts_stripe_id ON payouts(stripe_payout_id);

-- Pricing indexes
CREATE INDEX idx_pricing_factors_route ON pricing_factors(route_hash, effective_from);
CREATE INDEX idx_pricing_factors_category ON pricing_factors(item_category, urgency);
```

## 🧪 Testing Strategy

### 1. Payment Flow Testing
```javascript
describe('Payment Flow', () => {
  it('should process payment and create escrow', async () => {
    const paymentData = {
      deliveryId: 'delivery-id',
      amount: 3000,
      currency: 'USD',
      customerId: 'customer-id',
      paymentMethodId: 'pm_test_card'
    };

    const paymentIntent = await paymentService.createPaymentIntent(paymentData);
    expect(paymentIntent.status).toBe('requires_confirmation');

    const confirmedPayment = await paymentService.confirmPayment(paymentIntent.id, {
      paymentMethodId: paymentData.paymentMethodId
    });
    expect(confirmedPayment.status).toBe('succeeded');

    const escrow = await escrowService.findByDeliveryId(paymentData.deliveryId);
    expect(escrow).toBeDefined();
    expect(escrow.status).toBe('held');
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **Price Calculation**: < 300ms average response time
- **Payment Processing**: < 2s average response time
- **Escrow Operations**: < 500ms average response time
- **Payout Processing**: < 1s average response time
- **Fraud Detection**: < 200ms average response time
- **Throughput**: 500+ transactions/second per instance

This Payment Service architecture provides comprehensive financial operations with advanced security, fraud prevention, and regulatory compliance for the P2P Delivery Platform.