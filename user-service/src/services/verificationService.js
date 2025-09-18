const { User, UserVerificationDocument } = require('../models');
const { fileUploadService } = require('../config/storage');
const imageProcessingService = require('./imageProcessingService');
const { logger } = require('../config/logger');
const { cacheService } = require('../config/redis');

class VerificationService {
  constructor() {
    this.logger = logger;
    this.cacheService = cacheService;
  }

  // Upload verification documents
  async uploadVerificationDocument(userId, documentData, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to upload verification documents for this user');
      }

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate document data
      this.validateDocumentData(documentData);

      // Check if user already has a pending/approved document of this type
      const existingDocument = await UserVerificationDocument.findLatestByUserAndType(
        userId, 
        documentData.documentType
      );

      if (existingDocument && ['pending', 'under_review', 'approved'].includes(existingDocument.status)) {
        if (existingDocument.status === 'approved' && !existingDocument.isExpired()) {
          throw new Error('You already have an approved document of this type');
        }
        if (['pending', 'under_review'].includes(existingDocument.status)) {
          throw new Error('You already have a pending verification of this type');
        }
      }

      // Process and upload images
      const imageUrls = await this.processAndUploadDocumentImages(userId, documentData);

      // Create verification document record
      const verificationDocument = await UserVerificationDocument.create({
        userId,
        documentType: documentData.documentType,
        frontImageUrl: imageUrls.front,
        backImageUrl: imageUrls.back,
        selfieImageUrl: imageUrls.selfie,
        status: 'pending',
        submissionCount: existingDocument ? existingDocument.submissionCount + 1 : 1,
        metadata: {
          submittedAt: new Date().toISOString(),
          ipAddress: documentData.metadata?.ipAddress,
          userAgent: documentData.metadata?.userAgent,
          deviceInfo: documentData.metadata?.deviceInfo
        }
      });

      // Trigger AI verification process
      await this.triggerAIVerification(verificationDocument.id);

      // Invalidate cache
      await this.invalidateVerificationCache(userId);

      this.logger.info('Verification document uploaded successfully', {
        userId,
        documentId: verificationDocument.id,
        documentType: documentData.documentType,
        submissionCount: verificationDocument.submissionCount
      });

      return {
        id: verificationDocument.id,
        documentType: verificationDocument.documentType,
        status: verificationDocument.status,
        submissionCount: verificationDocument.submissionCount,
        estimatedProcessingTime: '24-48 hours',
        createdAt: verificationDocument.createdAt
      };
    } catch (error) {
      this.logger.error('Error uploading verification document', {
        userId,
        documentType: documentData?.documentType,
        error: error.message
      });
      throw error;
    }
  }

  // Get verification status
  async getVerificationStatus(userId, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to view verification status for this user');
      }

      // Check cache first
      const cacheKey = `user:verification:${userId}`;
      const cachedStatus = await this.cacheService.get(cacheKey);
      
      if (cachedStatus) {
        this.logger.debug('Verification status retrieved from cache', { userId });
        return cachedStatus;
      }

      // Get user with verification documents
      const user = await User.findByPk(userId, {
        include: [{
          model: UserVerificationDocument,
          as: 'VerificationDocuments',
          order: [['createdAt', 'DESC']]
        }]
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Build verification status
      const status = {
        userId,
        overallStatus: user.verificationLevel,
        documents: {},
        summary: {
          totalDocuments: 0,
          approvedDocuments: 0,
          pendingDocuments: 0,
          rejectedDocuments: 0,
          expiredDocuments: 0
        }
      };

      // Process each document type
      const documentTypes = ['passport', 'driving_license', 'national_id', 'utility_bill', 'bank_statement'];
      
      for (const docType of documentTypes) {
        const docs = user.VerificationDocuments.filter(doc => doc.documentType === docType);
        const latestDoc = docs[0]; // Most recent

        if (latestDoc) {
          status.documents[docType] = {
            id: latestDoc.id,
            status: latestDoc.status,
            submissionCount: latestDoc.submissionCount,
            confidenceScore: latestDoc.confidenceScore,
            isExpired: latestDoc.isExpired(),
            createdAt: latestDoc.createdAt,
            verifiedAt: latestDoc.verifiedAt,
            expiresAt: latestDoc.expiresAt,
            rejectionReason: latestDoc.rejectionReason,
            processingDuration: latestDoc.getProcessingDuration()
          };

          // Update summary
          status.summary.totalDocuments++;
          if (latestDoc.status === 'approved' && !latestDoc.isExpired()) {
            status.summary.approvedDocuments++;
          } else if (['pending', 'under_review'].includes(latestDoc.status)) {
            status.summary.pendingDocuments++;
          } else if (latestDoc.status === 'rejected') {
            status.summary.rejectedDocuments++;
          } else if (latestDoc.isExpired()) {
            status.summary.expiredDocuments++;
          }
        } else {
          status.documents[docType] = {
            status: 'not_submitted'
          };
        }
      }

      // Calculate overall completion percentage
      status.summary.completionPercentage = status.summary.totalDocuments > 0 
        ? Math.round((status.summary.approvedDocuments / status.summary.totalDocuments) * 100)
        : 0;

      // Cache the result
      await this.cacheService.set(cacheKey, status, 300); // 5 minutes

      this.logger.info('Verification status retrieved successfully', {
        userId,
        overallStatus: status.overallStatus,
        completionPercentage: status.summary.completionPercentage
      });

      return status;
    } catch (error) {
      this.logger.error('Error retrieving verification status', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Resubmit verification document
  async resubmitVerification(userId, documentType, documentData, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to resubmit verification for this user');
      }

      // Get latest document of this type
      const existingDocument = await UserVerificationDocument.findLatestByUserAndType(
        userId, 
        documentType
      );

      if (!existingDocument || !existingDocument.canBeResubmitted()) {
        throw new Error('Document cannot be resubmitted at this time');
      }

      // Upload new verification document
      const newDocumentData = {
        ...documentData,
        documentType
      };

      return await this.uploadVerificationDocument(userId, newDocumentData, requesterId);
    } catch (error) {
      this.logger.error('Error resubmitting verification document', {
        userId,
        documentType,
        error: error.message
      });
      throw error;
    }
  }

  // Process AI verification result (called by AI service)
  async processAIVerificationResult(verificationId, aiResults) {
    try {
      const document = await UserVerificationDocument.findByPk(verificationId);
      if (!document) {
        throw new Error('Verification document not found');
      }

      // Update document with AI results
      document.updateAIResults(aiResults);

      // Determine status based on confidence score
      let newStatus = 'under_review'; // Default to manual review
      
      if (aiResults.confidenceScore >= 0.9) {
        // High confidence - auto-approve
        newStatus = 'approved';
        document.approve(null, 'Auto-approved based on AI verification');
      } else if (aiResults.confidenceScore < 0.3) {
        // Very low confidence - auto-reject
        newStatus = 'rejected';
        document.reject(null, 'Rejected due to low AI confidence score');
      }

      document.status = newStatus;
      await document.save();

      // Update user verification level if approved
      if (newStatus === 'approved') {
        await this.updateUserVerificationLevel(document.userId);
      }

      // Invalidate cache
      await this.invalidateVerificationCache(document.userId);

      this.logger.info('AI verification result processed', {
        verificationId,
        userId: document.userId,
        documentType: document.documentType,
        confidenceScore: aiResults.confidenceScore,
        newStatus
      });

      return document;
    } catch (error) {
      this.logger.error('Error processing AI verification result', {
        verificationId,
        error: error.message
      });
      throw error;
    }
  }

  // Manual verification approval (admin function)
  async approveVerification(verificationId, adminId, notes = null) {
    try {
      const document = await UserVerificationDocument.findByPk(verificationId);
      if (!document) {
        throw new Error('Verification document not found');
      }

      if (document.status === 'approved') {
        throw new Error('Document is already approved');
      }

      // Approve document
      document.approve(adminId, notes);
      await document.save();

      // Update user verification level
      await this.updateUserVerificationLevel(document.userId);

      // Invalidate cache
      await this.invalidateVerificationCache(document.userId);

      this.logger.info('Verification manually approved', {
        verificationId,
        userId: document.userId,
        documentType: document.documentType,
        adminId,
        notes
      });

      return document;
    } catch (error) {
      this.logger.error('Error approving verification', {
        verificationId,
        adminId,
        error: error.message
      });
      throw error;
    }
  }

  // Manual verification rejection (admin function)
  async rejectVerification(verificationId, adminId, reason) {
    try {
      const document = await UserVerificationDocument.findByPk(verificationId);
      if (!document) {
        throw new Error('Verification document not found');
      }

      if (document.status === 'rejected') {
        throw new Error('Document is already rejected');
      }

      // Reject document
      document.reject(adminId, reason);
      await document.save();

      // Invalidate cache
      await this.invalidateVerificationCache(document.userId);

      this.logger.info('Verification manually rejected', {
        verificationId,
        userId: document.userId,
        documentType: document.documentType,
        adminId,
        reason
      });

      return document;
    } catch (error) {
      this.logger.error('Error rejecting verification', {
        verificationId,
        adminId,
        error: error.message
      });
      throw error;
    }
  }

  // Process and upload document images
  async processAndUploadDocumentImages(userId, documentData) {
    const imageUrls = {};

    try {
      // Process front image
      if (documentData.frontImage) {
        const processedFront = await imageProcessingService.processVerificationDocument(
          documentData.frontImage.buffer
        );
        
        const frontUpload = await fileUploadService.uploadSecureDocument(
          processedFront,
          `verification/${userId}/front`,
          documentData.frontImage.originalname
        );
        
        imageUrls.front = frontUpload.url;
      }

      // Process back image (if provided)
      if (documentData.backImage) {
        const processedBack = await imageProcessingService.processVerificationDocument(
          documentData.backImage.buffer
        );
        
        const backUpload = await fileUploadService.uploadSecureDocument(
          processedBack,
          `verification/${userId}/back`,
          documentData.backImage.originalname
        );
        
        imageUrls.back = backUpload.url;
      }

      // Process selfie image
      if (documentData.selfieImage) {
        const processedSelfie = await imageProcessingService.processVerificationDocument(
          documentData.selfieImage.buffer,
          { maxWidth: 800, quality: 85 }
        );
        
        const selfieUpload = await fileUploadService.uploadSecureDocument(
          processedSelfie,
          `verification/${userId}/selfie`,
          documentData.selfieImage.originalname
        );
        
        imageUrls.selfie = selfieUpload.url;
      }

      return imageUrls;
    } catch (error) {
      // Clean up any uploaded images if there was an error
      for (const url of Object.values(imageUrls)) {
        if (url) {
          const key = this.extractKeyFromUrl(url);
          if (key) {
            await fileUploadService.deleteFile(key, true);
          }
        }
      }
      
      throw new Error(`Image processing/upload failed: ${error.message}`);
    }
  }

  // Trigger AI verification process
  async triggerAIVerification(verificationId) {
    try {
      // This would typically queue a job for AI processing
      // For now, we'll just log it
      this.logger.info('AI verification queued', { verificationId });
      
      // TODO: Implement actual AI service integration
      // await aiVerificationQueue.add('verifyDocument', { verificationId });
      
      return true;
    } catch (error) {
      this.logger.error('Error triggering AI verification', {
        verificationId,
        error: error.message
      });
      return false;
    }
  }

  // Update user verification level based on approved documents
  async updateUserVerificationLevel(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [{
          model: UserVerificationDocument,
          as: 'VerificationDocuments',
          where: { status: 'approved' },
          required: false
        }]
      });

      if (!user) {
        throw new Error('User not found');
      }

      const approvedDocs = user.VerificationDocuments.filter(doc => 
        doc.status === 'approved' && !doc.isExpired()
      );

      let newLevel = 'unverified';

      // Check for ID documents
      const hasIdDocument = approvedDocs.some(doc => 
        ['passport', 'driving_license', 'national_id'].includes(doc.documentType)
      );

      // Check for address documents
      const hasAddressDocument = approvedDocs.some(doc => 
        ['utility_bill', 'bank_statement'].includes(doc.documentType)
      );

      // Determine verification level
      if (hasIdDocument && hasAddressDocument) {
        newLevel = 'fully_verified';
      } else if (hasIdDocument) {
        newLevel = 'id_verified';
      } else if (user.phoneNumber && user.email) {
        newLevel = 'phone_verified';
      } else if (user.email) {
        newLevel = 'email_verified';
      }

      // Update user if level changed
      if (user.verificationLevel !== newLevel) {
        await user.update({ verificationLevel: newLevel });
        
        this.logger.info('User verification level updated', {
          userId,
          oldLevel: user.verificationLevel,
          newLevel,
          approvedDocsCount: approvedDocs.length
        });
      }

      return newLevel;
    } catch (error) {
      this.logger.error('Error updating user verification level', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Validate document data
  validateDocumentData(documentData) {
    const { documentType, frontImage, backImage, selfieImage } = documentData;

    // Validate document type
    const allowedTypes = ['passport', 'driving_license', 'national_id', 'utility_bill', 'bank_statement'];
    if (!allowedTypes.includes(documentType)) {
      throw new Error(`Invalid document type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Validate required images based on document type
    if (documentType === 'driving_license') {
      if (!frontImage || !backImage) {
        throw new Error('Driving license requires both front and back images');
      }
    } else if (['passport', 'national_id'].includes(documentType)) {
      if (!frontImage) {
        throw new Error(`${documentType} requires front image`);
      }
    } else if (['utility_bill', 'bank_statement'].includes(documentType)) {
      if (!frontImage) {
        throw new Error(`${documentType} requires document image`);
      }
    }

    // Selfie is required for ID documents
    if (['passport', 'driving_license', 'national_id'].includes(documentType) && !selfieImage) {
      throw new Error('Selfie image is required for ID verification');
    }

    return true;
  }

  // Helper methods
  extractKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return null;
    }
  }

  async invalidateVerificationCache(userId) {
    await this.cacheService.invalidatePattern(`user:verification:${userId}*`);
    this.logger.debug('Verification cache invalidated', { userId });
  }
}

module.exports = new VerificationService();