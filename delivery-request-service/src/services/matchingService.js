const { DeliveryRequest } = require('../models');
const { cache } = require('../config/redis');
const axios = require('axios');
const geolib = require('geolib');
const moment = require('moment');

class MatchingService {
  constructor() {
    this.mlModel = null;
    this.cacheTimeout = 600; // 10 minutes
    this.loadModel();
  }

  async loadModel() {
    try {
      // In a real implementation, this would load a TensorFlow model
      // For now, we'll use rule-based matching
      console.log('ML model loading skipped - using rule-based matching');
      this.mlModel = null;
    } catch (error) {
      console.error('Failed to load ML model:', error);
      this.mlModel = null;
    }
  }

  async findMatches(deliveryRequestId, criteria = {}) {
    const cacheKey = `matches:${deliveryRequestId}:${JSON.stringify(criteria)}`;
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = await DeliveryRequest.findByPk(deliveryRequestId);
    if (!request) {
      throw new Error('Delivery request not found');
    }

    // Get potential trips based on geospatial and temporal constraints
    const candidateTrips = await this.findCandidateTrips(request, criteria);
    
    if (candidateTrips.length === 0) {
      return { matches: [], totalMatches: 0, algorithmUsed: 'geospatial' };
    }

    // Score each trip using ML model or rule-based scoring
    const scoredMatches = await Promise.all(
      candidateTrips.map(trip => this.scoreMatch(request, trip))
    );

    // Filter and sort by compatibility score
    const matches = scoredMatches
      .filter(match => match.compatibilityScore >= 0.6)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);

    const result = {
      matches,
      totalMatches: matches.length,
      algorithmUsed: this.mlModel ? 'ml' : 'rule-based'
    };

    // Cache for 10 minutes
    await cache.set(cacheKey, result, this.cacheTimeout);

    return result;
  }

  async findCandidateTrips(request, criteria) {
    const {
      maxDistance = 10, // km
      maxDetour = 20, // km
      timeFlexibility = 6 // hours
    } = criteria;

    try {
      // Call trip management service to find candidate trips
      const tripServiceUrl = process.env.TRIP_SERVICE_URL || 'http://localhost:3003';
      
      const searchParams = {
        // Origin within maxDistance of pickup location
        originLat: request.pickupCoordinates?.coordinates[1],
        originLng: request.pickupCoordinates?.coordinates[0],
        originRadius: maxDistance,
        
        // Destination within maxDistance of delivery location
        destinationLat: request.deliveryCoordinates?.coordinates[1],
        destinationLng: request.deliveryCoordinates?.coordinates[0],
        destinationRadius: maxDistance,
        
        // Departure time within flexibility window
        departureFrom: moment(request.pickupTimeStart).subtract(timeFlexibility, 'hours').toISOString(),
        departureTo: moment(request.pickupTimeEnd).add(timeFlexibility, 'hours').toISOString(),
        
        // Capacity requirements
        minWeight: request.weight,
        minItems: request.quantity,
        
        // Status filter
        status: 'upcoming',
        visibility: 'public',
        
        // Pagination
        limit: 50
      };

      const response = await axios.get(`${tripServiceUrl}/api/v1/trips/search`, {
        params: searchParams,
        timeout: 5000
      });

      const trips = response.data.data || [];
      
      // Filter by detour constraint
      return trips.filter(trip => {
        const detour = this.calculateDetour(trip, request);
        return detour <= maxDetour;
      });
      
    } catch (error) {
      console.error('Error fetching candidate trips:', error.message);
      
      // Return mock data for development
      return this.getMockTrips(request, criteria);
    }
  }

  async scoreMatch(request, trip) {
    // Extract features for scoring
    const features = this.extractMatchingFeatures(request, trip);
    
    // Get compatibility score
    const compatibilityScore = this.mlModel ? 
      await this.mlModel.predict(features) : 
      this.ruleBasedScore(features);

    // Calculate additional metrics
    const routeEfficiency = this.calculateRouteEfficiency(request, trip);
    const priceCompatibility = this.calculatePriceCompatibility(request, trip);
    const timeCompatibility = this.calculateTimeCompatibility(request, trip);

    return {
      trip: {
        id: trip.id,
        title: trip.title,
        traveler: {
          id: trip.travelerId,
          firstName: trip.traveler?.firstName || 'Unknown',
          lastName: trip.traveler?.lastName || 'User',
          rating: {
            average: trip.traveler?.rating?.average || 4.0,
            count: trip.traveler?.rating?.count || 0
          }
        },
        departureTime: trip.departureTime,
        route: {
          origin: trip.originAddress,
          destination: trip.destinationAddress
        }
      },
      compatibility: {
        score: Math.round(compatibilityScore * 1000) / 10, // Convert to percentage with 1 decimal
        factors: {
          route: Math.round(routeEfficiency * 100),
          timing: Math.round(timeCompatibility * 100),
          capacity: Math.round(this.calculateCapacityUtilization(request, trip) * 100),
          price: Math.round(priceCompatibility * 100),
          rating: Math.round((trip.traveler?.rating?.average || 4.0) / 5 * 100)
        }
      },
      compatibilityScore,
      routeEfficiency,
      priceCompatibility,
      timeCompatibility,
      estimatedPrice: this.calculateEstimatedPrice(request, trip),
      estimatedPickupTime: this.calculateEstimatedPickupTime(request, trip),
      estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(request, trip)
    };
  }

  extractMatchingFeatures(request, trip) {
    const traveler = trip.traveler || {};
    
    return {
      // Distance features
      originDistance: this.calculateDistance(
        request.pickupCoordinates, 
        trip.originCoordinates
      ),
      destinationDistance: this.calculateDistance(
        request.deliveryCoordinates, 
        trip.destinationCoordinates
      ),
      routeDetour: this.calculateDetour(trip, request),
      
      // Capacity features
      weightUtilization: request.weight / (trip.availableWeight || trip.weightCapacity || 10),
      volumeUtilization: this.calculateVolumeUtilization(request, trip),
      
      // Traveler features
      travelerRating: traveler.rating?.average || 4.0,
      travelerExperience: traveler.statistics?.totalDeliveries || 0,
      travelerVerificationLevel: this.getVerificationScore(traveler.verificationLevel || 'basic'),
      
      // Item compatibility
      categoryMatch: this.getCategoryCompatibility(request.category, trip.preferences),
      fragileCompatible: !request.isFragile || (trip.preferences?.acceptFragile !== false),
      valueCompatible: !request.value || request.value <= (trip.preferences?.maxItemValue || 1000),
      
      // Timing features
      timeFlexibility: this.calculateTimeFlexibility(request, trip),
      urgencyMatch: this.getUrgencyScore(request.urgency, trip.type),
      
      // Historical features (mock data)
      routeExperience: Math.floor(Math.random() * 10),
      categoryExperience: Math.floor(Math.random() * 20)
    };
  }

  ruleBasedScore(features) {
    let score = 0.5; // Base score
    
    // Distance scoring (closer is better)
    if (features.originDistance <= 5) score += 0.2;
    else if (features.originDistance <= 10) score += 0.1;
    else if (features.originDistance > 20) score -= 0.2;
    
    if (features.destinationDistance <= 5) score += 0.2;
    else if (features.destinationDistance <= 10) score += 0.1;
    else if (features.destinationDistance > 20) score -= 0.2;
    
    // Route detour penalty
    if (features.routeDetour <= 5) score += 0.1;
    else if (features.routeDetour > 20) score -= 0.2;
    
    // Traveler rating boost
    if (features.travelerRating >= 4.5) score += 0.15;
    else if (features.travelerRating >= 4.0) score += 0.1;
    else if (features.travelerRating < 3.0) score -= 0.2;
    
    // Capacity utilization (efficient use is better)
    if (features.weightUtilization > 0.7) score += 0.1;
    if (features.weightUtilization < 0.1) score -= 0.1;
    
    // Compatibility factors
    if (features.categoryMatch) score += 0.1;
    if (features.fragileCompatible) score += 0.05;
    if (features.valueCompatible) score += 0.05;
    
    // Experience bonus
    if (features.travelerExperience > 50) score += 0.1;
    else if (features.travelerExperience > 20) score += 0.05;
    
    // Time flexibility bonus
    if (features.timeFlexibility > 0.8) score += 0.1;
    else if (features.timeFlexibility < 0.3) score -= 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  calculateDistance(coords1, coords2) {
    if (!coords1 || !coords2) return 0;
    
    const point1 = {
      latitude: coords1.coordinates ? coords1.coordinates[1] : coords1.lat,
      longitude: coords1.coordinates ? coords1.coordinates[0] : coords1.lng
    };
    
    const point2 = {
      latitude: coords2.coordinates ? coords2.coordinates[1] : coords2.lat,
      longitude: coords2.coordinates ? coords2.coordinates[0] : coords2.lng
    };
    
    return geolib.getDistance(point1, point2) / 1000; // Convert to km
  }

  calculateDetour(trip, request) {
    // Calculate the additional distance if the trip includes pickup and delivery
    const directDistance = this.calculateDistance(
      trip.originCoordinates,
      trip.destinationCoordinates
    );
    
    const withDeliveryDistance = 
      this.calculateDistance(trip.originCoordinates, request.pickupCoordinates) +
      this.calculateDistance(request.pickupCoordinates, request.deliveryCoordinates) +
      this.calculateDistance(request.deliveryCoordinates, trip.destinationCoordinates);
    
    return Math.max(0, withDeliveryDistance - directDistance);
  }

  calculateRouteEfficiency(request, trip) {
    const detour = this.calculateDetour(trip, request);
    const directDistance = this.calculateDistance(
      trip.originCoordinates,
      trip.destinationCoordinates
    );
    
    if (directDistance === 0) return 0;
    
    const efficiency = Math.max(0, 1 - (detour / directDistance));
    return efficiency;
  }

  calculatePriceCompatibility(request, trip) {
    const estimatedPrice = this.calculateEstimatedPrice(request, trip);
    
    if (estimatedPrice <= request.maxPrice) {
      // Price is within budget - calculate how good the deal is
      return Math.min(1, request.maxPrice / estimatedPrice - 1 + 0.5);
    } else {
      // Price exceeds budget
      return Math.max(0, 1 - (estimatedPrice - request.maxPrice) / request.maxPrice);
    }
  }

  calculateTimeCompatibility(request, trip) {
    if (!request.pickupTimeStart || !trip.departureTime) return 0.5;
    
    const requestTime = moment(request.pickupTimeStart);
    const tripTime = moment(trip.departureTime);
    const timeDiff = Math.abs(tripTime.diff(requestTime, 'hours'));
    
    // Perfect match within 2 hours
    if (timeDiff <= 2) return 1.0;
    // Good match within 6 hours
    if (timeDiff <= 6) return 0.8;
    // Acceptable within 12 hours
    if (timeDiff <= 12) return 0.6;
    // Poor match within 24 hours
    if (timeDiff <= 24) return 0.3;
    
    return 0.1;
  }

  calculateCapacityUtilization(request, trip) {
    const weightUtil = request.weight / (trip.availableWeight || trip.weightCapacity || 10);
    const itemUtil = request.quantity / (trip.availableItems || trip.itemCapacity || 5);
    
    return Math.min(weightUtil, itemUtil);
  }

  calculateVolumeUtilization(request, trip) {
    if (!request.dimensions || !trip.volumeCapacity) return 0.1;
    
    const itemVolume = request.dimensions.length * request.dimensions.width * request.dimensions.height / 1000000; // Convert cm³ to m³
    return itemVolume / (trip.availableVolume || trip.volumeCapacity || 0.1);
  }

  getVerificationScore(verificationLevel) {
    const levels = {
      'basic': 1,
      'email': 2,
      'phone': 3,
      'identity': 4,
      'verified': 4
    };
    
    return levels[verificationLevel] || 1;
  }

  getCategoryCompatibility(requestCategory, tripPreferences) {
    if (!tripPreferences || !tripPreferences.acceptedCategories) return true;
    return tripPreferences.acceptedCategories.includes(requestCategory);
  }

  getUrgencyScore(requestUrgency, tripType) {
    const urgencyScores = {
      'standard': { 'car': 2, 'train': 2, 'bus': 2, 'flight': 3 },
      'express': { 'car': 3, 'train': 2, 'bus': 1, 'flight': 3 },
      'urgent': { 'car': 3, 'train': 1, 'bus': 1, 'flight': 3 }
    };
    
    return urgencyScores[requestUrgency]?.[tripType] || 2;
  }

  calculateTimeFlexibility(request, trip) {
    if (!request.flexiblePickupTiming) return 0.5;
    
    const pickupWindow = moment(request.pickupTimeEnd).diff(request.pickupTimeStart, 'hours');
    return Math.min(1, pickupWindow / 24); // Normalize to 24 hours
  }

  calculateEstimatedPrice(request, trip) {
    let basePrice = 15;
    
    // Distance factor
    const distance = this.calculateDistance(
      request.pickupCoordinates,
      request.deliveryCoordinates
    );
    basePrice += distance * 0.8;
    
    // Weight factor
    basePrice += request.weight * 2.5;
    
    // Urgency multiplier
    const urgencyMultipliers = { standard: 1.0, express: 1.4, urgent: 1.8 };
    basePrice *= urgencyMultipliers[request.urgency] || 1.0;
    
    // Trip type multiplier
    const tripMultipliers = { flight: 1.2, train: 1.0, car: 0.9, bus: 0.8 };
    basePrice *= tripMultipliers[trip.type] || 1.0;
    
    // Fragile item surcharge
    if (request.isFragile) basePrice *= 1.15;
    
    return Math.round(basePrice * 100) / 100;
  }

  calculateEstimatedPickupTime(request, trip) {
    const departureTime = moment(trip.departureTime);
    
    // Estimate pickup 1-2 hours before departure for local trips
    const pickupOffset = trip.type === 'flight' ? 3 : 1.5;
    
    return departureTime.subtract(pickupOffset, 'hours').toISOString();
  }

  calculateEstimatedDeliveryTime(request, trip) {
    const arrivalTime = moment(trip.arrivalTime);
    
    // Estimate delivery 1-3 hours after arrival
    const deliveryOffset = trip.type === 'flight' ? 2 : 1;
    
    return arrivalTime.add(deliveryOffset, 'hours').toISOString();
  }

  // Mock data for development
  getMockTrips(request, criteria) {
    const mockTrips = [
      {
        id: 'trip-1',
        title: 'NYC to Boston Flight',
        travelerId: 'traveler-1',
        type: 'flight',
        originAddress: 'New York, NY',
        destinationAddress: 'Boston, MA',
        originCoordinates: { lat: 40.7128, lng: -74.0060 },
        destinationCoordinates: { lat: 42.3601, lng: -71.0589 },
        departureTime: moment().add(1, 'day').toISOString(),
        arrivalTime: moment().add(1, 'day').add(1.5, 'hours').toISOString(),
        weightCapacity: 20,
        availableWeight: 15,
        itemCapacity: 5,
        availableItems: 3,
        volumeCapacity: 0.5,
        availableVolume: 0.3,
        traveler: {
          firstName: 'John',
          lastName: 'Doe',
          rating: { average: 4.8, count: 156 },
          verificationLevel: 'verified',
          statistics: { totalDeliveries: 89 }
        },
        preferences: {
          acceptedCategories: ['documents', 'electronics', 'clothing'],
          acceptFragile: true,
          maxItemValue: 1000
        }
      },
      {
        id: 'trip-2',
        title: 'NYC to Boston Train',
        travelerId: 'traveler-2',
        type: 'train',
        originAddress: 'New York, NY',
        destinationAddress: 'Boston, MA',
        originCoordinates: { lat: 40.7505, lng: -73.9934 },
        destinationCoordinates: { lat: 42.3584, lng: -71.0598 },
        departureTime: moment().add(2, 'days').toISOString(),
        arrivalTime: moment().add(2, 'days').add(4, 'hours').toISOString(),
        weightCapacity: 10,
        availableWeight: 8,
        itemCapacity: 3,
        availableItems: 2,
        volumeCapacity: 0.2,
        availableVolume: 0.15,
        traveler: {
          firstName: 'Jane',
          lastName: 'Smith',
          rating: { average: 4.6, count: 67 },
          verificationLevel: 'identity',
          statistics: { totalDeliveries: 45 }
        },
        preferences: {
          acceptedCategories: ['documents', 'books', 'clothing'],
          acceptFragile: false,
          maxItemValue: 500
        }
      }
    ];

    return mockTrips.filter(trip => {
      const originDistance = this.calculateDistance(
        request.pickupCoordinates,
        trip.originCoordinates
      );
      const destinationDistance = this.calculateDistance(
        request.deliveryCoordinates,
        trip.destinationCoordinates
      );
      
      return originDistance <= (criteria.maxDistance || 10) && 
             destinationDistance <= (criteria.maxDistance || 10);
    });
  }
}

module.exports = new MatchingService();