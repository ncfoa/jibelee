# QR Code Service - Detailed Architecture

## 🏗️ Service Overview

The QR Code Service provides secure, encrypted QR code generation and validation for pickup and delivery verification in the P2P Delivery Platform. It ensures secure handoffs between customers, travelers, and recipients using military-grade encryption and blockchain-based verification.

**Port:** 3006  
**Base URL:** `/api/v1/qr-codes`  
**Database:** `qr_db` (PostgreSQL)

## 🎯 Core Responsibilities

### Primary Functions
- **Secure QR Code Generation**: Encrypted QR codes for pickup and delivery verification
- **Blockchain Verification**: Optional blockchain-based integrity verification
- **Time-based Expiration**: Automatic expiration of codes based on delivery timeline
- **Location Binding**: Geofence-based validation for enhanced security
- **Emergency Overrides**: Admin-approved emergency access codes
- **Audit Trail**: Complete logging of all QR code operations
- **Multi-level Security**: Standard, high, and maximum security levels

### Key Features
- **Military-grade Encryption**: AES-256 encryption with rotating keys
- **Dual QR System**: Separate codes for pickup and delivery verification
- **Backup Codes**: Human-readable backup codes for emergencies
- **Real-time Validation**: Instant verification with comprehensive logging
- **Fraud Prevention**: Advanced anti-tampering and replay attack protection
- **Mobile Optimization**: Optimized for mobile camera scanning

## 🗄️ Database Schema

### Core Tables

#### 1. QR Codes Table
```sql
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    qr_type qr_type_enum NOT NULL,
    encrypted_data TEXT NOT NULL,
    image_data TEXT, -- Base64 encoded image
    download_url VARCHAR(500),
    backup_code VARCHAR(50) NOT NULL,
    security_level security_level_enum NOT NULL DEFAULT 'standard',
    
    -- Security features
    security_features JSONB DEFAULT '{}',
    
    -- Expiration and usage
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    status qr_status_enum NOT NULL DEFAULT 'active',
    
    -- Location binding (optional)
    location_bound BOOLEAN DEFAULT FALSE,
    bound_coordinates GEOGRAPHY(POINT, 4326),
    bound_radius INTEGER, -- meters
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_reason TEXT
);
```

#### 2. QR Code Scans Table
```sql
CREATE TABLE qr_code_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_code_id UUID NOT NULL,
    scanned_by UUID NOT NULL,
    scan_result scan_result_enum NOT NULL,
    scan_location GEOGRAPHY(POINT, 4326),
    device_info JSONB,
    additional_verification JSONB,
    failure_reason TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Emergency Overrides Table
```sql
CREATE TABLE qr_emergency_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL,
    qr_code_id UUID,
    override_reason TEXT NOT NULL,
    alternative_verification JSONB,
    requested_by UUID NOT NULL,
    approved_by UUID,
    alternative_code VARCHAR(50) NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Enums
```sql
CREATE TYPE qr_type_enum AS ENUM ('pickup', 'delivery');
CREATE TYPE security_level_enum AS ENUM ('standard', 'high', 'maximum');
CREATE TYPE qr_status_enum AS ENUM ('active', 'used', 'expired', 'revoked');
CREATE TYPE scan_result_enum AS ENUM ('success', 'failed', 'invalid_location', 'expired', 'already_used');
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js or Go for performance
const express = require('express');
const crypto = require('crypto');
const qrcode = require('qrcode');
const sharp = require('sharp');
const blockchain = require('web3');
const geolib = require('geolib');
```

### Key Dependencies
- **Express.js/Go**: Web framework
- **QRCode.js**: QR code generation
- **Sharp**: Image processing and optimization
- **Crypto**: Advanced cryptographic operations
- **Web3.js**: Blockchain integration (optional)
- **Geolib**: Geospatial calculations
- **Winston**: Comprehensive logging
- **Bull Queue**: Background job processing

### Security Libraries
- **Node.js Crypto**: Built-in cryptographic functions
- **bcrypt**: Password hashing for backup codes
- **jsonwebtoken**: Token-based verification
- **helmet**: Security headers
- **rate-limiter-flexible**: Advanced rate limiting

## 📊 API Endpoints (15 Total)

### QR Code Generation Endpoints

#### 1. Generate Pickup QR Code
```http
POST /api/v1/qr-codes/pickup
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "securityLevel": "standard|high|maximum",
  "locationBinding": {
    "enabled": true,
    "coordinates": { "lat": 40.7128, "lng": -74.0060 },
    "radius": 100
  },
  "expirationHours": 24,
  "additionalSecurity": {
    "requiresPhoto": true,
    "requiresSignature": false,
    "biometricVerification": false
  }
}
```

#### 2. Generate Delivery QR Code
```http
POST /api/v1/qr-codes/delivery
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "securityLevel": "high",
  "locationBinding": {
    "enabled": true,
    "coordinates": { "lat": 42.3601, "lng": -71.0589 },
    "radius": 50
  },
  "expirationHours": 48,
  "additionalSecurity": {
    "requiresPhoto": true,
    "requiresSignature": true,
    "biometricVerification": false
  }
}
```

#### 3. Regenerate QR Code
```http
POST /api/v1/qr-codes/:qrCodeId/regenerate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "Code compromised",
  "newSecurityLevel": "maximum"
}
```

### QR Code Validation Endpoints

#### 4. Validate QR Code
```http
POST /api/v1/qr-codes/validate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "qrData": "encrypted_qr_code_data",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 5
  },
  "deviceInfo": {
    "deviceId": "device-uuid",
    "platform": "ios",
    "appVersion": "1.0.0"
  },
  "additionalVerification": {
    "photo": "base64_encoded_photo",
    "signature": "base64_encoded_signature",
    "biometric": "fingerprint_hash"
  }
}
```

#### 5. Validate Backup Code
```http
POST /api/v1/qr-codes/validate-backup
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "backupCode": "ABC123DEF456",
  "deliveryId": "delivery-uuid",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "reason": "QR code scanner not working"
}
```

### QR Code Management Endpoints

#### 6. Get QR Code Details
```http
GET /api/v1/qr-codes/:qrCodeId
Authorization: Bearer <access_token>
```

#### 7. Get Delivery QR Codes
```http
GET /api/v1/qr-codes/delivery/:deliveryId
Authorization: Bearer <access_token>
```

#### 8. Download QR Code Image
```http
GET /api/v1/qr-codes/:qrCodeId/image
Authorization: Bearer <access_token>
Query Parameters:
- format: png|svg|pdf
- size: small|medium|large
- style: standard|branded
```

#### 9. Revoke QR Code
```http
POST /api/v1/qr-codes/:qrCodeId/revoke
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "Security compromise",
  "notifyParties": true
}
```

### Emergency Override Endpoints

#### 10. Request Emergency Override
```http
POST /api/v1/qr-codes/emergency-override
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "deliveryId": "delivery-uuid",
  "qrCodeId": "qr-code-uuid",
  "reason": "Lost phone, unable to scan QR code",
  "alternativeVerification": {
    "idPhoto": "base64_encoded_id",
    "selfiePhoto": "base64_encoded_selfie",
    "deliveryDetails": "Package description and tracking info"
  },
  "contactPhone": "+1234567890"
}
```

#### 11. Approve Emergency Override (Admin)
```http
POST /api/v1/qr-codes/emergency-override/:overrideId/approve
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "approvalNotes": "Verified identity through video call",
  "validityHours": 2,
  "additionalRestrictions": {
    "requiresAdminPresence": false,
    "photoRequired": true
  }
}
```

#### 12. Use Emergency Override
```http
POST /api/v1/qr-codes/emergency-override/:overrideId/use
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "alternativeCode": "EMRG-ABC123",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "verificationPhoto": "base64_encoded_photo"
}
```

### Audit & Security Endpoints

#### 13. Get Scan History
```http
GET /api/v1/qr-codes/:qrCodeId/scans
Authorization: Bearer <access_token>
Query Parameters:
- page: 1
- limit: 50
- result: success|failed|expired
```

#### 14. Get Security Audit
```http
GET /api/v1/qr-codes/audit/:deliveryId
Authorization: Bearer <access_token>
```

#### 15. Blockchain Verification (Optional)
```http
POST /api/v1/qr-codes/:qrCodeId/blockchain-verify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "transactionHash": "0x1234567890abcdef...",
  "blockchainNetwork": "ethereum|polygon"
}
```

## 🏗️ Service Architecture

### Directory Structure
```
qr-code-service/
├── src/
│   ├── controllers/
│   │   ├── qrCodeController.js
│   │   ├── validationController.js
│   │   ├── emergencyController.js
│   │   └── auditController.js
│   ├── models/
│   │   ├── QRCode.js
│   │   ├── QRCodeScan.js
│   │   ├── EmergencyOverride.js
│   │   └── SecurityAudit.js
│   ├── services/
│   │   ├── qrCodeService.js
│   │   ├── encryptionService.js
│   │   ├── validationService.js
│   │   ├── blockchainService.js
│   │   ├── imageService.js
│   │   └── securityService.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── validationMiddleware.js
│   │   ├── securityMiddleware.js
│   │   └── auditMiddleware.js
│   ├── routes/
│   │   ├── qrCodeRoutes.js
│   │   ├── validationRoutes.js
│   │   ├── emergencyRoutes.js
│   │   └── auditRoutes.js
│   ├── utils/
│   │   ├── cryptoUtils.js
│   │   ├── qrUtils.js
│   │   ├── geoUtils.js
│   │   └── securityUtils.js
│   ├── jobs/
│   │   ├── expirationJob.js
│   │   ├── blockchainSyncJob.js
│   │   └── securityScanJob.js
│   ├── config/
│   │   ├── database.js
│   │   ├── encryption.js
│   │   ├── blockchain.js
│   │   └── security.js
│   └── app.js
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. QR Code Service
```javascript
class QRCodeService {
  constructor() {
    this.encryptionService = new EncryptionService();
    this.imageService = new ImageService();
    this.blockchainService = new BlockchainService();
  }

  async generateQRCode(deliveryId, type, options = {}) {
    const {
      securityLevel = 'standard',
      locationBinding = {},
      expirationHours = 24,
      additionalSecurity = {}
    } = options;

    // Generate secure payload
    const payload = await this.createSecurePayload(deliveryId, type, options);
    
    // Encrypt payload
    const encryptedData = await this.encryptionService.encrypt(payload, securityLevel);
    
    // Generate backup code
    const backupCode = this.generateBackupCode();
    
    // Calculate expiration time
    const expiresAt = moment().add(expirationHours, 'hours').toDate();
    
    // Create QR code record
    const qrCode = await this.qrCodeRepository.create({
      deliveryId,
      qrType: type,
      encryptedData,
      backupCode: await bcrypt.hash(backupCode, 10),
      securityLevel,
      securityFeatures: additionalSecurity,
      expiresAt,
      locationBound: locationBinding.enabled || false,
      boundCoordinates: locationBinding.coordinates,
      boundRadius: locationBinding.radius
    });

    // Generate QR code image
    const qrImage = await this.generateQRImage(encryptedData, options);
    
    // Store image and get download URL
    const downloadUrl = await this.imageService.storeQRImage(qrCode.id, qrImage);
    
    // Update QR code with image data
    await this.qrCodeRepository.update(qrCode.id, {
      imageData: qrImage.toString('base64'),
      downloadUrl
    });

    // Optional blockchain registration
    if (securityLevel === 'maximum') {
      await this.blockchainService.registerQRCode(qrCode.id, encryptedData);
    }

    // Log creation event
    await this.auditService.logQRCodeEvent('created', qrCode.id, {
      deliveryId,
      type,
      securityLevel,
      expirationHours
    });

    return {
      id: qrCode.id,
      encryptedData,
      backupCode, // Return plain text backup code only once
      downloadUrl,
      expiresAt,
      securityLevel
    };
  }

  async createSecurePayload(deliveryId, type, options) {
    const delivery = await this.deliveryRepository.findById(deliveryId);
    
    const payload = {
      deliveryId,
      type,
      customerId: delivery.customerId,
      travelerId: delivery.travelerId,
      deliveryNumber: delivery.deliveryNumber,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
      securityLevel: options.securityLevel,
      locationBinding: options.locationBinding,
      additionalSecurity: options.additionalSecurity
    };

    // Add type-specific data
    if (type === 'pickup') {
      payload.pickupAddress = delivery.pickupAddress;
      payload.itemDetails = {
        name: delivery.itemName,
        weight: delivery.weight,
        description: delivery.itemDescription
      };
    } else if (type === 'delivery') {
      payload.deliveryAddress = delivery.deliveryAddress;
      payload.recipientInfo = {
        name: delivery.deliveryContactName,
        phone: delivery.deliveryContactPhone
      };
    }

    return payload;
  }

  async generateQRImage(data, options = {}) {
    const {
      size = 'medium',
      style = 'standard',
      format = 'png'
    } = options;

    // Define size configurations
    const sizeConfig = {
      small: { width: 200, margin: 2 },
      medium: { width: 400, margin: 4 },
      large: { width: 800, margin: 6 }
    };

    const config = sizeConfig[size];

    // Generate QR code
    const qrBuffer = await qrcode.toBuffer(data, {
      width: config.width,
      margin: config.margin,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H' // High error correction
    });

    // Apply styling if needed
    if (style === 'branded') {
      return this.applyBranding(qrBuffer, config.width);
    }

    return qrBuffer;
  }

  generateBackupCode() {
    // Generate human-readable backup code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 3 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code; // Format: ABC-123-DEF-456
  }
}
```

#### 2. Encryption Service
```javascript
class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyRotationInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  async encrypt(payload, securityLevel) {
    const key = await this.getEncryptionKey(securityLevel);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine encrypted data with metadata
    const encryptedPackage = {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
      securityLevel,
      timestamp: Date.now()
    };

    // Additional encoding for QR code compatibility
    return Buffer.from(JSON.stringify(encryptedPackage)).toString('base64');
  }

  async decrypt(encryptedData, securityLevel) {
    try {
      // Decode from base64
      const encryptedPackage = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      
      const key = await this.getEncryptionKey(securityLevel);
      const decipher = crypto.createDecipher(
        encryptedPackage.algorithm,
        key,
        Buffer.from(encryptedPackage.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(encryptedPackage.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedPackage.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new DecryptionError('Failed to decrypt QR code data');
    }
  }

  async getEncryptionKey(securityLevel) {
    const keyConfig = {
      standard: process.env.QR_ENCRYPTION_KEY_STANDARD,
      high: process.env.QR_ENCRYPTION_KEY_HIGH,
      maximum: process.env.QR_ENCRYPTION_KEY_MAXIMUM
    };

    let baseKey = keyConfig[securityLevel];
    
    // For maximum security, derive key with additional factors
    if (securityLevel === 'maximum') {
      const salt = await this.getCurrentSalt();
      baseKey = crypto.pbkdf2Sync(baseKey, salt, 100000, 32, 'sha256');
    }

    return baseKey;
  }

  async rotateKeys() {
    // Implement key rotation for enhanced security
    const newKeys = {
      standard: crypto.randomBytes(32).toString('hex'),
      high: crypto.randomBytes(32).toString('hex'),
      maximum: crypto.randomBytes(32).toString('hex')
    };

    // Store new keys securely (e.g., in HSM or secure key vault)
    await this.keyVaultService.storeKeys(newKeys);
    
    // Update environment variables or configuration
    await this.updateEncryptionKeys(newKeys);
    
    return newKeys;
  }
}
```

#### 3. Validation Service
```javascript
class ValidationService {
  constructor() {
    this.encryptionService = new EncryptionService();
    this.geoUtils = new GeoUtils();
  }

  async validateQRCode(qrData, validationContext) {
    const {
      location,
      deviceInfo,
      additionalVerification = {},
      scannedBy
    } = validationContext;

    try {
      // Decrypt QR code data
      const payload = await this.encryptionService.decrypt(qrData, 'auto-detect');
      
      // Get QR code record
      const qrCode = await this.qrCodeRepository.findByDeliveryAndType(
        payload.deliveryId,
        payload.type
      );

      if (!qrCode) {
        return this.createScanResult('failed', 'QR code not found');
      }

      // Validate QR code status
      if (qrCode.status !== 'active') {
        return this.createScanResult('failed', `QR code is ${qrCode.status}`);
      }

      // Check expiration
      if (new Date() > qrCode.expiresAt) {
        await this.qrCodeRepository.update(qrCode.id, { status: 'expired' });
        return this.createScanResult('expired', 'QR code has expired');
      }

      // Validate location if bound
      if (qrCode.locationBound && location) {
        const isWithinBounds = this.geoUtils.isWithinRadius(
          location,
          qrCode.boundCoordinates,
          qrCode.boundRadius
        );

        if (!isWithinBounds) {
          return this.createScanResult('invalid_location', 'Outside allowed location');
        }
      }

      // Validate user authorization
      const delivery = await this.deliveryRepository.findById(payload.deliveryId);
      const isAuthorized = this.validateUserAuthorization(scannedBy, delivery, payload.type);
      
      if (!isAuthorized) {
        return this.createScanResult('failed', 'User not authorized for this action');
      }

      // Validate additional security requirements
      if (qrCode.securityFeatures.requiresPhoto && !additionalVerification.photo) {
        return this.createScanResult('failed', 'Photo verification required');
      }

      if (qrCode.securityFeatures.requiresSignature && !additionalVerification.signature) {
        return this.createScanResult('failed', 'Signature verification required');
      }

      // Mark QR code as used
      await this.qrCodeRepository.update(qrCode.id, {
        status: 'used',
        usedAt: new Date()
      });

      // Log successful scan
      await this.logScanAttempt(qrCode.id, scannedBy, 'success', location, deviceInfo);

      // Update delivery status
      await this.updateDeliveryStatus(delivery, payload.type);

      return this.createScanResult('success', 'QR code validated successfully', {
        deliveryId: payload.deliveryId,
        deliveryNumber: delivery.deliveryNumber,
        type: payload.type
      });

    } catch (error) {
      console.error('QR validation error:', error);
      return this.createScanResult('failed', 'Invalid QR code data');
    }
  }

  async validateBackupCode(backupCode, deliveryId, location, scannedBy) {
    // Find active QR codes for the delivery
    const qrCodes = await this.qrCodeRepository.findActiveByDelivery(deliveryId);
    
    for (const qrCode of qrCodes) {
      const isValidBackup = await bcrypt.compare(backupCode, qrCode.backupCode);
      
      if (isValidBackup) {
        // Validate location if required
        if (qrCode.locationBound && location) {
          const isWithinBounds = this.geoUtils.isWithinRadius(
            location,
            qrCode.boundCoordinates,
            qrCode.boundRadius
          );

          if (!isWithinBounds) {
            return this.createScanResult('invalid_location', 'Outside allowed location');
          }
        }

        // Mark as used
        await this.qrCodeRepository.update(qrCode.id, {
          status: 'used',
          usedAt: new Date()
        });

        // Log backup code usage
        await this.logScanAttempt(qrCode.id, scannedBy, 'success', location, {
          method: 'backup_code'
        });

        const delivery = await this.deliveryRepository.findById(deliveryId);
        await this.updateDeliveryStatus(delivery, qrCode.qrType);

        return this.createScanResult('success', 'Backup code validated successfully', {
          deliveryId,
          type: qrCode.qrType
        });
      }
    }

    return this.createScanResult('failed', 'Invalid backup code');
  }

  validateUserAuthorization(userId, delivery, qrType) {
    if (qrType === 'pickup') {
      // For pickup: customer or traveler can scan
      return userId === delivery.customerId || userId === delivery.travelerId;
    } else if (qrType === 'delivery') {
      // For delivery: traveler or recipient can scan
      return userId === delivery.travelerId; // Recipient validation would need additional logic
    }

    return false;
  }

  async updateDeliveryStatus(delivery, qrType) {
    let newStatus;
    
    if (qrType === 'pickup') {
      newStatus = 'picked_up';
    } else if (qrType === 'delivery') {
      newStatus = 'delivered';
    }

    if (newStatus) {
      await this.deliveryRepository.update(delivery.id, {
        status: newStatus,
        [`${qrType}_completed_at`]: new Date()
      });

      // Send notifications
      await this.notificationService.sendStatusUpdate(delivery.id, newStatus);
    }
  }

  createScanResult(result, message, data = {}) {
    return {
      result,
      message,
      data,
      timestamp: new Date(),
      scanId: crypto.randomBytes(8).toString('hex')
    };
  }
}
```

#### 4. Emergency Override Service
```javascript
class EmergencyOverrideService {
  async requestOverride(userId, overrideData) {
    const {
      deliveryId,
      qrCodeId,
      reason,
      alternativeVerification,
      contactPhone
    } = overrideData;

    // Validate request
    const delivery = await this.deliveryRepository.findById(deliveryId);
    const isAuthorized = userId === delivery.customerId || userId === delivery.travelerId;
    
    if (!isAuthorized) {
      throw new UnauthorizedError('Not authorized to request override for this delivery');
    }

    // Generate alternative code
    const alternativeCode = `EMRG-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    
    // Create override request
    const override = await this.emergencyOverrideRepository.create({
      deliveryId,
      qrCodeId,
      overrideReason: reason,
      alternativeVerification,
      requestedBy: userId,
      alternativeCode: await bcrypt.hash(alternativeCode, 10),
      validUntil: moment().add(2, 'hours').toDate() // 2-hour validity
    });

    // Notify admins
    await this.notificationService.sendEmergencyOverrideRequest(override);
    
    // Send SMS to user with alternative code
    await this.smsService.sendEmergencyCode(contactPhone, alternativeCode, delivery.deliveryNumber);

    return {
      overrideId: override.id,
      alternativeCode, // Return only once
      validUntil: override.validUntil,
      status: 'pending_approval'
    };
  }

  async approveOverride(adminId, overrideId, approvalData) {
    const override = await this.emergencyOverrideRepository.findById(overrideId);
    
    if (!override) {
      throw new NotFoundError('Emergency override not found');
    }

    // Update override with approval
    await this.emergencyOverrideRepository.update(overrideId, {
      approvedBy: adminId,
      approvalNotes: approvalData.approvalNotes,
      validUntil: moment().add(approvalData.validityHours || 2, 'hours').toDate(),
      additionalRestrictions: approvalData.additionalRestrictions
    });

    // Log approval
    await this.auditService.logEmergencyOverride('approved', overrideId, {
      adminId,
      approvalNotes: approvalData.approvalNotes
    });

    // Notify requester
    await this.notificationService.sendOverrideApproval(override.requestedBy, override);

    return { status: 'approved', validUntil: override.validUntil };
  }

  async useOverride(userId, overrideId, useData) {
    const {
      alternativeCode,
      location,
      verificationPhoto
    } = useData;

    const override = await this.emergencyOverrideRepository.findById(overrideId);
    
    if (!override || !override.approvedBy) {
      throw new InvalidOverrideError('Override not found or not approved');
    }

    if (new Date() > override.validUntil) {
      throw new ExpiredOverrideError('Emergency override has expired');
    }

    // Validate alternative code
    const isValidCode = await bcrypt.compare(alternativeCode, override.alternativeCode);
    if (!isValidCode) {
      throw new InvalidCodeError('Invalid alternative code');
    }

    // Mark override as used
    await this.emergencyOverrideRepository.update(overrideId, {
      usedAt: new Date(),
      useLocation: location,
      verificationPhoto
    });

    // Update delivery status based on QR type
    const delivery = await this.deliveryRepository.findById(override.deliveryId);
    const qrCode = override.qrCodeId ? 
      await this.qrCodeRepository.findById(override.qrCodeId) : 
      await this.qrCodeRepository.findActiveByDelivery(override.deliveryId)[0];

    await this.validationService.updateDeliveryStatus(delivery, qrCode.qrType);

    // Log emergency override usage
    await this.auditService.logEmergencyOverride('used', overrideId, {
      userId,
      location,
      deliveryId: override.deliveryId
    });

    return {
      status: 'success',
      deliveryId: override.deliveryId,
      message: 'Emergency override successfully used'
    };
  }
}
```

## 🔐 Security Features

### 1. Multi-layered Encryption
```javascript
class AdvancedEncryption {
  async encryptWithMultipleLayers(data, securityLevel) {
    let encrypted = data;
    
    // Layer 1: AES-256-GCM encryption
    encrypted = await this.aesEncrypt(encrypted);
    
    // Layer 2: RSA encryption for high/maximum security
    if (securityLevel !== 'standard') {
      encrypted = await this.rsaEncrypt(encrypted);
    }
    
    // Layer 3: Custom obfuscation for maximum security
    if (securityLevel === 'maximum') {
      encrypted = await this.obfuscate(encrypted);
    }
    
    return encrypted;
  }

  async generateSecureHash(data) {
    // Use multiple hashing algorithms for integrity verification
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const sha512 = crypto.createHash('sha512').update(data).digest('hex');
    const blake2b = await this.blake2bHash(data);
    
    return { sha256, sha512, blake2b };
  }
}
```

### 2. Anti-tampering Protection
```javascript
class AntiTamperingService {
  async detectTampering(qrData, originalHash) {
    // Verify data integrity
    const currentHash = await this.generateSecureHash(qrData);
    
    if (currentHash !== originalHash) {
      await this.alertSecurityTeam('tampering_detected', {
        originalHash,
        currentHash,
        timestamp: new Date()
      });
      
      return { tampered: true, confidence: 0.95 };
    }
    
    // Additional behavioral analysis
    const behaviorScore = await this.analyzeScanBehavior(qrData);
    
    return {
      tampered: behaviorScore < 0.3,
      confidence: 1 - behaviorScore,
      analysis: 'behavioral_analysis'
    };
  }
}
```

## 📈 Performance Optimization

### 1. QR Code Caching
```javascript
class QRCodeCacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async cacheQRCode(qrCodeId, imageData) {
    const cacheKey = `qr:image:${qrCodeId}`;
    await this.redis.setex(cacheKey, 3600, imageData); // 1 hour cache
  }

  async getCachedQRCode(qrCodeId) {
    const cacheKey = `qr:image:${qrCodeId}`;
    return this.redis.get(cacheKey);
  }

  async cacheValidationResult(scanHash, result) {
    const cacheKey = `qr:validation:${scanHash}`;
    await this.redis.setex(cacheKey, 300, JSON.stringify(result)); // 5 min cache
  }
}
```

### 2. Database Optimization
```sql
-- QR code indexes
CREATE INDEX idx_qr_codes_delivery_type ON qr_codes(delivery_id, qr_type);
CREATE INDEX idx_qr_codes_status_expires ON qr_codes(status, expires_at);
CREATE INDEX idx_qr_codes_backup_code ON qr_codes(backup_code);

-- Scan history indexes
CREATE INDEX idx_qr_scans_qr_code_time ON qr_code_scans(qr_code_id, scanned_at);
CREATE INDEX idx_qr_scans_result ON qr_code_scans(scan_result, scanned_at);

-- Emergency override indexes
CREATE INDEX idx_emergency_overrides_delivery ON qr_emergency_overrides(delivery_id);
CREATE INDEX idx_emergency_overrides_status ON qr_emergency_overrides(approved_by, used_at);
```

## 🧪 Testing Strategy

### 1. Security Testing
```javascript
describe('QR Code Security', () => {
  describe('encryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const payload = { deliveryId: 'test-id', type: 'pickup' };
      const encrypted = await encryptionService.encrypt(payload, 'high');
      const decrypted = await encryptionService.decrypt(encrypted, 'high');
      
      expect(decrypted).toEqual(payload);
    });

    it('should fail decryption with wrong security level', async () => {
      const payload = { deliveryId: 'test-id', type: 'pickup' };
      const encrypted = await encryptionService.encrypt(payload, 'maximum');
      
      await expect(encryptionService.decrypt(encrypted, 'standard'))
        .rejects.toThrow(DecryptionError);
    });
  });
});
```

### 2. Integration Testing
```javascript
describe('QR Code Flow', () => {
  it('should complete full QR code lifecycle', async () => {
    // Generate QR code
    const qrCode = await qrCodeService.generateQRCode('delivery-id', 'pickup');
    
    // Validate QR code
    const validation = await validationService.validateQRCode(qrCode.encryptedData, {
      location: { lat: 40.7128, lng: -74.0060 },
      scannedBy: 'traveler-id'
    });
    
    expect(validation.result).toBe('success');
    
    // Verify QR code is marked as used
    const updatedQR = await qrCodeRepository.findById(qrCode.id);
    expect(updatedQR.status).toBe('used');
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **QR Code Generation**: < 500ms average response time
- **QR Code Validation**: < 200ms average response time
- **Image Generation**: < 1s for large QR codes
- **Encryption/Decryption**: < 50ms average response time
- **Backup Code Validation**: < 100ms average response time
- **Throughput**: 1000+ validations/second per instance

This QR Code Service architecture provides military-grade security with user-friendly backup options and comprehensive audit trails for the P2P Delivery Platform.