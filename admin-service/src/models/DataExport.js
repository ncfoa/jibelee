module.exports = (sequelize, DataTypes) => {
  const DataExport = sequelize.define('DataExport', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    export_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of data being exported (users, deliveries, transactions, etc.)'
    },
    format: {
      type: DataTypes.ENUM('csv', 'json', 'xlsx', 'xml'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('processing', 'completed', 'failed', 'expired'),
      defaultValue: 'processing'
    },
    filters: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Filters applied to the data export'
    },
    fields: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Specific fields to export (null = all fields)'
    },
    estimated_records: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Estimated number of records to export'
    },
    actual_records: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Actual number of records exported'
    },
    file_size_bytes: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Size of the exported file in bytes'
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Local file path of the export'
    },
    download_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Download URL for the export file'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this export expires and can be deleted'
    },
    requested_by: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Admin user who requested this export'
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if export failed'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional export metadata'
    },
    compression: {
      type: DataTypes.ENUM('zip', 'gzip', 'none'),
      defaultValue: 'none',
      comment: 'Compression method used'
    },
    is_encrypted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether the export file is encrypted'
    },
    download_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times this export has been downloaded'
    },
    last_downloaded_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    retention_days: {
      type: DataTypes.INTEGER,
      defaultValue: 7,
      comment: 'How many days to retain this export'
    },
    checksum: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'SHA-256 checksum of the export file'
    },
    progress_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00,
      comment: 'Export progress percentage'
    }
  }, {
    tableName: 'data_exports',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['requested_by', 'created_at']
      },
      {
        fields: ['export_type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['format']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['completed_at']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  DataExport.associate = (models) => {
    // Association with AdminUser (requested_by)
    DataExport.belongsTo(models.AdminUser, {
      foreignKey: 'requested_by',
      as: 'requestedBy'
    });
  };

  // Instance methods
  DataExport.prototype.markCompleted = async function(options = {}) {
    const {
      actualRecords,
      fileSizeBytes,
      filePath,
      downloadUrl,
      checksum
    } = options;
    
    this.status = 'completed';
    this.completed_at = new Date();
    this.progress_percentage = 100.00;
    
    if (actualRecords !== undefined) this.actual_records = actualRecords;
    if (fileSizeBytes !== undefined) this.file_size_bytes = fileSizeBytes;
    if (filePath) this.file_path = filePath;
    if (downloadUrl) this.download_url = downloadUrl;
    if (checksum) this.checksum = checksum;
    
    // Set expiration date
    if (this.retention_days) {
      this.expires_at = new Date(Date.now() + this.retention_days * 24 * 60 * 60 * 1000);
    }
    
    await this.save();
    
    // Log completion
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      this.requested_by,
      'data_export_completed',
      'data_export',
      this.id,
      {
        exportType: this.export_type,
        format: this.format,
        recordCount: this.actual_records,
        fileSize: this.file_size_bytes
      }
    );
    
    return this;
  };

  DataExport.prototype.markFailed = async function(errorMessage) {
    this.status = 'failed';
    this.error_message = errorMessage;
    this.completed_at = new Date();
    
    await this.save();
    
    // Log failure
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      this.requested_by,
      'data_export_failed',
      'data_export',
      this.id,
      {
        exportType: this.export_type,
        format: this.format,
        errorMessage
      }
    );
    
    return this;
  };

  DataExport.prototype.updateProgress = function(percentage, metadata = {}) {
    this.progress_percentage = Math.min(100, Math.max(0, percentage));
    this.metadata = { ...this.metadata, ...metadata };
    return this.save();
  };

  DataExport.prototype.recordDownload = async function() {
    this.download_count++;
    this.last_downloaded_at = new Date();
    
    await this.save();
    
    // Log download
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      this.requested_by,
      'data_export_downloaded',
      'data_export',
      this.id,
      {
        exportType: this.export_type,
        downloadCount: this.download_count
      }
    );
    
    return this;
  };

  DataExport.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at;
  };

  DataExport.prototype.getDaysUntilExpiration = function() {
    if (!this.expires_at) return null;
    const now = new Date();
    const diff = this.expires_at - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  DataExport.prototype.getDuration = function() {
    if (!this.completed_at) return null;
    return this.completed_at - this.created_at;
  };

  DataExport.prototype.getDurationInMinutes = function() {
    const duration = this.getDuration();
    return duration ? Math.round(duration / (1000 * 60)) : null;
  };

  DataExport.prototype.getFormattedSize = function() {
    if (!this.file_size_bytes) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = this.file_size_bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  DataExport.prototype.generateDownloadToken = function() {
    const jwt = require('jsonwebtoken');
    const payload = {
      exportId: this.id,
      type: 'export_download',
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours expiration
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET);
  };

  DataExport.prototype.getEstimatedCompletion = function() {
    if (this.status === 'completed' || this.status === 'failed') {
      return null;
    }
    
    if (this.progress_percentage <= 0) {
      return null;
    }
    
    const elapsed = new Date() - this.created_at;
    const estimatedTotal = (elapsed / this.progress_percentage) * 100;
    const remaining = estimatedTotal - elapsed;
    
    return new Date(Date.now() + remaining);
  };

  DataExport.prototype.canBeDownloaded = function() {
    return this.status === 'completed' && !this.isExpired();
  };

  DataExport.prototype.getFilename = function() {
    const timestamp = this.created_at.toISOString().split('T')[0];
    const extension = this.format === 'xlsx' ? 'xlsx' : this.format;
    let filename = `${this.export_type}_${timestamp}.${extension}`;
    
    if (this.compression === 'zip') {
      filename += '.zip';
    } else if (this.compression === 'gzip') {
      filename += '.gz';
    }
    
    return filename;
  };

  // Class methods
  DataExport.findByStatus = function(status, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    return this.findAll({
      where: { status },
      include: ['requestedBy'],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  };

  DataExport.findByType = function(exportType, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    return this.findAll({
      where: { export_type: exportType },
      include: ['requestedBy'],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  };

  DataExport.findByUser = function(userId, options = {}) {
    const { status = null, limit = 50, offset = 0 } = options;
    const where = { requested_by: userId };
    
    if (status) where.status = status;
    
    return this.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  };

  DataExport.findExpired = function() {
    return this.findAll({
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.lt]: new Date()
        },
        status: { [sequelize.Sequelize.Op.ne]: 'expired' }
      },
      order: [['expires_at', 'ASC']]
    });
  };

  DataExport.findInProgress = function() {
    return this.findAll({
      where: { status: 'processing' },
      include: ['requestedBy'],
      order: [['created_at', 'ASC']]
    });
  };

  DataExport.findRecent = function(limit = 10) {
    return this.findAll({
      include: ['requestedBy'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  DataExport.getExportStats = async function(dateRange = null) {
    const where = {};
    if (dateRange) {
      where.created_at = {
        [sequelize.Sequelize.Op.between]: [dateRange.start, dateRange.end]
      };
    }
    
    const exports = await this.findAll({
      where,
      attributes: ['export_type', 'format', 'status', 'file_size_bytes', 'actual_records'],
      raw: true
    });
    
    const stats = {
      total: exports.length,
      byStatus: { processing: 0, completed: 0, failed: 0, expired: 0 },
      byType: {},
      byFormat: { csv: 0, json: 0, xlsx: 0, xml: 0 },
      totalRecords: 0,
      totalSizeBytes: 0
    };
    
    exports.forEach(exportItem => {
      // Count by status
      stats.byStatus[exportItem.status]++;
      
      // Count by type
      if (!stats.byType[exportItem.export_type]) {
        stats.byType[exportItem.export_type] = 0;
      }
      stats.byType[exportItem.export_type]++;
      
      // Count by format
      stats.byFormat[exportItem.format]++;
      
      // Sum records and size
      if (exportItem.actual_records) {
        stats.totalRecords += exportItem.actual_records;
      }
      if (exportItem.file_size_bytes) {
        stats.totalSizeBytes += exportItem.file_size_bytes;
      }
    });
    
    // Calculate success rate
    stats.successRate = stats.total > 0 ? (stats.byStatus.completed / stats.total) * 100 : 0;
    
    return stats;
  };

  DataExport.cleanup = async function(options = {}) {
    const { dryRun = true, force = false } = options;
    
    // Find expired exports
    const expiredExports = await this.findExpired();
    
    if (dryRun) {
      return {
        count: expiredExports.length,
        totalSize: expiredExports.reduce((sum, exp) => sum + (exp.file_size_bytes || 0), 0),
        exports: expiredExports.map(exp => ({
          id: exp.id,
          type: exp.export_type,
          format: exp.format,
          createdAt: exp.created_at,
          expiresAt: exp.expires_at,
          size: exp.getFormattedSize()
        }))
      };
    }
    
    const fs = require('fs');
    let deletedCount = 0;
    let deletedSize = 0;
    const errors = [];
    
    for (const exportItem of expiredExports) {
      try {
        // Delete file if it exists
        if (exportItem.file_path && fs.existsSync(exportItem.file_path)) {
          fs.unlinkSync(exportItem.file_path);
        }
        
        // Mark as expired
        exportItem.status = 'expired';
        await exportItem.save();
        
        deletedCount++;
        deletedSize += exportItem.file_size_bytes || 0;
      } catch (error) {
        errors.push({
          exportId: exportItem.id,
          error: error.message
        });
      }
    }
    
    return {
      deletedCount,
      deletedSize,
      errors
    };
  };

  DataExport.getPopularExports = async function(limit = 10, dateRange = null) {
    const where = { status: 'completed' };
    if (dateRange) {
      where.created_at = {
        [sequelize.Sequelize.Op.between]: [dateRange.start, dateRange.end]
      };
    }
    
    const exports = await this.findAll({
      where,
      attributes: [
        'export_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('download_count')), 'total_downloads']
      ],
      group: ['export_type'],
      order: [[sequelize.literal('count'), 'DESC']],
      limit,
      raw: true
    });
    
    return exports;
  };

  DataExport.getLargestExports = function(limit = 10) {
    return this.findAll({
      where: { status: 'completed' },
      include: ['requestedBy'],
      order: [['file_size_bytes', 'DESC']],
      limit
    });
  };

  DataExport.getAverageExportTime = async function(exportType = null) {
    const where = { 
      status: 'completed',
      completed_at: { [sequelize.Sequelize.Op.not]: null }
    };
    
    if (exportType) where.export_type = exportType;
    
    const exports = await this.findAll({
      where,
      attributes: ['created_at', 'completed_at'],
      raw: true
    });
    
    if (exports.length === 0) return 0;
    
    const totalMinutes = exports.reduce((sum, exp) => {
      const duration = new Date(exp.completed_at) - new Date(exp.created_at);
      return sum + (duration / (1000 * 60));
    }, 0);
    
    return totalMinutes / exports.length;
  };

  return DataExport;
};