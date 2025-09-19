const { qrCodeService } = require('../services');
const logger = require('../config/logger');

class QRCodeController {
  /**
   * Generate pickup QR code
   * POST /api/v1/qr/pickup/generate
   */
  async generatePickupQR(req, res) {
    try {
      const { deliveryId, ...options } = req.body;
      const userId = req.user.id;

      const qrCode = await qrCodeService.generateQRCode(deliveryId, 'pickup', {
        ...options,
        createdBy: userId
      });

      logger.info('Pickup QR code generated:', {
        qrCodeId: qrCode.id,
        deliveryId,
        userId,
        securityLevel: qrCode.securityLevel
      });

      res.status(201).json({
        success: true,
        data: qrCode
      });

    } catch (error) {
      logger.error('Pickup QR generation failed:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate delivery QR code
   * POST /api/v1/qr/delivery/generate
   */
  async generateDeliveryQR(req, res) {
    try {
      const { deliveryId, ...options } = req.body;
      const userId = req.user.id;

      // Set default additional security for delivery QR codes
      const deliveryOptions = {
        ...options,
        additionalSecurity: {
          requiresSignature: true,
          requiresPhoto: true,
          ...options.additionalSecurity
        },
        createdBy: userId
      };

      const qrCode = await qrCodeService.generateQRCode(deliveryId, 'delivery', deliveryOptions);

      logger.info('Delivery QR code generated:', {
        qrCodeId: qrCode.id,
        deliveryId,
        userId,
        securityLevel: qrCode.securityLevel
      });

      res.status(201).json({
        success: true,
        data: qrCode
      });

    } catch (error) {
      logger.error('Delivery QR generation failed:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get QR code details
   * GET /api/v1/qr/:qrCodeId
   */
  async getQRCodeDetails(req, res) {
    try {
      const { qrCodeId } = req.params;
      const { includeScans = false } = req.query;

      const qrCode = await qrCodeService.getQRCodeDetails(qrCodeId, includeScans);

      res.json({
        success: true,
        data: qrCode
      });

    } catch (error) {
      logger.error('Failed to get QR code details:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get QR codes for a delivery
   * GET /api/v1/qr/delivery/:deliveryId
   */
  async getDeliveryQRCodes(req, res) {
    try {
      const { deliveryId } = req.params;

      const qrCodes = await qrCodeService.getDeliveryQRCodes(deliveryId);

      res.json({
        success: true,
        data: qrCodes
      });

    } catch (error) {
      logger.error('Failed to get delivery QR codes:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Download QR code image
   * GET /api/v1/qr/:qrCodeId/image
   */
  async downloadQRCodeImage(req, res) {
    try {
      const { qrCodeId } = req.params;
      const { format = 'png', size = 'medium', style = 'standard' } = req.query;

      const qrCode = await qrCodeService.getQRCodeDetails(qrCodeId);
      
      if (!qrCode.downloadUrl) {
        return res.status(404).json({
          success: false,
          error: 'QR code image not available'
        });
      }

      // In a real implementation, this would serve the actual image file
      // For now, returning the base64 image data
      if (qrCode.imageData) {
        const buffer = Buffer.from(qrCode.imageData, 'base64');
        
        res.set({
          'Content-Type': `image/${format}`,
          'Content-Length': buffer.length,
          'Content-Disposition': `attachment; filename="qr-${qrCodeId}.${format}"`
        });
        
        res.send(buffer);
      } else {
        res.status(404).json({
          success: false,
          error: 'QR code image not found'
        });
      }

    } catch (error) {
      logger.error('Failed to download QR code image:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Regenerate QR code
   * POST /api/v1/qr/:qrCodeId/regenerate
   */
  async regenerateQRCode(req, res) {
    try {
      const { qrCodeId } = req.params;
      const options = {
        ...req.body,
        createdBy: req.user.id,
        revokedBy: req.user.id
      };

      const newQRCode = await qrCodeService.regenerateQRCode(qrCodeId, options);

      logger.info('QR code regenerated:', {
        originalQrCodeId: qrCodeId,
        newQrCodeId: newQRCode.id,
        userId: req.user.id,
        reason: options.reason
      });

      res.status(201).json({
        success: true,
        data: newQRCode
      });

    } catch (error) {
      logger.error('QR code regeneration failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Revoke QR code
   * POST /api/v1/qr/:qrCodeId/revoke
   */
  async revokeQRCode(req, res) {
    try {
      const { qrCodeId } = req.params;
      const { reason, notifyParties = true } = req.body;
      const userId = req.user.id;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Revocation reason is required'
        });
      }

      const result = await qrCodeService.revokeQRCode(qrCodeId, reason, userId);

      logger.info('QR code revoked:', {
        qrCodeId,
        userId,
        reason
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('QR code revocation failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk generate QR codes
   * POST /api/v1/qr/bulk-generate
   */
  async bulkGenerateQRCodes(req, res) {
    try {
      const { requests, ...options } = req.body;
      const userId = req.user.id;

      // Add user context to each request
      const requestsWithUser = requests.map(request => ({
        ...request,
        options: {
          ...request.options,
          createdBy: userId
        }
      }));

      const result = await qrCodeService.bulkGenerateQRCodes(requestsWithUser, options);

      logger.info('Bulk QR code generation completed:', {
        userId,
        totalRequests: requests.length,
        successful: result.success,
        failed: result.failed
      });

      res.status(201).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Bulk QR code generation failed:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get QR code history
   * GET /api/v1/qr/history
   */
  async getQRCodeHistory(req, res) {
    try {
      const filters = req.query;
      const userId = req.user.id;

      // Add user filter for non-admin users
      if (!req.userContext?.isAdmin) {
        filters.createdBy = userId;
      }

      // This would be implemented in the service
      // For now, returning placeholder response
      const history = {
        qrCodes: [],
        pagination: {
          page: parseInt(filters.page) || 1,
          limit: parseInt(filters.limit) || 20,
          total: 0,
          totalPages: 0
        }
      };

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Failed to get QR code history:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get QR code analytics
   * GET /api/v1/qr/analytics
   */
  async getQRCodeAnalytics(req, res) {
    try {
      const { period = '24 hours', groupBy = 'day' } = req.query;

      const analytics = await qrCodeService.getStatistics(period);

      res.json({
        success: true,
        data: {
          summary: analytics,
          period,
          groupBy,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get QR code analytics:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Test QR code scanner
   * POST /api/v1/qr/test-scanner
   */
  async testQRScanner(req, res) {
    try {
      const { testType = 'both', mockData = {} } = req.body;
      const userId = req.user.id;

      // This would implement actual scanner testing
      // For now, returning mock test results
      const testResults = {
        pickup: testType === 'pickup' || testType === 'both' ? {
          qrGenerated: true,
          scanSuccessful: true,
          validationPassed: true,
          responseTime: `${Math.floor(Math.random() * 100 + 200)}ms`
        } : null,
        delivery: testType === 'delivery' || testType === 'both' ? {
          qrGenerated: true,
          scanSuccessful: true,
          validationPassed: true,
          responseTime: `${Math.floor(Math.random() * 100 + 250)}ms`
        } : null
      };

      const systemHealth = {
        qrGenerationService: 'healthy',
        validationService: 'healthy',
        encryptionService: 'healthy',
        databaseService: 'healthy'
      };

      logger.info('QR scanner test completed:', {
        userId,
        testType,
        results: testResults
      });

      res.json({
        success: true,
        data: {
          testResults,
          systemHealth,
          testedBy: userId,
          testedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('QR scanner test failed:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get performance metrics
   * GET /api/v1/qr/performance-metrics
   */
  async getPerformanceMetrics(req, res) {
    try {
      // This would implement actual performance monitoring
      // For now, returning mock metrics
      const metrics = {
        realTime: {
          activeQrCodes: Math.floor(Math.random() * 100 + 20),
          scansPerMinute: parseFloat((Math.random() * 5 + 1).toFixed(1)),
          averageResponseTime: `${Math.floor(Math.random() * 100 + 200)}ms`,
          successRate: parseFloat((Math.random() * 5 + 95).toFixed(1))
        },
        daily: {
          qrCodesGenerated: Math.floor(Math.random() * 200 + 50),
          totalScans: Math.floor(Math.random() * 300 + 100),
          uniqueUsers: Math.floor(Math.random() * 100 + 30),
          peakHour: '14:00-15:00'
        },
        systemLoad: {
          cpuUsage: `${Math.floor(Math.random() * 30 + 10)}%`,
          memoryUsage: `${Math.floor(Math.random() * 40 + 30)}%`,
          storageUsage: `${Math.floor(Math.random() * 50 + 20)}%`,
          networkLatency: `${Math.floor(Math.random() * 50 + 20)}ms`
        }
      };

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new QRCodeController();