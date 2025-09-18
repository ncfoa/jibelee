const addressService = require('../services/addressService');
const { logger } = require('../config/logger');

class AddressController {
  constructor() {
    this.logger = logger;
  }

  // Get user addresses
  getUserAddresses = async (req, res) => {
    try {
      const userId = req.user.id;
      const addresses = await addressService.getUserAddresses(userId);

      res.json({
        success: true,
        data: addresses
      });
    } catch (error) {
      this.logger.error('Error getting user addresses', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve addresses',
        errors: [error.message]
      });
    }
  };

  // Add new address
  addAddress = async (req, res) => {
    try {
      const userId = req.user.id;
      const addressData = req.body;

      const address = await addressService.addAddress(userId, addressData, userId);

      res.status(201).json({
        success: true,
        message: 'Address added successfully',
        data: address
      });
    } catch (error) {
      this.logger.error('Error adding address', {
        userId: req.user?.id,
        error: error.message,
        addressData: { ...req.body, coordinates: undefined }
      });

      if (error.message.includes('required') || error.message.includes('must be')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      if (error.message.includes('geocode')) {
        return res.status(400).json({
          success: false,
          message: 'Address validation failed',
          errors: ['Unable to validate the provided address. Please check the address details.']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add address',
        errors: [error.message]
      });
    }
  };

  // Update address
  updateAddress = async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;
      const updateData = req.body;

      const address = await addressService.updateAddress(
        userId, 
        addressId, 
        updateData, 
        userId
      );

      res.json({
        success: true,
        message: 'Address updated successfully',
        data: address
      });
    } catch (error) {
      this.logger.error('Error updating address', {
        userId: req.user?.id,
        addressId: req.params.addressId,
        error: error.message
      });

      if (error.message === 'Address not found') {
        return res.status(404).json({
          success: false,
          message: 'Address not found',
          errors: ['The requested address could not be found']
        });
      }

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errors: [error.message]
        });
      }

      if (error.message.includes('must be') || error.message.includes('required')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update address',
        errors: [error.message]
      });
    }
  };

  // Delete address
  deleteAddress = async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;

      const result = await addressService.deleteAddress(userId, addressId, userId);

      res.json({
        success: true,
        message: 'Address deleted successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error deleting address', {
        userId: req.user?.id,
        addressId: req.params.addressId,
        error: error.message
      });

      if (error.message === 'Address not found') {
        return res.status(404).json({
          success: false,
          message: 'Address not found',
          errors: ['The requested address could not be found']
        });
      }

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete address',
        errors: [error.message]
      });
    }
  };

  // Set default address
  setDefaultAddress = async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;

      const address = await addressService.setDefaultAddress(userId, addressId, userId);

      res.json({
        success: true,
        message: 'Default address updated successfully',
        data: address
      });
    } catch (error) {
      this.logger.error('Error setting default address', {
        userId: req.user?.id,
        addressId: req.params.addressId,
        error: error.message
      });

      if (error.message === 'Address not found') {
        return res.status(404).json({
          success: false,
          message: 'Address not found',
          errors: ['The requested address could not be found']
        });
      }

      if (error.message.includes('already set as default')) {
        return res.status(400).json({
          success: false,
          message: 'Address is already default',
          errors: ['This address is already set as default']
        });
      }

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          errors: [error.message]
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to set default address',
        errors: [error.message]
      });
    }
  };

  // Geocode address
  geocodeAddress = async (req, res) => {
    try {
      const addressData = req.body;

      const result = await addressService.geocodeAddress(addressData);

      if (!result) {
        return res.status(400).json({
          success: false,
          message: 'Geocoding failed',
          errors: ['Unable to geocode the provided address']
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error geocoding address', {
        addressData: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Geocoding service error',
        errors: [error.message]
      });
    }
  };

  // Reverse geocode coordinates
  reverseGeocode = async (req, res) => {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: ['Latitude and longitude are required']
        });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: ['Invalid latitude or longitude values']
        });
      }

      const result = await addressService.reverseGeocode(latitude, longitude);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'No address found',
          errors: ['No address found for the provided coordinates']
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error reverse geocoding', {
        lat: req.query.lat,
        lng: req.query.lng,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Reverse geocoding service error',
        errors: [error.message]
      });
    }
  };

  // Find nearby addresses (for admin/analytics)
  findNearbyAddresses = async (req, res) => {
    try {
      const { lat, lng } = req.query;
      const radius = parseFloat(req.query.radius) || 10;
      const limit = parseInt(req.query.limit) || 50;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: ['Latitude and longitude are required']
        });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: ['Invalid latitude or longitude values']
        });
      }

      const addresses = await addressService.findNearbyAddresses(
        latitude, 
        longitude, 
        radius, 
        limit
      );

      res.json({
        success: true,
        data: addresses,
        meta: {
          center: { lat: latitude, lng: longitude },
          radius,
          count: addresses.length
        }
      });
    } catch (error) {
      this.logger.error('Error finding nearby addresses', {
        lat: req.query.lat,
        lng: req.query.lng,
        radius: req.query.radius,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to find nearby addresses',
        errors: [error.message]
      });
    }
  };

  // Validate address (utility endpoint)
  validateAddress = async (req, res) => {
    try {
      const addressData = req.body;

      // Validate address data format
      try {
        addressService.validateAddressData(addressData);
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          message: 'Address validation failed',
          errors: [validationError.message]
        });
      }

      // Try to geocode to validate
      const geocodeResult = await addressService.geocodeAddress(addressData);

      const result = {
        valid: !!geocodeResult,
        formatted: geocodeResult?.formatted_address,
        coordinates: geocodeResult ? {
          lat: geocodeResult.lat,
          lng: geocodeResult.lng
        } : null,
        accuracy: geocodeResult?.accuracy,
        provider: geocodeResult?.provider
      };

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error validating address', {
        addressData: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Address validation service error',
        errors: [error.message]
      });
    }
  };
}

module.exports = new AddressController();