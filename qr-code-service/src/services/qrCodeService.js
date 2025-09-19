const moment = require('moment');
const { QRCode } = require('../models');
const encryptionService = require('./encryptionService');
const { QRUtils, CryptoUtils } = require('../utils');
const logger = require('../config/logger');

class QRCodeService {
  constructor() {
    this.defaultExpirationHours = parseInt(process.env.QR_CODE_EXPIRY_HOURS) || 24;
    this.maxExpirationHours = 168; // 7 days
  }

  /**
   * Generate QR code for pickup or delivery
   */
  async generateQRCode(deliveryId, qrType, options = {}) {
    try {
      const startTime = Date.now();
      
      // Validate input
      this.validateGenerationInput(deliveryId, qrType, options);
      
      // Check if QR code already exists for this delivery and type
      const existingQR = await QRCode.findByDeliveryAndType(deliveryId, qrType);
      if (existingQR && existingQR.isActive()) {
        throw new Error(`Active QR code already exists for ${qrType} of delivery ${deliveryId}`);
      }

      // Extract options
      const {
        securityLevel = 'standard',
        expirationHours = this.defaultExpirationHours,
        locationBinding = {},
        additionalSecurity = {},
        additionalData = {},
        createdBy
      } = options;

      // Validate security level
      if (!['standard', 'high', 'maximum'].includes(securityLevel)) {
        throw new Error('Invalid security level');
      }

      // Calculate expiration time
      const expiresAt = moment().add(expirationHours, 'hours').toDate();
      if (expirationHours > this.maxExpirationHours) {
        throw new Error(`Expiration cannot exceed ${this.maxExpirationHours} hours`);
      }

      // Create secure payload
      const payload = await this.createSecurePayload(deliveryId, qrType, options);
      
      // Encrypt payload
      const encryptedData = await encryptionService.encrypt(payload, securityLevel);
      
      // Generate backup code
      const backupCode = encryptionService.generateBackupCode();
      const backupCodeHash = await encryptionService.hashBackupCode(backupCode);
      
      // Process location binding
      const locationBound = locationBinding.enabled || false;
      const boundCoordinates = locationBound ? locationBinding.coordinates : null;
      const boundRadius = locationBound ? locationBinding.radius : null;

      // Create QR code record
      const qrCodeData = {
        deliveryId,
        qrType,
        encryptedData,
        backupCodeHash,
        securityLevel,
        securityFeatures: {
          encrypted: true,
          timestamped: true,
          locationBound,
          singleUse: true,
          ...additionalSecurity
        },
        expiresAt,
        locationBound,
        boundCoordinates: boundCoordinates ? `POINT(${boundCoordinates.lng} ${boundCoordinates.lat})` : null,
        boundRadius,
        createdBy,
        additionalData
      };

      const qrCode = await QRCode.create(qrCodeData);

      // Generate QR code image
      const imageOptions = {
        size: options.imageSize || 'medium',
        style: options.imageStyle || 'standard',
        branding: options.branding,
        format: options.imageFormat || 'png'
      };

      const qrImage = await QRUtils.generateQRImage(encryptedData, imageOptions);
      const qrImageBase64 = qrImage.toString('base64');
      
      // Generate download URL (this would integrate with file storage service)
      const downloadUrl = await this.generateDownloadUrl(qrCode.id, imageOptions.format);
      
      // Update QR code with image data
      await qrCode.update({
        imageData: qrImageBase64,
        downloadUrl
      });

      // Log creation event
      await this.logQRCodeEvent('created', qrCode.id, {
        deliveryId,
        qrType,
        securityLevel,
        expirationHours,
        locationBound,
        createdBy
      });

      const duration = Date.now() - startTime;
      logger.info(`QR code generated in ${duration}ms`, {
        qrCodeId: qrCode.id,
        deliveryId,
        qrType,
        securityLevel
      });

      return {
        id: qrCode.id,
        qrCodeData: encryptedData,
        qrCodeImage: `data:image/${imageOptions.format};base64,${qrImageBase64}`,
        downloadUrl,
        backupCode, // Return plain text backup code only once
        expiresAt,
        securityLevel,
        securityFeatures: qrCode.securityFeatures,
        scanInstructions: this.getScanInstructions(qrType),
        locationBound,
        boundRadius
      };
    } catch (error) {
      logger.error('QR code generation failed:', error);
      throw error;
    }
  }

  /**
   * Regenerate QR code (for expired or compromised codes)
   */
  async regenerateQRCode(qrCodeId, options = {}) {
    try {
      const existingQR = await QRCode.findByPk(qrCodeId);
      if (!existingQR) {
        throw new Error('QR code not found');
      }

      // Revoke existing QR code
      await existingQR.revoke(options.reason || 'regenerated', options.revokedBy);

      // Generate new QR code with same parameters but new expiration
      const newOptions = {
        securityLevel: options.newSecurityLevel || existingQR.securityLevel,
        expirationHours: options.newExpirationHours || this.defaultExpirationHours,
        locationBinding: {
          enabled: existingQR.locationBound,
          coordinates: existingQR.boundCoordinates ? this.parseCoordinates(existingQR.boundCoordinates) : null,
          radius: existingQR.boundRadius
        },
        additionalSecurity: existingQR.securityFeatures,
        additionalData: existingQR.additionalData,
        createdBy: options.createdBy
      };

      const newQR = await this.generateQRCode(existingQR.deliveryId, existingQR.qrType, newOptions);

      // Log regeneration event
      await this.logQRCodeEvent('regenerated', newQR.id, {
        originalQrCodeId: qrCodeId,
        reason: options.reason,
        newSecurityLevel: newOptions.securityLevel
      });

      return {
        ...newQR,
        previousQrRevoked: true,
        originalQrCodeId: qrCodeId
      };
    } catch (error) {
      logger.error('QR code regeneration failed:', error);
      throw error;
    }
  }

  /**
   * Get QR code details
   */
  async getQRCodeDetails(qrCodeId, includeScans = false) {
    try {
      const includeOptions = includeScans ? { include: ['scans'] } : {};
      const qrCode = await QRCode.findByPk(qrCodeId, includeOptions);
      
      if (!qrCode) {
        throw new Error('QR code not found');
      }

      return {
        id: qrCode.id,
        deliveryId: qrCode.deliveryId,
        type: qrCode.qrType,
        status: qrCode.status,
        securityLevel: qrCode.securityLevel,
        securityFeatures: qrCode.securityFeatures,
        createdAt: qrCode.createdAt,
        expiresAt: qrCode.expiresAt,
        usedAt: qrCode.usedAt,
        locationBound: qrCode.locationBound,
        boundCoordinates: qrCode.boundCoordinates ? this.parseCoordinates(qrCode.boundCoordinates) : null,
        boundRadius: qrCode.boundRadius,
        downloadUrl: qrCode.downloadUrl,
        scanHistory: includeScans ? qrCode.scans : undefined,
        additionalData: qrCode.additionalData
      };
    } catch (error) {
      logger.error('Failed to get QR code details:', error);
      throw error;
    }
  }

  /**
   * Revoke QR code
   */
  async revokeQRCode(qrCodeId, reason, revokedBy) {
    try {
      const qrCode = await QRCode.findByPk(qrCodeId);
      if (!qrCode) {
        throw new Error('QR code not found');
      }

      if (qrCode.status !== 'active') {
        throw new Error(`Cannot revoke QR code with status: ${qrCode.status}`);
      }

      await qrCode.revoke(reason, revokedBy);

      // Log revocation event
      await this.logQRCodeEvent('revoked', qrCodeId, {
        reason,
        revokedBy,
        previousStatus: 'active'
      });

      return {
        id: qrCode.id,
        status: 'revoked',
        revokedAt: qrCode.revokedAt,
        reason: qrCode.revokedReason
      };
    } catch (error) {
      logger.error('QR code revocation failed:', error);
      throw error;
    }
  }

  /**
   * Get QR codes for a delivery
   */
  async getDeliveryQRCodes(deliveryId) {
    try {
      const qrCodes = await QRCode.findAll({
        where: { deliveryId },
        order: [['createdAt', 'DESC']]
      });

      return qrCodes.map(qr => ({
        id: qr.id,
        type: qr.qrType,
        status: qr.status,
        securityLevel: qr.securityLevel,
        createdAt: qr.createdAt,
        expiresAt: qr.expiresAt,
        usedAt: qr.usedAt,
        downloadUrl: qr.downloadUrl,
        locationBound: qr.locationBound
      }));
    } catch (error) {
      logger.error('Failed to get delivery QR codes:', error);
      throw error;
    }
  }

  /**
   * Bulk generate QR codes
   */
  async bulkGenerateQRCodes(requests, options = {}) {
    try {
      const results = [];
      const errors = [];
      const concurrency = options.concurrency || 5;

      // Process requests in batches
      for (let i = 0; i < requests.length; i += concurrency) {
        const batch = requests.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (request) => {
          try {
            const qrCode = await this.generateQRCode(
              request.deliveryId,
              request.type,
              request.options || {}
            );
            
            return {
              deliveryId: request.deliveryId,
              type: request.type,
              success: true,
              qrCode
            };
          } catch (error) {
            return {
              deliveryId: request.deliveryId,
              type: request.type,
              success: false,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            results.push(result);
          } else {
            errors.push(result);
          }
        });
      }

      // Generate bulk download URL if requested
      let bulkDownloadUrl = null;
      if (options.generateBulkDownload && results.length > 0) {
        bulkDownloadUrl = await this.generateBulkDownloadUrl(results);
      }

      return {
        success: results.length,
        failed: errors.length,
        results,
        errors,
        bulkDownloadUrl
      };
    } catch (error) {
      logger.error('Bulk QR code generation failed:', error);
      throw error;
    }
  }

  /**
   * Create secure payload for QR code
   */
  async createSecurePayload(deliveryId, qrType, options) {
    // This would typically fetch delivery details from delivery service
    // For now, creating a basic payload structure
    
    const payload = {
      deliveryId,
      type: qrType,
      timestamp: Date.now(),
      nonce: CryptoUtils.generateNonce(),
      securityLevel: options.securityLevel || 'standard',
      version: '1.0'
    };

    // Add type-specific data
    if (qrType === 'pickup') {
      payload.action = 'pickup_verification';
      payload.requiredVerification = options.additionalSecurity || {};
    } else if (qrType === 'delivery') {
      payload.action = 'delivery_verification';
      payload.requiredVerification = {
        signature: true,
        photo: true,
        ...options.additionalSecurity
      };
    }

    // Add location binding if enabled
    if (options.locationBinding?.enabled) {
      payload.locationBinding = {
        coordinates: options.locationBinding.coordinates,
        radius: options.locationBinding.radius
      };
    }

    // Add additional data
    if (options.additionalData) {
      payload.additionalData = options.additionalData;
    }

    return payload;
  }

  /**
   * Generate download URL for QR code image
   */
  async generateDownloadUrl(qrCodeId, format = 'png') {
    // This would integrate with file storage service (AWS S3, etc.)
    // For now, returning a placeholder URL
    const baseUrl = process.env.QR_DOWNLOAD_BASE_URL || 'https://qr.p2pdelivery.com';
    return `${baseUrl}/qr/${qrCodeId}.${format}`;
  }

  /**
   * Generate bulk download URL
   */
  async generateBulkDownloadUrl(results) {
    // This would create a ZIP file with all QR codes
    // For now, returning a placeholder URL
    const batchId = CryptoUtils.generateSecureUUID();
    const baseUrl = process.env.QR_DOWNLOAD_BASE_URL || 'https://qr.p2pdelivery.com';
    return `${baseUrl}/bulk/${batchId}.zip`;
  }

  /**
   * Get scan instructions for QR type
   */
  getScanInstructions(qrType) {
    const instructions = {
      pickup: 'Show this QR code to the traveler for item pickup verification',
      delivery: 'Show this QR code to the recipient for delivery confirmation'
    };
    
    return instructions[qrType] || 'Scan this QR code for verification';
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
      logger.warn('Failed to parse coordinates:', error);
      return null;
    }
  }

  /**
   * Log QR code events for audit trail
   */
  async logQRCodeEvent(eventType, qrCodeId, details) {
    try {
      // This would integrate with audit logging service
      logger.info(`QR Code Event: ${eventType}`, {
        qrCodeId,
        eventType,
        ...details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('Failed to log QR code event:', error);
    }
  }

  /**
   * Validate generation input
   */
  validateGenerationInput(deliveryId, qrType, options) {
    if (!deliveryId) {
      throw new Error('Delivery ID is required');
    }

    if (!['pickup', 'delivery'].includes(qrType)) {
      throw new Error('QR type must be pickup or delivery');
    }

    if (options.expirationHours && (options.expirationHours < 1 || options.expirationHours > this.maxExpirationHours)) {
      throw new Error(`Expiration hours must be between 1 and ${this.maxExpirationHours}`);
    }

    if (options.locationBinding?.enabled) {
      if (!options.locationBinding.coordinates) {
        throw new Error('Location binding requires coordinates');
      }
      
      if (!options.locationBinding.radius || options.locationBinding.radius < 1) {
        throw new Error('Location binding requires valid radius');
      }
    }
  }

  /**
   * Get QR code statistics
   */
  async getStatistics(timeframe = '24 hours') {
    try {
      const startTime = moment().subtract(24, 'hours').toDate();
      
      const stats = await QRCode.findAll({
        where: {
          createdAt: {
            [require('sequelize').Op.gte]: startTime
          }
        },
        attributes: [
          'qrType',
          'securityLevel',
          'status'
        ]
      });

      const summary = {
        totalGenerated: stats.length,
        byType: {
          pickup: stats.filter(s => s.qrType === 'pickup').length,
          delivery: stats.filter(s => s.qrType === 'delivery').length
        },
        bySecurityLevel: {
          standard: stats.filter(s => s.securityLevel === 'standard').length,
          high: stats.filter(s => s.securityLevel === 'high').length,
          maximum: stats.filter(s => s.securityLevel === 'maximum').length
        },
        byStatus: {
          active: stats.filter(s => s.status === 'active').length,
          used: stats.filter(s => s.status === 'used').length,
          expired: stats.filter(s => s.status === 'expired').length,
          revoked: stats.filter(s => s.status === 'revoked').length
        }
      };

      return summary;
    } catch (error) {
      logger.error('Failed to get QR code statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up expired QR codes
   */
  async cleanupExpiredCodes() {
    try {
      const expiredCount = await QRCode.expireOldCodes();
      logger.info(`Expired ${expiredCount} old QR codes`);
      return expiredCount;
    } catch (error) {
      logger.error('Failed to cleanup expired QR codes:', error);
      throw error;
    }
  }
}

module.exports = new QRCodeService();