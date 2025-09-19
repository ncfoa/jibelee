const turf = require('@turf/turf');
const geolib = require('geolib');

class GeoUtils {
  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {Object} coord1 - {latitude, longitude}
   * @param {Object} coord2 - {latitude, longitude}
   * @param {string} unit - 'meters', 'kilometers', 'miles'
   * @returns {number} Distance in specified unit
   */
  static calculateDistance(coord1, coord2, unit = 'meters') {
    const point1 = turf.point([coord1.longitude, coord1.latitude]);
    const point2 = turf.point([coord2.longitude, coord2.latitude]);
    
    const distance = turf.distance(point1, point2, { units: 'kilometers' });
    
    switch (unit) {
      case 'meters':
        return distance * 1000;
      case 'miles':
        return distance * 0.621371;
      case 'kilometers':
      default:
        return distance;
    }
  }

  /**
   * Calculate bearing between two coordinates
   * @param {Object} from - {latitude, longitude}
   * @param {Object} to - {latitude, longitude}
   * @returns {number} Bearing in degrees (0-360)
   */
  static calculateBearing(from, to) {
    const point1 = turf.point([from.longitude, from.latitude]);
    const point2 = turf.point([to.longitude, to.latitude]);
    
    return turf.bearing(point1, point2);
  }

  /**
   * Calculate the center point of multiple coordinates
   * @param {Array} coordinates - Array of {latitude, longitude} objects
   * @returns {Object} Center point {latitude, longitude}
   */
  static calculateCenter(coordinates) {
    if (coordinates.length === 0) return null;
    if (coordinates.length === 1) return coordinates[0];

    const points = coordinates.map(coord => 
      turf.point([coord.longitude, coord.latitude])
    );
    
    const collection = turf.featureCollection(points);
    const center = turf.center(collection);
    
    return {
      latitude: center.geometry.coordinates[1],
      longitude: center.geometry.coordinates[0]
    };
  }

  /**
   * Create a bounding box around a point with given radius
   * @param {Object} center - {latitude, longitude}
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Object} Bounding box {north, south, east, west}
   */
  static createBoundingBox(center, radiusKm) {
    const centerPoint = turf.point([center.longitude, center.latitude]);
    const bbox = turf.bbox(turf.buffer(centerPoint, radiusKm, { units: 'kilometers' }));
    
    return {
      west: bbox[0],
      south: bbox[1],
      east: bbox[2],
      north: bbox[3]
    };
  }

  /**
   * Check if a point is within a circular area
   * @param {Object} point - {latitude, longitude}
   * @param {Object} center - {latitude, longitude}
   * @param {number} radiusMeters - Radius in meters
   * @returns {boolean}
   */
  static isPointInCircle(point, center, radiusMeters) {
    const distance = this.calculateDistance(point, center, 'meters');
    return distance <= radiusMeters;
  }

  /**
   * Check if a point is within a polygon
   * @param {Object} point - {latitude, longitude}
   * @param {Array} polygon - Array of [longitude, latitude] coordinates
   * @returns {boolean}
   */
  static isPointInPolygon(point, polygon) {
    const pt = turf.point([point.longitude, point.latitude]);
    const poly = turf.polygon([polygon]);
    
    return turf.booleanPointInPolygon(pt, poly);
  }

  /**
   * Generate a circle polygon from center and radius
   * @param {Object} center - {latitude, longitude}
   * @param {number} radiusMeters - Radius in meters
   * @param {number} steps - Number of steps for circle approximation
   * @returns {Array} Array of [longitude, latitude] coordinates
   */
  static generateCirclePolygon(center, radiusMeters, steps = 64) {
    const centerPoint = turf.point([center.longitude, center.latitude]);
    const circle = turf.circle(centerPoint, radiusMeters / 1000, { units: 'kilometers', steps });
    
    return circle.geometry.coordinates[0];
  }

  /**
   * Simplify a polygon by reducing the number of points
   * @param {Array} polygon - Array of [longitude, latitude] coordinates
   * @param {number} tolerance - Simplification tolerance
   * @returns {Array} Simplified polygon coordinates
   */
  static simplifyPolygon(polygon, tolerance = 0.001) {
    const poly = turf.polygon([polygon]);
    const simplified = turf.simplify(poly, { tolerance, highQuality: true });
    
    return simplified.geometry.coordinates[0];
  }

  /**
   * Calculate the area of a polygon
   * @param {Array} polygon - Array of [longitude, latitude] coordinates
   * @param {string} unit - 'meters', 'kilometers', 'hectares', 'acres'
   * @returns {number} Area in specified unit
   */
  static calculatePolygonArea(polygon, unit = 'meters') {
    const poly = turf.polygon([polygon]);
    const area = turf.area(poly);
    
    switch (unit) {
      case 'kilometers':
        return area / 1000000;
      case 'hectares':
        return area / 10000;
      case 'acres':
        return area * 0.000247105;
      case 'meters':
      default:
        return area;
    }
  }

  /**
   * Find the closest point on a line to a given point
   * @param {Object} point - {latitude, longitude}
   * @param {Array} line - Array of [longitude, latitude] coordinates
   * @returns {Object} Closest point {latitude, longitude, distance}
   */
  static findClosestPointOnLine(point, line) {
    const pt = turf.point([point.longitude, point.latitude]);
    const lineString = turf.lineString(line);
    
    const closestPoint = turf.nearestPointOnLine(lineString, pt);
    
    return {
      latitude: closestPoint.geometry.coordinates[1],
      longitude: closestPoint.geometry.coordinates[0],
      distance: closestPoint.properties.dist * 1000 // Convert to meters
    };
  }

  /**
   * Calculate total distance of a route (array of coordinates)
   * @param {Array} route - Array of {latitude, longitude} objects
   * @param {string} unit - 'meters', 'kilometers', 'miles'
   * @returns {number} Total distance
   */
  static calculateRouteDistance(route, unit = 'meters') {
    if (route.length < 2) return 0;
    
    let totalDistance = 0;
    
    for (let i = 1; i < route.length; i++) {
      totalDistance += this.calculateDistance(route[i - 1], route[i], unit);
    }
    
    return totalDistance;
  }

  /**
   * Interpolate points along a route at regular intervals
   * @param {Array} route - Array of {latitude, longitude} objects
   * @param {number} intervalMeters - Interval between points in meters
   * @returns {Array} Interpolated points
   */
  static interpolateRoute(route, intervalMeters = 100) {
    if (route.length < 2) return route;
    
    const lineCoords = route.map(point => [point.longitude, point.latitude]);
    const line = turf.lineString(lineCoords);
    const length = turf.length(line, { units: 'kilometers' });
    
    const intervalKm = intervalMeters / 1000;
    const numPoints = Math.floor(length / intervalKm);
    
    const interpolated = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const distance = i * intervalKm;
      const point = turf.along(line, distance, { units: 'kilometers' });
      
      interpolated.push({
        latitude: point.geometry.coordinates[1],
        longitude: point.geometry.coordinates[0]
      });
    }
    
    return interpolated;
  }

  /**
   * Create a buffer around a point or line
   * @param {Object|Array} geometry - Point {lat, lng} or line array
   * @param {number} radiusMeters - Buffer radius in meters
   * @returns {Array} Buffer polygon coordinates
   */
  static createBuffer(geometry, radiusMeters) {
    let feature;
    
    if (Array.isArray(geometry)) {
      // Line geometry
      const coords = geometry.map(point => [point.longitude, point.latitude]);
      feature = turf.lineString(coords);
    } else {
      // Point geometry
      feature = turf.point([geometry.longitude, geometry.latitude]);
    }
    
    const buffered = turf.buffer(feature, radiusMeters / 1000, { units: 'kilometers' });
    
    return buffered.geometry.coordinates[0];
  }

  /**
   * Find points within a certain distance of a route
   * @param {Array} route - Array of {latitude, longitude} objects
   * @param {Array} points - Array of points to check
   * @param {number} maxDistanceMeters - Maximum distance in meters
   * @returns {Array} Points within distance with their closest route point
   */
  static findPointsNearRoute(route, points, maxDistanceMeters) {
    if (route.length < 2) return [];
    
    const lineCoords = route.map(point => [point.longitude, point.latitude]);
    const line = turf.lineString(lineCoords);
    
    return points.filter(point => {
      const pt = turf.point([point.longitude, point.latitude]);
      const closestPoint = turf.nearestPointOnLine(line, pt);
      const distance = closestPoint.properties.dist * 1000; // Convert to meters
      
      return distance <= maxDistanceMeters;
    }).map(point => {
      const pt = turf.point([point.longitude, point.latitude]);
      const closestPoint = turf.nearestPointOnLine(line, pt);
      
      return {
        ...point,
        distanceToRoute: closestPoint.properties.dist * 1000,
        closestRoutePoint: {
          latitude: closestPoint.geometry.coordinates[1],
          longitude: closestPoint.geometry.coordinates[0]
        }
      };
    });
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees
   * @returns {number} radians
   */
  static degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   * @param {number} radians
   * @returns {number} degrees
   */
  static radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
  }

  /**
   * Calculate destination point given start point, bearing, and distance
   * @param {Object} start - {latitude, longitude}
   * @param {number} bearing - Bearing in degrees
   * @param {number} distanceMeters - Distance in meters
   * @returns {Object} Destination point {latitude, longitude}
   */
  static calculateDestination(start, bearing, distanceMeters) {
    const startPoint = turf.point([start.longitude, start.latitude]);
    const destination = turf.destination(startPoint, distanceMeters / 1000, bearing, { units: 'kilometers' });
    
    return {
      latitude: destination.geometry.coordinates[1],
      longitude: destination.geometry.coordinates[0]
    };
  }

  /**
   * Validate coordinates
   * @param {Object} coordinates - {latitude, longitude}
   * @returns {boolean}
   */
  static isValidCoordinates(coordinates) {
    const { latitude, longitude } = coordinates;
    
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Normalize longitude to -180 to 180 range
   * @param {number} longitude
   * @returns {number}
   */
  static normalizeLongitude(longitude) {
    while (longitude > 180) longitude -= 360;
    while (longitude < -180) longitude += 360;
    return longitude;
  }

  /**
   * Convert coordinates to different formats
   * @param {Object} coordinates - {latitude, longitude}
   * @param {string} format - 'dms', 'dm', 'dd'
   * @returns {Object} Formatted coordinates
   */
  static formatCoordinates(coordinates, format = 'dd') {
    const { latitude, longitude } = coordinates;
    
    switch (format) {
      case 'dms': // Degrees, Minutes, Seconds
        return {
          latitude: this.decimalToDMS(latitude, 'lat'),
          longitude: this.decimalToDMS(longitude, 'lng')
        };
      case 'dm': // Degrees, Minutes
        return {
          latitude: this.decimalToDM(latitude, 'lat'),
          longitude: this.decimalToDM(longitude, 'lng')
        };
      case 'dd': // Decimal Degrees
      default:
        return {
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6))
        };
    }
  }

  /**
   * Convert decimal degrees to DMS format
   * @param {number} decimal
   * @param {string} type - 'lat' or 'lng'
   * @returns {string}
   */
  static decimalToDMS(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesFloat = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
    
    const direction = type === 'lat' 
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');
    
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  }

  /**
   * Convert decimal degrees to DM format
   * @param {number} decimal
   * @param {string} type - 'lat' or 'lng'
   * @returns {string}
   */
  static decimalToDM(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutes = ((absolute - degrees) * 60).toFixed(4);
    
    const direction = type === 'lat' 
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');
    
    return `${degrees}°${minutes}'${direction}`;
  }

  /**
   * Generate random coordinates within a bounding box
   * @param {Object} bbox - {north, south, east, west}
   * @returns {Object} Random coordinates {latitude, longitude}
   */
  static generateRandomCoordinates(bbox) {
    const latitude = Math.random() * (bbox.north - bbox.south) + bbox.south;
    const longitude = Math.random() * (bbox.east - bbox.west) + bbox.west;
    
    return { latitude, longitude };
  }

  /**
   * Calculate speed between two location points
   * @param {Object} point1 - {latitude, longitude, timestamp}
   * @param {Object} point2 - {latitude, longitude, timestamp}
   * @param {string} unit - 'kmh', 'mph', 'ms'
   * @returns {number} Speed in specified unit
   */
  static calculateSpeed(point1, point2, unit = 'kmh') {
    const distance = this.calculateDistance(point1, point2, 'meters');
    const timeDiff = (new Date(point2.timestamp) - new Date(point1.timestamp)) / 1000; // seconds
    
    if (timeDiff <= 0) return 0;
    
    const speedMs = distance / timeDiff; // meters per second
    
    switch (unit) {
      case 'kmh':
        return speedMs * 3.6;
      case 'mph':
        return speedMs * 2.237;
      case 'ms':
      default:
        return speedMs;
    }
  }
}

module.exports = GeoUtils;