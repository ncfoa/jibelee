const { validationService } = require('../services');
const logger = require('../config/logger');

class ValidationController {
  /**
   * Validate pickup QR code
   * POST /api/v1/qr/pickup/validate
   */
  async validatePickupQR(req, res) {
    try {
      const { qrCodeData, location, deviceInfo, additionalVerification } = req.body;
      const userId = req.user.id;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const validationContext = {
        scannedBy: userId,
        location,
        deviceInfo,
        additionalVerification,
        ipAddress,
        userAgent
      };

      const result = await validationService.validateQRCode(qrCodeData, validationContext);

      // Log validation attempt
      logger.info('Pickup QR validation attempt:', {
        userId,
        result: result.result,
        qrCodeId: result.qrCodeId,
        responseTime: result.responseTime
      });

      const statusCode = result.result === 'success' ? 200 : 400;

      res.status(statusCode).json({
        success: result.result === 'success',
        data: result
      });

    } catch (error) {
      logger.error('Pickup QR validation failed:', error);
      
      res.status(500).json({
        success: false,
        error: 'Validation service error',
        message: error.message
      });
    }
  }

  /**
   * Validate delivery QR code
   * POST /api/v1/qr/delivery/validate
   */
  async validateDeliveryQR(req, res) {
    try {
      const { 
        qrCodeData, 
        location, 
        deviceInfo, 
        recipientVerification,
        deliveryEvidence,
        additionalVerification 
      } = req.body;
      const userId = req.user.id;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Combine all verification data for delivery
      const combinedVerification = {
        ...additionalVerification,
        ...recipientVerification,
        ...deliveryEvidence
      };

      const validationContext = {
        scannedBy: userId,
        location,
        deviceInfo,
        additionalVerification: combinedVerification,
        ipAddress,
        userAgent
      };

      const result = await validationService.validateQRCode(qrCodeData, validationContext);

      // Enhanced logging for delivery validation
      logger.info('Delivery QR validation attempt:', {
        userId,
        result: result.result,
        qrCodeId: result.qrCodeId,
        responseTime: result.responseTime,
        hasRecipientVerification: !!recipientVerification,
        hasDeliveryEvidence: !!deliveryEvidence
      });

      const statusCode = result.result === 'success' ? 200 : 400;

      // Add delivery-specific response data
      if (result.result === 'success') {
        result.data = {
          ...result.data,
          deliveryCompleted: true,
          completedAt: new Date().toISOString(),
          recipientConfirmation: recipientVerification?.recipientPresent || false,
          evidenceCollected: {
            photo: !!deliveryEvidence?.photoUrl,
            signature: !!recipientVerification?.recipientSignature,
            idVerification: !!recipientVerification?.idVerification
          }
        };
      }

      res.status(statusCode).json({
        success: result.result === 'success',
        data: result
      });

    } catch (error) {
      logger.error('Delivery QR validation failed:', error);
      
      res.status(500).json({
        success: false,
        error: 'Validation service error',
        message: error.message
      });
    }
  }

  /**
   * Validate QR code (generic endpoint)
   * POST /api/v1/qr/validate
   */
  async validateQRCode(req, res) {
    try {
      const { qrCodeData, location, deviceInfo, additionalVerification } = req.body;
      const userId = req.user.id;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const validationContext = {
        scannedBy: userId,
        location,
        deviceInfo,
        additionalVerification,
        ipAddress,
        userAgent
      };

      const result = await validationService.validateQRCode(qrCodeData, validationContext);

      logger.info('QR validation attempt:', {
        userId,
        result: result.result,
        qrCodeId: result.qrCodeId,
        responseTime: result.responseTime
      });

      const statusCode = result.result === 'success' ? 200 : 400;

      res.status(statusCode).json({
        success: result.result === 'success',
        data: result
      });

    } catch (error) {
      logger.error('QR validation failed:', error);
      
      res.status(500).json({
        success: false,
        error: 'Validation service error',
        message: error.message
      });
    }
  }

  /**
   * Validate backup code
   * POST /api/v1/qr/validate-backup
   */
  async validateBackupCode(req, res) {
    try {
      const { backupCode, deliveryId, location, reason } = req.body;
      const userId = req.user.id;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      const deviceInfo = req.body.deviceInfo || {};

      const validationContext = {
        scannedBy: userId,
        location,
        reason,
        ipAddress,
        userAgent,
        deviceInfo
      };

      const result = await validationService.validateBackupCode(backupCode, deliveryId, validationContext);

      logger.info('Backup code validation attempt:', {
        userId,
        deliveryId,
        result: result.result,
        reason,
        responseTime: result.responseTime
      });

      const statusCode = result.result === 'success' ? 200 : 400;

      res.status(statusCode).json({
        success: result.result === 'success',
        data: result
      });

    } catch (error) {
      logger.error('Backup code validation failed:', error);
      
      res.status(500).json({
        success: false,
        error: 'Validation service error',
        message: error.message
      });
    }
  }

  /**
   * Verify QR code integrity
   * POST /api/v1/qr/verify-integrity
   */
  async verifyQRCodeIntegrity(req, res) {
    try {
      const { qrCodeData, expectedDeliveryId, expectedType } = req.body;

      const result = await validationService.verifyQRCodeIntegrity(
        qrCodeData, 
        expectedDeliveryId, 
        expectedType
      );

      logger.info('QR integrity verification:', {
        userId: req.user?.id,
        valid: result.valid,
        deliveryId: result.deliveryId,
        type: result.type
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('QR integrity verification failed:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get scan history for a QR code
   * GET /api/v1/qr/:qrCodeId/scans
   */
  async getQRCodeScans(req, res) {
    try {
      const { qrCodeId } = req.params;
      const { page = 1, limit = 50, result } = req.query;

      // This would be implemented in the service
      // For now, returning placeholder data
      const scans = {
        scans: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      };

      res.json({
        success: true,
        data: scans
      });

    } catch (error) {
      logger.error('Failed to get QR code scans:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get validation statistics
   * GET /api/v1/qr/validation-stats
   */
  async getValidationStatistics(req, res) {
    try {
      const { timeframe = '24 hours', groupBy = 'hour' } = req.query;

      // This would implement actual statistics gathering
      // For now, returning mock data
      const stats = {
        summary: {
          totalScans: Math.floor(Math.random() * 1000 + 500),
          successfulScans: Math.floor(Math.random() * 900 + 450),
          failedScans: Math.floor(Math.random() * 100 + 50),
          successRate: parseFloat((Math.random() * 10 + 85).toFixed(1)),
          averageResponseTime: `${Math.floor(Math.random() * 100 + 200)}ms`
        },
        breakdown: {
          pickup: {
            scans: Math.floor(Math.random() * 500 + 250),
            successRate: parseFloat((Math.random() * 5 + 92).toFixed(1))
          },
          delivery: {
            scans: Math.floor(Math.random() * 500 + 250),
            successRate: parseFloat((Math.random() * 10 + 80).toFixed(1))
          }
        },
        failureReasons: [
          {
            reason: 'expired',
            count: Math.floor(Math.random() * 20 + 5),
            percentage: parseFloat((Math.random() * 30 + 20).toFixed(1))
          },
          {
            reason: 'invalid_location',
            count: Math.floor(Math.random() * 15 + 3),
            percentage: parseFloat((Math.random() * 20 + 10).toFixed(1))
          },
          {
            reason: 'already_used',
            count: Math.floor(Math.random() * 10 + 2),
            percentage: parseFloat((Math.random() * 15 + 5).toFixed(1))
          }
        ]
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get validation statistics:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get suspicious scan activities
   * GET /api/v1/qr/suspicious-scans
   */
  async getSuspiciousScans(req, res) {
    try {
      const { timeframe = '24 hours', severity = 'medium' } = req.query;

      // This would implement actual suspicious activity detection
      // For now, returning mock data
      const suspiciousScans = {
        scans: [],
        summary: {
          totalSuspicious: 0,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0
        },
        timeframe
      };

      res.json({
        success: true,
        data: suspiciousScans
      });

    } catch (error) {
      logger.error('Failed to get suspicious scans:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Real-time validation status
   * GET /api/v1/qr/validation-status
   */
  async getValidationStatus(req, res) {
    try {
      // This would provide real-time validation service status
      const status = {
        service: 'operational',
        responseTime: `${Math.floor(Math.random() * 50 + 150)}ms`,
        successRate: parseFloat((Math.random() * 5 + 95).toFixed(1)),
        activeValidations: Math.floor(Math.random() * 20 + 5),
        queueLength: Math.floor(Math.random() * 10),
        lastHealthCheck: new Date().toISOString()
      };

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Failed to get validation status:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ValidationController();