const { body, param, query } = require('express-validator');

class ValidationMiddleware {
  // Delivery request validation
  validateCreateDeliveryRequest() {
    return [
      body('title')
        .isLength({ min: 5, max: 255 })
        .withMessage('Title must be between 5 and 255 characters'),
      
      body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters'),
      
      body('category')
        .isIn(['documents', 'electronics', 'clothing', 'food', 'fragile', 'books', 'gifts', 'other'])
        .withMessage('Invalid category'),
      
      body('urgency')
        .optional()
        .isIn(['standard', 'express', 'urgent'])
        .withMessage('Invalid urgency level'),
      
      // Item validation
      body('item.name')
        .isLength({ min: 2, max: 255 })
        .withMessage('Item name must be between 2 and 255 characters'),
      
      body('item.weight')
        .isFloat({ min: 0.01, max: 100 })
        .withMessage('Weight must be between 0.01 and 100 kg'),
      
      body('item.quantity')
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage('Quantity must be between 1 and 10'),
      
      body('item.value')
        .optional()
        .isFloat({ min: 0, max: 10000 })
        .withMessage('Value must be between 0 and 10,000'),
      
      body('item.dimensions.length')
        .optional()
        .isFloat({ min: 1, max: 200 })
        .withMessage('Length must be between 1 and 200 cm'),
      
      body('item.dimensions.width')
        .optional()
        .isFloat({ min: 1, max: 200 })
        .withMessage('Width must be between 1 and 200 cm'),
      
      body('item.dimensions.height')
        .optional()
        .isFloat({ min: 1, max: 200 })
        .withMessage('Height must be between 1 and 200 cm'),
      
      // Pickup validation
      body('pickup.address')
        .isLength({ min: 10, max: 500 })
        .withMessage('Pickup address must be between 10 and 500 characters'),
      
      body('pickup.coordinates.lat')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid pickup latitude'),
      
      body('pickup.coordinates.lng')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid pickup longitude'),
      
      body('pickup.contactName')
        .optional()
        .isLength({ min: 2, max: 255 })
        .withMessage('Contact name must be between 2 and 255 characters'),
      
      body('pickup.contactPhone')
        .optional()
        .matches(/^[+]?[\d\s\-\(\)]{10,20}$/)
        .withMessage('Invalid phone number format'),
      
      body('pickup.timeWindow.start')
        .optional()
        .isISO8601()
        .withMessage('Invalid pickup start time format'),
      
      body('pickup.timeWindow.end')
        .optional()
        .isISO8601()
        .withMessage('Invalid pickup end time format'),
      
      // Delivery validation
      body('delivery.address')
        .isLength({ min: 10, max: 500 })
        .withMessage('Delivery address must be between 10 and 500 characters'),
      
      body('delivery.coordinates.lat')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid delivery latitude'),
      
      body('delivery.coordinates.lng')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid delivery longitude'),
      
      body('delivery.contactName')
        .optional()
        .isLength({ min: 2, max: 255 })
        .withMessage('Contact name must be between 2 and 255 characters'),
      
      body('delivery.contactPhone')
        .optional()
        .matches(/^[+]?[\d\s\-\(\)]{10,20}$/)
        .withMessage('Invalid phone number format'),
      
      body('delivery.timeWindow.start')
        .optional()
        .isISO8601()
        .withMessage('Invalid delivery start time format'),
      
      body('delivery.timeWindow.end')
        .optional()
        .isISO8601()
        .withMessage('Invalid delivery end time format'),
      
      // Pricing validation
      body('pricing.maxPrice')
        .optional()
        .isFloat({ min: 1, max: 1000 })
        .withMessage('Max price must be between $1 and $1,000'),
      
      body('maxPrice')
        .optional()
        .isFloat({ min: 1, max: 1000 })
        .withMessage('Max price must be between $1 and $1,000'),
      
      body('pricing.autoAcceptPrice')
        .optional()
        .isFloat({ min: 1, max: 1000 })
        .withMessage('Auto-accept price must be between $1 and $1,000'),
      
      body('autoAcceptPrice')
        .optional()
        .isFloat({ min: 1, max: 1000 })
        .withMessage('Auto-accept price must be between $1 and $1,000'),
      
      // Preferences validation
      body('preferences.minTravelerRating')
        .optional()
        .isFloat({ min: 0, max: 5 })
        .withMessage('Minimum traveler rating must be between 0 and 5'),
      
      body('expiresAt')
        .optional()
        .isISO8601()
        .withMessage('Invalid expiration date format')
    ];
  }

  validateUpdateDeliveryRequest() {
    return [
      body('title')
        .optional()
        .isLength({ min: 5, max: 255 })
        .withMessage('Title must be between 5 and 255 characters'),
      
      body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters'),
      
      body('maxPrice')
        .optional()
        .isFloat({ min: 1, max: 1000 })
        .withMessage('Max price must be between $1 and $1,000'),
      
      body('pickup.timeWindow.start')
        .optional()
        .isISO8601()
        .withMessage('Invalid pickup start time format'),
      
      body('pickup.timeWindow.end')
        .optional()
        .isISO8601()
        .withMessage('Invalid pickup end time format'),
      
      body('specialInstructions')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Special instructions must be less than 1000 characters')
    ];
  }

  // Offer validation
  validateCreateOffer() {
    return [
      body('price')
        .isFloat({ min: 1, max: 1000 })
        .withMessage('Price must be between $1 and $1,000'),
      
      body('message')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Message must be less than 500 characters'),
      
      body('tripId')
        .optional()
        .isUUID()
        .withMessage('Invalid trip ID format'),
      
      body('estimatedPickupTime')
        .optional()
        .isISO8601()
        .withMessage('Invalid pickup time format'),
      
      body('estimatedDeliveryTime')
        .optional()
        .isISO8601()
        .withMessage('Invalid delivery time format'),
      
      body('validUntil')
        .optional()
        .isISO8601()
        .withMessage('Invalid expiration time format')
    ];
  }

  validateUpdateOffer() {
    return [
      body('price')
        .optional()
        .isFloat({ min: 1, max: 1000 })
        .withMessage('Price must be between $1 and $1,000'),
      
      body('message')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Message must be less than 500 characters'),
      
      body('estimatedPickupTime')
        .optional()
        .isISO8601()
        .withMessage('Invalid pickup time format'),
      
      body('estimatedDeliveryTime')
        .optional()
        .isISO8601()
        .withMessage('Invalid delivery time format'),
      
      body('validUntil')
        .optional()
        .isISO8601()
        .withMessage('Invalid expiration time format')
    ];
  }

  // Parameter validation
  validateUUID() {
    return [
      param('requestId')
        .optional()
        .isUUID()
        .withMessage('Invalid request ID format'),
      
      param('offerId')
        .optional()
        .isUUID()
        .withMessage('Invalid offer ID format'),
      
      param('deliveryId')
        .optional()
        .isUUID()
        .withMessage('Invalid delivery ID format')
    ];
  }

  // Query parameter validation
  validateSearchQuery() {
    return [
      query('originLat')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid origin latitude'),
      
      query('originLng')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid origin longitude'),
      
      query('destinationLat')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid destination latitude'),
      
      query('destinationLng')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid destination longitude'),
      
      query('radius')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('Radius must be between 1 and 500 km'),
      
      query('category')
        .optional()
        .isIn(['documents', 'electronics', 'clothing', 'food', 'fragile', 'books', 'gifts', 'other'])
        .withMessage('Invalid category'),
      
      query('urgency')
        .optional()
        .isIn(['standard', 'express', 'urgent'])
        .withMessage('Invalid urgency level'),
      
      query('minPrice')
        .optional()
        .isFloat({ min: 0, max: 1000 })
        .withMessage('Min price must be between $0 and $1,000'),
      
      query('maxPrice')
        .optional()
        .isFloat({ min: 0, max: 1000 })
        .withMessage('Max price must be between $0 and $1,000'),
      
      query('maxWeight')
        .optional()
        .isFloat({ min: 0.01, max: 100 })
        .withMessage('Max weight must be between 0.01 and 100 kg'),
      
      query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be between 1 and 1,000'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      
      query('sortBy')
        .optional()
        .isIn(['price', 'distance', 'created', 'urgency'])
        .withMessage('Invalid sort option')
    ];
  }

  validatePaginationQuery() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be between 1 and 1,000'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
    ];
  }

  // Cancel/decline/withdraw validation
  validateCancellationReason() {
    return [
      body('reason')
        .optional()
        .isIn([
          'no_longer_needed',
          'found_alternative', 
          'too_expensive',
          'schedule_changed',
          'found_better_option',
          'no_longer_available',
          'price_too_high',
          'timing_not_suitable',
          'prefer_other_traveler',
          'other'
        ])
        .withMessage('Invalid reason'),
      
      body('message')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Message must be less than 500 characters')
    ];
  }

  // Accept offer validation
  validateAcceptOffer() {
    return [
      body('message')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Message must be less than 500 characters'),
      
      body('paymentMethod')
        .optional()
        .isIn(['card', 'wallet', 'bank_transfer'])
        .withMessage('Invalid payment method'),
      
      body('specialRequests')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Special requests must be less than 500 characters')
    ];
  }
}

module.exports = new ValidationMiddleware();