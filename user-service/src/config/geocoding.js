require('dotenv').config();
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const { logger } = require('./logger');

// Geocoding configuration
const geocodingConfig = {
  mapboxToken: process.env.MAPBOX_ACCESS_TOKEN,
  googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
  provider: process.env.GEOCODING_PROVIDER || 'mapbox' // 'mapbox' or 'google'
};

// Initialize Mapbox geocoding client
let mapboxClient = null;
if (geocodingConfig.mapboxToken) {
  mapboxClient = mbxGeocoding({ accessToken: geocodingConfig.mapboxToken });
}

// Geocoding service
class GeocodingService {
  constructor() {
    this.mapboxClient = mapboxClient;
    this.provider = geocodingConfig.provider;
  }

  // Geocode address to coordinates
  async geocodeAddress(addressData) {
    try {
      const address = this.formatAddress(addressData);
      
      if (this.provider === 'mapbox' && this.mapboxClient) {
        return await this.geocodeWithMapbox(address);
      } else if (this.provider === 'google' && geocodingConfig.googleApiKey) {
        return await this.geocodeWithGoogle(address);
      } else {
        logger.warn('No geocoding service configured, using mock coordinates');
        return this.getMockCoordinates(addressData);
      }
    } catch (error) {
      logger.error('Geocoding failed:', {
        error: error.message,
        address: addressData,
        provider: this.provider
      });
      return this.getMockCoordinates(addressData);
    }
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(lat, lng) {
    try {
      if (this.provider === 'mapbox' && this.mapboxClient) {
        return await this.reverseGeocodeWithMapbox(lat, lng);
      } else if (this.provider === 'google' && geocodingConfig.googleApiKey) {
        return await this.reverseGeocodeWithGoogle(lat, lng);
      } else {
        logger.warn('No reverse geocoding service configured');
        return null;
      }
    } catch (error) {
      logger.error('Reverse geocoding failed:', {
        error: error.message,
        lat,
        lng,
        provider: this.provider
      });
      return null;
    }
  }

  // Mapbox geocoding
  async geocodeWithMapbox(address) {
    try {
      const response = await this.mapboxClient.forwardGeocode({
        query: address,
        limit: 1,
        types: ['address', 'poi']
      }).send();

      if (response.body.features && response.body.features.length > 0) {
        const feature = response.body.features[0];
        const [lng, lat] = feature.center;
        
        logger.info('Mapbox geocoding successful', {
          address,
          coordinates: { lat, lng },
          accuracy: feature.relevance
        });

        return {
          lat: parseFloat(lat.toFixed(6)),
          lng: parseFloat(lng.toFixed(6)),
          accuracy: feature.relevance,
          formatted_address: feature.place_name,
          provider: 'mapbox'
        };
      } else {
        throw new Error('No results found');
      }
    } catch (error) {
      logger.error('Mapbox geocoding error:', error.message);
      throw error;
    }
  }

  // Mapbox reverse geocoding
  async reverseGeocodeWithMapbox(lat, lng) {
    try {
      const response = await this.mapboxClient.reverseGeocode({
        query: [lng, lat],
        limit: 1,
        types: ['address']
      }).send();

      if (response.body.features && response.body.features.length > 0) {
        const feature = response.body.features[0];
        
        return {
          formatted_address: feature.place_name,
          components: this.parseMapboxComponents(feature),
          provider: 'mapbox'
        };
      } else {
        return null;
      }
    } catch (error) {
      logger.error('Mapbox reverse geocoding error:', error.message);
      throw error;
    }
  }

  // Google geocoding (placeholder - would need axios for HTTP requests)
  async geocodeWithGoogle(address) {
    // This is a placeholder implementation
    // In a real implementation, you would make HTTP requests to Google's Geocoding API
    logger.warn('Google geocoding not implemented, using mock data');
    return this.getMockCoordinates({ street: address });
  }

  // Google reverse geocoding (placeholder)
  async reverseGeocodeWithGoogle(lat, lng) {
    logger.warn('Google reverse geocoding not implemented');
    return null;
  }

  // Format address string
  formatAddress(addressData) {
    const parts = [];
    
    if (addressData.street) parts.push(addressData.street);
    if (addressData.city) parts.push(addressData.city);
    if (addressData.state) parts.push(addressData.state);
    if (addressData.postalCode) parts.push(addressData.postalCode);
    if (addressData.country) parts.push(addressData.country);
    
    return parts.join(', ');
  }

  // Parse Mapbox address components
  parseMapboxComponents(feature) {
    const components = {};
    
    if (feature.context) {
      feature.context.forEach(context => {
        if (context.id.startsWith('postcode')) {
          components.postal_code = context.text;
        } else if (context.id.startsWith('place')) {
          components.city = context.text;
        } else if (context.id.startsWith('region')) {
          components.state = context.text;
        } else if (context.id.startsWith('country')) {
          components.country = context.text;
        }
      });
    }
    
    return components;
  }

  // Get mock coordinates for testing/fallback
  getMockCoordinates(addressData) {
    // Generate mock coordinates based on city/country
    const mockCoordinates = {
      'New York': { lat: 40.7128, lng: -74.0060 },
      'Los Angeles': { lat: 34.0522, lng: -118.2437 },
      'Chicago': { lat: 41.8781, lng: -87.6298 },
      'London': { lat: 51.5074, lng: -0.1278 },
      'Paris': { lat: 48.8566, lng: 2.3522 },
      'Tokyo': { lat: 35.6762, lng: 139.6503 }
    };

    const city = addressData.city || 'New York';
    const coords = mockCoordinates[city] || mockCoordinates['New York'];
    
    // Add some randomness to avoid exact duplicates
    const lat = coords.lat + (Math.random() - 0.5) * 0.01;
    const lng = coords.lng + (Math.random() - 0.5) * 0.01;

    logger.info('Using mock coordinates', {
      city,
      coordinates: { lat, lng }
    });

    return {
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      accuracy: 0.8,
      formatted_address: this.formatAddress(addressData),
      provider: 'mock'
    };
  }

  // Validate coordinates
  validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    return !isNaN(latitude) && 
           !isNaN(longitude) && 
           latitude >= -90 && 
           latitude <= 90 && 
           longitude >= -180 && 
           longitude <= 180;
  }

  // Calculate distance between two points (Haversine formula)
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
}

const geocodingService = new GeocodingService();

module.exports = {
  geocodingService,
  geocodingConfig,
  GeocodingService
};