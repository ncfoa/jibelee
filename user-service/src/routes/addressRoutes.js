const express = require('express');
const addressController = require('../controllers/addressController');
const { auth, validation } = require('../middleware');

const router = express.Router();

// Get user addresses
router.get('/me/addresses',
  auth.authenticateToken,
  addressController.getUserAddresses
);

// Add new address
router.post('/me/addresses',
  auth.authenticateToken,
  validation.addressValidation(),
  addressController.addAddress
);

// Update address
router.put('/me/addresses/:addressId',
  auth.authenticateToken,
  validation.uuidParamValidation('addressId'),
  validation.addressUpdateValidation(),
  addressController.updateAddress
);

// Delete address
router.delete('/me/addresses/:addressId',
  auth.authenticateToken,
  validation.uuidParamValidation('addressId'),
  addressController.deleteAddress
);

// Set default address
router.post('/me/addresses/:addressId/default',
  auth.authenticateToken,
  validation.uuidParamValidation('addressId'),
  addressController.setDefaultAddress
);

// Utility endpoints

// Geocode address
router.post('/geocode',
  auth.authenticateToken,
  validation.addressValidation(),
  addressController.geocodeAddress
);

// Reverse geocode coordinates
router.get('/reverse-geocode',
  auth.authenticateToken,
  validation.coordinatesValidation(),
  addressController.reverseGeocode
);

// Validate address
router.post('/validate-address',
  auth.authenticateToken,
  validation.addressValidation(),
  addressController.validateAddress
);

// Admin endpoints

// Find nearby addresses (admin only)
router.get('/nearby-addresses',
  auth.authenticateToken,
  auth.requireUserType('admin'),
  validation.coordinatesValidation(),
  addressController.findNearbyAddresses
);

module.exports = router;