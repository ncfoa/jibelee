const geolib = require('geolib');

class GeoUtils {
  /**
   * Calculate distance between two points in meters
   */
  static calculateDistance(point1, point2) {
    try {
      return geolib.getDistance(
        { latitude: point1.lat, longitude: point1.lng },
        { latitude: point2.lat, longitude: point2.lng }
      );
    } catch (error) {
      throw new Error(`Distance calculation failed: ${error.message}`);
    }
  }

  /**
   * Check if a point is within a radius of another point
   */
  static isWithinRadius(point, center, radiusMeters) {
    try {
      const distance = this.calculateDistance(point, center);
      return distance <= radiusMeters;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate coordinates
   */
  static validateCoordinates(coordinates) {
    const { lat, lng } = coordinates;
    
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return false;
    }
    
    if (lat < -90 || lat > 90) {
      return false;
    }
    
    if (lng < -180 || lng > 180) {
      return false;
    }
    
    return true;
  }

  /**
   * Normalize coordinates to ensure they're valid
   */
  static normalizeCoordinates(coordinates) {
    let { lat, lng } = coordinates;
    
    // Ensure numeric values
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    
    // Clamp latitude to valid range
    lat = Math.max(-90, Math.min(90, lat));
    
    // Normalize longitude to -180 to 180 range
    lng = ((lng + 180) % 360 + 360) % 360 - 180;
    
    return { lat, lng };
  }

  /**
   * Convert coordinates to PostGIS POINT format
   */
  static toPostGISPoint(coordinates) {
    const normalized = this.normalizeCoordinates(coordinates);
    return `POINT(${normalized.lng} ${normalized.lat})`;
  }

  /**
   * Parse PostGIS POINT to coordinates object
   */
  static fromPostGISPoint(pointString) {
    try {
      const matches = pointString.match(/POINT\(([^)]+)\)/);
      if (!matches) {
        throw new Error('Invalid PostGIS POINT format');
      }
      
      const [lng, lat] = matches[1].split(' ').map(parseFloat);
      return { lat, lng };
    } catch (error) {
      throw new Error(`Failed to parse PostGIS POINT: ${error.message}`);
    }
  }

  /**
   * Calculate bearing between two points
   */
  static calculateBearing(point1, point2) {
    try {
      return geolib.getBearing(
        { latitude: point1.lat, longitude: point1.lng },
        { latitude: point2.lat, longitude: point2.lng }
      );
    } catch (error) {
      throw new Error(`Bearing calculation failed: ${error.message}`);
    }
  }

  /**
   * Get center point of multiple coordinates
   */
  static getCenterPoint(coordinates) {
    try {
      const points = coordinates.map(coord => ({
        latitude: coord.lat,
        longitude: coord.lng
      }));
      
      const center = geolib.getCenterOfBounds(points);
      return {
        lat: center.latitude,
        lng: center.longitude
      };
    } catch (error) {
      throw new Error(`Center calculation failed: ${error.message}`);
    }
  }

  /**
   * Check if coordinates are in a polygon
   */
  static isPointInPolygon(point, polygon) {
    try {
      const geoPoint = { latitude: point.lat, longitude: point.lng };
      const geoPolygon = polygon.map(p => ({ latitude: p.lat, longitude: p.lng }));
      
      return geolib.isPointInPolygon(geoPoint, geoPolygon);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate geohash for coordinates
   */
  static generateGeohash(coordinates, precision = 12) {
    try {
      // Simple geohash implementation
      // In production, use a proper geohash library
      const { lat, lng } = this.normalizeCoordinates(coordinates);
      return `${lat.toFixed(6)},${lng.toFixed(6)}`;
    } catch (error) {
      throw new Error(`Geohash generation failed: ${error.message}`);
    }
  }

  /**
   * Calculate area of polygon in square meters
   */
  static calculatePolygonArea(polygon) {
    try {
      const geoPolygon = polygon.map(p => ({ latitude: p.lat, longitude: p.lng }));
      return geolib.getAreaOfPolygon(geoPolygon);
    } catch (error) {
      throw new Error(`Area calculation failed: ${error.message}`);
    }
  }

  /**
   * Find nearest point from a list of coordinates
   */
  static findNearestPoint(targetPoint, candidatePoints) {
    try {
      const target = { latitude: targetPoint.lat, longitude: targetPoint.lng };
      const candidates = candidatePoints.map((point, index) => ({
        ...point,
        latitude: point.lat,
        longitude: point.lng,
        originalIndex: index
      }));
      
      const nearest = geolib.findNearest(target, candidates);
      return {
        point: { lat: nearest.latitude, lng: nearest.longitude },
        distance: nearest.distance,
        index: nearest.originalIndex
      };
    } catch (error) {
      throw new Error(`Nearest point search failed: ${error.message}`);
    }
  }

  /**
   * Generate random point within radius
   */
  static generateRandomPointInRadius(center, radiusMeters) {
    try {
      // Convert radius from meters to degrees (approximate)
      const radiusDegrees = radiusMeters / 111000; // rough conversion
      
      // Generate random angle and distance
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * radiusDegrees;
      
      // Calculate new coordinates
      const lat = center.lat + distance * Math.cos(angle);
      const lng = center.lng + distance * Math.sin(angle);
      
      return this.normalizeCoordinates({ lat, lng });
    } catch (error) {
      throw new Error(`Random point generation failed: ${error.message}`);
    }
  }

  /**
   * Check GPS accuracy and reliability
   */
  static assessLocationAccuracy(location) {
    const { lat, lng, accuracy, timestamp } = location;
    
    // Validate coordinates
    if (!this.validateCoordinates({ lat, lng })) {
      return { reliable: false, reason: 'Invalid coordinates' };
    }
    
    // Check accuracy
    if (accuracy && accuracy > 100) {
      return { reliable: false, reason: 'Low GPS accuracy' };
    }
    
    // Check timestamp freshness (within last 5 minutes)
    const now = Date.now();
    const locationTime = timestamp ? new Date(timestamp).getTime() : now;
    const ageMinutes = (now - locationTime) / (1000 * 60);
    
    if (ageMinutes > 5) {
      return { reliable: false, reason: 'Location data too old' };
    }
    
    return { reliable: true, accuracy, ageMinutes };
  }

  /**
   * Calculate geofence status
   */
  static calculateGeofenceStatus(userLocation, geofence) {
    try {
      const { center, radius } = geofence;
      const distance = this.calculateDistance(userLocation, center);
      const isInside = distance <= radius;
      
      return {
        isInside,
        distance,
        radius,
        distanceFromBoundary: isInside ? radius - distance : distance - radius
      };
    } catch (error) {
      throw new Error(`Geofence calculation failed: ${error.message}`);
    }
  }

  /**
   * Format coordinates for display
   */
  static formatCoordinates(coordinates, format = 'decimal') {
    const { lat, lng } = coordinates;
    
    switch (format) {
      case 'decimal':
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      case 'dms': // Degrees, Minutes, Seconds
        const latDMS = this.toDMS(lat, 'lat');
        const lngDMS = this.toDMS(lng, 'lng');
        return `${latDMS}, ${lngDMS}`;
      
      case 'url':
        return `${lat},${lng}`;
      
      default:
        return `${lat}, ${lng}`;
    }
  }

  /**
   * Convert decimal degrees to degrees, minutes, seconds
   */
  static toDMS(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesFloat = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = (minutesFloat - minutes) * 60;
    
    const direction = type === 'lat' 
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');
    
    return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction}`;
  }

  /**
   * Get location privacy level based on accuracy and context
   */
  static getPrivacyLevel(location, context = {}) {
    const { accuracy, isIndoor, isPublicPlace } = context;
    
    // High accuracy in private places = low privacy
    if (accuracy && accuracy < 10 && !isPublicPlace) {
      return 'low';
    }
    
    // Indoor locations are generally more private
    if (isIndoor) {
      return 'medium';
    }
    
    // Public places with low accuracy = high privacy
    if (isPublicPlace && accuracy && accuracy > 50) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Anonymize location data for privacy
   */
  static anonymizeLocation(coordinates, radiusMeters = 100) {
    try {
      // Add random offset within radius
      const randomPoint = this.generateRandomPointInRadius(coordinates, radiusMeters);
      
      // Reduce precision
      return {
        lat: parseFloat(randomPoint.lat.toFixed(3)),
        lng: parseFloat(randomPoint.lng.toFixed(3))
      };
    } catch (error) {
      throw new Error(`Location anonymization failed: ${error.message}`);
    }
  }
}

module.exports = GeoUtils;