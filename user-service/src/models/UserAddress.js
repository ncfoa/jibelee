const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserAddress = sequelize.define('UserAddress', {
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
    type: {
      type: DataTypes.ENUM('home', 'work', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [1, 100]
      }
    },
    street: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [5, 255],
        notEmpty: true
      }
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [2, 100]
      }
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'postal_code',
      validate: {
        len: [3, 20],
        notEmpty: true
      }
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        len: [2, 2],
        isUppercase: true,
        isAlpha: true
      }
    },
    coordinates: {
      type: DataTypes.GEOGRAPHY('POINT', 4326),
      allowNull: true
    },
    latitude: {
      type: DataTypes.VIRTUAL,
      get() {
        const coords = this.getDataValue('coordinates');
        return coords ? coords.coordinates[1] : null;
      }
    },
    longitude: {
      type: DataTypes.VIRTUAL,
      get() {
        const coords = this.getDataValue('coordinates');
        return coords ? coords.coordinates[0] : null;
      }
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified'
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at'
    }
  }, {
    tableName: 'user_addresses',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['user_id', 'is_default'],
        where: {
          is_default: true
        }
      },
      {
        fields: ['type']
      },
      {
        fields: ['country']
      },
      {
        fields: ['city']
      },
      {
        type: 'GIST',
        fields: ['coordinates']
      }
    ],
    validate: {
      // Ensure only one default address per user
      async onlyOneDefault() {
        if (this.isDefault) {
          const existingDefault = await UserAddress.findOne({
            where: {
              userId: this.userId,
              isDefault: true,
              id: { [sequelize.Sequelize.Op.ne]: this.id || null }
            }
          });
          
          if (existingDefault) {
            throw new Error('User can only have one default address');
          }
        }
      }
    },
    hooks: {
      beforeCreate: async (address) => {
        // If this is the user's first address, make it default
        const addressCount = await UserAddress.count({
          where: { userId: address.userId }
        });
        
        if (addressCount === 0) {
          address.isDefault = true;
        }
      },
      beforeUpdate: async (address) => {
        // If setting as default, unset other default addresses
        if (address.changed('isDefault') && address.isDefault) {
          await UserAddress.update(
            { isDefault: false },
            {
              where: {
                userId: address.userId,
                id: { [sequelize.Sequelize.Op.ne]: address.id }
              }
            }
          );
        }
      }
    }
  });

  // Instance methods
  UserAddress.prototype.getFormattedAddress = function() {
    const parts = [this.street, this.city];
    if (this.state) parts.push(this.state);
    parts.push(this.postalCode, this.country);
    return parts.join(', ');
  };

  UserAddress.prototype.getCoordinates = function() {
    if (this.coordinates) {
      return {
        lat: this.coordinates.coordinates[1],
        lng: this.coordinates.coordinates[0]
      };
    }
    return null;
  };

  UserAddress.prototype.setCoordinates = function(lat, lng) {
    if (lat && lng) {
      this.coordinates = {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      };
    }
  };

  UserAddress.prototype.getDistance = function(lat, lng) {
    if (!this.coordinates) return null;
    
    const coords = this.getCoordinates();
    if (!coords) return null;
    
    return calculateDistance(coords.lat, coords.lng, lat, lng);
  };

  // Class methods
  UserAddress.findByUserId = function(userId, includeDeleted = false) {
    const where = { userId };
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    
    return this.findAll({
      where,
      order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
    });
  };

  UserAddress.findDefaultByUserId = function(userId) {
    return this.findOne({
      where: {
        userId,
        isDefault: true
      }
    });
  };

  UserAddress.findNearby = function(lat, lng, radiusKm = 10, limit = 50) {
    return this.findAll({
      where: sequelize.where(
        sequelize.fn(
          'ST_DWithin',
          sequelize.col('coordinates'),
          sequelize.fn('ST_GeogFromText', `POINT(${lng} ${lat})`),
          radiusKm * 1000
        ),
        true
      ),
      limit,
      order: sequelize.literal(`
        ST_Distance(coordinates, ST_GeogFromText('POINT(${lng} ${lat})')) ASC
      `)
    });
  };

  // Associations
  UserAddress.associate = function(models) {
    UserAddress.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
  };

  return UserAddress;
};

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}