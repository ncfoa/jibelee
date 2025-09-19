const express = require('express');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, sendSuccessResponse } = require('../middleware/errorHandler');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route GET /api/v1/location/geocode
 * @desc Forward and reverse geocoding
 * @access Private
 */
router.get('/',
  validate('geocode', 'query'),
  asyncHandler(async (req, res) => {
    const { address, lat, lng, type, country, limit = 5 } = req.query;

    let results = [];

    if (type === 'forward' && address) {
      // Forward geocoding - address to coordinates
      // Mock implementation - in production, use Google Maps/Mapbox API
      results = [
        {
          formattedAddress: `${address}, Mock City, MC 12345, USA`,
          location: {
            lat: 40.7128 + (Math.random() - 0.5) * 0.01,
            lng: -74.0060 + (Math.random() - 0.5) * 0.01
          },
          addressComponents: {
            streetNumber: '123',
            streetName: address.split(' ').slice(0, -1).join(' ') || 'Main St',
            city: 'Mock City',
            state: 'MC',
            postalCode: '12345',
            country: 'USA',
            countryCode: 'US'
          },
          placeId: `place_${Date.now()}`,
          confidence: 0.95,
          accuracy: 'rooftop',
          types: ['street_address']
        }
      ];
    } else if (type === 'reverse' && lat && lng) {
      // Reverse geocoding - coordinates to address
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      results = [
        {
          formattedAddress: `123 Mock Street, Near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}, Mock City, MC 12345, USA`,
          location: {
            lat: latitude,
            lng: longitude
          },
          addressComponents: {
            streetNumber: '123',
            streetName: 'Mock Street',
            city: 'Mock City',
            state: 'MC',
            postalCode: '12345',
            country: 'USA',
            countryCode: 'US'
          },
          placeId: `place_${Date.now()}`,
          confidence: 0.88,
          accuracy: 'interpolated',
          types: ['street_address']
        }
      ];
    }

    // Apply country filter if specified
    if (country) {
      results = results.filter(result => 
        result.addressComponents.countryCode.toLowerCase() === country.toLowerCase()
      );
    }

    // Limit results
    results = results.slice(0, parseInt(limit));

    const bounds = results.length > 0 ? {
      north: Math.max(...results.map(r => r.location.lat)) + 0.001,
      south: Math.min(...results.map(r => r.location.lat)) - 0.001,
      east: Math.max(...results.map(r => r.location.lng)) + 0.001,
      west: Math.min(...results.map(r => r.location.lng)) - 0.001
    } : null;

    sendSuccessResponse(res, {
      query: address || `${lat}, ${lng}`,
      type,
      results,
      bounds,
      resultCount: results.length
    });
  })
);

/**
 * @route POST /api/v1/location/geocode/batch
 * @desc Batch geocoding for multiple addresses or coordinates
 * @access Private
 */
router.post('/batch',
  asyncHandler(async (req, res) => {
    const { requests } = req.body;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Requests array is required'
      });
    }

    if (requests.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 requests allowed per batch'
      });
    }

    const results = requests.map((request, index) => {
      const { address, lat, lng, type } = request;
      
      let geocodeResults = [];

      if (type === 'forward' && address) {
        geocodeResults = [
          {
            formattedAddress: `${address}, Mock City, MC 12345, USA`,
            location: {
              lat: 40.7128 + (Math.random() - 0.5) * 0.1,
              lng: -74.0060 + (Math.random() - 0.5) * 0.1
            },
            confidence: 0.85 + Math.random() * 0.15
          }
        ];
      } else if (type === 'reverse' && lat && lng) {
        geocodeResults = [
          {
            formattedAddress: `Mock Address near ${lat}, ${lng}`,
            location: {
              lat: parseFloat(lat),
              lng: parseFloat(lng)
            },
            confidence: 0.80 + Math.random() * 0.20
          }
        ];
      }

      return {
        requestId: index,
        success: geocodeResults.length > 0,
        results: geocodeResults,
        error: geocodeResults.length === 0 ? 'No results found' : null
      };
    });

    const summary = {
      totalRequests: requests.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    sendSuccessResponse(res, {
      results,
      summary
    });
  })
);

/**
 * @route GET /api/v1/location/geocode/suggestions
 * @desc Get autocomplete suggestions for addresses
 * @access Private
 */
router.get('/suggestions',
  asyncHandler(async (req, res) => {
    const { input, country, limit = 5 } = req.query;

    if (!input || input.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Input must be at least 2 characters'
      });
    }

    // Mock autocomplete suggestions
    const suggestions = [
      {
        description: `${input} Street, Mock City, MC, USA`,
        placeId: `suggestion_1_${Date.now()}`,
        types: ['route'],
        matchedSubstrings: [{ offset: 0, length: input.length }]
      },
      {
        description: `${input} Avenue, Mock City, MC, USA`,
        placeId: `suggestion_2_${Date.now()}`,
        types: ['route'],
        matchedSubstrings: [{ offset: 0, length: input.length }]
      },
      {
        description: `${input} Plaza, Mock City, MC, USA`,
        placeId: `suggestion_3_${Date.now()}`,
        types: ['establishment'],
        matchedSubstrings: [{ offset: 0, length: input.length }]
      }
    ].slice(0, parseInt(limit));

    sendSuccessResponse(res, {
      input,
      suggestions,
      count: suggestions.length
    });
  })
);

/**
 * @route GET /api/v1/location/geocode/place/:placeId
 * @desc Get detailed place information by place ID
 * @access Private
 */
router.get('/place/:placeId',
  asyncHandler(async (req, res) => {
    const { placeId } = req.params;

    // Mock place details
    const placeDetails = {
      placeId,
      name: 'Mock Location',
      formattedAddress: '123 Mock Street, Mock City, MC 12345, USA',
      location: {
        lat: 40.7128 + (Math.random() - 0.5) * 0.01,
        lng: -74.0060 + (Math.random() - 0.5) * 0.01
      },
      addressComponents: {
        streetNumber: '123',
        streetName: 'Mock Street',
        city: 'Mock City',
        state: 'MC',
        postalCode: '12345',
        country: 'USA',
        countryCode: 'US'
      },
      types: ['establishment', 'point_of_interest'],
      businessStatus: 'OPERATIONAL',
      rating: 4.2,
      userRatingsTotal: 156,
      phoneNumber: '+1234567890',
      website: 'https://example.com',
      openingHours: {
        openNow: true,
        periods: [
          {
            open: { day: 1, time: '0900' },
            close: { day: 1, time: '1700' }
          }
        ]
      },
      photos: [
        {
          photoReference: 'mock_photo_reference',
          height: 400,
          width: 600
        }
      ]
    };

    sendSuccessResponse(res, placeDetails);
  })
);

module.exports = router;