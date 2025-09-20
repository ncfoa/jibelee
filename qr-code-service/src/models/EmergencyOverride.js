const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmergencyOverride = sequelize.define('EmergencyOverride', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  deliveryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'delivery_id'
  },
  
  qrCodeId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'qr_code_id',
    references: {
      model: 'qr_codes',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  
  overrideType: {
    type: DataTypes.ENUM('emergency', 'technical', 'customer_service', 'security'),
    allowNull: false,
    field: 'override_type'
  },
  
  overrideReason: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'override_reason'
  },
  
  emergencyCategory: {
    type: DataTypes.ENUM('medical', 'theft', 'accident', 'natural_disaster', 'technical_failure', 'other'),
    allowNull: false,
    field: 'emergency_category'
  },
  
  severityLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    field: 'severity_level'
  },
  
  alternativeVerification: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'alternative_verification'
  },
  
  requestedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'requested_by'
  },
  
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'approved_by'
  },
  
  emergencyContact: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'emergency_contact'
  },
  
  locationData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'location_data'
  },
  
  supportingEvidence: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    defaultValue: [],
    field: 'supporting_evidence'
  },
  
  witnessInformation: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'witness_information'
  },
  
  policeReportNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'police_report_number'
  },
  
  insuranceClaimNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'insurance_claim_number'
  },
  
  alternativeCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'alternative_code'
  },
  
  codeExpiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'code_expires_at'
  },
  
  validUntil: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'valid_until'
  },
  
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at'
  },
  
  usedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'used_by'
  },
  
  usageLocation: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true,
    field: 'usage_location'
  },
  
  verificationPhotos: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    defaultValue: [],
    field: 'verification_photos'
  },
  
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_notes'
  },
  
  followUpRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'follow_up_required'
  },
  
  auditTrail: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'audit_trail'
  },
  
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'used', 'expired'),
    allowNull: false,
    defaultValue: 'pending'
  },
  
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'rejected_at'
  },
  
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  }
}, {
  tableName: 'qr_emergency_overrides',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // No updatedAt field in this table
  indexes: [
    {
      fields: ['delivery_id']
    },
    {
      fields: ['qr_code_id']
    },
    {
      fields: ['requested_by']
    },
    {
      fields: ['approved_by']
    },
    {
      fields: ['status']
    },
    {
      fields: ['valid_until']
    },
    {
      fields: ['created_at']
    }
  ],
  validate: {
    validUntilInFuture() {
      if (this.validUntil && this.validUntil <= this.createdAt) {
        throw new Error('Valid until date must be in the future');
      }
    },
    approvalLogic() {
      if (this.status === 'approved' && (!this.approvedBy || !this.approvedAt)) {
        throw new Error('Approved overrides must have approvedBy and approvedAt');
      }
    }
  }
});

// Instance methods
EmergencyOverride.prototype.isExpired = function() {
  return new Date() > this.validUntil || this.status === 'expired';
};

EmergencyOverride.prototype.isActive = function() {
  return this.status === 'approved' && !this.isExpired() && !this.usedAt;
};

EmergencyOverride.prototype.canBeUsed = function() {
  return this.isActive();
};

EmergencyOverride.prototype.approve = async function(approvedBy, approvalNotes, additionalRestrictions = {}) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  this.approvalNotes = approvalNotes;
  this.additionalRestrictions = additionalRestrictions;
  
  return this.save();
};

EmergencyOverride.prototype.reject = async function(rejectedBy, rejectionReason) {
  this.status = 'rejected';
  this.approvedBy = rejectedBy; // Reusing field for rejected by
  this.rejectedAt = new Date();
  this.approvalNotes = rejectionReason; // Reusing field for rejection reason
  
  return this.save();
};

EmergencyOverride.prototype.use = async function(usedBy, useLocation, verificationEvidence = {}) {
  if (!this.canBeUsed()) {
    throw new Error('Emergency override cannot be used in current state');
  }
  
  this.status = 'used';
  this.usedAt = new Date();
  this.usedBy = usedBy;
  this.useLocation = useLocation;
  this.verificationEvidence = verificationEvidence;
  
  return this.save();
};

EmergencyOverride.prototype.expire = async function() {
  this.status = 'expired';
  return this.save();
};

EmergencyOverride.prototype.getRemainingTime = function() {
  if (this.isExpired()) return 0;
  return Math.max(0, this.validUntil.getTime() - Date.now());
};

EmergencyOverride.prototype.getRemainingTimeFormatted = function() {
  const remainingMs = this.getRemainingTime();
  if (remainingMs === 0) return 'Expired';
  
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
};

// Class methods
EmergencyOverride.findPendingApprovals = async function(options = {}) {
  return this.findAll({
    where: {
      status: 'pending',
      validUntil: {
        [sequelize.Sequelize.Op.gt]: new Date()
      }
    },
    order: [['created_at', 'ASC']],
    ...options
  });
};

EmergencyOverride.findByDelivery = async function(deliveryId, options = {}) {
  return this.findAll({
    where: { deliveryId },
    order: [['created_at', 'DESC']],
    ...options
  });
};

EmergencyOverride.findActiveByDelivery = async function(deliveryId) {
  return this.findAll({
    where: {
      deliveryId,
      status: 'approved',
      validUntil: {
        [sequelize.Sequelize.Op.gt]: new Date()
      },
      usedAt: null
    }
  });
};

EmergencyOverride.findByUser = async function(userId, role = 'requested', options = {}) {
  const whereField = role === 'requested' ? 'requestedBy' : 'approvedBy';
  
  return this.findAll({
    where: { [whereField]: userId },
    order: [['created_at', 'DESC']],
    ...options
  });
};

EmergencyOverride.expireOldOverrides = async function() {
  const [affectedCount] = await this.update(
    { status: 'expired' },
    {
      where: {
        status: {
          [sequelize.Sequelize.Op.in]: ['pending', 'approved']
        },
        validUntil: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    }
  );
  
  return affectedCount;
};

EmergencyOverride.getStatistics = async function(timeframe = '30 days') {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const stats = await sequelize.query(`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests,
      COUNT(CASE WHEN status = 'used' THEN 1 END) as used_overrides,
      COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_overrides,
      AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/3600) as avg_approval_time_hours
    FROM qr_emergency_overrides 
    WHERE created_at >= :startDate
  `, {
    replacements: { startDate },
    type: sequelize.QueryTypes.SELECT
  });
  
  return stats[0];
};

EmergencyOverride.getPendingCount = async function() {
  return this.count({
    where: {
      status: 'pending',
      validUntil: {
        [sequelize.Sequelize.Op.gt]: new Date()
      }
    }
  });
};

module.exports = EmergencyOverride;