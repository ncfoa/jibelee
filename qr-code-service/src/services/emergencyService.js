const moment = require('moment');
const { EmergencyOverride, QRCode } = require('../models');
const encryptionService = require('./encryptionService');
const { CryptoUtils, GeoUtils } = require('../utils');
const logger = require('../config/logger');

class EmergencyService {
  constructor() {
    this.defaultValidityHours = parseInt(process.env.EMERGENCY_OVERRIDE_EXPIRY_HOURS) || 2;
    this.maxValidityHours = 24; // Maximum 24 hours
    this.maxActiveOverrides = 3; // Maximum active overrides per user
  }

  /**
   * Request emergency override
   */
  async requestOverride(userId, overrideData) {
    try {
      const {
        deliveryId,
        qrCodeId,
        reason,
        description,
        alternativeVerification = {},
        contactPhone,
        location
      } = overrideData;

      // Validate input
      this.validateOverrideRequest(overrideData);

      // Check if user has too many active overrides
      const activeOverrides = await EmergencyOverride.count({
        where: {
          requestedBy: userId,
          status: {
            [require('sequelize').Op.in]: ['pending', 'approved']
          },
          validUntil: {
            [require('sequelize').Op.gt]: new Date()
          }
        }
      });

      if (activeOverrides >= this.maxActiveOverrides) {
        throw new Error(`Maximum ${this.maxActiveOverrides} active emergency overrides allowed per user`);
      }

      // Validate delivery and QR code if provided
      if (qrCodeId) {
        const qrCode = await QRCode.findByPk(qrCodeId);
        if (!qrCode || qrCode.deliveryId !== deliveryId) {
          throw new Error('Invalid QR code or delivery mismatch');
        }
      }

      // Generate alternative code
      const alternativeCode = this.generateAlternativeCode();
      const alternativeCodeHash = await encryptionService.hashBackupCode(alternativeCode);

      // Set validity period
      const validUntil = moment().add(this.defaultValidityHours, 'hours').toDate();

      // Create override request
      const override = await EmergencyOverride.create({
        deliveryId,
        qrCodeId,
        overrideReason: reason,
        description,
        alternativeVerification,
        requestedBy: userId,
        alternativeCodeHash,
        validUntil,
        status: 'pending'
      });

      // Log the request
      await this.logOverrideEvent('requested', override.id, {
        userId,
        deliveryId,
        qrCodeId,
        reason,
        location
      });

      // Send notifications to admins
      await this.notifyAdminsOfRequest(override, alternativeCode);

      // Send confirmation to user
      await this.sendUserConfirmation(userId, override, alternativeCode, contactPhone);

      logger.info('Emergency override requested:', {
        overrideId: override.id,
        userId,
        deliveryId,
        reason
      });

      return {
        overrideId: override.id,
        alternativeCode, // Return only once for security
        validUntil: override.validUntil,
        status: 'pending_approval',
        estimatedApprovalTime: '15-30 minutes',
        supportContact: process.env.SUPPORT_CONTACT || 'support@p2pdelivery.com'
      };

    } catch (error) {
      logger.error('Emergency override request failed:', error);
      throw error;
    }
  }

  /**
   * Approve emergency override (admin action)
   */
  async approveOverride(adminId, overrideId, approvalData) {
    try {
      const {
        approvalNotes,
        validityHours = this.defaultValidityHours,
        additionalRestrictions = {}
      } = approvalData;

      // Find override request
      const override = await EmergencyOverride.findByPk(overrideId);
      if (!override) {
        throw new Error('Emergency override not found');
      }

      // Validate override can be approved
      if (override.status !== 'pending') {
        throw new Error(`Cannot approve override with status: ${override.status}`);
      }

      if (override.validUntil < new Date()) {
        throw new Error('Override request has expired');
      }

      // Validate validity hours
      if (validityHours > this.maxValidityHours) {
        throw new Error(`Validity cannot exceed ${this.maxValidityHours} hours`);
      }

      // Update override with approval
      const newValidUntil = moment().add(validityHours, 'hours').toDate();
      
      await override.update({
        status: 'approved',
        approvedBy: adminId,
        approvedAt: new Date(),
        approvalNotes,
        validUntil: newValidUntil,
        additionalRestrictions
      });

      // Log the approval
      await this.logOverrideEvent('approved', overrideId, {
        adminId,
        approvalNotes,
        validityHours,
        additionalRestrictions
      });

      // Notify requester of approval
      await this.notifyUserOfApproval(override.requestedBy, override);

      // Send approval to relevant parties
      await this.sendApprovalNotifications(override);

      logger.info('Emergency override approved:', {
        overrideId,
        adminId,
        validUntil: newValidUntil
      });

      return {
        overrideId,
        status: 'approved',
        validUntil: newValidUntil,
        approvedBy: adminId,
        approvedAt: override.approvedAt,
        additionalRestrictions
      };

    } catch (error) {
      logger.error('Emergency override approval failed:', error);
      throw error;
    }
  }

  /**
   * Reject emergency override (admin action)
   */
  async rejectOverride(adminId, overrideId, rejectionData) {
    try {
      const { rejectionReason, notifyUser = true } = rejectionData;

      // Find override request
      const override = await EmergencyOverride.findByPk(overrideId);
      if (!override) {
        throw new Error('Emergency override not found');
      }

      // Validate override can be rejected
      if (override.status !== 'pending') {
        throw new Error(`Cannot reject override with status: ${override.status}`);
      }

      // Update override with rejection
      await override.update({
        status: 'rejected',
        approvedBy: adminId, // Reusing field for rejected by
        rejectedAt: new Date(),
        approvalNotes: rejectionReason // Reusing field for rejection reason
      });

      // Log the rejection
      await this.logOverrideEvent('rejected', overrideId, {
        adminId,
        rejectionReason
      });

      // Notify requester of rejection
      if (notifyUser) {
        await this.notifyUserOfRejection(override.requestedBy, override, rejectionReason);
      }

      logger.info('Emergency override rejected:', {
        overrideId,
        adminId,
        rejectionReason
      });

      return {
        overrideId,
        status: 'rejected',
        rejectedBy: adminId,
        rejectedAt: override.rejectedAt,
        rejectionReason
      };

    } catch (error) {
      logger.error('Emergency override rejection failed:', error);
      throw error;
    }
  }

  /**
   * Use emergency override
   */
  async useOverride(userId, overrideId, useData) {
    try {
      const {
        alternativeCode,
        location,
        verificationEvidence = {},
        deviceInfo = {}
      } = useData;

      // Find override
      const override = await EmergencyOverride.findByPk(overrideId);
      if (!override) {
        throw new Error('Emergency override not found');
      }

      // Validate override can be used
      if (!override.canBeUsed()) {
        throw new Error(`Override cannot be used. Status: ${override.status}, Expired: ${override.isExpired()}`);
      }

      // Validate alternative code
      const isValidCode = await encryptionService.verifyBackupCode(alternativeCode, override.alternativeCodeHash);
      if (!isValidCode) {
        // Log failed attempt
        await this.logOverrideEvent('use_failed', overrideId, {
          userId,
          reason: 'Invalid alternative code',
          location,
          deviceInfo
        });
        throw new Error('Invalid alternative code');
      }

      // Validate user authorization
      if (userId !== override.requestedBy) {
        // Allow traveler to use override for delivery
        // This would need integration with delivery service to verify user role
        logger.info('Different user attempting to use override:', {
          overrideId,
          requestedBy: override.requestedBy,
          userId
        });
      }

      // Check additional restrictions
      if (override.additionalRestrictions) {
        const restrictionCheck = this.validateAdditionalRestrictions(override.additionalRestrictions, {
          userId,
          location,
          verificationEvidence,
          deviceInfo
        });
        
        if (!restrictionCheck.valid) {
          await this.logOverrideEvent('use_failed', overrideId, {
            userId,
            reason: restrictionCheck.reason,
            location,
            deviceInfo
          });
          throw new Error(restrictionCheck.reason);
        }
      }

      // Mark override as used
      await override.use(userId, location, verificationEvidence);

      // Update delivery status based on QR type
      if (override.qrCodeId) {
        const qrCode = await QRCode.findByPk(override.qrCodeId);
        if (qrCode) {
          await this.updateDeliveryStatusForOverride(qrCode.deliveryId, qrCode.qrType, userId);
        }
      }

      // Log successful usage
      await this.logOverrideEvent('used', overrideId, {
        userId,
        location,
        verificationEvidence: Object.keys(verificationEvidence),
        deviceInfo
      });

      // Send completion notifications
      await this.sendUsageNotifications(override, userId);

      logger.info('Emergency override used successfully:', {
        overrideId,
        userId,
        deliveryId: override.deliveryId
      });

      return {
        overrideId,
        status: 'used',
        deliveryId: override.deliveryId,
        usedAt: override.usedAt,
        message: 'Emergency override successfully used',
        nextSteps: await this.getNextStepsAfterOverride(override)
      };

    } catch (error) {
      logger.error('Emergency override usage failed:', error);
      throw error;
    }
  }

  /**
   * Get pending override requests for admin approval
   */
  async getPendingOverrides(adminId, filters = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        deliveryId,
        urgency,
        sortBy = 'created_at',
        sortOrder = 'ASC'
      } = filters;

      const whereClause = {
        status: 'pending',
        validUntil: {
          [require('sequelize').Op.gt]: new Date()
        }
      };

      if (deliveryId) {
        whereClause.deliveryId = deliveryId;
      }

      const overrides = await EmergencyOverride.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: QRCode,
            as: 'qrCode',
            attributes: ['id', 'qrType', 'securityLevel']
          }
        ]
      });

      // Calculate urgency scores
      const enrichedOverrides = overrides.rows.map(override => ({
        ...override.toJSON(),
        urgencyScore: this.calculateUrgencyScore(override),
        timeRemaining: override.getRemainingTimeFormatted()
      }));

      return {
        overrides: enrichedOverrides,
        total: overrides.count,
        pending: overrides.count
      };

    } catch (error) {
      logger.error('Failed to get pending overrides:', error);
      throw error;
    }
  }

  /**
   * Get override history for a user
   */
  async getUserOverrideHistory(userId, filters = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        status,
        dateFrom,
        dateTo
      } = filters;

      const whereClause = { requestedBy: userId };

      if (status) {
        whereClause.status = status;
      }

      if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) whereClause.createdAt[require('sequelize').Op.gte] = new Date(dateFrom);
        if (dateTo) whereClause.createdAt[require('sequelize').Op.lte] = new Date(dateTo);
      }

      const overrides = await EmergencyOverride.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return {
        overrides: overrides.rows.map(override => ({
          id: override.id,
          deliveryId: override.deliveryId,
          status: override.status,
          reason: override.overrideReason,
          createdAt: override.createdAt,
          validUntil: override.validUntil,
          usedAt: override.usedAt,
          approvedAt: override.approvedAt
        })),
        total: overrides.count
      };

    } catch (error) {
      logger.error('Failed to get user override history:', error);
      throw error;
    }
  }

  /**
   * Get override statistics
   */
  async getOverrideStatistics(timeframe = '30 days') {
    try {
      const stats = await EmergencyOverride.getStatistics(timeframe);
      
      // Add additional calculated metrics
      const approvalRate = stats.total_requests > 0 
        ? (stats.approved_requests / stats.total_requests) * 100 
        : 0;
        
      const usageRate = stats.approved_requests > 0 
        ? (stats.used_overrides / stats.approved_requests) * 100 
        : 0;

      return {
        ...stats,
        approval_rate: Math.round(approvalRate * 100) / 100,
        usage_rate: Math.round(usageRate * 100) / 100,
        avg_approval_time_formatted: this.formatHours(stats.avg_approval_time_hours)
      };

    } catch (error) {
      logger.error('Failed to get override statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up expired overrides
   */
  async cleanupExpiredOverrides() {
    try {
      const expiredCount = await EmergencyOverride.expireOldOverrides();
      logger.info(`Expired ${expiredCount} old emergency overrides`);
      return expiredCount;
    } catch (error) {
      logger.error('Failed to cleanup expired overrides:', error);
      throw error;
    }
  }

  /**
   * Generate alternative code
   */
  generateAlternativeCode() {
    const codeLength = parseInt(process.env.EMERGENCY_CODE_LENGTH) || 12;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'EMRG-';
    
    for (let i = 0; i < codeLength; i++) {
      if (i > 0 && i % 3 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
  }

  /**
   * Validate override request
   */
  validateOverrideRequest(overrideData) {
    const { deliveryId, reason, description } = overrideData;

    if (!deliveryId) {
      throw new Error('Delivery ID is required');
    }

    if (!reason || reason.trim().length < 10) {
      throw new Error('Detailed reason is required (minimum 10 characters)');
    }

    if (description && description.length > 1000) {
      throw new Error('Description too long (maximum 1000 characters)');
    }
  }

  /**
   * Validate additional restrictions
   */
  validateAdditionalRestrictions(restrictions, context) {
    const { userId, location, verificationEvidence, deviceInfo } = context;

    // Check if admin presence is required
    if (restrictions.requiresAdminPresence) {
      return { valid: false, reason: 'Admin presence required for this override' };
    }

    // Check if photo is required
    if (restrictions.photoRequired && !verificationEvidence.photo) {
      return { valid: false, reason: 'Photo verification required' };
    }

    // Check location restrictions
    if (restrictions.locationRestricted && location) {
      // Would implement location-based restrictions
    }

    // Check time restrictions
    if (restrictions.timeRestricted) {
      const currentHour = new Date().getHours();
      if (currentHour < 8 || currentHour > 20) {
        return { valid: false, reason: 'Override can only be used during business hours (8 AM - 8 PM)' };
      }
    }

    return { valid: true };
  }

  /**
   * Calculate urgency score for override request
   */
  calculateUrgencyScore(override) {
    let score = 0;

    // Time-based urgency
    const timeRemaining = override.getRemainingTime();
    const totalTime = override.validUntil.getTime() - override.createdAt.getTime();
    const timeElapsed = totalTime - timeRemaining;
    const timeRatio = timeElapsed / totalTime;
    score += timeRatio * 40; // Up to 40 points for time urgency

    // Reason-based urgency
    const urgentReasons = [
      'medical emergency',
      'safety concern',
      'security issue',
      'device failure',
      'technical malfunction'
    ];
    
    if (urgentReasons.some(reason => override.overrideReason.toLowerCase().includes(reason))) {
      score += 30;
    }

    // QR code security level
    if (override.qrCode?.securityLevel === 'maximum') {
      score += 20;
    } else if (override.qrCode?.securityLevel === 'high') {
      score += 10;
    }

    // Alternative verification complexity
    if (override.alternativeVerification) {
      const verificationCount = Object.keys(override.alternativeVerification).length;
      score += Math.min(verificationCount * 5, 20);
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Update delivery status for override usage
   */
  async updateDeliveryStatusForOverride(deliveryId, qrType, userId) {
    try {
      // This would integrate with delivery service
      logger.info('Updating delivery status for emergency override:', {
        deliveryId,
        qrType,
        userId,
        method: 'emergency_override'
      });

      // Placeholder for delivery service integration
      // await deliveryService.updateStatus(deliveryId, newStatus, { method: 'emergency_override' });

    } catch (error) {
      logger.error('Failed to update delivery status for override:', error);
    }
  }

  /**
   * Get next steps after override usage
   */
  async getNextStepsAfterOverride(override) {
    const steps = [];

    if (override.qrCode?.qrType === 'pickup') {
      steps.push('Proceed with item pickup');
      steps.push('Take photos of the item for verification');
      steps.push('Continue to delivery destination');
    } else if (override.qrCode?.qrType === 'delivery') {
      steps.push('Complete delivery to recipient');
      steps.push('Obtain delivery confirmation');
      steps.push('Upload delivery evidence');
    }

    steps.push('Contact support if any issues arise');

    return steps;
  }

  /**
   * Notification methods (placeholders for integration)
   */
  async notifyAdminsOfRequest(override, alternativeCode) {
    try {
      logger.info('Notifying admins of emergency override request:', {
        overrideId: override.id,
        deliveryId: override.deliveryId,
        urgency: this.calculateUrgencyScore(override)
      });
      // Integration with notification service
    } catch (error) {
      logger.error('Failed to notify admins:', error);
    }
  }

  async sendUserConfirmation(userId, override, alternativeCode, contactPhone) {
    try {
      logger.info('Sending user confirmation:', {
        userId,
        overrideId: override.id,
        contactPhone
      });
      // Integration with notification service
    } catch (error) {
      logger.error('Failed to send user confirmation:', error);
    }
  }

  async notifyUserOfApproval(userId, override) {
    try {
      logger.info('Notifying user of approval:', {
        userId,
        overrideId: override.id
      });
      // Integration with notification service
    } catch (error) {
      logger.error('Failed to notify user of approval:', error);
    }
  }

  async notifyUserOfRejection(userId, override, reason) {
    try {
      logger.info('Notifying user of rejection:', {
        userId,
        overrideId: override.id,
        reason
      });
      // Integration with notification service
    } catch (error) {
      logger.error('Failed to notify user of rejection:', error);
    }
  }

  async sendApprovalNotifications(override) {
    try {
      logger.info('Sending approval notifications:', {
        overrideId: override.id,
        deliveryId: override.deliveryId
      });
      // Integration with notification service
    } catch (error) {
      logger.error('Failed to send approval notifications:', error);
    }
  }

  async sendUsageNotifications(override, userId) {
    try {
      logger.info('Sending usage notifications:', {
        overrideId: override.id,
        userId,
        deliveryId: override.deliveryId
      });
      // Integration with notification service
    } catch (error) {
      logger.error('Failed to send usage notifications:', error);
    }
  }

  /**
   * Log override events
   */
  async logOverrideEvent(eventType, overrideId, details) {
    try {
      logger.info(`Emergency Override Event: ${eventType}`, {
        overrideId,
        eventType,
        ...details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('Failed to log override event:', error);
    }
  }

  /**
   * Format hours for display
   */
  formatHours(hours) {
    if (!hours) return 'N/A';
    
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${Math.round(hours * 10) / 10} hours`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days} day${days > 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
  }
}

module.exports = new EmergencyService();