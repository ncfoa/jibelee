module.exports = (sequelize, DataTypes) => {
  const DisputeEvidence = sequelize.define('DisputeEvidence', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    dispute_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the dispute'
    },
    submitted_by: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User ID who submitted this evidence'
    },
    evidence_type: {
      type: DataTypes.ENUM('photo', 'video', 'document', 'audio', 'text'),
      allowNull: false
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL to the uploaded file (if applicable)'
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Original file name'
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'File size in bytes'
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'MIME type of the file'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description or context for this evidence'
    },
    text_content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Text content for text-type evidence'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional metadata (dimensions, duration, etc.)'
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this evidence has been verified by admin'
    },
    verified_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin who verified this evidence'
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    verification_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Admin notes about verification'
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Soft delete flag'
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deleted_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin who deleted this evidence'
    },
    hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'SHA-256 hash of the file for integrity verification'
    }
  }, {
    tableName: 'dispute_evidence',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['dispute_id', 'created_at']
      },
      {
        fields: ['submitted_by']
      },
      {
        fields: ['evidence_type']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['is_deleted']
      },
      {
        fields: ['hash']
      }
    ]
  });

  DisputeEvidence.associate = (models) => {
    // Association with Dispute
    DisputeEvidence.belongsTo(models.Dispute, {
      foreignKey: 'dispute_id',
      as: 'dispute'
    });

    // Association with AdminUser (verified_by)
    DisputeEvidence.belongsTo(models.AdminUser, {
      foreignKey: 'verified_by',
      as: 'verifiedBy'
    });

    // Association with AdminUser (deleted_by)
    DisputeEvidence.belongsTo(models.AdminUser, {
      foreignKey: 'deleted_by',
      as: 'deletedBy'
    });
  };

  // Instance methods
  DisputeEvidence.prototype.verify = async function(adminId, notes = null) {
    this.is_verified = true;
    this.verified_by = adminId;
    this.verified_at = new Date();
    this.verification_notes = notes;
    
    await this.save();
    
    // Log verification
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'evidence_verified',
      'dispute_evidence',
      this.id,
      { disputeId: this.dispute_id, evidenceType: this.evidence_type }
    );
    
    return this;
  };

  DisputeEvidence.prototype.softDelete = async function(adminId, reason = null) {
    this.is_deleted = true;
    this.deleted_at = new Date();
    this.deleted_by = adminId;
    
    await this.save();
    
    // Log deletion
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'evidence_deleted',
      'dispute_evidence',
      this.id,
      { disputeId: this.dispute_id, reason }
    );
    
    return this;
  };

  DisputeEvidence.prototype.restore = async function(adminId) {
    this.is_deleted = false;
    this.deleted_at = null;
    this.deleted_by = null;
    
    await this.save();
    
    // Log restoration
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      adminId,
      'evidence_restored',
      'dispute_evidence',
      this.id,
      { disputeId: this.dispute_id }
    );
    
    return this;
  };

  DisputeEvidence.prototype.updateMetadata = function(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this.save();
  };

  DisputeEvidence.prototype.generateHash = function(fileBuffer) {
    const crypto = require('crypto');
    this.hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return this.hash;
  };

  DisputeEvidence.prototype.verifyIntegrity = function(fileBuffer) {
    if (!this.hash) return true; // No hash to verify against
    
    const crypto = require('crypto');
    const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return currentHash === this.hash;
  };

  DisputeEvidence.prototype.getFileExtension = function() {
    if (!this.file_name) return null;
    return this.file_name.split('.').pop().toLowerCase();
  };

  DisputeEvidence.prototype.isImage = function() {
    const imageTypes = ['photo'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    
    return imageTypes.includes(this.evidence_type) ||
           imageExtensions.includes(this.getFileExtension()) ||
           (this.mime_type && imageMimeTypes.includes(this.mime_type));
  };

  DisputeEvidence.prototype.isVideo = function() {
    const videoTypes = ['video'];
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const videoMimeTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/webm'];
    
    return videoTypes.includes(this.evidence_type) ||
           videoExtensions.includes(this.getFileExtension()) ||
           (this.mime_type && videoMimeTypes.includes(this.mime_type));
  };

  DisputeEvidence.prototype.isDocument = function() {
    const documentTypes = ['document'];
    const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
    const documentMimeTypes = ['application/pdf', 'application/msword', 'text/plain'];
    
    return documentTypes.includes(this.evidence_type) ||
           documentExtensions.includes(this.getFileExtension()) ||
           (this.mime_type && documentMimeTypes.some(type => this.mime_type.includes(type)));
  };

  // Class methods
  DisputeEvidence.findByDispute = function(disputeId, options = {}) {
    const { includeDeleted = false, evidenceType = null } = options;
    const where = { dispute_id: disputeId };
    
    if (!includeDeleted) {
      where.is_deleted = false;
    }
    
    if (evidenceType) {
      where.evidence_type = evidenceType;
    }
    
    return this.findAll({
      where,
      include: ['verifiedBy', 'deletedBy'],
      order: [['created_at', 'ASC']]
    });
  };

  DisputeEvidence.findBySubmitter = function(submitterId, options = {}) {
    const { includeDeleted = false, limit = 50 } = options;
    const where = { submitted_by: submitterId };
    
    if (!includeDeleted) {
      where.is_deleted = false;
    }
    
    return this.findAll({
      where,
      include: ['dispute', 'verifiedBy'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  DisputeEvidence.findUnverified = function(options = {}) {
    const { evidenceType = null, limit = 100 } = options;
    const where = {
      is_verified: false,
      is_deleted: false
    };
    
    if (evidenceType) {
      where.evidence_type = evidenceType;
    }
    
    return this.findAll({
      where,
      include: ['dispute'],
      order: [['created_at', 'ASC']],
      limit
    });
  };

  DisputeEvidence.getStatsByType = async function(disputeId = null) {
    const where = { is_deleted: false };
    if (disputeId) where.dispute_id = disputeId;
    
    const evidence = await this.findAll({
      where,
      attributes: ['evidence_type'],
      raw: true
    });
    
    const stats = {};
    evidence.forEach(item => {
      stats[item.evidence_type] = (stats[item.evidence_type] || 0) + 1;
    });
    
    return stats;
  };

  DisputeEvidence.getVerificationStats = async function(dateRange = null) {
    const where = { is_deleted: false };
    if (dateRange) {
      where.created_at = {
        [sequelize.Sequelize.Op.between]: [dateRange.start, dateRange.end]
      };
    }
    
    const evidence = await this.findAll({
      where,
      attributes: ['is_verified'],
      raw: true
    });
    
    const stats = {
      total: evidence.length,
      verified: evidence.filter(item => item.is_verified).length,
      unverified: evidence.filter(item => !item.is_verified).length
    };
    
    stats.verificationRate = stats.total > 0 ? (stats.verified / stats.total) * 100 : 0;
    
    return stats;
  };

  DisputeEvidence.findByHash = function(hash) {
    return this.findOne({
      where: { hash, is_deleted: false }
    });
  };

  DisputeEvidence.findDuplicates = async function() {
    const evidence = await this.findAll({
      where: {
        hash: { [sequelize.Sequelize.Op.not]: null },
        is_deleted: false
      },
      attributes: ['id', 'hash', 'dispute_id', 'file_name'],
      raw: true
    });
    
    const hashMap = {};
    const duplicates = [];
    
    evidence.forEach(item => {
      if (hashMap[item.hash]) {
        duplicates.push({
          original: hashMap[item.hash],
          duplicate: item
        });
      } else {
        hashMap[item.hash] = item;
      }
    });
    
    return duplicates;
  };

  DisputeEvidence.cleanup = async function(options = {}) {
    const { olderThanDays = 90, dryRun = true } = options;
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    const oldEvidence = await this.findAll({
      where: {
        is_deleted: true,
        deleted_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
    
    if (dryRun) {
      return {
        count: oldEvidence.length,
        items: oldEvidence.map(item => ({
          id: item.id,
          fileName: item.file_name,
          deletedAt: item.deleted_at
        }))
      };
    }
    
    // Actually delete the records
    const deletedCount = await this.destroy({
      where: {
        is_deleted: true,
        deleted_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
    
    return { deletedCount };
  };

  return DisputeEvidence;
};