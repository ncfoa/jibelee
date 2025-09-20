const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QRCodeScan = sequelize.define('QRCodeScan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  qrCodeId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'qr_code_id',
    references: {
      model: 'qr_codes',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  
  scannedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'scanned_by'
  },
  
  scanResult: {
    type: DataTypes.ENUM(
      'success', 
      'failed', 
      'invalid_location', 
      'expired', 
      'already_used', 
      'unauthorized', 
      'invalid_data'
    ),
    allowNull: false,
    field: 'scan_result'
  },
  
  verificationStatus: {
    type: DataTypes.ENUM('verified', 'failed', 'pending', 'bypassed'),
    allowNull: false,
    field: 'verification_status'
  },
  
  scanLocation: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true,
    field: 'scan_location'
  },
  
  scanAccuracy: {
    type: DataTypes.DECIMAL(8,2),
    allowNull: true,
    field: 'scan_accuracy',
    validate: {
      min: 0
    }
  },
  
  ipAddress: {
    type: DataTypes.INET,
    allowNull: true,
    field: 'ip_address'
  },
  
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent'
  },
  
  deviceInfo: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'device_info'
  },
  
  appVersion: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'app_version'
  },
  
  cameraUsed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'camera_used'
  },
  
  scanDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'scan_duration',
    validate: {
      min: 0
    }
  },
  
  imageQualityScore: {
    type: DataTypes.DECIMAL(3,2),
    allowNull: true,
    field: 'image_quality_score',
    validate: {
      min: 0.0,
      max: 1.0
    }
  },
  
  additionalVerification: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'additional_verification'
  },
  
  biometricVerification: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'biometric_verification'
  },
  
  twoFactorVerification: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'two_factor_verification'
  },
  
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'failure_reason'
  },
  
  securityWarnings: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    defaultValue: [],
    field: 'security_warnings'
  },
  
  fraudIndicators: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'fraud_indicators'
  },
  
  riskScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'risk_score'
  },
  
  manualOverride: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'manual_override'
  },
  
  overrideReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'override_reason'
  },
  
  overrideBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'override_by'
  },
  
  scannedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'scanned_at'
  },
  
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'processed_at'
  }
}, {
  tableName: 'qr_code_scans',
  timestamps: false, // Using custom scannedAt field
  indexes: [
    {
      fields: ['qr_code_id']
    },
    {
      fields: ['scanned_by']
    },
    {
      fields: ['scan_result']
    },
    {
      fields: ['scanned_at']
    },
    {
      fields: ['qr_code_id', 'scanned_at']
    },
    {
      fields: ['risk_score'],
      where: {
        risk_score: {
          [sequelize.Sequelize.Op.gt]: 0.5
        }
      }
    }
  ]
});

// Instance methods
QRCodeScan.prototype.isSuccessful = function() {
  return this.scanResult === 'success';
};

QRCodeScan.prototype.isSuspicious = function() {
  return this.riskScore > 0.7 || this.securityFlags?.suspicious === true;
};

QRCodeScan.prototype.getLocationString = function() {
  if (!this.scanLocation) return null;
  
  // Extract coordinates from PostGIS point
  // This would need proper PostGIS parsing
  return `${this.scanLocation.coordinates[1]}, ${this.scanLocation.coordinates[0]}`;
};

// Class methods
QRCodeScan.findByQRCode = async function(qrCodeId, options = {}) {
  const queryOptions = {
    where: { qrCodeId },
    order: [['scanned_at', 'DESC']],
    ...options
  };
  
  return this.findAll(queryOptions);
};

QRCodeScan.findByUser = async function(scannedBy, options = {}) {
  const queryOptions = {
    where: { scannedBy },
    order: [['scanned_at', 'DESC']],
    ...options
  };
  
  return this.findAll(queryOptions);
};

QRCodeScan.getSuccessRate = async function(timeframe = '24 hours') {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - 24);
  
  const total = await this.count({
    where: {
      scannedAt: {
        [sequelize.Sequelize.Op.gte]: startTime
      }
    }
  });
  
  const successful = await this.count({
    where: {
      scannedAt: {
        [sequelize.Sequelize.Op.gte]: startTime
      },
      scanResult: 'success'
    }
  });
  
  return total > 0 ? (successful / total) * 100 : 0;
};

QRCodeScan.getSuspiciousScans = async function(timeframe = '24 hours') {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - 24);
  
  return this.findAll({
    where: {
      scannedAt: {
        [sequelize.Sequelize.Op.gte]: startTime
      },
      [sequelize.Sequelize.Op.or]: [
        { riskScore: { [sequelize.Sequelize.Op.gt]: 0.7 } },
        { 
          securityFlags: {
            suspicious: true
          }
        }
      ]
    },
    order: [['risk_score', 'DESC'], ['scanned_at', 'DESC']]
  });
};

QRCodeScan.getAnalytics = async function(startDate, endDate, groupBy = 'day') {
  // This would implement analytics queries
  // For now, returning basic structure
  const analytics = await sequelize.query(`
    SELECT 
      DATE_TRUNC(:groupBy, scanned_at) as period,
      COUNT(*) as total_scans,
      COUNT(CASE WHEN scan_result = 'success' THEN 1 END) as successful_scans,
      COUNT(CASE WHEN scan_result != 'success' THEN 1 END) as failed_scans,
      AVG(response_time_ms) as avg_response_time,
      AVG(risk_score) as avg_risk_score
    FROM qr_code_scans 
    WHERE scanned_at BETWEEN :startDate AND :endDate
    GROUP BY DATE_TRUNC(:groupBy, scanned_at)
    ORDER BY period
  `, {
    replacements: { groupBy, startDate, endDate },
    type: sequelize.QueryTypes.SELECT
  });
  
  return analytics;
};

QRCodeScan.cleanupOldRecords = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const deletedCount = await this.destroy({
    where: {
      scannedAt: {
        [sequelize.Sequelize.Op.lt]: cutoffDate
      }
    }
  });
  
  return deletedCount;
};

module.exports = QRCodeScan;