const { UserAddress } = require('../models');
const { geocodingService } = require('../config/geocoding');
const { cacheService } = require('../config/redis');
const { logger } = require('../config/logger');

class AddressService {
  constructor() {
    this.geocodingService = geocodingService;
    this.cacheService = cacheService;
    this.logger = logger;
  }

  // Get user addresses
  async getUserAddresses(userId) {
    try {
      // Check cache first
      const cacheKey = `user:addresses:${userId}`;
      const cachedAddresses = await this.cacheService.get(cacheKey);
      
      if (cachedAddresses) {
        this.logger.debug('Addresses retrieved from cache', { userId });
        return cachedAddresses;
      }

      // Fetch from database
      const addresses = await UserAddress.findByUserId(userId);
      
      // Format addresses
      const formattedAddresses = addresses.map(addr => this.formatAddress(addr));
      
      // Cache the result
      await this.cacheService.set(cacheKey, formattedAddresses, 600); // 10 minutes

      this.logger.info('User addresses retrieved successfully', { 
        userId, 
        count: addresses.length 
      });

      return formattedAddresses;
    } catch (error) {
      this.logger.error('Error retrieving user addresses', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Add new address
  async addAddress(userId, addressData, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to add address for this user');
      }

      // Validate address data
      const validatedData = this.validateAddressData(addressData);
      
      // Geocode address
      const coordinates = await this.geocodeAddress(validatedData);
      
      // Validate geocoded address
      if (!coordinates) {
        throw new Error('Unable to geocode the provided address');
      }

      // Create address
      const address = await UserAddress.create({
        ...validatedData,
        userId,
        coordinates: {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat]
        }
      });

      // Invalidate cache
      await this.invalidateAddressCache(userId);

      const formattedAddress = this.formatAddress(address);

      this.logger.info('Address added successfully', { 
        userId, 
        addressId: address.id,
        type: address.type 
      });

      return formattedAddress;
    } catch (error) {
      this.logger.error('Error adding address', {
        userId,
        error: error.message,
        addressData: { ...addressData, coordinates: undefined }
      });
      throw error;
    }
  }

  // Update address
  async updateAddress(userId, addressId, updateData, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to update this address');
      }

      // Get existing address
      const address = await UserAddress.findOne({
        where: { id: addressId, userId }
      });

      if (!address) {
        throw new Error('Address not found');
      }

      // Validate update data
      const validatedData = this.validateAddressData(updateData, true);
      
      // Check if address fields changed (need re-geocoding)
      const addressFieldsChanged = ['street', 'city', 'state', 'postalCode', 'country']
        .some(field => validatedData[field] && validatedData[field] !== address[field]);

      let coordinates = null;
      if (addressFieldsChanged) {
        // Re-geocode if address changed
        const addressForGeocoding = {
          street: validatedData.street || address.street,
          city: validatedData.city || address.city,
          state: validatedData.state || address.state,
          postalCode: validatedData.postalCode || address.postalCode,
          country: validatedData.country || address.country
        };
        
        coordinates = await this.geocodeAddress(addressForGeocoding);
        
        if (coordinates) {
          validatedData.coordinates = {
            type: 'Point',
            coordinates: [coordinates.lng, coordinates.lat]
          };
          validatedData.isVerified = false; // Reset verification status
        }
      }

      // Update address
      await address.update(validatedData);
      
      // Invalidate cache
      await this.invalidateAddressCache(userId);

      const updatedAddress = this.formatAddress(address);

      this.logger.info('Address updated successfully', { 
        userId, 
        addressId,
        updatedFields: Object.keys(validatedData),
        reGeocoded: !!coordinates
      });

      return updatedAddress;
    } catch (error) {
      this.logger.error('Error updating address', {
        userId,
        addressId,
        error: error.message
      });
      throw error;
    }
  }

  // Delete address
  async deleteAddress(userId, addressId, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to delete this address');
      }

      // Get address
      const address = await UserAddress.findOne({
        where: { id: addressId, userId }
      });

      if (!address) {
        throw new Error('Address not found');
      }

      // Check if it's the default address
      if (address.isDefault) {
        // Check if user has other addresses
        const otherAddresses = await UserAddress.findAll({
          where: { 
            userId, 
            id: { [UserAddress.sequelize.Sequelize.Op.ne]: addressId }
          }
        });

        if (otherAddresses.length > 0) {
          // Set the first other address as default
          await otherAddresses[0].update({ isDefault: true });
          this.logger.info('Default address transferred', {
            userId,
            fromAddressId: addressId,
            toAddressId: otherAddresses[0].id
          });
        }
      }

      // Delete address
      await address.destroy();
      
      // Invalidate cache
      await this.invalidateAddressCache(userId);

      this.logger.info('Address deleted successfully', { 
        userId, 
        addressId,
        wasDefault: address.isDefault
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting address', {
        userId,
        addressId,
        error: error.message
      });
      throw error;
    }
  }

  // Set default address
  async setDefaultAddress(userId, addressId, requesterId = null) {
    try {
      // Check permissions
      if (requesterId && requesterId !== userId) {
        throw new Error('Unauthorized to set default address for this user');
      }

      // Get address
      const address = await UserAddress.findOne({
        where: { id: addressId, userId }
      });

      if (!address) {
        throw new Error('Address not found');
      }

      if (address.isDefault) {
        throw new Error('Address is already set as default');
      }

      // Unset current default
      await UserAddress.update(
        { isDefault: false },
        { where: { userId, isDefault: true } }
      );

      // Set new default
      await address.update({ isDefault: true });
      
      // Invalidate cache
      await this.invalidateAddressCache(userId);

      this.logger.info('Default address updated', { 
        userId, 
        addressId 
      });

      return this.formatAddress(address);
    } catch (error) {
      this.logger.error('Error setting default address', {
        userId,
        addressId,
        error: error.message
      });
      throw error;
    }
  }

  // Find nearby addresses
  async findNearbyAddresses(lat, lng, radiusKm = 10, limit = 50) {
    try {
      const addresses = await UserAddress.findNearby(lat, lng, radiusKm, limit);
      
      const formattedAddresses = addresses.map(addr => ({
        ...this.formatAddress(addr),
        distance: this.calculateDistance(lat, lng, addr.latitude, addr.longitude)
      }));

      this.logger.info('Nearby addresses found', {
        lat,
        lng,
        radiusKm,
        count: addresses.length
      });

      return formattedAddresses;
    } catch (error) {
      this.logger.error('Error finding nearby addresses', {
        lat,
        lng,
        radiusKm,
        error: error.message
      });
      throw error;
    }
  }

  // Geocode address
  async geocodeAddress(addressData) {
    try {
      // Create cache key for geocoding
      const addressString = this.formatAddressString(addressData);
      const cacheKey = `geocode:${Buffer.from(addressString).toString('base64')}`;
      
      // Check cache first
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        this.logger.debug('Geocoding result retrieved from cache', { addressString });
        return cachedResult;
      }

      // Geocode using service
      const result = await this.geocodingService.geocodeAddress(addressData);
      
      // Cache result for 24 hours
      if (result) {
        await this.cacheService.set(cacheKey, result, 86400);
      }

      this.logger.debug('Address geocoded successfully', {
        address: addressString,
        coordinates: result ? { lat: result.lat, lng: result.lng } : null,
        provider: result?.provider
      });

      return result;
    } catch (error) {
      this.logger.error('Error geocoding address', {
        addressData,
        error: error.message
      });
      return null; // Return null instead of throwing to allow address creation without coordinates
    }
  }

  // Reverse geocode coordinates
  async reverseGeocode(lat, lng) {
    try {
      const cacheKey = `reverse_geocode:${lat}:${lng}`;
      
      // Check cache first
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        this.logger.debug('Reverse geocoding result retrieved from cache', { lat, lng });
        return cachedResult;
      }

      // Reverse geocode using service
      const result = await this.geocodingService.reverseGeocode(lat, lng);
      
      // Cache result for 24 hours
      if (result) {
        await this.cacheService.set(cacheKey, result, 86400);
      }

      this.logger.debug('Coordinates reverse geocoded successfully', {
        coordinates: { lat, lng },
        result: result?.formatted_address
      });

      return result;
    } catch (error) {
      this.logger.error('Error reverse geocoding coordinates', {
        lat,
        lng,
        error: error.message
      });
      return null;
    }
  }

  // Validate address data
  validateAddressData(addressData, isUpdate = false) {
    const requiredFields = isUpdate ? [] : ['street', 'city', 'postalCode', 'country'];
    const allowedFields = [
      'type', 'label', 'street', 'city', 'state', 'postalCode', 'country', 'isDefault'
    ];

    // Check required fields for new addresses
    for (const field of requiredFields) {
      if (!addressData[field] || addressData[field].trim() === '') {
        throw new Error(`${field} is required`);
      }
    }

    // Validate and sanitize data
    const validatedData = {};
    
    for (const field of allowedFields) {
      if (addressData[field] !== undefined) {
        let value = addressData[field];
        
        // Sanitize string fields
        if (typeof value === 'string') {
          value = value.trim();
          
          // Validate length
          const maxLengths = {
            label: 100,
            street: 255,
            city: 100,
            state: 100,
            postalCode: 20
          };
          
          if (maxLengths[field] && value.length > maxLengths[field]) {
            throw new Error(`${field} must be less than ${maxLengths[field]} characters`);
          }
        }
        
        // Validate specific fields
        if (field === 'type' && !['home', 'work', 'other'].includes(value)) {
          throw new Error('Address type must be home, work, or other');
        }
        
        if (field === 'country' && value.length !== 2) {
          throw new Error('Country must be a 2-letter ISO code');
        }
        
        if (field === 'country') {
          value = value.toUpperCase();
        }
        
        validatedData[field] = value;
      }
    }

    return validatedData;
  }

  // Format address for response
  formatAddress(address) {
    const coords = address.getCoordinates();
    
    return {
      id: address.id,
      type: address.type,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      coordinates: coords,
      isDefault: address.isDefault,
      isVerified: address.isVerified,
      formattedAddress: address.getFormattedAddress(),
      createdAt: address.createdAt,
      updatedAt: address.updatedAt
    };
  }

  // Format address as string for geocoding
  formatAddressString(addressData) {
    const parts = [];
    
    if (addressData.street) parts.push(addressData.street);
    if (addressData.city) parts.push(addressData.city);
    if (addressData.state) parts.push(addressData.state);
    if (addressData.postalCode) parts.push(addressData.postalCode);
    if (addressData.country) parts.push(addressData.country);
    
    return parts.join(', ');
  }

  // Calculate distance between two points
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Invalidate address cache
  async invalidateAddressCache(userId) {
    await this.cacheService.invalidatePattern(`user:addresses:${userId}*`);
    this.logger.debug('Address cache invalidated', { userId });
  }
}

module.exports = new AddressService();