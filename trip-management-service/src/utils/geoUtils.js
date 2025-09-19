const geolib = require('geolib');
const turf = require('@turf/turf');
const { logger } = require('../config/logger');

/**
 * Geospatial utility functions for trip management
 */
class GeoUtils {
  /**
   * Calculate distance between two points in kilometers
   * @param {Object} point1 - {lat, lng}
   * @param {Object} point2 - {lat, lng}
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(point1, point2) {
    try {
      const distance = geolib.getDistance(
        { latitude: point1.lat, longitude: point1.lng },
        { latitude: point2.lat, longitude: point2.lng }
      );
      return distance / 1000; // Convert meters to kilometers
    } catch (error) {
      logger.error('Error calculating distance:', error);
      return 0;
    }
  }

  /**
   * Calculate bearing between two points
   * @param {Object} point1 - {lat, lng}
   * @param {Object} point2 - {lat, lng}
   * @returns {number} Bearing in degrees
   */
  static calculateBearing(point1, point2) {
    try {
      return geolib.getRhumbLineBearing(
        { latitude: point1.lat, longitude: point1.lng },
        { latitude: point2.lat, longitude: point2.lng }
      );
    } catch (error) {
      logger.error('Error calculating bearing:', error);
      return 0;
    }
  }

  /**
   * Check if a point is within a certain radius of another point
   * @param {Object} center - {lat, lng}
   * @param {Object} point - {lat, lng}
   * @param {number} radiusKm - Radius in kilometers
   * @returns {boolean}
   */
  static isWithinRadius(center, point, radiusKm) {
    try {
      const distance = this.calculateDistance(center, point);
      return distance <= radiusKm;
    } catch (error) {
      logger.error('Error checking radius:', error);
      return false;
    }
  }

  /**
   * Get center point of multiple coordinates
   * @param {Array} points - Array of {lat, lng} objects
   * @returns {Object} Center point {lat, lng}
   */
  static getCenterPoint(points) {
    try {
      if (!points || points.length === 0) return null;
      if (points.length === 1) return points[0];

      const coordinates = points.map(p => [p.lng, p.lat]);
      const center = turf.center(turf.points(coordinates));
      
      return {
        lat: center.geometry.coordinates[1],
        lng: center.geometry.coordinates[0]
      };
    } catch (error) {
      logger.error('Error calculating center point:', error);
      return null;
    }
  }

  /**
   * Create a bounding box around a point
   * @param {Object} center - {lat, lng}
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Object} Bounding box {north, south, east, west}
   */
  static createBoundingBox(center, radiusKm) {
    try {
      const bounds = geolib.getBoundsOfDistance(
        { latitude: center.lat, longitude: center.lng },
        radiusKm * 1000 // Convert km to meters
      );

      return {
        north: bounds[1].latitude,
        south: bounds[0].latitude,
        east: bounds[1].longitude,
        west: bounds[0].longitude
      };
    } catch (error) {
      logger.error('Error creating bounding box:', error);
      return null;
    }
  }

  /**
   * Check if a point is within a bounding box
   * @param {Object} point - {lat, lng}
   * @param {Object} bounds - {north, south, east, west}
   * @returns {boolean}
   */
  static isWithinBounds(point, bounds) {
    try {
      return (
        point.lat >= bounds.south &&
        point.lat <= bounds.north &&
        point.lng >= bounds.west &&
        point.lng <= bounds.east
      );
    } catch (error) {
      logger.error('Error checking bounds:', error);
      return false;
    }
  }

  /**
   * Calculate the area of a polygon in square kilometers
   * @param {Array} coordinates - Array of {lat, lng} objects
   * @returns {number} Area in square kilometers
   */
  static calculatePolygonArea(coordinates) {
    try {
      const coords = coordinates.map(c => [c.lng, c.lat]);
      coords.push(coords[0]); // Close the polygon
      const polygon = turf.polygon([coords]);
      const area = turf.area(polygon);
      return area / 1000000; // Convert square meters to square kilometers
    } catch (error) {
      logger.error('Error calculating polygon area:', error);
      return 0;
    }
  }

  /**
   * Find the closest point in an array to a given point
   * @param {Object} target - {lat, lng}
   * @param {Array} points - Array of {lat, lng} objects
   * @returns {Object} Closest point with distance
   */
  static findClosestPoint(target, points) {
    try {
      if (!points || points.length === 0) return null;

      let closest = null;
      let minDistance = Infinity;

      points.forEach(point => {
        const distance = this.calculateDistance(target, point);
        if (distance < minDistance) {
          minDistance = distance;
          closest = { ...point, distance };
        }
      });

      return closest;
    } catch (error) {
      logger.error('Error finding closest point:', error);
      return null;
    }
  }

  /**
   * Generate waypoints along a route
   * @param {Object} start - {lat, lng}
   * @param {Object} end - {lat, lng}
   * @param {number} numWaypoints - Number of waypoints to generate
   * @returns {Array} Array of waypoints
   */
  static generateWaypoints(start, end, numWaypoints = 5) {
    try {
      const waypoints = [];
      const startPoint = turf.point([start.lng, start.lat]);
      const endPoint = turf.point([end.lng, end.lat]);
      
      for (let i = 1; i < numWaypoints - 1; i++) {
        const fraction = i / (numWaypoints - 1);
        const waypoint = turf.midpoint(startPoint, endPoint);
        // Adjust waypoint based on fraction
        const adjustedPoint = turf.destination(
          startPoint,
          turf.distance(startPoint, endPoint) * fraction,
          turf.bearing(startPoint, endPoint)
        );
        
        waypoints.push({
          lat: adjustedPoint.geometry.coordinates[1],
          lng: adjustedPoint.geometry.coordinates[0]
        });
      }
      
      return waypoints;
    } catch (error) {
      logger.error('Error generating waypoints:', error);
      return [];
    }
  }

  /**
   * Validate coordinates
   * @param {Object} coords - {lat, lng}
   * @returns {boolean}
   */
  static validateCoordinates(coords) {
    if (!coords || typeof coords !== 'object') return false;
    
    const lat = parseFloat(coords.lat);
    const lng = parseFloat(coords.lng);
    
    return (
      !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    );
  }

  /**
   * Convert coordinates to PostGIS POINT format
   * @param {Object} coords - {lat, lng}
   * @returns {string} PostGIS POINT string
   */
  static toPostGISPoint(coords) {
    if (!this.validateCoordinates(coords)) {
      throw new Error('Invalid coordinates');
    }
    return `POINT(${coords.lng} ${coords.lat})`;
  }

  /**
   * Parse PostGIS POINT to coordinates object
   * @param {string} pointString - PostGIS POINT string
   * @returns {Object} {lat, lng}
   */
  static fromPostGISPoint(pointString) {
    try {
      if (!pointString) return null;
      
      // Handle different formats
      let coords;
      if (typeof pointString === 'string') {
        // Format: "POINT(lng lat)" or "(lng,lat)"
        const match = pointString.match(/\(([^,\s]+)[,\s]+([^)]+)\)/);
        if (match) {
          coords = {
            lng: parseFloat(match[1]),
            lat: parseFloat(match[2])
          };
        }
      } else if (pointString.coordinates) {
        // GeoJSON format
        coords = {
          lng: pointString.coordinates[0],
          lat: pointString.coordinates[1]
        };
      }
      
      return this.validateCoordinates(coords) ? coords : null;
    } catch (error) {
      logger.error('Error parsing PostGIS point:', error);
      return null;
    }
  }

  /**
   * Create a circular geofence
   * @param {Object} center - {lat, lng}
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Object} Geofence object
   */
  static createCircularGeofence(center, radiusKm) {
    try {
      const circle = turf.circle([center.lng, center.lat], radiusKm, {
        units: 'kilometers',
        steps: 32
      });
      
      return {
        type: 'circle',
        center,
        radius: radiusKm,
        geometry: circle.geometry
      };
    } catch (error) {
      logger.error('Error creating circular geofence:', error);
      return null;
    }
  }

  /**
   * Check if a point is inside a geofence
   * @param {Object} point - {lat, lng}
   * @param {Object} geofence - Geofence object
   * @returns {boolean}
   */
  static isPointInGeofence(point, geofence) {
    try {
      if (geofence.type === 'circle') {
        return this.isWithinRadius(geofence.center, point, geofence.radius);
      } else if (geofence.geometry) {
        const pt = turf.point([point.lng, point.lat]);
        return turf.booleanPointInPolygon(pt, geofence.geometry);
      }
      return false;
    } catch (error) {
      logger.error('Error checking point in geofence:', error);
      return false;
    }
  }

  /**
   * Calculate estimated travel time based on distance and mode
   * @param {number} distanceKm - Distance in kilometers
   * @param {string} mode - Travel mode (car, flight, train, bus, walk)
   * @returns {number} Estimated time in minutes
   */
  static estimateTravelTime(distanceKm, mode = 'car') {
    try {
      const speeds = {
        walk: 5, // km/h
        bike: 15,
        car: 60,
        bus: 40,
        train: 80,
        flight: 500,
        ship: 30
      };
      
      const speed = speeds[mode] || speeds.car;
      const timeHours = distanceKm / speed;
      
      // Add buffer time based on mode
      const bufferMultipliers = {
        walk: 1.1,
        bike: 1.1,
        car: 1.2,
        bus: 1.3,
        train: 1.2,
        flight: 2.0, // Includes airport time
        ship: 1.3
      };
      
      const buffer = bufferMultipliers[mode] || 1.2;
      return Math.round(timeHours * 60 * buffer); // Convert to minutes
    } catch (error) {
      logger.error('Error estimating travel time:', error);
      return 0;
    }
  }

  /**
   * Simplify a route by removing unnecessary waypoints
   * @param {Array} route - Array of {lat, lng} points
   * @param {number} tolerance - Simplification tolerance
   * @returns {Array} Simplified route
   */
  static simplifyRoute(route, tolerance = 0.001) {
    try {
      if (!route || route.length < 3) return route;
      
      const coordinates = route.map(p => [p.lng, p.lat]);
      const line = turf.lineString(coordinates);
      const simplified = turf.simplify(line, { tolerance, highQuality: true });
      
      return simplified.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));
    } catch (error) {
      logger.error('Error simplifying route:', error);
      return route;
    }
  }

  /**
   * Get country/region from coordinates (requires reverse geocoding)
   * @param {Object} coords - {lat, lng}
   * @returns {string} Country code or null
   */
  static getCountryFromCoords(coords) {
    // This would typically integrate with a reverse geocoding service
    // For now, return a simple region detection based on coordinates
    try {
      const { lat, lng } = coords;
      
      // Simple region detection (very basic)
      if (lat >= 24.396308 && lat <= 49.384358 && lng >= -125.0 && lng <= -66.93457) {
        return 'US'; // United States (approximate)
      } else if (lat >= 41.6751 && lat <= 83.23324 && lng >= -141.0 && lng <= -52.6480987209) {
        return 'CA'; // Canada (approximate)
      } else if (lat >= 35.8 && lat <= 71.2 && lng >= -9.56 && lng <= 34.59) {
        return 'EU'; // Europe (very approximate)
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting country from coordinates:', error);
      return null;
    }
  }

  /**
   * Format coordinates for display
   * @param {Object} coords - {lat, lng}
   * @param {number} precision - Decimal places
   * @returns {string} Formatted coordinates
   */
  static formatCoordinates(coords, precision = 6) {
    try {
      if (!this.validateCoordinates(coords)) return 'Invalid coordinates';
      
      const lat = parseFloat(coords.lat).toFixed(precision);
      const lng = parseFloat(coords.lng).toFixed(precision);
      
      return `${lat}, ${lng}`;
    } catch (error) {
      logger.error('Error formatting coordinates:', error);
      return 'Invalid coordinates';
    }
  }
}

module.exports = GeoUtils;