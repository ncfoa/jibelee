# User Management Service - Detailed Architecture

## 🏗️ Service Overview

The User Management Service handles comprehensive user profile management, identity verification, ratings, reviews, and user preferences in the P2P Delivery Platform. It manages the extended user data beyond basic authentication.

**Port:** 3002  
**Base URL:** `/api/v1/users`  
**Database:** `user_db` (PostgreSQL)

## 🎯 Core Responsibilities

### Primary Functions
- **Profile Management**: Complete user profile CRUD operations
- **Identity Verification**: Document upload and verification workflow
- **Rating & Review System**: Bidirectional rating system between users
- **Address Management**: Multiple address storage with favorites
- **User Preferences**: Settings, notifications, privacy controls
- **User Statistics**: Performance metrics and analytics
- **Favorites & Blocking**: User relationship management
- **Profile Privacy**: Granular privacy controls

### Key Features
- **Dual-Role System**: Support for Customer/Traveler/Both user types
- **Document Verification**: AI-powered identity document verification
- **Rating Analytics**: Detailed rating breakdowns and trends
- **Address Geocoding**: Automatic coordinate resolution
- **Privacy Controls**: GDPR-compliant data management
- **User Search**: Advanced user discovery with filters

## 🗄️ Database Schema

### Core Tables

#### 1. Users Table (Extended Profile)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    profile_picture_url VARCHAR(500),
    bio TEXT,
    user_type user_type_enum NOT NULL DEFAULT 'customer',
    status user_status_enum NOT NULL DEFAULT 'pending',
    verification_level verification_level_enum NOT NULL DEFAULT 'unverified',
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferred_currency VARCHAR(3) DEFAULT 'USD',
    referral_code VARCHAR(20) UNIQUE,
    referred_by_user_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

#### 2. User Addresses Table
```sql
CREATE TABLE user_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type address_type_enum NOT NULL DEFAULT 'other',
    label VARCHAR(100),
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. User Preferences Table
```sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    notification_settings JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{}',
    location_settings JSONB DEFAULT '{}',
    payment_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. User Statistics Table
```sql
CREATE TABLE user_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    total_trips INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    cancelled_deliveries INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INTEGER DEFAULT 0,
    response_time_minutes INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. User Verification Documents Table
```sql
CREATE TABLE user_verification_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    document_type document_type_enum NOT NULL,
    front_image_url VARCHAR(500),
    back_image_url VARCHAR(500),
    selfie_image_url VARCHAR(500),
    status verification_status_enum NOT NULL DEFAULT 'pending',
    verified_by UUID,
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. Reviews Table
```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    reviewee_id UUID NOT NULL,
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    comment TEXT,
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
    carefulness_rating INTEGER CHECK (carefulness_rating >= 1 AND carefulness_rating <= 5),
    friendliness_rating INTEGER CHECK (friendliness_rating >= 1 AND friendliness_rating <= 5),
    is_anonymous BOOLEAN DEFAULT FALSE,
    status review_status_enum NOT NULL DEFAULT 'active',
    moderation_status moderation_status_enum NOT NULL DEFAULT 'approved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 7. User Blocks Table
```sql
CREATE TABLE user_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL,
    blocked_id UUID NOT NULL,
    reason block_reason_enum,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 8. User Favorites Table
```sql
CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    traveler_id UUID NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js or Python with FastAPI
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const AWS = require('aws-sdk');
const geocoding = require('@mapbox/mapbox-sdk/services/geocoding');
```

### Key Dependencies
- **Express.js/FastAPI**: Web framework
- **Multer**: File upload handling
- **Sharp**: Image processing
- **AWS SDK**: S3 file storage
- **Mapbox/Google Maps**: Geocoding services
- **ML Libraries**: Document verification
- **Image Recognition**: Identity verification
- **Joi/Pydantic**: Request validation

### Database & Storage
- **PostgreSQL**: Primary database with PostGIS
- **AWS S3/Google Cloud**: File storage
- **Redis**: Caching layer
- **Elasticsearch**: User search (optional)

## 📊 API Endpoints (25 Total)

### Profile Management Endpoints

#### 1. Get Current User Profile
```http
GET /api/v1/users/me
Authorization: Bearer <access_token>
```

#### 2. Update User Profile
```http
PUT /api/v1/users/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Experienced traveler, happy to help with deliveries",
  "dateOfBirth": "1990-01-01",
  "preferredLanguage": "en",
  "timezone": "America/New_York",
  "preferredCurrency": "USD"
}
```

#### 3. Upload Profile Picture
```http
POST /api/v1/users/me/profile-picture
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: [image file]
```

#### 4. Delete Profile Picture
```http
DELETE /api/v1/users/me/profile-picture
Authorization: Bearer <access_token>
```

#### 5. Get User Profile by ID
```http
GET /api/v1/users/:userId
Authorization: Bearer <access_token>
```

### Address Management Endpoints

#### 6. Get User Addresses
```http
GET /api/v1/users/me/addresses
Authorization: Bearer <access_token>
```

#### 7. Add New Address
```http
POST /api/v1/users/me/addresses
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "home|work|other",
  "label": "Home Address",
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "US",
  "isDefault": false
}
```

#### 8. Update Address
```http
PUT /api/v1/users/me/addresses/:addressId
Authorization: Bearer <access_token>
```

#### 9. Delete Address
```http
DELETE /api/v1/users/me/addresses/:addressId
Authorization: Bearer <access_token>
```

#### 10. Set Default Address
```http
POST /api/v1/users/me/addresses/:addressId/default
Authorization: Bearer <access_token>
```

### Verification Endpoints

#### 11. Upload Verification Document
```http
POST /api/v1/users/me/verification/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

documentType: passport|driving_license|national_id
frontImage: [image file]
backImage: [image file]
selfieImage: [image file]
```

#### 12. Get Verification Status
```http
GET /api/v1/users/me/verification/status
Authorization: Bearer <access_token>
```

#### 13. Resubmit Verification
```http
POST /api/v1/users/me/verification/resubmit
Authorization: Bearer <access_token>
```

### Preferences Management Endpoints

#### 14. Get User Preferences
```http
GET /api/v1/users/me/preferences
Authorization: Bearer <access_token>
```

#### 15. Update Preferences
```http
PUT /api/v1/users/me/preferences
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "notifications": {
    "email": {
      "newDeliveryRequest": true,
      "deliveryUpdates": true,
      "marketing": false
    },
    "push": {
      "newDeliveryRequest": true,
      "deliveryUpdates": true,
      "quietHours": {
        "enabled": true,
        "start": "22:00",
        "end": "08:00"
      }
    }
  },
  "privacy": {
    "showProfile": "public|friends|private",
    "showRating": true,
    "showStatistics": false
  }
}
```

### Statistics & Analytics Endpoints

#### 16. Get User Statistics
```http
GET /api/v1/users/me/statistics
Authorization: Bearer <access_token>
```

#### 17. Get User Analytics
```http
GET /api/v1/users/me/analytics
Authorization: Bearer <access_token>
Query Parameters:
- period: day|week|month|year
- startDate: 2025-01-01
- endDate: 2025-01-31
```

### Review System Endpoints

#### 18. Get User Reviews (Received)
```http
GET /api/v1/users/me/reviews
Authorization: Bearer <access_token>
Query Parameters:
- page: 1
- limit: 20
- rating: 1-5
- type: received|given
```

#### 19. Get User Reviews (Given)
```http
GET /api/v1/users/me/reviews/given
Authorization: Bearer <access_token>
```

#### 20. Submit Review
```http
POST /api/v1/users/:userId/reviews
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery_uuid",
  "overallRating": 5,
  "comment": "Great experience, highly recommended!",
  "categoryRatings": {
    "communication": 5,
    "punctuality": 4,
    "carefulness": 5,
    "friendliness": 5
  },
  "isAnonymous": false
}
```

#### 21. Report Review
```http
POST /api/v1/users/reviews/:reviewId/report
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "inappropriate_content|spam|harassment|false_information|other",
  "description": "Detailed description of the issue"
}
```

### User Relationships Endpoints

#### 22. Get Favorite Users
```http
GET /api/v1/users/me/favorites
Authorization: Bearer <access_token>
```

#### 23. Add User to Favorites
```http
POST /api/v1/users/:userId/favorite
Authorization: Bearer <access_token>
```

#### 24. Remove User from Favorites
```http
DELETE /api/v1/users/:userId/favorite
Authorization: Bearer <access_token>
```

#### 25. Block User
```http
POST /api/v1/users/:userId/block
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "inappropriate_behavior|spam|harassment|unreliable|other",
  "comment": "Optional detailed reason"
}
```

## 🏗️ Service Architecture

### Directory Structure
```
user-management-service/
├── src/
│   ├── controllers/
│   │   ├── profileController.js
│   │   ├── addressController.js
│   │   ├── verificationController.js
│   │   ├── preferencesController.js
│   │   ├── reviewController.js
│   │   └── relationshipController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Address.js
│   │   ├── Preferences.js
│   │   ├── Statistics.js
│   │   ├── Review.js
│   │   └── VerificationDocument.js
│   ├── services/
│   │   ├── profileService.js
│   │   ├── verificationService.js
│   │   ├── fileUploadService.js
│   │   ├── geocodingService.js
│   │   ├── imageProcessingService.js
│   │   └── analyticsService.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── fileUploadMiddleware.js
│   │   ├── validationMiddleware.js
│   │   └── privacyMiddleware.js
│   ├── routes/
│   │   ├── profileRoutes.js
│   │   ├── addressRoutes.js
│   │   ├── verificationRoutes.js
│   │   ├── preferencesRoutes.js
│   │   └── reviewRoutes.js
│   ├── utils/
│   │   ├── imageUtils.js
│   │   ├── geocodingUtils.js
│   │   ├── validationUtils.js
│   │   └── privacyUtils.js
│   ├── config/
│   │   ├── database.js
│   │   ├── storage.js
│   │   ├── geocoding.js
│   │   └── ml.js
│   └── app.js
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. Profile Service
```javascript
class ProfileService {
  async getUserProfile(userId, requesterId) {
    const user = await this.userRepository.findById(userId);
    const privacy = await this.getPrivacySettings(userId);
    
    // Apply privacy filters based on relationship
    return this.applyPrivacyFilters(user, privacy, requesterId);
  }

  async updateProfile(userId, updateData) {
    // Validate update data
    const validation = this.validateProfileUpdate(updateData);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    // Update profile
    const updatedUser = await this.userRepository.update(userId, updateData);
    
    // Update search index if applicable
    await this.updateSearchIndex(updatedUser);
    
    return updatedUser;
  }

  async uploadProfilePicture(userId, imageFile) {
    // Process image
    const processedImage = await this.imageProcessingService.processProfileImage(imageFile);
    
    // Upload to storage
    const imageUrl = await this.fileUploadService.uploadImage(processedImage, 'profile-pictures');
    
    // Update user record
    return this.userRepository.update(userId, { profilePictureUrl: imageUrl });
  }
}
```

#### 2. Verification Service
```javascript
class VerificationService {
  async uploadVerificationDocument(userId, documentData) {
    // Upload images to secure storage
    const frontImageUrl = await this.fileUploadService.uploadSecureImage(
      documentData.frontImage, 
      `verification/${userId}/front`
    );
    
    const backImageUrl = documentData.backImage ? 
      await this.fileUploadService.uploadSecureImage(
        documentData.backImage, 
        `verification/${userId}/back`
      ) : null;
    
    const selfieUrl = await this.fileUploadService.uploadSecureImage(
      documentData.selfieImage, 
      `verification/${userId}/selfie`
    );

    // Create verification record
    const verification = await this.verificationRepository.create({
      userId,
      documentType: documentData.documentType,
      frontImageUrl,
      backImageUrl,
      selfieImageUrl: selfieUrl,
      status: 'pending'
    });

    // Trigger AI verification process
    await this.triggerAIVerification(verification.id);
    
    return verification;
  }

  async triggerAIVerification(verificationId) {
    // Queue AI verification job
    await this.mlService.queueDocumentVerification(verificationId);
  }

  async processAIVerificationResult(verificationId, result) {
    const status = result.confidence > 0.8 ? 'approved' : 'needs_review';
    
    await this.verificationRepository.update(verificationId, {
      status,
      metadata: result,
      verifiedAt: status === 'approved' ? new Date() : null
    });

    // Update user verification level
    if (status === 'approved') {
      await this.updateUserVerificationLevel(verificationId);
    }
  }
}
```

#### 3. Address Service
```javascript
class AddressService {
  async addAddress(userId, addressData) {
    // Geocode address
    const coordinates = await this.geocodingService.geocodeAddress(addressData);
    
    // Validate address
    const validation = await this.validateAddress(addressData, coordinates);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    // Create address
    const address = await this.addressRepository.create({
      ...addressData,
      userId,
      coordinates
    });

    // Set as default if it's the first address
    const addressCount = await this.addressRepository.countByUserId(userId);
    if (addressCount === 1) {
      await this.setDefaultAddress(userId, address.id);
    }

    return address;
  }

  async setDefaultAddress(userId, addressId) {
    // Unset current default
    await this.addressRepository.updateByUserId(userId, { isDefault: false });
    
    // Set new default
    return this.addressRepository.update(addressId, { isDefault: true });
  }
}
```

#### 4. Review Service
```javascript
class ReviewService {
  async submitReview(reviewerId, revieweeId, reviewData) {
    // Validate review eligibility
    await this.validateReviewEligibility(reviewerId, revieweeId, reviewData.deliveryId);
    
    // Create review
    const review = await this.reviewRepository.create({
      ...reviewData,
      reviewerId,
      revieweeId
    });

    // Update user statistics
    await this.updateUserRatingStatistics(revieweeId);
    
    // Trigger notifications
    await this.notificationService.sendReviewNotification(revieweeId, review);
    
    return review;
  }

  async updateUserRatingStatistics(userId) {
    const reviews = await this.reviewRepository.findByRevieweeId(userId);
    
    const totalRatings = reviews.length;
    const averageRating = reviews.reduce((sum, review) => sum + review.overallRating, 0) / totalRatings;
    
    const ratingBreakdown = reviews.reduce((breakdown, review) => {
      breakdown[review.overallRating] = (breakdown[review.overallRating] || 0) + 1;
      return breakdown;
    }, {});

    await this.statisticsRepository.update(userId, {
      totalRatings,
      averageRating: Math.round(averageRating * 100) / 100,
      ratingBreakdown
    });
  }
}
```

#### 5. File Upload Service
```javascript
class FileUploadService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
  }

  async uploadImage(imageBuffer, folder) {
    const fileName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.jpg`;
    
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read'
    };

    const result = await this.s3.upload(uploadParams).promise();
    return result.Location;
  }

  async uploadSecureImage(imageBuffer, path) {
    const fileName = `secure/${path}-${Date.now()}.jpg`;
    
    const uploadParams = {
      Bucket: process.env.S3_SECURE_BUCKET_NAME,
      Key: fileName,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      ServerSideEncryption: 'AES256'
    };

    const result = await this.s3.upload(uploadParams).promise();
    return result.Location;
  }
}
```

#### 6. Image Processing Service
```javascript
class ImageProcessingService {
  async processProfileImage(imageBuffer) {
    return sharp(imageBuffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  async processVerificationDocument(imageBuffer) {
    return sharp(imageBuffer)
      .resize(1200, null, { withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  async generateThumbnail(imageBuffer, width = 150, height = 150) {
    return sharp(imageBuffer)
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
}
```

## 🔐 Security & Privacy

### 1. Data Privacy Controls
```javascript
class PrivacyService {
  applyPrivacyFilters(userData, privacySettings, requesterId) {
    const relationship = this.getUserRelationship(userData.id, requesterId);
    
    const filteredData = { ...userData };
    
    // Apply privacy rules based on settings and relationship
    if (privacySettings.showProfile === 'private' && relationship !== 'self') {
      return this.getMinimalProfile(userData);
    }
    
    if (privacySettings.showProfile === 'friends' && relationship !== 'friend' && relationship !== 'self') {
      return this.getLimitedProfile(userData);
    }
    
    // Hide sensitive data based on settings
    if (!privacySettings.showStatistics && relationship !== 'self') {
      delete filteredData.statistics;
    }
    
    return filteredData;
  }

  async updatePrivacySettings(userId, settings) {
    return this.preferencesRepository.updatePrivacySettings(userId, settings);
  }
}
```

### 2. File Upload Security
```javascript
const fileUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 3 // Max 3 files
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Virus scanning middleware
const virusScanMiddleware = async (req, res, next) => {
  if (req.files) {
    for (const file of req.files) {
      const scanResult = await virusScanner.scan(file.buffer);
      if (scanResult.isInfected) {
        return res.status(400).json({ error: 'File contains malicious content' });
      }
    }
  }
  next();
};
```

### 3. Input Validation
```javascript
const profileUpdateValidation = {
  body: Joi.object({
    firstName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/),
    lastName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/),
    bio: Joi.string().max(500).optional(),
    dateOfBirth: Joi.date().max('now').min('1900-01-01').optional(),
    preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'it').optional(),
    timezone: Joi.string().optional(),
    preferredCurrency: Joi.string().length(3).uppercase().optional()
  })
};

const addressValidation = {
  body: Joi.object({
    type: Joi.string().valid('home', 'work', 'other').required(),
    label: Joi.string().max(100).optional(),
    street: Joi.string().max(255).required(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).optional(),
    postalCode: Joi.string().max(20).required(),
    country: Joi.string().length(2).uppercase().required(),
    isDefault: Joi.boolean().optional()
  })
};
```

## 📈 Performance Optimization

### 1. Database Indexing
```sql
-- User profile indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_verification_level ON users(verification_level);

-- Address indexes
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_coordinates ON user_addresses USING GIST(coordinates);
CREATE INDEX idx_user_addresses_is_default ON user_addresses(user_id, is_default) WHERE is_default = true;

-- Review indexes
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON reviews(overall_rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);

-- Full-text search index
CREATE INDEX idx_users_search ON users USING gin(
    (first_name || ' ' || last_name || ' ' || COALESCE(bio, '')) gin_trgm_ops
);
```

### 2. Caching Strategy
```javascript
class CacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async getUserProfile(userId) {
    const cacheKey = `user:profile:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const profile = await this.userRepository.findById(userId);
    await this.redis.setex(cacheKey, 300, JSON.stringify(profile)); // 5 min cache
    
    return profile;
  }

  async invalidateUserCache(userId) {
    const pattern = `user:*:${userId}`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 3. Image Optimization
```javascript
const imageOptimizationMiddleware = async (req, res, next) => {
  if (req.files) {
    for (const file of req.files) {
      // Optimize image
      file.buffer = await sharp(file.buffer)
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      
      // Generate WebP version for modern browsers
      file.webpBuffer = await sharp(file.buffer)
        .webp({ quality: 80 })
        .toBuffer();
    }
  }
  next();
};
```

## 🔍 Monitoring & Analytics

### 1. User Activity Tracking
```javascript
class AnalyticsService {
  async trackUserActivity(userId, activity, metadata = {}) {
    const event = {
      userId,
      activity,
      metadata,
      timestamp: new Date(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    };

    // Store in analytics database
    await this.analyticsRepository.create(event);
    
    // Send to real-time analytics
    await this.realTimeAnalytics.track(event);
  }

  async getUserAnalytics(userId, period) {
    const analytics = await this.analyticsRepository.getUserAnalytics(userId, period);
    
    return {
      profileViews: analytics.profileViews,
      profileUpdates: analytics.profileUpdates,
      addressChanges: analytics.addressChanges,
      verificationAttempts: analytics.verificationAttempts,
      reviewsReceived: analytics.reviewsReceived,
      reviewsGiven: analytics.reviewsGiven
    };
  }
}
```

### 2. Performance Monitoring
```javascript
const performanceMonitoring = {
  profileLoad: new prometheus.Histogram({
    name: 'user_profile_load_duration_seconds',
    help: 'Duration of user profile load operations',
    labelNames: ['operation', 'status']
  }),
  
  imageUpload: new prometheus.Histogram({
    name: 'image_upload_duration_seconds',
    help: 'Duration of image upload operations',
    labelNames: ['type', 'size']
  }),
  
  verificationProcessing: new prometheus.Histogram({
    name: 'verification_processing_duration_seconds',
    help: 'Duration of verification processing',
    labelNames: ['document_type', 'result']
  })
};
```

## 🧪 Testing Strategy

### 1. Unit Tests
```javascript
describe('ProfileService', () => {
  describe('updateProfile', () => {
    it('should update user profile with valid data', async () => {
      const userId = 'user-uuid';
      const updateData = {
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Updated bio'
      };

      const result = await profileService.updateProfile(userId, updateData);
      
      expect(result.firstName).toBe(updateData.firstName);
      expect(result.lastName).toBe(updateData.lastName);
      expect(result.bio).toBe(updateData.bio);
    });

    it('should validate profile data before updating', async () => {
      const userId = 'user-uuid';
      const invalidData = {
        firstName: '', // Invalid: empty string
        email: 'invalid-email' // Invalid: not a valid email
      };

      await expect(profileService.updateProfile(userId, invalidData))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### 2. Integration Tests
```javascript
describe('User Profile API', () => {
  it('should complete profile update flow', async () => {
    // Create user
    const user = await createTestUser();
    const token = await generateAuthToken(user.id);

    // Update profile
    const updateResponse = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'New bio'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.firstName).toBe('Updated');

    // Verify profile was updated
    const profileResponse = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(profileResponse.body.data.firstName).toBe('Updated');
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **Profile Load**: < 100ms average response time
- **Profile Update**: < 200ms average response time
- **Image Upload**: < 2s for 5MB images
- **Address Geocoding**: < 500ms average response time
- **Review Submission**: < 150ms average response time
- **Throughput**: 500+ requests/second per instance

This User Management Service architecture provides comprehensive user profile management with robust verification, privacy controls, and performance optimization for the P2P Delivery Platform.