const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserVerificationDocument = sequelize.define('UserVerificationDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    documentType: {
      type: DataTypes.ENUM('passport', 'driving_license', 'national_id', 'utility_bill', 'bank_statement'),
      allowNull: false,
      field: 'document_type'
    },
    frontImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'front_image_url',
      validate: {
        isUrl: true
      }
    },
    backImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'back_image_url',
      validate: {
        isUrl: true
      }
    },
    selfieImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'selfie_image_url',
      validate: {
        isUrl: true
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'under_review', 'approved', 'rejected', 'expired'),
      allowNull: false,
      defaultValue: 'pending'
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'verified_by',
      references: {
        model: 'users', // Admin user who verified
        key: 'id'
      }
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at'
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional metadata like OCR results, AI confidence scores, etc.'
    },
    // Document details extracted via OCR/AI
    extractedData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'extracted_data',
      defaultValue: {},
      comment: 'Data extracted from the document'
    },
    // AI/ML processing results
    aiProcessingResults: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'ai_processing_results',
      defaultValue: {},
      comment: 'Results from AI/ML document verification'
    },
    confidenceScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'confidence_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'AI confidence score for document authenticity'
    },
    submissionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'submission_count',
      comment: 'Number of times this document type was submitted'
    },
    processingStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processing_started_at'
    },
    processingCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processing_completed_at'
    }
  }, {
    tableName: 'user_verification_documents',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['user_id', 'document_type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['verified_by']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['confidence_score']
      }
    ],
    validate: {
      // Ensure required images based on document type
      requiredImages() {
        if (this.documentType === 'driving_license') {
          if (!this.frontImageUrl || !this.backImageUrl) {
            throw new Error('Driving license requires both front and back images');
          }
        } else if (['passport', 'national_id'].includes(this.documentType)) {
          if (!this.frontImageUrl) {
            throw new Error(`${this.documentType} requires front image`);
          }
        }
        
        // Selfie is required for ID documents
        if (['passport', 'driving_license', 'national_id'].includes(this.documentType)) {
          if (!this.selfieImageUrl) {
            throw new Error('Selfie image is required for ID verification');
          }
        }
      }
    },
    hooks: {
      beforeCreate: (document) => {
        // Set processing started timestamp
        document.processingStartedAt = new Date();
        
        // Set expiration date for approved documents (2 years for ID documents)
        if (['passport', 'driving_license', 'national_id'].includes(document.documentType)) {
          const expirationDate = new Date();
          expirationDate.setFullYear(expirationDate.getFullYear() + 2);
          document.expiresAt = expirationDate;
        }
      },
      beforeUpdate: (document) => {
        // Set verification timestamp when approved
        if (document.changed('status') && document.status === 'approved') {
          document.verifiedAt = new Date();
          document.processingCompletedAt = new Date();
        }
        
        // Set processing completed timestamp when status changes from pending
        if (document.changed('status') && document.status !== 'pending') {
          document.processingCompletedAt = new Date();
        }
      }
    }
  });

  // Instance methods
  UserVerificationDocument.prototype.isExpired = function() {
    return this.expiresAt && new Date() > this.expiresAt;
  };

  UserVerificationDocument.prototype.isApproved = function() {
    return this.status === 'approved' && !this.isExpired();
  };

  UserVerificationDocument.prototype.canBeResubmitted = function() {
    return ['rejected', 'expired'].includes(this.status) || this.isExpired();
  };

  UserVerificationDocument.prototype.getProcessingDuration = function() {
    if (!this.processingStartedAt) return null;
    
    const endTime = this.processingCompletedAt || new Date();
    return Math.round((endTime - this.processingStartedAt) / (1000 * 60)); // minutes
  };

  UserVerificationDocument.prototype.updateAIResults = function(results) {
    this.aiProcessingResults = {
      ...this.aiProcessingResults,
      ...results,
      processedAt: new Date().toISOString()
    };
    
    if (results.confidenceScore !== undefined) {
      this.confidenceScore = results.confidenceScore;
    }
    
    if (results.extractedData) {
      this.extractedData = {
        ...this.extractedData,
        ...results.extractedData
      };
    }
    
    return this;
  };

  UserVerificationDocument.prototype.approve = function(verifiedBy, notes = null) {
    this.status = 'approved';
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
    this.processingCompletedAt = new Date();
    
    if (notes) {
      this.metadata = {
        ...this.metadata,
        approvalNotes: notes,
        approvedAt: new Date().toISOString()
      };
    }
    
    return this;
  };

  UserVerificationDocument.prototype.reject = function(verifiedBy, reason) {
    this.status = 'rejected';
    this.verifiedBy = verifiedBy;
    this.rejectionReason = reason;
    this.processingCompletedAt = new Date();
    
    this.metadata = {
      ...this.metadata,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason
    };
    
    return this;
  };

  UserVerificationDocument.prototype.getImageUrls = function() {
    const urls = [];
    
    if (this.frontImageUrl) {
      urls.push({ type: 'front', url: this.frontImageUrl });
    }
    
    if (this.backImageUrl) {
      urls.push({ type: 'back', url: this.backImageUrl });
    }
    
    if (this.selfieImageUrl) {
      urls.push({ type: 'selfie', url: this.selfieImageUrl });
    }
    
    return urls;
  };

  UserVerificationDocument.prototype.getSummary = function() {
    return {
      id: this.id,
      documentType: this.documentType,
      status: this.status,
      confidenceScore: this.confidenceScore,
      submissionCount: this.submissionCount,
      isExpired: this.isExpired(),
      processingDuration: this.getProcessingDuration(),
      createdAt: this.createdAt,
      verifiedAt: this.verifiedAt,
      expiresAt: this.expiresAt
    };
  };

  // Class methods
  UserVerificationDocument.findByUserId = function(userId, documentType = null) {
    const where = { userId };
    if (documentType) {
      where.documentType = documentType;
    }
    
    return this.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
  };

  UserVerificationDocument.findLatestByUserAndType = function(userId, documentType) {
    return this.findOne({
      where: { userId, documentType },
      order: [['createdAt', 'DESC']]
    });
  };

  UserVerificationDocument.findPendingVerifications = function(limit = 50) {
    return this.findAll({
      where: {
        status: ['pending', 'under_review']
      },
      order: [['createdAt', 'ASC']],
      limit,
      include: [{
        model: sequelize.models.User,
        as: 'User',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });
  };

  UserVerificationDocument.getVerificationStats = function() {
    return this.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });
  };

  UserVerificationDocument.findExpiringSoon = function(daysAhead = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.findAll({
      where: {
        status: 'approved',
        expiresAt: {
          [sequelize.Sequelize.Op.lte]: futureDate,
          [sequelize.Sequelize.Op.gt]: new Date()
        }
      },
      include: [{
        model: sequelize.models.User,
        as: 'User',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });
  };

  // Associations
  UserVerificationDocument.associate = function(models) {
    UserVerificationDocument.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
    
    UserVerificationDocument.belongsTo(models.User, {
      foreignKey: 'verified_by',
      as: 'VerifiedBy'
    });
  };

  return UserVerificationDocument;
};