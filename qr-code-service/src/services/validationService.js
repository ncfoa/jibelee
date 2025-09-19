const moment = require('moment');
const { QRCode, QRCodeScan } = require('../models');
const encryptionService = require('./encryptionService');
const { GeoUtils, CryptoUtils } = require('../utils');
const logger = require('../config/logger');

class ValidationService {
  constructor() {
    this.maxScanAttempts = 5;
    this.scanAttemptWindow = 15 * 60 * 1000; // 15 minutes
    this.locationAccuracyThreshold = 100; // meters
  }

  /**
   * Validate QR code scan
   */
  async validateQRCode(qrData, validationContext) {
    const startTime = Date.now();
    let qrCode = null;
    
    try {
      // Extract validation context
      const {
        scannedBy,
        location,
        deviceInfo = {},
        additionalVerification = {},
        ipAddress,
        userAgent
      } = validationContext;

      // Validate required parameters
      if (!qrData || !scannedBy) {
        return this.createScanResult('failed', 'Missing required parameters', null, startTime);
      }

      // Decrypt QR code data
      let payload;
      try {
        payload = await encryptionService.decrypt(qrData);
      } catch (error) {
        logger.warn('QR code decryption failed:', error.message);
        return this.createScanResult('invalid_data', 'Invalid QR code data', null, startTime);
      }

      // Find QR code record
      qrCode = await QRCode.findByDeliveryAndType(payload.deliveryId, payload.type);
      if (!qrCode) {
        return this.createScanResult('failed', 'QR code not found in database', null, startTime);
      }

      // Check scan rate limiting
      const rateLimitCheck = await this.checkScanRateLimit(qrCode.id, scannedBy, ipAddress);
      if (!rateLimitCheck.allowed) {
        await this.logScanAttempt(qrCode.id, scannedBy, 'failed', location, deviceInfo, 'Rate limit exceeded', startTime, ipAddress, userAgent);
        return this.createScanResult('failed', 'Too many scan attempts', qrCode, startTime);
      }

      // Validate QR code status
      const statusValidation = this.validateQRCodeStatus(qrCode);
      if (!statusValidation.valid) {
        await this.logScanAttempt(qrCode.id, scannedBy, statusValidation.result, location, deviceInfo, statusValidation.reason, startTime, ipAddress, userAgent);
        return this.createScanResult(statusValidation.result, statusValidation.reason, qrCode, startTime);
      }

      // Check expiration
      if (qrCode.isExpired()) {
        await qrCode.update({ status: 'expired' });
        await this.logScanAttempt(qrCode.id, scannedBy, 'expired', location, deviceInfo, 'QR code has expired', startTime, ipAddress, userAgent);
        return this.createScanResult('expired', 'QR code has expired', qrCode, startTime);
      }

      // Validate location if bound
      if (qrCode.locationBound && location) {
        const locationValidation = await this.validateLocation(qrCode, location);
        if (!locationValidation.valid) {
          await this.logScanAttempt(qrCode.id, scannedBy, 'invalid_location', location, deviceInfo, locationValidation.reason, startTime, ipAddress, userAgent);
          return this.createScanResult('invalid_location', locationValidation.reason, qrCode, startTime);
        }
      }

      // Validate user authorization
      const authValidation = await this.validateUserAuthorization(scannedBy, qrCode, payload);
      if (!authValidation.valid) {
        await this.logScanAttempt(qrCode.id, scannedBy, 'unauthorized', location, deviceInfo, authValidation.reason, startTime, ipAddress, userAgent);
        return this.createScanResult('unauthorized', authValidation.reason, qrCode, startTime);
      }

      // Validate additional security requirements
      const securityValidation = this.validateSecurityRequirements(qrCode, additionalVerification);
      if (!securityValidation.valid) {
        await this.logScanAttempt(qrCode.id, scannedBy, 'failed', location, deviceInfo, securityValidation.reason, startTime, ipAddress, userAgent);
        return this.createScanResult('failed', securityValidation.reason, qrCode, startTime);
      }

      // Calculate risk score
      const riskScore = await this.calculateRiskScore(qrCode, validationContext, payload);

      // Check if risk score is too high
      if (riskScore > 0.8) {
        await this.logScanAttempt(qrCode.id, scannedBy, 'failed', location, deviceInfo, 'High risk score detected', startTime, ipAddress, userAgent, riskScore);
        await this.triggerSecurityAlert(qrCode.id, scannedBy, 'high_risk_scan', { riskScore, location, deviceInfo });
        return this.createScanResult('failed', 'Security validation failed', qrCode, startTime);
      }

      // Mark QR code as used
      await qrCode.markAsUsed();

      // Log successful scan
      await this.logScanAttempt(qrCode.id, scannedBy, 'success', location, deviceInfo, null, startTime, ipAddress, userAgent, riskScore);

      // Update delivery status (would integrate with delivery service)
      await this.updateDeliveryStatus(qrCode.deliveryId, qrCode.qrType, scannedBy);

      // Send notifications (would integrate with notification service)
      await this.sendValidationNotifications(qrCode, scannedBy, payload.type);

      return this.createScanResult('success', 'QR code validated successfully', qrCode, startTime, {
        deliveryId: qrCode.deliveryId,
        qrType: qrCode.qrType,
        verificationId: CryptoUtils.generateSecureUUID(),
        riskScore
      });

    } catch (error) {
      logger.error('QR code validation failed:', error);
      
      if (qrCode) {
        await this.logScanAttempt(qrCode.id, validationContext.scannedBy, 'failed', 
          validationContext.location, validationContext.deviceInfo, error.message, 
          startTime, validationContext.ipAddress, validationContext.userAgent);
      }
      
      return this.createScanResult('failed', 'Validation error occurred', qrCode, startTime);
    }
  }

  /**
   * Validate backup code
   */
  async validateBackupCode(backupCode, deliveryId, validationContext) {
    const startTime = Date.now();
    
    try {
      const { scannedBy, location, reason, ipAddress, userAgent, deviceInfo = {} } = validationContext;

      // Find active QR codes for the delivery
      const qrCodes = await QRCode.findActiveByDelivery(deliveryId);
      
      if (qrCodes.length === 0) {
        return this.createScanResult('failed', 'No active QR codes found for delivery', null, startTime);
      }

      // Try to validate backup code against each QR code
      for (const qrCode of qrCodes) {
        const isValidBackup = await encryptionService.verifyBackupCode(backupCode, qrCode.backupCodeHash);
        
        if (isValidBackup) {
          // Validate location if required
          if (qrCode.locationBound && location) {
            const locationValidation = await this.validateLocation(qrCode, location);
            if (!locationValidation.valid) {
              await this.logScanAttempt(qrCode.id, scannedBy, 'invalid_location', location, deviceInfo, 
                locationValidation.reason, startTime, ipAddress, userAgent);
              return this.createScanResult('invalid_location', locationValidation.reason, qrCode, startTime);
            }
          }

          // Validate user authorization
          const authValidation = await this.validateUserAuthorization(scannedBy, qrCode, { type: qrCode.qrType });
          if (!authValidation.valid) {
            await this.logScanAttempt(qrCode.id, scannedBy, 'unauthorized', location, deviceInfo, 
              authValidation.reason, startTime, ipAddress, userAgent);
            return this.createScanResult('unauthorized', authValidation.reason, qrCode, startTime);
          }

          // Mark as used
          await qrCode.markAsUsed();

          // Log backup code usage
          await this.logScanAttempt(qrCode.id, scannedBy, 'success', location, { 
            ...deviceInfo, 
            method: 'backup_code',
            reason 
          }, null, startTime, ipAddress, userAgent);

          // Update delivery status
          await this.updateDeliveryStatus(qrCode.deliveryId, qrCode.qrType, scannedBy);

          // Send notifications
          await this.sendValidationNotifications(qrCode, scannedBy, qrCode.qrType, 'backup_code');

          return this.createScanResult('success', 'Backup code validated successfully', qrCode, startTime, {
            deliveryId: qrCode.deliveryId,
            qrType: qrCode.qrType,
            method: 'backup_code',
            verificationId: CryptoUtils.generateSecureUUID()
          });
        }
      }

      // Log failed backup code attempt
      if (qrCodes.length > 0) {
        await this.logScanAttempt(qrCodes[0].id, scannedBy, 'failed', location, deviceInfo, 
          'Invalid backup code', startTime, ipAddress, userAgent);
      }

      return this.createScanResult('failed', 'Invalid backup code', null, startTime);

    } catch (error) {
      logger.error('Backup code validation failed:', error);
      return this.createScanResult('failed', 'Validation error occurred', null, startTime);
    }
  }

  /**
   * Verify QR code integrity without marking as used
   */
  async verifyQRCodeIntegrity(qrData, expectedDeliveryId = null, expectedType = null) {
    try {
      // Decrypt QR code data
      const payload = await encryptionService.decrypt(qrData);

      // Validate expected values
      if (expectedDeliveryId && payload.deliveryId !== expectedDeliveryId) {
        return { valid: false, reason: 'Delivery ID mismatch' };
      }

      if (expectedType && payload.type !== expectedType) {
        return { valid: false, reason: 'QR type mismatch' };
      }

      // Find QR code record
      const qrCode = await QRCode.findByDeliveryAndType(payload.deliveryId, payload.type);
      if (!qrCode) {
        return { valid: false, reason: 'QR code not found' };
      }

      // Perform security checks
      const securityChecks = {
        signatureValid: true, // Would verify cryptographic signature
        timestampValid: !this.isTimestampTooOld(payload.timestamp, qrCode.securityLevel),
        notExpired: !qrCode.isExpired(),
        notRevoked: qrCode.status !== 'revoked',
        checksumValid: true // Would verify data checksum
      };

      const allChecksPass = Object.values(securityChecks).every(check => check === true);

      return {
        valid: allChecksPass,
        integrity: allChecksPass ? 'verified' : 'compromised',
        deliveryId: payload.deliveryId,
        type: payload.type,
        issuedAt: qrCode.createdAt,
        expiresAt: qrCode.expiresAt,
        securityChecks
      };

    } catch (error) {
      logger.warn('QR code integrity verification failed:', error);
      return {
        valid: false,
        integrity: 'invalid',
        reason: 'Decryption or validation failed'
      };
    }
  }

  /**
   * Validate QR code status
   */
  validateQRCodeStatus(qrCode) {
    if (qrCode.status === 'used') {
      return { valid: false, result: 'already_used', reason: 'QR code has already been used' };
    }

    if (qrCode.status === 'revoked') {
      return { valid: false, result: 'failed', reason: 'QR code has been revoked' };
    }

    if (qrCode.status === 'expired') {
      return { valid: false, result: 'expired', reason: 'QR code has expired' };
    }

    if (qrCode.status !== 'active') {
      return { valid: false, result: 'failed', reason: `Invalid QR code status: ${qrCode.status}` };
    }

    return { valid: true };
  }

  /**
   * Validate location against QR code bounds
   */
  async validateLocation(qrCode, userLocation) {
    try {
      if (!qrCode.locationBound || !qrCode.boundCoordinates) {
        return { valid: true };
      }

      // Parse bound coordinates
      const boundCoordinates = this.parseCoordinates(qrCode.boundCoordinates);
      if (!boundCoordinates) {
        logger.warn('Invalid bound coordinates for QR code:', qrCode.id);
        return { valid: true }; // Don't fail if coordinates are invalid
      }

      // Validate user location format
      if (!GeoUtils.validateCoordinates(userLocation)) {
        return { valid: false, reason: 'Invalid user location coordinates' };
      }

      // Check location accuracy
      const locationAccuracy = GeoUtils.assessLocationAccuracy(userLocation);
      if (!locationAccuracy.reliable) {
        return { valid: false, reason: `Location not reliable: ${locationAccuracy.reason}` };
      }

      // Check if user is within allowed radius
      const isWithinRadius = GeoUtils.isWithinRadius(userLocation, boundCoordinates, qrCode.boundRadius);
      if (!isWithinRadius) {
        const distance = GeoUtils.calculateDistance(userLocation, boundCoordinates);
        return { 
          valid: false, 
          reason: `Outside allowed location (${distance}m from center, max: ${qrCode.boundRadius}m)` 
        };
      }

      return { valid: true, distance: GeoUtils.calculateDistance(userLocation, boundCoordinates) };

    } catch (error) {
      logger.error('Location validation failed:', error);
      return { valid: false, reason: 'Location validation error' };
    }
  }

  /**
   * Validate user authorization
   */
  async validateUserAuthorization(userId, qrCode, payload) {
    try {
      // This would integrate with user service and delivery service
      // For now, implementing basic validation logic

      if (!userId) {
        return { valid: false, reason: 'User ID required' };
      }

      // For pickup QR codes: customer or assigned traveler can scan
      if (payload.type === 'pickup') {
        // Would check if user is customer or assigned traveler for this delivery
        return { valid: true }; // Placeholder
      }

      // For delivery QR codes: assigned traveler can scan
      if (payload.type === 'delivery') {
        // Would check if user is assigned traveler for this delivery
        return { valid: true }; // Placeholder
      }

      return { valid: false, reason: 'User not authorized for this action' };

    } catch (error) {
      logger.error('User authorization validation failed:', error);
      return { valid: false, reason: 'Authorization validation error' };
    }
  }

  /**
   * Validate security requirements
   */
  validateSecurityRequirements(qrCode, additionalVerification) {
    const required = qrCode.securityFeatures || {};

    // Check photo requirement
    if (required.requiresPhoto && !additionalVerification.photo) {
      return { valid: false, reason: 'Photo verification required' };
    }

    // Check signature requirement
    if (required.requiresSignature && !additionalVerification.signature) {
      return { valid: false, reason: 'Signature verification required' };
    }

    // Check biometric requirement
    if (required.requiresBiometric && !additionalVerification.biometric) {
      return { valid: false, reason: 'Biometric verification required' };
    }

    return { valid: true };
  }

  /**
   * Calculate risk score for scan attempt
   */
  async calculateRiskScore(qrCode, validationContext, payload) {
    let riskScore = 0.0;

    try {
      const { location, deviceInfo, ipAddress, scannedBy } = validationContext;

      // Location-based risk factors
      if (location) {
        const locationAccuracy = GeoUtils.assessLocationAccuracy(location);
        if (!locationAccuracy.reliable) {
          riskScore += 0.2;
        }

        if (locationAccuracy.accuracy && locationAccuracy.accuracy > this.locationAccuracyThreshold) {
          riskScore += 0.1;
        }
      }

      // Device-based risk factors
      if (deviceInfo.platform && !['ios', 'android', 'web'].includes(deviceInfo.platform)) {
        riskScore += 0.1;
      }

      // Time-based risk factors
      const scanTime = new Date().getHours();
      if (scanTime < 6 || scanTime > 22) { // Late night/early morning scans
        riskScore += 0.1;
      }

      // Historical scan patterns
      const recentScans = await QRCodeScan.findAll({
        where: {
          scannedBy,
          scannedAt: {
            [require('sequelize').Op.gte]: moment().subtract(1, 'hour').toDate()
          }
        }
      });

      if (recentScans.length > 5) { // Too many recent scans
        riskScore += 0.3;
      }

      // IP-based risk factors (would integrate with IP reputation service)
      if (ipAddress) {
        // Placeholder for IP reputation check
        // riskScore += await this.checkIPReputation(ipAddress);
      }

      // QR code age risk
      const qrAge = Date.now() - qrCode.createdAt.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (qrAge > maxAge) {
        riskScore += 0.1;
      }

      return Math.min(riskScore, 1.0); // Cap at 1.0

    } catch (error) {
      logger.warn('Risk score calculation failed:', error);
      return 0.5; // Default medium risk
    }
  }

  /**
   * Check scan rate limiting
   */
  async checkScanRateLimit(qrCodeId, scannedBy, ipAddress) {
    try {
      const windowStart = moment().subtract(this.scanAttemptWindow, 'milliseconds').toDate();

      // Check attempts by user
      const userAttempts = await QRCodeScan.count({
        where: {
          qrCodeId,
          scannedBy,
          scannedAt: {
            [require('sequelize').Op.gte]: windowStart
          }
        }
      });

      if (userAttempts >= this.maxScanAttempts) {
        return { allowed: false, reason: 'User rate limit exceeded' };
      }

      // Check attempts by IP address
      if (ipAddress) {
        const ipAttempts = await QRCodeScan.count({
          where: {
            qrCodeId,
            ipAddress,
            scannedAt: {
              [require('sequelize').Op.gte]: windowStart
            }
          }
        });

        if (ipAttempts >= this.maxScanAttempts * 2) {
          return { allowed: false, reason: 'IP rate limit exceeded' };
        }
      }

      return { allowed: true };

    } catch (error) {
      logger.warn('Rate limit check failed:', error);
      return { allowed: true }; // Allow if check fails
    }
  }

  /**
   * Log scan attempt
   */
  async logScanAttempt(qrCodeId, scannedBy, result, location, deviceInfo, failureReason, startTime, ipAddress, userAgent, riskScore = 0.0) {
    try {
      const responseTime = Date.now() - startTime;

      await QRCodeScan.create({
        qrCodeId,
        scannedBy,
        scanResult: result,
        scanLocation: location ? `POINT(${location.lng} ${location.lat})` : null,
        scanAccuracy: location?.accuracy,
        deviceInfo,
        failureReason,
        responseTimeMs: responseTime,
        ipAddress,
        userAgent,
        riskScore
      });

    } catch (error) {
      logger.error('Failed to log scan attempt:', error);
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(deliveryId, qrType, scannedBy) {
    try {
      // This would integrate with delivery service
      logger.info('Delivery status update:', { deliveryId, qrType, scannedBy });
      
      // Placeholder for delivery service integration
      // await deliveryService.updateStatus(deliveryId, newStatus);
      
    } catch (error) {
      logger.error('Failed to update delivery status:', error);
    }
  }

  /**
   * Send validation notifications
   */
  async sendValidationNotifications(qrCode, scannedBy, qrType, method = 'qr_code') {
    try {
      // This would integrate with notification service
      logger.info('Sending validation notifications:', { 
        qrCodeId: qrCode.id, 
        scannedBy, 
        qrType, 
        method 
      });
      
      // Placeholder for notification service integration
      // await notificationService.sendValidationNotification(qrCode.deliveryId, qrType, scannedBy);
      
    } catch (error) {
      logger.error('Failed to send validation notifications:', error);
    }
  }

  /**
   * Trigger security alert
   */
  async triggerSecurityAlert(qrCodeId, userId, alertType, details) {
    try {
      logger.warn('Security alert triggered:', { qrCodeId, userId, alertType, details });
      
      // This would integrate with security monitoring system
      // await securityService.triggerAlert(alertType, { qrCodeId, userId, ...details });
      
    } catch (error) {
      logger.error('Failed to trigger security alert:', error);
    }
  }

  /**
   * Create scan result object
   */
  createScanResult(result, message, qrCode, startTime, additionalData = {}) {
    const responseTime = Date.now() - startTime;
    
    return {
      result,
      message,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      qrCodeId: qrCode?.id,
      ...additionalData
    };
  }

  /**
   * Parse PostGIS coordinates
   */
  parseCoordinates(postgisPoint) {
    try {
      const matches = postgisPoint.match(/POINT\(([^)]+)\)/);
      if (!matches) return null;
      
      const [lng, lat] = matches[1].split(' ').map(parseFloat);
      return { lat, lng };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if timestamp is too old based on security level
   */
  isTimestampTooOld(timestamp, securityLevel) {
    const now = Date.now();
    const age = now - timestamp;
    
    const maxAge = {
      standard: 24 * 60 * 60 * 1000, // 24 hours
      high: 12 * 60 * 60 * 1000,     // 12 hours  
      maximum: 6 * 60 * 60 * 1000    // 6 hours
    };

    return age > (maxAge[securityLevel] || maxAge.standard);
  }
}

module.exports = new ValidationService();