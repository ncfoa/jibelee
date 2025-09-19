const axios = require('axios');
const { Client } = require('@googlemaps/google-maps-services-js');
const { logger, logApiCall } = require('../config/logger');
const { cache, generateCacheKey } = require('../config/redis');
const { GeoUtils } = require('../utils');

/**
 * Geocoding service for address to coordinates conversion
 */
class GeocodingService {
  constructor() {
    this.googleMapsClient = new Client({});
    this.googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    this.cacheTimeout = 86400; // 24 hours
  }

  /**
   * Geocode an address to coordinates
   * @param {string} address - Address to geocode
   * @param {Object} options - Geocoding options
   * @returns {Object} Geocoding result
   */
  async geocode(address, options = {}) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Valid address is required');
      }

      const cleanAddress = address.trim();
      if (cleanAddress.length === 0) {
        throw new Error('Address cannot be empty');
      }

      // Check cache first
      const cacheKey = generateCacheKey.geocode(cleanAddress);
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.debug('Geocoding cache hit', { address: cleanAddress });
        return cached;
      }

      let result = null;

      // Try Google Maps first
      if (this.googleApiKey) {
        try {
          result = await this.geocodeWithGoogle(cleanAddress, options);
        } catch (error) {
          logger.warn('Google Maps geocoding failed:', error.message);
        }
      }

      // Fallback to Mapbox if Google fails
      if (!result && this.mapboxToken) {
        try {
          result = await this.geocodeWithMapbox(cleanAddress, options);
        } catch (error) {
          logger.warn('Mapbox geocoding failed:', error.message);
        }
      }

      // Fallback to OpenStreetMap (free service)
      if (!result) {
        try {
          result = await this.geocodeWithOSM(cleanAddress, options);
        } catch (error) {
          logger.warn('OSM geocoding failed:', error.message);
        }
      }

      if (!result) {
        throw new Error('Geocoding failed with all providers');
      }

      // Validate coordinates
      if (!GeoUtils.validateCoordinates(result.coordinates)) {
        throw new Error('Invalid coordinates returned from geocoding');
      }

      // Cache the result
      await cache.set(cacheKey, result, this.cacheTimeout);

      logger.info('Address geocoded successfully', {
        address: cleanAddress,
        coordinates: result.coordinates,
        provider: result.provider
      });

      return result;
    } catch (error) {
      logger.error('Geocoding error:', {
        address,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {Object} coordinates - {lat, lng}
   * @param {Object} options - Reverse geocoding options
   * @returns {Object} Reverse geocoding result
   */
  async reverseGeocode(coordinates, options = {}) {
    try {
      if (!GeoUtils.validateCoordinates(coordinates)) {
        throw new Error('Valid coordinates are required');
      }

      // Check cache first
      const cacheKey = generateCacheKey.reverseGeocode(coordinates);
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.debug('Reverse geocoding cache hit', { coordinates });
        return cached;
      }

      let result = null;

      // Try Google Maps first
      if (this.googleApiKey) {
        try {
          result = await this.reverseGeocodeWithGoogle(coordinates, options);
        } catch (error) {
          logger.warn('Google Maps reverse geocoding failed:', error.message);
        }
      }

      // Fallback to Mapbox
      if (!result && this.mapboxToken) {
        try {
          result = await this.reverseGeocodeWithMapbox(coordinates, options);
        } catch (error) {
          logger.warn('Mapbox reverse geocoding failed:', error.message);
        }
      }

      // Fallback to OpenStreetMap
      if (!result) {
        try {
          result = await this.reverseGeocodeWithOSM(coordinates, options);
        } catch (error) {
          logger.warn('OSM reverse geocoding failed:', error.message);
        }
      }

      if (!result) {
        throw new Error('Reverse geocoding failed with all providers');
      }

      // Cache the result
      await cache.set(cacheKey, result, this.cacheTimeout);

      logger.info('Coordinates reverse geocoded successfully', {
        coordinates,
        address: result.address,
        provider: result.provider
      });

      return result;
    } catch (error) {
      logger.error('Reverse geocoding error:', {
        coordinates,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Geocode with Google Maps
   * @private
   */
  async geocodeWithGoogle(address, options = {}) {
    const startTime = Date.now();
    
    try {
      const response = await this.googleMapsClient.geocode({
        params: {
          address,
          key: this.googleApiKey,
          language: options.language || 'en',
          region: options.region || undefined,
          components: options.components || undefined
        }
      });

      logApiCall('Google Maps', 'geocode', 'GET', Date.now() - startTime, response.status);

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error(`Google geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];
      const location = result.geometry.location;

      return {
        coordinates: {
          lat: location.lat,
          lng: location.lng
        },
        formatted_address: result.formatted_address,
        address_components: result.address_components,
        place_id: result.place_id,
        types: result.types,
        geometry: result.geometry,
        provider: 'google',
        confidence: this.calculateGoogleConfidence(result),
        raw_response: result
      };
    } catch (error) {
      logApiCall('Google Maps', 'geocode', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Geocode with Mapbox
   * @private
   */
  async geocodeWithMapbox(address, options = {}) {
    const startTime = Date.now();
    
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`;
      const params = {
        access_token: this.mapboxToken,
        language: options.language || 'en',
        country: options.country || undefined,
        types: options.types || undefined,
        limit: 1
      };

      const response = await axios.get(url, { params });
      
      logApiCall('Mapbox', 'geocode', 'GET', Date.now() - startTime, response.status);

      if (!response.data.features || !response.data.features.length) {
        throw new Error('No results from Mapbox geocoding');
      }

      const feature = response.data.features[0];
      const [lng, lat] = feature.center;

      return {
        coordinates: { lat, lng },
        formatted_address: feature.place_name,
        address_components: this.parseMapboxComponents(feature),
        place_id: feature.id,
        types: feature.place_type,
        geometry: feature.geometry,
        provider: 'mapbox',
        confidence: feature.relevance || 0.5,
        raw_response: feature
      };
    } catch (error) {
      logApiCall('Mapbox', 'geocode', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Geocode with OpenStreetMap (Nominatim)
   * @private
   */
  async geocodeWithOSM(address, options = {}) {
    const startTime = Date.now();
    
    try {
      const url = 'https://nominatim.openstreetmap.org/search';
      const params = {
        q: address,
        format: 'json',
        limit: 1,
        addressdetails: 1,
        'accept-language': options.language || 'en'
      };

      const response = await axios.get(url, { 
        params,
        headers: {
          'User-Agent': 'P2P-Delivery-Trip-Service/1.0'
        }
      });

      logApiCall('OSM Nominatim', 'geocode', 'GET', Date.now() - startTime, response.status);

      if (!response.data || !response.data.length) {
        throw new Error('No results from OSM geocoding');
      }

      const result = response.data[0];

      return {
        coordinates: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        },
        formatted_address: result.display_name,
        address_components: this.parseOSMComponents(result.address),
        place_id: result.place_id,
        types: [result.type],
        geometry: {
          location_type: result.importance > 0.5 ? 'ROOFTOP' : 'APPROXIMATE',
          bounds: result.boundingbox ? {
            northeast: {
              lat: parseFloat(result.boundingbox[1]),
              lng: parseFloat(result.boundingbox[3])
            },
            southwest: {
              lat: parseFloat(result.boundingbox[0]),
              lng: parseFloat(result.boundingbox[2])
            }
          } : undefined
        },
        provider: 'osm',
        confidence: parseFloat(result.importance) || 0.3,
        raw_response: result
      };
    } catch (error) {
      logApiCall('OSM Nominatim', 'geocode', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Reverse geocode with Google Maps
   * @private
   */
  async reverseGeocodeWithGoogle(coordinates, options = {}) {
    const startTime = Date.now();
    
    try {
      const response = await this.googleMapsClient.reverseGeocode({
        params: {
          latlng: `${coordinates.lat},${coordinates.lng}`,
          key: this.googleApiKey,
          language: options.language || 'en',
          result_type: options.result_type || undefined
        }
      });

      logApiCall('Google Maps', 'reverse-geocode', 'GET', Date.now() - startTime, response.status);

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error(`Google reverse geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];

      return {
        address: result.formatted_address,
        address_components: result.address_components,
        place_id: result.place_id,
        types: result.types,
        provider: 'google',
        confidence: this.calculateGoogleConfidence(result),
        raw_response: result
      };
    } catch (error) {
      logApiCall('Google Maps', 'reverse-geocode', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Reverse geocode with Mapbox
   * @private
   */
  async reverseGeocodeWithMapbox(coordinates, options = {}) {
    const startTime = Date.now();
    
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates.lng},${coordinates.lat}.json`;
      const params = {
        access_token: this.mapboxToken,
        language: options.language || 'en',
        types: options.types || undefined
      };

      const response = await axios.get(url, { params });
      
      logApiCall('Mapbox', 'reverse-geocode', 'GET', Date.now() - startTime, response.status);

      if (!response.data.features || !response.data.features.length) {
        throw new Error('No results from Mapbox reverse geocoding');
      }

      const feature = response.data.features[0];

      return {
        address: feature.place_name,
        address_components: this.parseMapboxComponents(feature),
        place_id: feature.id,
        types: feature.place_type,
        provider: 'mapbox',
        confidence: feature.relevance || 0.5,
        raw_response: feature
      };
    } catch (error) {
      logApiCall('Mapbox', 'reverse-geocode', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Reverse geocode with OpenStreetMap
   * @private
   */
  async reverseGeocodeWithOSM(coordinates, options = {}) {
    const startTime = Date.now();
    
    try {
      const url = 'https://nominatim.openstreetmap.org/reverse';
      const params = {
        lat: coordinates.lat,
        lon: coordinates.lng,
        format: 'json',
        addressdetails: 1,
        'accept-language': options.language || 'en'
      };

      const response = await axios.get(url, { 
        params,
        headers: {
          'User-Agent': 'P2P-Delivery-Trip-Service/1.0'
        }
      });

      logApiCall('OSM Nominatim', 'reverse-geocode', 'GET', Date.now() - startTime, response.status);

      if (!response.data || !response.data.display_name) {
        throw new Error('No results from OSM reverse geocoding');
      }

      const result = response.data;

      return {
        address: result.display_name,
        address_components: this.parseOSMComponents(result.address),
        place_id: result.place_id,
        types: [result.type],
        provider: 'osm',
        confidence: parseFloat(result.importance) || 0.3,
        raw_response: result
      };
    } catch (error) {
      logApiCall('OSM Nominatim', 'reverse-geocode', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Calculate confidence score for Google results
   * @private
   */
  calculateGoogleConfidence(result) {
    let confidence = 0.5; // Base confidence
    
    if (result.geometry.location_type === 'ROOFTOP') {
      confidence = 0.95;
    } else if (result.geometry.location_type === 'RANGE_INTERPOLATED') {
      confidence = 0.8;
    } else if (result.geometry.location_type === 'GEOMETRIC_CENTER') {
      confidence = 0.6;
    }
    
    // Adjust based on types
    if (result.types.includes('street_address')) {
      confidence = Math.min(1.0, confidence + 0.1);
    } else if (result.types.includes('premise')) {
      confidence = Math.min(1.0, confidence + 0.05);
    }
    
    return confidence;
  }

  /**
   * Parse Mapbox address components
   * @private
   */
  parseMapboxComponents(feature) {
    const components = [];
    
    if (feature.properties) {
      const props = feature.properties;
      
      // Map Mapbox properties to Google-like components
      const mapping = {
        address: 'street_number',
        street: 'route',
        neighborhood: 'neighborhood',
        locality: 'locality',
        place: 'locality',
        district: 'administrative_area_level_2',
        region: 'administrative_area_level_1',
        country: 'country',
        postcode: 'postal_code'
      };
      
      Object.entries(mapping).forEach(([mapboxType, googleType]) => {
        if (props[mapboxType]) {
          components.push({
            long_name: props[mapboxType],
            short_name: props[mapboxType],
            types: [googleType]
          });
        }
      });
    }
    
    return components;
  }

  /**
   * Parse OSM address components
   * @private
   */
  parseOSMComponents(address) {
    if (!address) return [];
    
    const components = [];
    
    // Map OSM address fields to Google-like components
    const mapping = {
      house_number: 'street_number',
      road: 'route',
      neighbourhood: 'neighborhood',
      suburb: 'sublocality',
      city: 'locality',
      town: 'locality',
      village: 'locality',
      county: 'administrative_area_level_2',
      state: 'administrative_area_level_1',
      country: 'country',
      postcode: 'postal_code'
    };
    
    Object.entries(mapping).forEach(([osmField, googleType]) => {
      if (address[osmField]) {
        components.push({
          long_name: address[osmField],
          short_name: address[osmField],
          types: [googleType]
        });
      }
    });
    
    return components;
  }

  /**
   * Batch geocode multiple addresses
   * @param {Array} addresses - Array of addresses to geocode
   * @param {Object} options - Geocoding options
   * @returns {Array} Array of geocoding results
   */
  async batchGeocode(addresses, options = {}) {
    try {
      if (!Array.isArray(addresses)) {
        throw new Error('Addresses must be an array');
      }

      const results = [];
      const batchSize = options.batchSize || 5;
      const delay = options.delay || 100; // ms between requests

      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchPromises = batch.map(async (address, index) => {
          try {
            // Add delay to avoid rate limiting
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const result = await this.geocode(address, options);
            return { address, result, success: true };
          } catch (error) {
            return { address, error: error.message, success: false };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches
        if (i + batchSize < addresses.length) {
          await new Promise(resolve => setTimeout(resolve, delay * 2));
        }
      }

      return results;
    } catch (error) {
      logger.error('Batch geocoding error:', error);
      throw error;
    }
  }

  /**
   * Get place details by place ID
   * @param {string} placeId - Place ID
   * @param {Object} options - Options
   * @returns {Object} Place details
   */
  async getPlaceDetails(placeId, options = {}) {
    try {
      if (!placeId) {
        throw new Error('Place ID is required');
      }

      // Check cache first
      const cacheKey = generateCacheKey.placeDetails(placeId);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      let result = null;

      // Try Google Places API if available
      if (this.googleApiKey && placeId.startsWith('ChIJ')) {
        result = await this.getGooglePlaceDetails(placeId, options);
      }

      if (!result) {
        throw new Error('Place details not found');
      }

      // Cache the result
      await cache.set(cacheKey, result, this.cacheTimeout);

      return result;
    } catch (error) {
      logger.error('Get place details error:', error);
      throw error;
    }
  }

  /**
   * Get Google Place details
   * @private
   */
  async getGooglePlaceDetails(placeId, options = {}) {
    const startTime = Date.now();
    
    try {
      const response = await this.googleMapsClient.placeDetails({
        params: {
          place_id: placeId,
          key: this.googleApiKey,
          fields: options.fields || [
            'name', 'formatted_address', 'geometry', 'place_id',
            'types', 'address_components', 'international_phone_number',
            'website', 'rating', 'user_ratings_total'
          ],
          language: options.language || 'en'
        }
      });

      logApiCall('Google Places', 'place-details', 'GET', Date.now() - startTime, response.status);

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API failed: ${response.data.status}`);
      }

      return {
        ...response.data.result,
        provider: 'google'
      };
    } catch (error) {
      logApiCall('Google Places', 'place-details', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Clear geocoding cache
   * @param {string} pattern - Cache key pattern to clear
   * @returns {number} Number of keys cleared
   */
  async clearCache(pattern = '*geocode*') {
    try {
      return await cache.delPattern(pattern);
    } catch (error) {
      logger.error('Error clearing geocoding cache:', error);
      return 0;
    }
  }
}

// Extend cache key generation for geocoding
Object.assign(generateCacheKey, {
  geocode: (address) => `geocode:${Buffer.from(address.toLowerCase()).toString('base64')}`,
  reverseGeocode: (coords) => `reverse-geocode:${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`,
  placeDetails: (placeId) => `place-details:${placeId}`
});

module.exports = GeocodingService;