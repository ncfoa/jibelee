const verificationService = require('../services/verificationService');
const { logger } = require('../config/logger');

class VerificationController {
  constructor() {
    this.logger = logger;
  }

  // Upload identity verification documents
  uploadVerificationDocument = async (req, res) => {
    try {
      const userId = req.user.id;
      const { documentType } = req.body;
      const files = req.files;

      if (!documentType) {
        return res.status(400).json({
          success: false,
          message: 'Document type is required',
          errors: ['documentType field is required']
        });
      }

      // Extract files from multer
      const documentData = {
        documentType,
        frontImage: files?.frontImage?.[0],
        backImage: files?.backImage?.[0],
        selfieImage: files?.selfieImage?.[0],
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          deviceInfo: req.get('X-Device-Info')
        }
      };

      const result = await verificationService.uploadVerificationDocument(
        userId, 
        documentData, 
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Verification documents uploaded successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error uploading verification document', {
        userId: req.user?.id,
        documentType: req.body?.documentType,
        error: error.message,
        filesReceived: req.files ? Object.keys(req.files) : []
      });

      if (error.message.includes('requires') || error.message.includes('Invalid document type')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      if (error.message.includes('already have')) {
        return res.status(409).json({
          success: false,
          message: 'Document already exists',
          errors: [error.message]
        });
      }

      if (error.message.includes('Image processing') || error.message.includes('upload')) {
        return res.status(400).json({
          success: false,
          message: 'File processing failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to upload verification documents',
        errors: [error.message]
      });
    }
  };

  // Get verification status
  getVerificationStatus = async (req, res) => {
    try {
      const userId = req.user.id;
      const status = await verificationService.getVerificationStatus(userId, userId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      this.logger.error('Error getting verification status', {
        userId: req.user?.id,
        error: error.message
      });

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          errors: ['User not found']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve verification status',
        errors: [error.message]
      });
    }
  };

  // Resubmit verification document
  resubmitVerification = async (req, res) => {
    try {
      const userId = req.user.id;
      const { documentType } = req.body;
      const files = req.files;

      if (!documentType) {
        return res.status(400).json({
          success: false,
          message: 'Document type is required',
          errors: ['documentType field is required']
        });
      }

      // Extract files from multer
      const documentData = {
        frontImage: files?.frontImage?.[0],
        backImage: files?.backImage?.[0],
        selfieImage: files?.selfieImage?.[0],
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          deviceInfo: req.get('X-Device-Info'),
          resubmission: true
        }
      };

      const result = await verificationService.resubmitVerification(
        userId, 
        documentType, 
        documentData, 
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Verification documents resubmitted successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error resubmitting verification', {
        userId: req.user?.id,
        documentType: req.body?.documentType,
        error: error.message
      });

      if (error.message.includes('cannot be resubmitted')) {
        return res.status(400).json({
          success: false,
          message: 'Resubmission not allowed',
          errors: [error.message]
        });
      }

      if (error.message.includes('requires') || error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to resubmit verification',
        errors: [error.message]
      });
    }
  };

  // Verify phone number (initiate)
  verifyPhoneNumber = async (req, res) => {
    try {
      const userId = req.user.id;
      const { phoneNumber } = req.body;

      // TODO: Implement phone verification service
      // This should:
      // 1. Generate verification code
      // 2. Send SMS
      // 3. Store verification attempt
      
      this.logger.info('Phone verification initiated', {
        userId,
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*') // Mask phone number
      });

      // For now, return mock response
      const result = {
        verificationId: `phone_verify_${Date.now()}`,
        method: 'sms',
        expiresIn: 300, // 5 minutes
        message: 'Verification code sent to your phone'
      };

      res.json({
        success: true,
        message: 'Verification code sent',
        data: result
      });
    } catch (error) {
      this.logger.error('Error initiating phone verification', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to send verification code',
        errors: [error.message]
      });
    }
  };

  // Confirm phone number verification
  confirmPhoneVerification = async (req, res) => {
    try {
      const userId = req.user.id;
      const { verificationId, code } = req.body;

      // TODO: Implement phone verification confirmation
      // This should:
      // 1. Validate verification ID
      // 2. Check code
      // 3. Update user verification status
      
      this.logger.info('Phone verification confirmed', {
        userId,
        verificationId,
        code: code.replace(/./g, '*') // Mask code
      });

      // For now, return mock success
      const result = {
        verified: true,
        phoneNumber: req.user.phoneNumber,
        verifiedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'Phone number verified successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error confirming phone verification', {
        userId: req.user?.id,
        verificationId: req.body?.verificationId,
        error: error.message
      });

      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        return res.status(400).json({
          success: false,
          message: 'Verification failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to verify phone number',
        errors: [error.message]
      });
    }
  };

  // Admin: Approve verification document
  approveVerification = async (req, res) => {
    try {
      const { verificationId } = req.params;
      const { notes } = req.body;
      const adminId = req.user.id;

      const result = await verificationService.approveVerification(
        verificationId, 
        adminId, 
        notes
      );

      res.json({
        success: true,
        message: 'Verification approved successfully',
        data: {
          id: result.id,
          status: result.status,
          verifiedAt: result.verifiedAt,
          verifiedBy: result.verifiedBy
        }
      });
    } catch (error) {
      this.logger.error('Error approving verification', {
        verificationId: req.params.verificationId,
        adminId: req.user?.id,
        error: error.message
      });

      if (error.message === 'Verification document not found') {
        return res.status(404).json({
          success: false,
          message: 'Verification not found',
          errors: ['The requested verification document could not be found']
        });
      }

      if (error.message.includes('already approved')) {
        return res.status(400).json({
          success: false,
          message: 'Already approved',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to approve verification',
        errors: [error.message]
      });
    }
  };

  // Admin: Reject verification document
  rejectVerification = async (req, res) => {
    try {
      const { verificationId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
          errors: ['Reason field is required for rejection']
        });
      }

      const result = await verificationService.rejectVerification(
        verificationId, 
        adminId, 
        reason.trim()
      );

      res.json({
        success: true,
        message: 'Verification rejected successfully',
        data: {
          id: result.id,
          status: result.status,
          rejectionReason: result.rejectionReason,
          verifiedBy: result.verifiedBy
        }
      });
    } catch (error) {
      this.logger.error('Error rejecting verification', {
        verificationId: req.params.verificationId,
        adminId: req.user?.id,
        error: error.message
      });

      if (error.message === 'Verification document not found') {
        return res.status(404).json({
          success: false,
          message: 'Verification not found',
          errors: ['The requested verification document could not be found']
        });
      }

      if (error.message.includes('already rejected')) {
        return res.status(400).json({
          success: false,
          message: 'Already rejected',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to reject verification',
        errors: [error.message]
      });
    }
  };

  // Admin: Get pending verifications
  getPendingVerifications = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const page = parseInt(req.query.page) || 1;
      const offset = (page - 1) * limit;

      // TODO: Implement pagination in service
      const { UserVerificationDocument } = require('../models');
      
      const { count, rows: verifications } = await UserVerificationDocument.findAndCountAll({
        where: {
          status: ['pending', 'under_review']
        },
        include: [{
          model: require('../models').User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }],
        order: [['createdAt', 'ASC']],
        limit,
        offset
      });

      const formattedVerifications = verifications.map(doc => ({
        id: doc.id,
        documentType: doc.documentType,
        status: doc.status,
        submissionCount: doc.submissionCount,
        confidenceScore: doc.confidenceScore,
        createdAt: doc.createdAt,
        processingDuration: doc.getProcessingDuration(),
        user: doc.User ? {
          id: doc.User.id,
          firstName: doc.User.firstName,
          lastName: doc.User.lastName,
          email: doc.User.email
        } : null
      }));

      res.json({
        success: true,
        data: formattedVerifications,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      this.logger.error('Error getting pending verifications', {
        adminId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve pending verifications',
        errors: [error.message]
      });
    }
  };

  // Admin: Get verification statistics
  getVerificationStatistics = async (req, res) => {
    try {
      const { UserVerificationDocument } = require('../models');
      
      const stats = await UserVerificationDocument.getVerificationStats();
      
      const formattedStats = {
        total: 0,
        byStatus: {},
        byDocumentType: {}
      };

      stats.forEach(stat => {
        const count = parseInt(stat.count);
        formattedStats.total += count;
        formattedStats.byStatus[stat.status] = count;
      });

      // Get document type breakdown
      const typeStats = await UserVerificationDocument.findAll({
        attributes: [
          'document_type',
          [UserVerificationDocument.sequelize.fn('COUNT', UserVerificationDocument.sequelize.col('id')), 'count']
        ],
        group: ['document_type'],
        raw: true
      });

      typeStats.forEach(stat => {
        formattedStats.byDocumentType[stat.document_type] = parseInt(stat.count);
      });

      res.json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      this.logger.error('Error getting verification statistics', {
        adminId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve verification statistics',
        errors: [error.message]
      });
    }
  };
}

module.exports = new VerificationController();