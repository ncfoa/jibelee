const { emergencyService } = require('../services');
const logger = require('../config/logger');

class EmergencyController {
  /**
   * Request emergency override
   * POST /api/v1/qr/emergency-override
   */
  async requestEmergencyOverride(req, res) {
    try {
      const userId = req.user.id;
      const overrideData = {
        ...req.body,
        location: req.body.location || {
          lat: 0, // Would get from request context
          lng: 0
        }
      };

      const result = await emergencyService.requestOverride(userId, overrideData);

      logger.info('Emergency override requested:', {
        overrideId: result.overrideId,
        userId,
        deliveryId: overrideData.deliveryId,
        reason: overrideData.reason
      });

      res.status(201).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Emergency override request failed:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get pending override requests (Admin only)
   * GET /api/v1/qr/emergency-override/pending
   */
  async getPendingOverrides(req, res) {
    try {
      const adminId = req.user.id;
      const filters = req.query;

      const result = await emergencyService.getPendingOverrides(adminId, filters);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Failed to get pending overrides:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Approve emergency override (Admin only)
   * POST /api/v1/qr/emergency-override/:overrideId/approve
   */
  async approveEmergencyOverride(req, res) {
    try {
      const { overrideId } = req.params;
      const adminId = req.user.id;
      const approvalData = req.body;

      const result = await emergencyService.approveOverride(adminId, overrideId, approvalData);

      logger.info('Emergency override approved:', {
        overrideId,
        adminId,
        validUntil: result.validUntil
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Emergency override approval failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reject emergency override (Admin only)
   * POST /api/v1/qr/emergency-override/:overrideId/reject
   */
  async rejectEmergencyOverride(req, res) {
    try {
      const { overrideId } = req.params;
      const adminId = req.user.id;
      const rejectionData = req.body;

      const result = await emergencyService.rejectOverride(adminId, overrideId, rejectionData);

      logger.info('Emergency override rejected:', {
        overrideId,
        adminId,
        reason: rejectionData.rejectionReason
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Emergency override rejection failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Use emergency override
   * POST /api/v1/qr/emergency-override/:overrideId/use
   */
  async useEmergencyOverride(req, res) {
    try {
      const { overrideId } = req.params;
      const userId = req.user.id;
      const useData = {
        ...req.body,
        deviceInfo: {
          ...req.body.deviceInfo,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      };

      const result = await emergencyService.useOverride(userId, overrideId, useData);

      logger.info('Emergency override used:', {
        overrideId,
        userId,
        deliveryId: result.deliveryId
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Emergency override usage failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 
                        error.message.includes('Invalid') ? 401 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get user's override history
   * GET /api/v1/qr/emergency-override/history
   */
  async getUserOverrideHistory(req, res) {
    try {
      const userId = req.user.id;
      const filters = req.query;

      const result = await emergencyService.getUserOverrideHistory(userId, filters);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Failed to get user override history:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get override details
   * GET /api/v1/qr/emergency-override/:overrideId
   */
  async getOverrideDetails(req, res) {
    try {
      const { overrideId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.userContext?.isAdmin;

      // This would implement the actual service method
      // For now, returning placeholder response
      const override = {
        id: overrideId,
        status: 'pending',
        deliveryId: 'delivery-123',
        reason: 'Device malfunction',
        createdAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      };

      // Check if user has access to this override
      if (!isAdmin && override.requestedBy !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: override
      });

    } catch (error) {
      logger.error('Failed to get override details:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get override statistics (Admin only)
   * GET /api/v1/qr/emergency-override/statistics
   */
  async getOverrideStatistics(req, res) {
    try {
      const { timeframe = '30 days' } = req.query;

      const stats = await emergencyService.getOverrideStatistics(timeframe);

      res.json({
        success: true,
        data: {
          ...stats,
          timeframe,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get override statistics:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get current override status for delivery
   * GET /api/v1/qr/emergency-override/delivery/:deliveryId/status
   */
  async getDeliveryOverrideStatus(req, res) {
    try {
      const { deliveryId } = req.params;
      const userId = req.user.id;

      // This would check if there are any active overrides for the delivery
      // For now, returning placeholder response
      const status = {
        hasActiveOverride: false,
        activeOverrides: [],
        canRequestOverride: true,
        lastOverrideRequest: null
      };

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Failed to get delivery override status:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cancel override request (before approval)
   * POST /api/v1/qr/emergency-override/:overrideId/cancel
   */
  async cancelOverrideRequest(req, res) {
    try {
      const { overrideId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      // This would implement the cancel functionality
      // For now, returning placeholder response
      logger.info('Override request cancelled:', {
        overrideId,
        userId,
        reason
      });

      res.json({
        success: true,
        data: {
          overrideId,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          reason
        }
      });

    } catch (error) {
      logger.error('Failed to cancel override request:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get override approval queue metrics (Admin only)
   * GET /api/v1/qr/emergency-override/queue-metrics
   */
  async getQueueMetrics(req, res) {
    try {
      // This would implement actual queue monitoring
      const metrics = {
        pendingCount: Math.floor(Math.random() * 10 + 2),
        averageWaitTime: `${Math.floor(Math.random() * 30 + 15)} minutes`,
        averageApprovalTime: `${Math.floor(Math.random() * 20 + 10)} minutes`,
        approvalRate: parseFloat((Math.random() * 15 + 80).toFixed(1)),
        urgentRequests: Math.floor(Math.random() * 3 + 1),
        oldestRequest: {
          id: 'override-123',
          waitTime: `${Math.floor(Math.random() * 60 + 30)} minutes`,
          urgencyScore: Math.floor(Math.random() * 40 + 60)
        }
      };

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Failed to get queue metrics:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk approve overrides (Admin only)
   * POST /api/v1/qr/emergency-override/bulk-approve
   */
  async bulkApproveOverrides(req, res) {
    try {
      const { overrideIds, approvalData } = req.body;
      const adminId = req.user.id;

      if (!overrideIds || !Array.isArray(overrideIds) || overrideIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Override IDs array is required'
        });
      }

      // This would implement bulk approval
      const results = {
        successful: overrideIds.length,
        failed: 0,
        overrides: overrideIds.map(id => ({
          overrideId: id,
          status: 'approved',
          approvedAt: new Date().toISOString()
        }))
      };

      logger.info('Bulk override approval:', {
        adminId,
        count: overrideIds.length,
        successful: results.successful
      });

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      logger.error('Bulk override approval failed:', error);
      
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new EmergencyController();