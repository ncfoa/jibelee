module.exports = (sequelize, DataTypes) => {
  const SystemBackup = sequelize.define('SystemBackup', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    backup_type: {
      type: DataTypes.ENUM('full', 'incremental', 'database_only', 'files_only'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('in_progress', 'completed', 'failed', 'expired'),
      defaultValue: 'in_progress'
    },
    size_bytes: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Size of the backup in bytes'
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Local file path of the backup'
    },
    download_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Download URL for the backup file'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description or notes about this backup'
    },
    include_uploads: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether user uploads are included'
    },
    include_logs: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether system logs are included'
    },
    compression_type: {
      type: DataTypes.ENUM('zip', 'gzip', 'tar', 'none'),
      defaultValue: 'gzip',
      comment: 'Compression method used'
    },
    encryption_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether the backup is encrypted'
    },
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this backup expires and can be deleted'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Admin user who created this backup'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional backup metadata'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if backup failed'
    },
    backup_manifest: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Manifest of what was backed up'
    },
    checksum: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'SHA-256 checksum of the backup file'
    },
    retention_days: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'How many days to retain this backup'
    },
    is_scheduled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this was a scheduled backup'
    },
    schedule_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Name of the backup schedule that created this'
    }
  }, {
    tableName: 'system_backups',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['status', 'created_at']
      },
      {
        fields: ['backup_type']
      },
      {
        fields: ['created_by']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['is_scheduled']
      },
      {
        fields: ['schedule_name']
      },
      {
        fields: ['completed_at']
      }
    ]
  });

  SystemBackup.associate = (models) => {
    // Association with AdminUser (created_by)
    SystemBackup.belongsTo(models.AdminUser, {
      foreignKey: 'created_by',
      as: 'createdBy'
    });
  };

  // Instance methods
  SystemBackup.prototype.markCompleted = async function(options = {}) {
    const { sizeBytes, filePath, downloadUrl, checksum, manifest } = options;
    
    this.status = 'completed';
    this.completed_at = new Date();
    
    if (sizeBytes) this.size_bytes = sizeBytes;
    if (filePath) this.file_path = filePath;
    if (downloadUrl) this.download_url = downloadUrl;
    if (checksum) this.checksum = checksum;
    if (manifest) this.backup_manifest = manifest;
    
    // Set expiration date based on retention days
    if (this.retention_days) {
      this.expires_at = new Date(Date.now() + this.retention_days * 24 * 60 * 60 * 1000);
    }
    
    await this.save();
    
    // Log completion
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      this.created_by,
      'backup_completed',
      'system_backup',
      this.id,
      {
        backupType: this.backup_type,
        sizeBytes: this.size_bytes,
        duration: this.completed_at - this.started_at
      }
    );
    
    return this;
  };

  SystemBackup.prototype.markFailed = async function(errorMessage) {
    this.status = 'failed';
    this.error_message = errorMessage;
    this.completed_at = new Date();
    
    await this.save();
    
    // Log failure
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      this.created_by,
      'backup_failed',
      'system_backup',
      this.id,
      {
        backupType: this.backup_type,
        errorMessage,
        duration: this.completed_at - this.started_at
      }
    );
    
    return this;
  };

  SystemBackup.prototype.markExpired = async function() {
    this.status = 'expired';
    
    await this.save();
    
    // Log expiration
    const { AdminActivityLog } = require('./AdminActivityLog');
    await AdminActivityLog.logActivity(
      this.created_by,
      'backup_expired',
      'system_backup',
      this.id,
      { backupType: this.backup_type }
    );
    
    return this;
  };

  SystemBackup.prototype.updateProgress = function(progress, metadata = {}) {
    this.metadata = { ...this.metadata, progress, ...metadata };
    return this.save();
  };

  SystemBackup.prototype.getDuration = function() {
    if (!this.completed_at) return null;
    return this.completed_at - this.started_at;
  };

  SystemBackup.prototype.getDurationInMinutes = function() {
    const duration = this.getDuration();
    return duration ? Math.round(duration / (1000 * 60)) : null;
  };

  SystemBackup.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at;
  };

  SystemBackup.prototype.getDaysUntilExpiration = function() {
    if (!this.expires_at) return null;
    const now = new Date();
    const diff = this.expires_at - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  SystemBackup.prototype.getFormattedSize = function() {
    if (!this.size_bytes) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = this.size_bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  SystemBackup.prototype.generateDownloadToken = function() {
    const jwt = require('jsonwebtoken');
    const payload = {
      backupId: this.id,
      type: 'backup_download',
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET);
  };

  SystemBackup.prototype.verifyIntegrity = async function(filePath = null) {
    if (!this.checksum) return { valid: null, message: 'No checksum available' };
    
    const crypto = require('crypto');
    const fs = require('fs');
    const path = filePath || this.file_path;
    
    if (!path || !fs.existsSync(path)) {
      return { valid: false, message: 'Backup file not found' };
    }
    
    try {
      const fileBuffer = fs.readFileSync(path);
      const calculatedChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const valid = calculatedChecksum === this.checksum;
      
      return {
        valid,
        message: valid ? 'Checksum verified' : 'Checksum mismatch',
        expectedChecksum: this.checksum,
        calculatedChecksum
      };
    } catch (error) {
      return { valid: false, message: `Error verifying checksum: ${error.message}` };
    }
  };

  // Class methods
  SystemBackup.findByStatus = function(status, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    return this.findAll({
      where: { status },
      include: ['createdBy'],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  };

  SystemBackup.findByType = function(backupType, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    return this.findAll({
      where: { backup_type: backupType },
      include: ['createdBy'],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  };

  SystemBackup.findExpired = function() {
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

  SystemBackup.findExpiringSoon = function(days = 7) {
    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    return this.findAll({
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.between]: [new Date(), futureDate]
        },
        status: 'completed'
      },
      order: [['expires_at', 'ASC']]
    });
  };

  SystemBackup.findInProgress = function() {
    return this.findAll({
      where: { status: 'in_progress' },
      include: ['createdBy'],
      order: [['started_at', 'ASC']]
    });
  };

  SystemBackup.findRecent = function(limit = 10) {
    return this.findAll({
      include: ['createdBy'],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  SystemBackup.getStorageStats = async function() {
    const backups = await this.findAll({
      where: { status: 'completed' },
      attributes: ['size_bytes', 'backup_type'],
      raw: true
    });
    
    const stats = {
      totalBackups: backups.length,
      totalSizeBytes: backups.reduce((sum, backup) => sum + (backup.size_bytes || 0), 0),
      byType: {}
    };
    
    backups.forEach(backup => {
      if (!stats.byType[backup.backup_type]) {
        stats.byType[backup.backup_type] = { count: 0, sizeBytes: 0 };
      }
      stats.byType[backup.backup_type].count++;
      stats.byType[backup.backup_type].sizeBytes += backup.size_bytes || 0;
    });
    
    // Format total size
    const formatSize = (bytes) => {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${size.toFixed(2)} ${units[unitIndex]}`;
    };
    
    stats.totalSizeFormatted = formatSize(stats.totalSizeBytes);
    
    return stats;
  };

  SystemBackup.cleanup = async function(options = {}) {
    const { dryRun = true, force = false } = options;
    
    // Find expired backups
    const expiredBackups = await this.findExpired();
    
    if (dryRun) {
      return {
        count: expiredBackups.length,
        totalSize: expiredBackups.reduce((sum, backup) => sum + (backup.size_bytes || 0), 0),
        backups: expiredBackups.map(backup => ({
          id: backup.id,
          type: backup.backup_type,
          createdAt: backup.created_at,
          expiresAt: backup.expires_at,
          size: backup.getFormattedSize()
        }))
      };
    }
    
    const fs = require('fs');
    let deletedCount = 0;
    let deletedSize = 0;
    const errors = [];
    
    for (const backup of expiredBackups) {
      try {
        // Delete file if it exists
        if (backup.file_path && fs.existsSync(backup.file_path)) {
          fs.unlinkSync(backup.file_path);
        }
        
        // Mark as expired
        await backup.markExpired();
        
        deletedCount++;
        deletedSize += backup.size_bytes || 0;
      } catch (error) {
        errors.push({
          backupId: backup.id,
          error: error.message
        });
      }
    }
    
    return {
      deletedCount,
      deletedSize,
      errors,
      totalSizeFormatted: this.prototype.getFormattedSize.call({ size_bytes: deletedSize })
    };
  };

  SystemBackup.getBackupScheduleStats = async function() {
    const backups = await this.findAll({
      where: { is_scheduled: true },
      attributes: ['schedule_name', 'status', 'backup_type', 'created_at'],
      raw: true
    });
    
    const stats = {};
    
    backups.forEach(backup => {
      const scheduleName = backup.schedule_name || 'Unknown';
      
      if (!stats[scheduleName]) {
        stats[scheduleName] = {
          total: 0,
          successful: 0,
          failed: 0,
          lastRun: null,
          types: {}
        };
      }
      
      stats[scheduleName].total++;
      
      if (backup.status === 'completed') {
        stats[scheduleName].successful++;
      } else if (backup.status === 'failed') {
        stats[scheduleName].failed++;
      }
      
      if (!stats[scheduleName].lastRun || backup.created_at > stats[scheduleName].lastRun) {
        stats[scheduleName].lastRun = backup.created_at;
      }
      
      if (!stats[scheduleName].types[backup.backup_type]) {
        stats[scheduleName].types[backup.backup_type] = 0;
      }
      stats[scheduleName].types[backup.backup_type]++;
    });
    
    // Calculate success rates
    Object.values(stats).forEach(stat => {
      stat.successRate = stat.total > 0 ? (stat.successful / stat.total) * 100 : 0;
    });
    
    return stats;
  };

  return SystemBackup;
};