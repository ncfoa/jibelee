const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QRCode = sequelize.define('QRCode', {
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
  
  qrType: {
    type: DataTypes.ENUM('pickup', 'delivery', 'verification', 'emergency'),
    allowNull: false,
    field: 'qr_type'
  },
  
  codeData: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'code_data'
  },
  
  encryptedData: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'encrypted_data'
  },
  
  hashValue: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    field: 'hash_value'
  },
  
  imageData: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'image_data'
  },
  
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'image_url'
  },
  
  downloadUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'download_url'
  },
  
  backupCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'backup_code'
  },
  
  securityLevel: {
    type: DataTypes.ENUM('standard', 'high', 'maximum'),
    allowNull: false,
    defaultValue: 'standard',
    field: 'security_level'
  },
  
  encryptionAlgorithm: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'AES-256',
    field: 'encryption_algorithm'
  },
  
  securityFeatures: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'security_features'
  },
  
  format: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'PNG'
  },
  
  size: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '256x256'
  },
  
  errorCorrection: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'M',
    field: 'error_correction'
  },
  
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at'
  },
  
  status: {
    type: DataTypes.ENUM('active', 'used', 'expired', 'revoked'),
    allowNull: false,
    defaultValue: 'active'
  },
  
  usageCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'usage_count'
  },
  
  maxUsageCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'max_usage_count'
  },
  
  locationBound: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'location_bound'
  },
  
  boundCoordinates: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true,
    field: 'bound_coordinates'
  },
  
  boundRadius: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'bound_radius',
    validate: {
      min: 1
    }
  },
  
  timeBound: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'time_bound'
  },
  
  validFrom: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'valid_from'
  },
  
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'valid_until'
  },
  
  deviceBound: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'device_bound'
  },
  
  boundDeviceId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'bound_device_id'
  },
  
  ipRestrictions: {
    type: DataTypes.ARRAY(DataTypes.INET),
    allowNull: true,
    defaultValue: [],
    field: 'ip_restrictions'
  },
  
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'revoked_at'
  },
  
  revokedReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'revoked_reason'
  },
  
  revokedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'revoked_by'
  }
}, {
  tableName: 'qr_codes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['delivery_id', 'qr_type']
    },
    {
      fields: ['delivery_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['status', 'expires_at']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['security_level']
    }
  ],
  validate: {
    expiresInFuture() {
      if (this.expiresAt && this.expiresAt <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
    },
    boundRadiusWithCoordinates() {
      if (this.locationBound && (!this.boundCoordinates || !this.boundRadius)) {
        throw new Error('Location bound QR codes must have coordinates and radius');
      }
    }
  },
  hooks: {
    beforeUpdate: (qrCode) => {
      qrCode.version += 1;
    }
  }
});

// Instance methods
QRCode.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

QRCode.prototype.isActive = function() {
  return this.status === 'active' && !this.isExpired();
};

QRCode.prototype.canBeScanned = function() {
  return this.isActive() && !this.usedAt;
};

QRCode.prototype.markAsUsed = async function() {
  this.status = 'used';
  this.usedAt = new Date();
  return this.save();
};

QRCode.prototype.revoke = async function(reason, revokedBy) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedReason = reason;
  this.revokedBy = revokedBy;
  return this.save();
};

QRCode.prototype.isLocationValid = function(userLocation, accuracy = 10) {
  if (!this.locationBound || !this.boundCoordinates) {
    return true; // No location restriction
  }

  // This would need a proper geospatial calculation
  // For now, returning true - implement with PostGIS functions
  return true;
};

// Class methods
QRCode.findActiveByDelivery = async function(deliveryId) {
  return this.findAll({
    where: {
      deliveryId,
      status: 'active'
    }
  });
};

QRCode.findByDeliveryAndType = async function(deliveryId, qrType) {
  return this.findOne({
    where: {
      deliveryId,
      qrType
    }
  });
};

QRCode.expireOldCodes = async function() {
  const [affectedCount] = await this.update(
    { status: 'expired' },
    {
      where: {
        status: 'active',
        expiresAt: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    }
  );
  return affectedCount;
};

module.exports = QRCode;