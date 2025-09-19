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
    type: DataTypes.ENUM('pickup', 'delivery'),
    allowNull: false,
    field: 'qr_type'
  },
  
  encryptedData: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'encrypted_data'
  },
  
  imageData: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'image_data'
  },
  
  downloadUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'download_url'
  },
  
  backupCodeHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'backup_code_hash'
  },
  
  securityLevel: {
    type: DataTypes.ENUM('standard', 'high', 'maximum'),
    allowNull: false,
    defaultValue: 'standard',
    field: 'security_level'
  },
  
  securityFeatures: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'security_features'
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
  
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'created_by'
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
  },
  
  additionalData: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'additional_data'
  },
  
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
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