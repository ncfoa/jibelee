# Delivery Request Service - Detailed Architecture

## 🏗️ Service Overview

The Delivery Request Service is the core business logic service that handles delivery requests, intelligent matching algorithms, offer management, and delivery lifecycle in the P2P Delivery Platform. It connects customers who need items delivered with travelers who have available capacity.

**Port:** 3004  
**Base URL:** `/api/v1/delivery-requests`  
**Database:** `delivery_db` (PostgreSQL with PostGIS)

## 🎯 Core Responsibilities

### Primary Functions
- **Delivery Request Management**: Complete CRUD operations for delivery requests
- **AI-Powered Matching**: Intelligent algorithm to match requests with suitable trips
- **Offer Management**: Handle traveler offers and customer acceptance/rejection
- **Delivery Lifecycle**: Track deliveries from request to completion
- **Market Analysis**: Dynamic pricing recommendations and market insights
- **Compatibility Scoring**: Multi-factor compatibility assessment
- **Real-time Notifications**: Live updates for all parties involved

### Key Features
- **Smart Matching Algorithm**: ML-based matching considering 15+ factors
- **Real-time Offer System**: Instant offer notifications and responses
- **Automated Acceptance**: Optional auto-accept based on criteria
- **Market Intelligence**: Dynamic pricing based on supply/demand
- **Geospatial Matching**: Location-based matching with radius optimization
- **Performance Analytics**: Success rates and optimization insights

## 🗄️ Database Schema

### Core Tables

#### 1. Delivery Requests Table
```sql
CREATE TABLE delivery_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category item_category_enum NOT NULL,
    status delivery_request_status_enum NOT NULL DEFAULT 'pending',
    urgency urgency_level_enum NOT NULL DEFAULT 'standard',
    
    -- Item details
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    weight DECIMAL(8,2) NOT NULL,
    dimensions JSONB, -- {length, width, height}
    value DECIMAL(12,2),
    is_fragile BOOLEAN DEFAULT FALSE,
    is_perishable BOOLEAN DEFAULT FALSE,
    is_hazardous BOOLEAN DEFAULT FALSE,
    requires_signature BOOLEAN DEFAULT FALSE,
    item_images TEXT[],
    
    -- Pickup location
    pickup_address VARCHAR(500) NOT NULL,
    pickup_coordinates GEOGRAPHY(POINT, 4326),
    pickup_contact_name VARCHAR(255),
    pickup_contact_phone VARCHAR(20),
    pickup_instructions TEXT,
    pickup_time_start TIMESTAMP,
    pickup_time_end TIMESTAMP,
    flexible_pickup_timing BOOLEAN DEFAULT FALSE,
    preferred_pickup_days TEXT[],
    
    -- Delivery location
    delivery_address VARCHAR(500) NOT NULL,
    delivery_coordinates GEOGRAPHY(POINT, 4326),
    delivery_contact_name VARCHAR(255),
    delivery_contact_phone VARCHAR(20),
    delivery_instructions TEXT,
    delivery_time_start TIMESTAMP,
    delivery_time_end TIMESTAMP,
    requires_recipient_presence BOOLEAN DEFAULT FALSE,
    
    -- Pricing
    max_price DECIMAL(10,2) NOT NULL,
    auto_accept_price DECIMAL(10,2),
    estimated_price DECIMAL(10,2),
    
    -- Preferences and restrictions
    preferred_travelers UUID[],
    blacklisted_travelers UUID[],
    min_traveler_rating DECIMAL(3,2) DEFAULT 0.00,
    verification_required BOOLEAN DEFAULT FALSE,
    insurance_required BOOLEAN DEFAULT FALSE,
    background_check_required BOOLEAN DEFAULT FALSE,
    
    -- Notifications
    notification_preferences JSONB DEFAULT '{}',
    special_instructions TEXT,
    tags TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT
);
```

#### 2. Delivery Offers Table
```sql
CREATE TABLE delivery_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_request_id UUID NOT NULL,
    traveler_id UUID NOT NULL,
    trip_id UUID,
    price DECIMAL(10,2) NOT NULL,
    message TEXT,
    estimated_pickup_time TIMESTAMP,
    estimated_delivery_time TIMESTAMP,
    status offer_status_enum NOT NULL DEFAULT 'pending',
    
    -- Guarantees and services
    guarantees JSONB DEFAULT '{}',
    special_services JSONB DEFAULT '{}',
    
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    declined_at TIMESTAMP,
    declined_reason TEXT
);
```

#### 3. Deliveries Table
```sql
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_request_id UUID NOT NULL,
    offer_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    traveler_id UUID NOT NULL,
    trip_id UUID,
    
    delivery_number VARCHAR(20) UNIQUE NOT NULL, -- DEL-001234
    status delivery_status_enum NOT NULL DEFAULT 'accepted',
    
    -- Final agreed terms
    final_price DECIMAL(10,2) NOT NULL,
    special_requests TEXT,
    
    -- Timeline tracking
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pickup_scheduled_at TIMESTAMP,
    pickup_completed_at TIMESTAMP,
    in_transit_at TIMESTAMP,
    delivery_scheduled_at TIMESTAMP,
    delivery_completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by UUID,
    
    -- Completion details
    pickup_verification JSONB,
    delivery_verification JSONB,
    recipient_signature_url VARCHAR(500),
    delivery_photo_url VARCHAR(500),
    delivery_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Enums
```sql
CREATE TYPE item_category_enum AS ENUM (
    'documents', 'electronics', 'clothing', 'food', 'fragile', 'books', 'gifts', 'other'
);

CREATE TYPE delivery_request_status_enum AS ENUM (
    'pending', 'matched', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired'
);

CREATE TYPE urgency_level_enum AS ENUM ('standard', 'express', 'urgent');

CREATE TYPE offer_status_enum AS ENUM ('pending', 'accepted', 'declined', 'expired', 'withdrawn');

CREATE TYPE delivery_status_enum AS ENUM (
    'accepted', 'pickup_scheduled', 'picked_up', 'in_transit', 
    'delivery_scheduled', 'delivered', 'cancelled', 'disputed'
);
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js or Python with Django/FastAPI
const express = require('express');
const tf = require('@tensorflow/tfjs-node');
const bull = require('bull');
const socketio = require('socket.io');
const moment = require('moment');
```

### Key Dependencies
- **Express.js/Django**: Web framework
- **TensorFlow.js/PyTorch**: Machine learning for matching
- **Bull Queue**: Background job processing
- **Socket.io**: Real-time notifications
- **PostGIS**: Geospatial queries
- **Redis**: Caching and pub/sub
- **Elasticsearch**: Advanced search capabilities

### Machine Learning Stack
- **TensorFlow/PyTorch**: Matching algorithm training
- **Scikit-learn**: Feature engineering
- **Pandas/NumPy**: Data processing
- **MLflow**: Model versioning and deployment

## 📊 API Endpoints (20 Total)

### Delivery Request Management Endpoints

#### 1. Create Delivery Request
```http
POST /api/v1/delivery-requests
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Important Documents to Boston",
  "description": "Legal documents that need to be delivered urgently",
  "category": "documents",
  "urgency": "express",
  "item": {
    "name": "Legal Documents",
    "description": "Sealed envelope with contracts",
    "quantity": 1,
    "weight": 0.5,
    "dimensions": {
      "length": 30,
      "width": 21,
      "height": 2
    },
    "value": 0,
    "isFragile": false,
    "isPerishable": false,
    "requiresSignature": true,
    "images": ["https://example.com/image1.jpg"]
  },
  "pickup": {
    "address": "123 Main St, New York, NY 10001",
    "coordinates": { "lat": 40.7128, "lng": -74.0060 },
    "contactName": "John Doe",
    "contactPhone": "+1234567890",
    "instructions": "Ring apartment 5B",
    "timeWindow": {
      "start": "2025-02-01T09:00:00Z",
      "end": "2025-02-01T18:00:00Z"
    },
    "flexibleTiming": true
  },
  "delivery": {
    "address": "456 Oak Ave, Boston, MA 02101",
    "coordinates": { "lat": 42.3601, "lng": -71.0589 },
    "contactName": "Jane Smith",
    "contactPhone": "+1987654321",
    "instructions": "Office building, ask for reception",
    "timeWindow": {
      "start": "2025-02-02T09:00:00Z",
      "end": "2025-02-02T17:00:00Z"
    },
    "requiresRecipientPresence": true
  },
  "pricing": {
    "maxPrice": 50.00,
    "autoAcceptPrice": 30.00
  },
  "preferences": {
    "minTravelerRating": 4.5,
    "verificationRequired": true,
    "insuranceRequired": false,
    "preferredTravelers": ["traveler-uuid-1"]
  },
  "expiresAt": "2025-02-05T23:59:59Z"
}
```

#### 2. Get Customer's Delivery Requests
```http
GET /api/v1/delivery-requests/me
Authorization: Bearer <access_token>
Query Parameters:
- status: pending|matched|accepted|delivered|cancelled
- page: 1
- limit: 20
- sort: created_at|departure_time|price
- order: asc|desc
```

#### 3. Get Delivery Request Details
```http
GET /api/v1/delivery-requests/:requestId
Authorization: Bearer <access_token>
```

#### 4. Update Delivery Request
```http
PUT /api/v1/delivery-requests/:requestId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Updated Title",
  "maxPrice": 60.00,
  "pickup": {
    "instructions": "Updated pickup instructions"
  }
}
```

#### 5. Cancel Delivery Request
```http
POST /api/v1/delivery-requests/:requestId/cancel
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "Plans changed",
  "notifyTravelers": true
}
```

### Matching & Discovery Endpoints

#### 6. Find Matching Trips
```http
POST /api/v1/delivery-requests/:requestId/find-matches
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "maxDistance": 10,
  "maxDetour": 20,
  "timeFlexibility": 6
}
```

#### 7. Get Market Analysis
```http
GET /api/v1/delivery-requests/market-analysis
Authorization: Bearer <access_token>
Query Parameters:
- origin: "New York, NY"
- destination: "Boston, MA"
- category: documents
- urgency: express
```

#### 8. Get Price Recommendations
```http
POST /api/v1/delivery-requests/price-recommendations
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "route": {
    "origin": { "lat": 40.7128, "lng": -74.0060 },
    "destination": { "lat": 42.3601, "lng": -71.0589 }
  },
  "item": {
    "weight": 2.5,
    "category": "electronics",
    "value": 500
  },
  "urgency": "express"
}
```

### Offer Management Endpoints

#### 9. Get Offers for Request
```http
GET /api/v1/delivery-requests/:requestId/offers
Authorization: Bearer <access_token>
Query Parameters:
- status: pending|accepted|declined
- sort: price|rating|created_at
- order: asc|desc
```

#### 10. Submit Offer (Traveler)
```http
POST /api/v1/delivery-requests/:requestId/offers
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "tripId": "trip-uuid",
  "price": 35.00,
  "message": "I can deliver this safely and on time",
  "estimatedPickupTime": "2025-02-01T14:00:00Z",
  "estimatedDeliveryTime": "2025-02-02T10:00:00Z",
  "guarantees": {
    "insurance": true,
    "tracking": true,
    "photoUpdates": true
  },
  "specialServices": {
    "expressDelivery": false,
    "signatureRequired": true,
    "whiteGloveService": false
  }
}
```

#### 11. Accept Offer (Customer)
```http
POST /api/v1/delivery-requests/:requestId/offers/:offerId/accept
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "specialRequests": "Please send photo confirmation when picked up"
}
```

#### 12. Decline Offer (Customer)
```http
POST /api/v1/delivery-requests/:requestId/offers/:offerId/decline
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "Price too high",
  "message": "Thank you for the offer, but I found a better option"
}
```

#### 13. Withdraw Offer (Traveler)
```http
POST /api/v1/delivery-requests/offers/:offerId/withdraw
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "Trip cancelled"
}
```

### Delivery Management Endpoints

#### 14. Get Active Deliveries
```http
GET /api/v1/deliveries/active
Authorization: Bearer <access_token>
Query Parameters:
- role: customer|traveler
- status: accepted|in_transit|delivered
```

#### 15. Get Delivery Details
```http
GET /api/v1/deliveries/:deliveryId
Authorization: Bearer <access_token>
```

#### 16. Update Delivery Status
```http
POST /api/v1/deliveries/:deliveryId/status
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "picked_up|in_transit|delivered",
  "notes": "Package picked up successfully",
  "photos": ["https://example.com/pickup-photo.jpg"],
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

#### 17. Complete Delivery
```http
POST /api/v1/deliveries/:deliveryId/complete
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

deliveryPhoto: [image file]
recipientSignature: [signature image]
notes: "Delivered successfully to recipient"
```

### Analytics & Search Endpoints

#### 18. Search Delivery Requests (Travelers)
```http
GET /api/v1/delivery-requests/search
Authorization: Bearer <access_token>
Query Parameters:
- origin: "New York, NY"
- destination: "Boston, MA"
- maxDistance: 50
- category: documents|electronics|clothing
- urgency: standard|express|urgent
- maxWeight: 5
- dateFrom: 2025-02-01
- dateTo: 2025-02-07
- minPrice: 10
- maxPrice: 100
```

#### 19. Get Delivery Analytics
```http
GET /api/v1/deliveries/analytics
Authorization: Bearer <access_token>
Query Parameters:
- role: customer|traveler
- period: week|month|quarter|year
- startDate: 2025-01-01
- endDate: 2025-01-31
```

#### 20. Get Compatibility Score
```http
POST /api/v1/delivery-requests/:requestId/compatibility/:travelerId
Authorization: Bearer <access_token>
```

## 🏗️ Service Architecture

### Directory Structure
```
delivery-request-service/
├── src/
│   ├── controllers/
│   │   ├── deliveryRequestController.js
│   │   ├── offerController.js
│   │   ├── deliveryController.js
│   │   ├── matchingController.js
│   │   └── analyticsController.js
│   ├── models/
│   │   ├── DeliveryRequest.js
│   │   ├── DeliveryOffer.js
│   │   ├── Delivery.js
│   │   └── MatchingCriteria.js
│   ├── services/
│   │   ├── deliveryRequestService.js
│   │   ├── matchingService.js
│   │   ├── offerService.js
│   │   ├── deliveryService.js
│   │   ├── pricingService.js
│   │   ├── marketAnalysisService.js
│   │   └── notificationService.js
│   ├── ml/
│   │   ├── models/
│   │   │   ├── matchingModel.js
│   │   │   └── pricingModel.js
│   │   ├── training/
│   │   │   ├── dataPreprocessor.js
│   │   │   └── modelTrainer.js
│   │   └── inference/
│   │       ├── matchingEngine.js
│   │       └── pricingEngine.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── validationMiddleware.js
│   │   ├── geoMiddleware.js
│   │   └── rateLimitMiddleware.js
│   ├── routes/
│   │   ├── deliveryRequestRoutes.js
│   │   ├── offerRoutes.js
│   │   ├── deliveryRoutes.js
│   │   └── searchRoutes.js
│   ├── utils/
│   │   ├── geoUtils.js
│   │   ├── pricingUtils.js
│   │   ├── matchingUtils.js
│   │   └── validationUtils.js
│   ├── jobs/
│   │   ├── matchingJob.js
│   │   ├── pricingUpdateJob.js
│   │   └── expirationJob.js
│   ├── config/
│   │   ├── database.js
│   │   ├── ml.js
│   │   ├── queue.js
│   │   └── realtime.js
│   └── app.js
├── ml-models/
│   ├── matching/
│   └── pricing/
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. Matching Service
```javascript
class MatchingService {
  constructor() {
    this.mlModel = new MatchingModel();
    this.geoUtils = new GeoUtils();
  }

  async findMatches(deliveryRequestId, criteria = {}) {
    const request = await this.deliveryRequestRepository.findById(deliveryRequestId);
    
    // Get potential trips based on geospatial and temporal constraints
    const candidateTrips = await this.findCandidateTrips(request, criteria);
    
    // Score each trip using ML model
    const scoredMatches = await Promise.all(
      candidateTrips.map(trip => this.scoreMatch(request, trip))
    );
    
    // Sort by compatibility score and return top matches
    return scoredMatches
      .filter(match => match.compatibilityScore > 0.6)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);
  }

  async findCandidateTrips(request, criteria) {
    const {
      maxDistance = 10, // km
      maxDetour = 20, // km
      timeFlexibility = 6 // hours
    } = criteria;

    // Build geospatial query
    const spatialQuery = {
      // Origin within maxDistance of pickup location
      originNear: {
        coordinates: request.pickupCoordinates,
        maxDistance: maxDistance * 1000 // Convert to meters
      },
      // Destination within maxDistance of delivery location
      destinationNear: {
        coordinates: request.deliveryCoordinates,
        maxDistance: maxDistance * 1000
      },
      // Departure time within flexibility window
      departureTime: {
        gte: moment(request.pickupTimeStart).subtract(timeFlexibility, 'hours').toDate(),
        lte: moment(request.pickupTimeEnd).add(timeFlexibility, 'hours').toDate()
      },
      // Available capacity
      availableWeight: { gte: request.weight },
      availableItems: { gte: request.quantity },
      status: 'upcoming',
      visibility: 'public'
    };

    const trips = await this.tripRepository.findWithGeoConstraints(spatialQuery);
    
    // Filter by detour constraint
    return trips.filter(trip => {
      const detour = this.calculateDetour(trip, request);
      return detour <= maxDetour;
    });
  }

  async scoreMatch(request, trip) {
    // Extract features for ML model
    const features = this.extractMatchingFeatures(request, trip);
    
    // Get compatibility score from ML model
    const compatibilityScore = await this.mlModel.predict(features);
    
    // Calculate additional metrics
    const routeEfficiency = this.calculateRouteEfficiency(request, trip);
    const priceCompatibility = this.calculatePriceCompatibility(request, trip);
    const timeCompatibility = this.calculateTimeCompatibility(request, trip);
    
    return {
      tripId: trip.id,
      travelerId: trip.travelerId,
      compatibilityScore,
      routeEfficiency,
      priceCompatibility,
      timeCompatibility,
      estimatedPrice: await this.pricingService.calculatePrice(request, trip),
      estimatedPickupTime: this.calculateEstimatedPickupTime(request, trip),
      estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(request, trip)
    };
  }

  extractMatchingFeatures(request, trip) {
    const traveler = trip.traveler;
    
    return {
      // Distance features
      originDistance: this.geoUtils.calculateDistance(
        request.pickupCoordinates, 
        trip.originCoordinates
      ),
      destinationDistance: this.geoUtils.calculateDistance(
        request.deliveryCoordinates, 
        trip.destinationCoordinates
      ),
      routeDetour: this.calculateDetour(trip, request),
      
      // Capacity features
      weightUtilization: request.weight / trip.availableWeight,
      volumeUtilization: this.calculateVolumeUtilization(request, trip),
      
      // Traveler features
      travelerRating: traveler.averageRating,
      travelerExperience: traveler.totalDeliveries,
      travelerVerificationLevel: this.getVerificationScore(traveler.verificationLevel),
      
      // Item compatibility
      categoryMatch: this.getCategoryCompatibility(request.category, trip.preferences),
      fragileCompatible: !request.isFragile || trip.preferences.acceptFragile,
      valueCompatible: !request.value || request.value <= trip.preferences.maxItemValue,
      
      // Timing features
      timeFlexibility: this.calculateTimeFlexibility(request, trip),
      urgencyMatch: this.getUrgencyScore(request.urgency, trip.type),
      
      // Historical features
      routeExperience: this.getRouteExperience(traveler, request),
      categoryExperience: this.getCategoryExperience(traveler, request.category)
    };
  }
}
```

#### 2. Offer Service
```javascript
class OfferService {
  async submitOffer(travelerId, requestId, offerData) {
    // Validate offer eligibility
    await this.validateOfferEligibility(travelerId, requestId);
    
    // Check if traveler already has an offer for this request
    const existingOffer = await this.offerRepository.findByTravelerAndRequest(travelerId, requestId);
    if (existingOffer) {
      throw new DuplicateOfferError('You already have an offer for this request');
    }

    // Validate pricing
    const request = await this.deliveryRequestRepository.findById(requestId);
    if (offerData.price > request.maxPrice) {
      throw new ValidationError('Offer price exceeds maximum price');
    }

    // Create offer
    const offer = await this.offerRepository.create({
      ...offerData,
      travelerId,
      deliveryRequestId: requestId,
      validUntil: moment().add(24, 'hours').toDate() // 24-hour expiry
    });

    // Send real-time notification to customer
    await this.notificationService.sendOfferNotification(request.customerId, offer);

    // Check for auto-acceptance
    if (request.autoAcceptPrice && offerData.price <= request.autoAcceptPrice) {
      await this.autoAcceptOffer(offer.id);
    }

    return offer;
  }

  async acceptOffer(customerId, offerId, acceptanceData) {
    return this.offerRepository.transaction(async (trx) => {
      const offer = await this.offerRepository.findByIdForUpdate(offerId, trx);
      
      if (!offer || offer.status !== 'pending') {
        throw new InvalidOfferError('Offer is no longer available');
      }

      const request = await this.deliveryRequestRepository.findById(offer.deliveryRequestId, trx);
      if (request.customerId !== customerId) {
        throw new UnauthorizedError('Not authorized to accept this offer');
      }

      // Accept the offer
      await this.offerRepository.update(offerId, {
        status: 'accepted',
        acceptedAt: new Date()
      }, trx);

      // Decline all other offers for this request
      await this.offerRepository.declineOtherOffers(offer.deliveryRequestId, offerId, trx);

      // Update request status
      await this.deliveryRequestRepository.update(offer.deliveryRequestId, {
        status: 'accepted'
      }, trx);

      // Create delivery record
      const delivery = await this.deliveryRepository.create({
        deliveryRequestId: offer.deliveryRequestId,
        offerId: offer.id,
        customerId: request.customerId,
        travelerId: offer.travelerId,
        tripId: offer.tripId,
        deliveryNumber: await this.generateDeliveryNumber(),
        finalPrice: offer.price,
        specialRequests: acceptanceData.specialRequests
      }, trx);

      // Reserve trip capacity
      await this.capacityService.reserveCapacity(offer.tripId, {
        weight: request.weight,
        volume: this.calculateItemVolume(request.dimensions),
        items: request.quantity
      }, delivery.id, trx);

      // Send notifications
      await this.notificationService.sendOfferAcceptedNotification(offer.travelerId, delivery);
      await this.notificationService.sendDeliveryCreatedNotification(request.customerId, delivery);

      return delivery;
    });
  }

  async autoAcceptOffer(offerId) {
    const offer = await this.offerRepository.findById(offerId);
    const request = await this.deliveryRequestRepository.findById(offer.deliveryRequestId);
    
    // Auto-accept the offer
    await this.acceptOffer(request.customerId, offerId, {
      specialRequests: 'Auto-accepted based on your criteria'
    });
  }
}
```

#### 3. Machine Learning Matching Engine
```javascript
class MatchingModel {
  constructor() {
    this.model = null;
    this.loadModel();
  }

  async loadModel() {
    try {
      this.model = await tf.loadLayersModel('file://./ml-models/matching/model.json');
    } catch (error) {
      console.error('Failed to load ML model:', error);
      // Fallback to rule-based matching
      this.model = null;
    }
  }

  async predict(features) {
    if (!this.model) {
      return this.ruleBasedScore(features);
    }

    // Normalize features
    const normalizedFeatures = this.normalizeFeatures(features);
    
    // Convert to tensor
    const inputTensor = tf.tensor2d([normalizedFeatures]);
    
    // Make prediction
    const prediction = this.model.predict(inputTensor);
    const score = await prediction.data();
    
    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();
    
    return score[0];
  }

  ruleBasedScore(features) {
    let score = 0.5; // Base score
    
    // Distance scoring (closer is better)
    if (features.originDistance <= 5) score += 0.2;
    else if (features.originDistance <= 10) score += 0.1;
    else score -= 0.1;
    
    if (features.destinationDistance <= 5) score += 0.2;
    else if (features.destinationDistance <= 10) score += 0.1;
    else score -= 0.1;
    
    // Traveler rating
    if (features.travelerRating >= 4.5) score += 0.2;
    else if (features.travelerRating >= 4.0) score += 0.1;
    else if (features.travelerRating < 3.0) score -= 0.2;
    
    // Capacity utilization (efficient use is better)
    if (features.weightUtilization > 0.7) score += 0.1;
    if (features.weightUtilization < 0.1) score -= 0.1;
    
    // Compatibility factors
    if (features.categoryMatch) score += 0.1;
    if (features.fragileCompatible) score += 0.05;
    if (features.valueCompatible) score += 0.05;
    
    // Experience bonus
    if (features.travelerExperience > 50) score += 0.1;
    if (features.routeExperience > 5) score += 0.05;
    
    return Math.max(0, Math.min(1, score));
  }

  normalizeFeatures(features) {
    return [
      features.originDistance / 50, // Normalize to 0-1 (max 50km)
      features.destinationDistance / 50,
      features.routeDetour / 100, // Max 100km detour
      features.weightUtilization, // Already 0-1
      features.volumeUtilization,
      features.travelerRating / 5, // Rating out of 5
      Math.min(features.travelerExperience / 100, 1), // Cap at 100
      features.travelerVerificationLevel / 4, // 4 levels
      features.categoryMatch ? 1 : 0,
      features.fragileCompatible ? 1 : 0,
      features.valueCompatible ? 1 : 0,
      features.timeFlexibility / 24, // Hours normalized to days
      features.urgencyMatch / 3, // 3 urgency levels
      Math.min(features.routeExperience / 20, 1), // Cap at 20
      Math.min(features.categoryExperience / 50, 1) // Cap at 50
    ];
  }
}
```

#### 4. Real-time Notification Service
```javascript
class RealtimeNotificationService {
  constructor() {
    this.io = require('socket.io')(server);
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('join-user-room', (userId) => {
        socket.join(`user-${userId}`);
      });

      socket.on('join-delivery-room', (deliveryId) => {
        socket.join(`delivery-${deliveryId}`);
      });
    });
  }

  async sendOfferNotification(customerId, offer) {
    const notification = {
      type: 'new_offer',
      data: {
        offerId: offer.id,
        travelerId: offer.travelerId,
        price: offer.price,
        message: offer.message,
        estimatedPickupTime: offer.estimatedPickupTime,
        estimatedDeliveryTime: offer.estimatedDeliveryTime
      },
      timestamp: new Date()
    };

    // Send real-time notification
    this.io.to(`user-${customerId}`).emit('new_offer', notification);

    // Also send push notification
    await this.pushNotificationService.send(customerId, {
      title: 'New Delivery Offer',
      body: `You received a new offer for $${offer.price}`,
      data: { offerId: offer.id, type: 'new_offer' }
    });
  }

  async sendOfferAcceptedNotification(travelerId, delivery) {
    const notification = {
      type: 'offer_accepted',
      data: {
        deliveryId: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        finalPrice: delivery.finalPrice
      },
      timestamp: new Date()
    };

    this.io.to(`user-${travelerId}`).emit('offer_accepted', notification);

    await this.pushNotificationService.send(travelerId, {
      title: 'Offer Accepted!',
      body: `Your offer for delivery ${delivery.deliveryNumber} was accepted`,
      data: { deliveryId: delivery.id, type: 'offer_accepted' }
    });
  }

  async sendDeliveryStatusUpdate(deliveryId, status, details) {
    const delivery = await this.deliveryRepository.findById(deliveryId);
    
    const notification = {
      type: 'status_update',
      data: {
        deliveryId,
        status,
        details,
        timestamp: new Date()
      }
    };

    // Notify both customer and traveler
    this.io.to(`delivery-${deliveryId}`).emit('status_update', notification);
    this.io.to(`user-${delivery.customerId}`).emit('delivery_update', notification);
    this.io.to(`user-${delivery.travelerId}`).emit('delivery_update', notification);
  }
}
```

## 🤖 Machine Learning Pipeline

### 1. Training Data Collection
```javascript
class TrainingDataCollector {
  async collectMatchingData() {
    // Collect historical matching data
    const historicalMatches = await this.deliveryRepository.getHistoricalMatches();
    
    const trainingData = historicalMatches.map(match => {
      const features = this.extractMatchingFeatures(match.request, match.trip);
      const label = match.wasSuccessful ? 1 : 0;
      
      return { features, label };
    });

    return trainingData;
  }

  async collectPricingData() {
    // Collect pricing data with market outcomes
    const pricingData = await this.deliveryRepository.getPricingHistory();
    
    return pricingData.map(data => ({
      features: this.extractPricingFeatures(data),
      label: data.actualPrice
    }));
  }
}
```

### 2. Model Training
```javascript
class ModelTrainer {
  async trainMatchingModel(trainingData) {
    // Prepare data
    const features = trainingData.map(d => d.features);
    const labels = trainingData.map(d => d.label);
    
    // Create model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [15], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    // Train model
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);
    
    await model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs.loss}, accuracy = ${logs.acc}`);
        }
      }
    });

    // Save model
    await model.save('file://./ml-models/matching/model.json');
    
    // Cleanup
    xs.dispose();
    ys.dispose();
    
    return model;
  }
}
```

## 📈 Performance Optimization

### 1. Database Indexing
```sql
-- Delivery request search indexes
CREATE INDEX idx_delivery_requests_search ON delivery_requests(
    status, category, urgency, pickup_coordinates, delivery_coordinates
) WHERE status = 'pending';

-- Geospatial indexes
CREATE INDEX idx_delivery_requests_pickup ON delivery_requests USING GIST(pickup_coordinates);
CREATE INDEX idx_delivery_requests_delivery ON delivery_requests USING GIST(delivery_coordinates);

-- Offer management indexes
CREATE INDEX idx_delivery_offers_request_status ON delivery_offers(delivery_request_id, status);
CREATE INDEX idx_delivery_offers_traveler ON delivery_offers(traveler_id, status, created_at);

-- Delivery tracking indexes
CREATE INDEX idx_deliveries_status_updated ON deliveries(status, updated_at);
CREATE INDEX idx_deliveries_customer_status ON deliveries(customer_id, status);
CREATE INDEX idx_deliveries_traveler_status ON deliveries(traveler_id, status);

-- Full-text search indexes
CREATE INDEX idx_delivery_requests_search_text ON delivery_requests USING gin(
    (title || ' ' || description || ' ' || item_name) gin_trgm_ops
);
```

### 2. Caching Strategy
```javascript
class DeliveryRequestCacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async cacheSearchResults(searchHash, results) {
    await this.redis.setex(`search:${searchHash}`, 300, JSON.stringify(results)); // 5 min
  }

  async getCachedSearchResults(searchHash) {
    const cached = await this.redis.get(`search:${searchHash}`);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheMatchingResults(requestId, matches) {
    await this.redis.setex(`matches:${requestId}`, 600, JSON.stringify(matches)); // 10 min
  }

  async invalidateRequestCache(requestId) {
    const patterns = [`request:${requestId}`, `matches:${requestId}`, `search:*`];
    
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
```

## 🧪 Testing Strategy

### 1. Unit Tests
```javascript
describe('MatchingService', () => {
  describe('findMatches', () => {
    it('should return compatible trips for delivery request', async () => {
      const request = createTestDeliveryRequest();
      const trips = [createTestTrip(), createTestTrip()];
      
      mockTripRepository.findWithGeoConstraints.mockResolvedValue(trips);
      mockMLModel.predict.mockResolvedValue(0.85);

      const matches = await matchingService.findMatches(request.id);
      
      expect(matches).toHaveLength(2);
      expect(matches[0].compatibilityScore).toBeGreaterThan(0.6);
    });
  });
});
```

### 2. Integration Tests
```javascript
describe('Delivery Request Flow', () => {
  it('should complete full delivery request to completion flow', async () => {
    // Create delivery request
    const requestResponse = await request(app)
      .post('/api/v1/delivery-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(validRequestData);

    const requestId = requestResponse.body.data.id;

    // Submit offer
    const offerResponse = await request(app)
      .post(`/api/v1/delivery-requests/${requestId}/offers`)
      .set('Authorization', `Bearer ${travelerToken}`)
      .send(validOfferData);

    const offerId = offerResponse.body.data.id;

    // Accept offer
    const acceptResponse = await request(app)
      .post(`/api/v1/delivery-requests/${requestId}/offers/${offerId}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data.status).toBe('accepted');
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **Request Creation**: < 300ms average response time
- **Matching Algorithm**: < 2s for complex matches
- **Offer Submission**: < 150ms average response time
- **Search Queries**: < 200ms average response time
- **Real-time Notifications**: < 100ms delivery time
- **Throughput**: 300+ requests/second per instance

This Delivery Request Service architecture provides intelligent matching, comprehensive offer management, and real-time delivery tracking for the P2P Delivery Platform.