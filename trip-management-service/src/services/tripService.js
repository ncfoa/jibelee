const { logger, logBusinessEvent } = require('../config/logger');
const { cache, generateCacheKey } = require('../config/redis');
const { withTransaction } = require('../config/database');
const { GeoUtils, TimeUtils, CommonUtils } = require('../utils');
const GeocodingService = require('./geocodingService');
const WeatherService = require('./weatherService');
const CapacityService = require('./capacityService');

/**
 * Main trip service for managing trips
 */
class TripService {
  constructor() {
    this.geocodingService = new GeocodingService();
    this.weatherService = new WeatherService();
    this.capacityService = new CapacityService();
    this.cacheTimeout = 300; // 5 minutes
  }

  /**
   * Create a new trip
   * @param {string} userId - User ID
   * @param {Object} tripData - Trip data
   * @returns {Object} Created trip
   */
  async createTrip(userId, tripData) {
    try {
      return await withTransaction(async (transaction) => {
        const { Trip } = require('../models');

        // Geocode origin and destination if coordinates not provided
        if (!tripData.origin.coordinates) {
          const originGeocode = await this.geocodingService.geocode(tripData.origin.address);
          tripData.origin.coordinates = originGeocode.coordinates;
        }

        if (!tripData.destination.coordinates) {
          const destGeocode = await this.geocodingService.geocode(tripData.destination.address);
          tripData.destination.coordinates = destGeocode.coordinates;
        }

        // Calculate route distance and duration
        const distance = GeoUtils.calculateDistance(
          tripData.origin.coordinates,
          tripData.destination.coordinates
        );

        // Estimate duration if not provided
        let estimatedDuration = tripData.estimatedDuration;
        if (!estimatedDuration) {
          const departureTime = new Date(tripData.departureTime);
          const arrivalTime = new Date(tripData.arrivalTime);
          estimatedDuration = TimeUtils.calculateDuration(departureTime, arrivalTime);
        }

        // Prepare trip data for database
        const dbTripData = {
          traveler_id: userId,
          title: tripData.title,
          description: tripData.description,
          trip_type: tripData.type,
          status: 'upcoming',

          // Origin data
          origin_address: tripData.origin.address,
          origin_coordinates: {
            type: 'Point',
            coordinates: [tripData.origin.coordinates.lng, tripData.origin.coordinates.lat]
          },
          origin_airport: tripData.origin.airport,
          origin_terminal: tripData.origin.terminal,
          origin_details: tripData.origin.details,

          // Destination data
          destination_address: tripData.destination.address,
          destination_coordinates: {
            type: 'Point',
            coordinates: [tripData.destination.coordinates.lng, tripData.destination.coordinates.lat]
          },
          destination_airport: tripData.destination.airport,
          destination_terminal: tripData.destination.terminal,
          destination_details: tripData.destination.details,

          // Timing
          departure_time: tripData.departureTime,
          arrival_time: tripData.arrivalTime,
          estimated_duration: estimatedDuration,

          // Capacity
          weight_capacity: tripData.capacity.weight,
          volume_capacity: tripData.capacity.volume,
          item_capacity: tripData.capacity.items,
          available_weight: tripData.capacity.weight,
          available_volume: tripData.capacity.volume,
          available_items: tripData.capacity.items,

          // Pricing
          base_price: tripData.pricing.basePrice,
          price_per_kg: tripData.pricing.pricePerKg || 0,
          price_per_km: tripData.pricing.pricePerKm || 0,
          express_multiplier: tripData.pricing.expressMultiplier || 1,
          fragile_multiplier: tripData.pricing.fragileMultiplier || 1,

          // Settings
          restrictions: tripData.restrictions || {},
          preferences: tripData.preferences || {},
          is_recurring: tripData.isRecurring || false,
          recurring_pattern: tripData.recurringPattern,
          visibility: tripData.visibility || 'public',
          auto_accept: tripData.autoAccept || false,
          auto_accept_price: tripData.autoAcceptPrice,
          tags: tripData.tags || [],
          distance: distance
        };

        // Create the trip
        const trip = await Trip.create(dbTripData, { transaction });

        // Fetch weather data in background
        this.weatherService.fetchTripWeather(trip.id).catch(error => {
          logger.warn('Failed to fetch weather data for new trip:', {
            tripId: trip.id,
            error: error.message
          });
        });

        // Create recurring trips if specified
        if (tripData.isRecurring && tripData.recurringPattern) {
          this.createRecurringTrips(trip, tripData.recurringPattern).catch(error => {
            logger.warn('Failed to create recurring trips:', {
              parentTripId: trip.id,
              error: error.message
            });
          });
        }

        // Cache the trip
        const cacheKey = generateCacheKey.trip(trip.id);
        await cache.set(cacheKey, trip.toJSON(), this.cacheTimeout);

        logBusinessEvent('trip_created', {
          tripId: trip.id,
          userId,
          type: trip.trip_type,
          distance,
          capacity: tripData.capacity,
          isRecurring: tripData.isRecurring
        });

        return this.formatTripResponse(trip);
      });
    } catch (error) {
      logger.error('Create trip error:', {
        userId,
        tripData: { ...tripData, capacity: tripData.capacity },
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get trip by ID
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID (for access control)
   * @returns {Object} Trip data
   */
  async getTripById(tripId, userId) {
    try {
      // Try cache first
      const cacheKey = generateCacheKey.trip(tripId);
      let trip = await cache.get(cacheKey);

      if (!trip) {
        // Get from database
        const { Trip, TripWeather } = require('../models');
        trip = await Trip.findByPk(tripId, {
          include: [
            {
              model: TripWeather,
              as: 'weather',
              required: false
            }
          ]
        });

        if (!trip) {
          throw new Error('Trip not found');
        }

        // Cache for future use
        await cache.set(cacheKey, trip.toJSON(), this.cacheTimeout);
      }

      // Check access permissions
      if (trip.visibility === 'private' && trip.traveler_id !== userId) {
        throw new Error('Access denied to private trip');
      }

      return this.formatTripResponse(trip);
    } catch (error) {
      logger.error('Get trip by ID error:', {
        tripId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update trip
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated trip
   */
  async updateTrip(tripId, userId, updateData) {
    try {
      return await withTransaction(async (transaction) => {
        const { Trip } = require('../models');

        // Get trip with lock
        const trip = await Trip.findByPk(tripId, {
          lock: true,
          transaction
        });

        if (!trip) {
          throw new Error('Trip not found');
        }

        // Check ownership
        if (trip.traveler_id !== userId) {
          throw new Error('Access denied - not trip owner');
        }

        // Check if trip can be updated
        if (trip.status === 'completed' || trip.status === 'cancelled') {
          throw new Error('Cannot update completed or cancelled trip');
        }

        // Prepare update data
        const updates = {};

        if (updateData.title) updates.title = updateData.title;
        if (updateData.description !== undefined) updates.description = updateData.description;
        if (updateData.departureTime) updates.departure_time = updateData.departureTime;
        if (updateData.arrivalTime) updates.arrival_time = updateData.arrivalTime;
        
        // Update capacity
        if (updateData.capacity) {
          // Check if there are active reservations
          const capacityStatus = await this.capacityService.getCapacityStatus(tripId);
          const usedCapacity = {
            weight: trip.weight_capacity - trip.available_weight,
            volume: trip.volume_capacity - trip.available_volume,
            items: trip.item_capacity - trip.available_items
          };

          // Ensure new capacity is not less than used capacity
          if (updateData.capacity.weight < usedCapacity.weight ||
              updateData.capacity.volume < usedCapacity.volume ||
              updateData.capacity.items < usedCapacity.items) {
            throw new Error('Cannot reduce capacity below currently used capacity');
          }

          updates.weight_capacity = updateData.capacity.weight;
          updates.volume_capacity = updateData.capacity.volume;
          updates.item_capacity = updateData.capacity.items;
          
          // Update available capacity
          updates.available_weight = updateData.capacity.weight - usedCapacity.weight;
          updates.available_volume = updateData.capacity.volume - usedCapacity.volume;
          updates.available_items = updateData.capacity.items - usedCapacity.items;
        }

        // Update pricing
        if (updateData.pricing) {
          if (updateData.pricing.basePrice !== undefined) {
            updates.base_price = updateData.pricing.basePrice;
          }
          if (updateData.pricing.pricePerKg !== undefined) {
            updates.price_per_kg = updateData.pricing.pricePerKg;
          }
          if (updateData.pricing.pricePerKm !== undefined) {
            updates.price_per_km = updateData.pricing.pricePerKm;
          }
        }

        // Update other fields
        if (updateData.restrictions) updates.restrictions = updateData.restrictions;
        if (updateData.preferences) updates.preferences = updateData.preferences;
        if (updateData.visibility) updates.visibility = updateData.visibility;
        if (updateData.autoAccept !== undefined) updates.auto_accept = updateData.autoAccept;
        if (updateData.autoAcceptPrice !== undefined) updates.auto_accept_price = updateData.autoAcceptPrice;
        if (updateData.tags) updates.tags = updateData.tags;

        // Recalculate duration if times changed
        if (updates.departure_time || updates.arrival_time) {
          const depTime = new Date(updates.departure_time || trip.departure_time);
          const arrTime = new Date(updates.arrival_time || trip.arrival_time);
          updates.estimated_duration = TimeUtils.calculateDuration(depTime, arrTime);
        }

        // Update the trip
        const updatedTrip = await trip.update(updates, { transaction });

        // Clear cache
        const cacheKey = generateCacheKey.trip(tripId);
        await cache.del(cacheKey);

        logBusinessEvent('trip_updated', {
          tripId,
          userId,
          updatedFields: Object.keys(updates),
          previousStatus: trip.status
        });

        return this.formatTripResponse(updatedTrip);
      });
    } catch (error) {
      logger.error('Update trip error:', {
        tripId,
        userId,
        updateData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel trip
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {Object} cancellationData - Cancellation data
   * @returns {Object} Cancelled trip
   */
  async cancelTrip(tripId, userId, cancellationData) {
    try {
      return await withTransaction(async (transaction) => {
        const { Trip } = require('../models');

        const trip = await Trip.findByPk(tripId, {
          lock: true,
          transaction
        });

        if (!trip) {
          throw new Error('Trip not found');
        }

        // Check ownership
        if (trip.traveler_id !== userId) {
          throw new Error('Access denied - not trip owner');
        }

        // Check if trip can be cancelled
        if (trip.status === 'completed' || trip.status === 'cancelled') {
          throw new Error('Trip is already completed or cancelled');
        }

        // Update trip status
        const updatedTrip = await trip.update({
          status: 'cancelled',
          cancelled_at: new Date(),
          cancellation_reason: cancellationData.message || cancellationData.reason
        }, { transaction });

        // Release all capacity reservations
        await this.releaseAllReservations(tripId);

        // Clear cache
        const cacheKey = generateCacheKey.trip(tripId);
        await cache.del(cacheKey);

        logBusinessEvent('trip_cancelled', {
          tripId,
          userId,
          reason: cancellationData.reason,
          previousStatus: trip.status
        });

        return this.formatTripResponse(updatedTrip);
      });
    } catch (error) {
      logger.error('Cancel trip error:', {
        tripId,
        userId,
        cancellationData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search trips
   * @param {Object} searchCriteria - Search criteria
   * @param {string} userId - User ID (optional)
   * @returns {Object} Search results
   */
  async searchTrips(searchCriteria, userId = null) {
    try {
      const cacheKey = generateCacheKey.tripSearch(searchCriteria);
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const { Trip, Sequelize } = require('../models');
      const { Op } = Sequelize;

      // Build where clause
      const where = {
        status: 'upcoming',
        visibility: 'public'
      };

      // Date filters
      if (searchCriteria.departureDate) {
        const date = new Date(searchCriteria.departureDate);
        const dayBounds = TimeUtils.getDayBounds(date);
        where.departure_time = {
          [Op.between]: [dayBounds.start, dayBounds.end]
        };
      } else if (searchCriteria.departureDateFrom || searchCriteria.departureDateTo) {
        const dateRange = {};
        if (searchCriteria.departureDateFrom) {
          dateRange[Op.gte] = new Date(searchCriteria.departureDateFrom);
        }
        if (searchCriteria.departureDateTo) {
          dateRange[Op.lte] = new Date(searchCriteria.departureDateTo);
        }
        where.departure_time = dateRange;
      }

      // Trip type filter
      if (searchCriteria.type) {
        where.trip_type = searchCriteria.type;
      }

      // Capacity filters
      if (searchCriteria.minCapacityWeight) {
        where.available_weight = { [Op.gte]: searchCriteria.minCapacityWeight };
      }
      if (searchCriteria.minCapacityVolume) {
        where.available_volume = { [Op.gte]: searchCriteria.minCapacityVolume };
      }

      // Price filter
      if (searchCriteria.maxPrice) {
        where.base_price = { [Op.lte]: searchCriteria.maxPrice };
      }

      // Location-based search
      let locationWhere = [];
      const radius = (searchCriteria.radius || 50) * 1000; // Convert km to meters

      if (searchCriteria.origin || (searchCriteria.originLat && searchCriteria.originLng)) {
        let originCoords;
        if (searchCriteria.originLat && searchCriteria.originLng) {
          originCoords = { lat: searchCriteria.originLat, lng: searchCriteria.originLng };
        } else {
          const geocoded = await this.geocodingService.geocode(searchCriteria.origin);
          originCoords = geocoded.coordinates;
        }

        locationWhere.push(
          Sequelize.where(
            Sequelize.fn(
              'ST_DWithin',
              Sequelize.col('origin_coordinates'),
              Sequelize.fn('ST_GeomFromText', `POINT(${originCoords.lng} ${originCoords.lat})`, 4326),
              radius
            ),
            true
          )
        );
      }

      if (searchCriteria.destination || (searchCriteria.destinationLat && searchCriteria.destinationLng)) {
        let destCoords;
        if (searchCriteria.destinationLat && searchCriteria.destinationLng) {
          destCoords = { lat: searchCriteria.destinationLat, lng: searchCriteria.destinationLng };
        } else {
          const geocoded = await this.geocodingService.geocode(searchCriteria.destination);
          destCoords = geocoded.coordinates;
        }

        locationWhere.push(
          Sequelize.where(
            Sequelize.fn(
              'ST_DWithin',
              Sequelize.col('destination_coordinates'),
              Sequelize.fn('ST_GeomFromText', `POINT(${destCoords.lng} ${destCoords.lat})`, 4326),
              radius
            ),
            true
          )
        );
      }

      if (locationWhere.length > 0) {
        where[Op.and] = locationWhere;
      }

      // Sorting
      const sortBy = searchCriteria.sortBy || 'departure';
      const sortOrder = searchCriteria.sortOrder || 'asc';
      
      const sortMapping = {
        price: 'base_price',
        departure: 'departure_time',
        distance: 'distance',
        created_at: 'created_at'
      };

      const orderBy = [[sortMapping[sortBy] || 'departure_time', sortOrder.toUpperCase()]];

      // Pagination
      const page = parseInt(searchCriteria.page) || 1;
      const limit = parseInt(searchCriteria.limit) || 20;
      const offset = (page - 1) * limit;

      // Execute search
      const { count, rows } = await Trip.findAndCountAll({
        where,
        order: orderBy,
        limit,
        offset,
        attributes: [
          'id', 'title', 'trip_type', 'origin_address', 'destination_address',
          'departure_time', 'arrival_time', 'available_weight', 'available_volume',
          'available_items', 'base_price', 'distance', 'created_at'
        ]
      });

      const results = {
        trips: rows.map(trip => this.formatTripSearchResult(trip)),
        pagination: CommonUtils.generatePagination(page, limit, count),
        filters: {
          appliedFilters: searchCriteria,
          totalResults: count
        }
      };

      // Cache results for 1 minute
      await cache.set(cacheKey, results, 60);

      logBusinessEvent('trip_search_performed', {
        userId,
        criteria: searchCriteria,
        resultCount: count,
        page,
        limit
      });

      return results;
    } catch (error) {
      logger.error('Search trips error:', {
        searchCriteria,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user's trips
   * @param {string} userId - User ID
   * @param {Object} filters - Filters
   * @returns {Object} User trips
   */
  async getUserTrips(userId, filters = {}) {
    try {
      const cacheKey = generateCacheKey.trips(userId, filters);
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const { Trip, TripWeather } = require('../models');
      const { Op } = Sequelize;

      // Build where clause
      const where = { traveler_id: userId };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.type) {
        where.trip_type = filters.type;
      }

      // Date range filters
      if (filters.startDate || filters.endDate) {
        const dateRange = {};
        if (filters.startDate) {
          dateRange[Op.gte] = new Date(filters.startDate);
        }
        if (filters.endDate) {
          dateRange[Op.lte] = new Date(filters.endDate);
        }
        where.departure_time = dateRange;
      }

      // Sorting
      const sortBy = filters.sort || 'created_at';
      const sortOrder = filters.order || 'desc';
      const orderBy = [[sortBy, sortOrder.toUpperCase()]];

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const offset = (page - 1) * limit;

      // Execute query
      const { count, rows } = await Trip.findAndCountAll({
        where,
        include: [
          {
            model: TripWeather,
            as: 'weather',
            required: false,
            limit: 1,
            order: [['fetched_at', 'DESC']]
          }
        ],
        order: orderBy,
        limit,
        offset
      });

      const results = {
        trips: rows.map(trip => this.formatTripResponse(trip)),
        pagination: CommonUtils.generatePagination(page, limit, count),
        summary: await this.getUserTripsSummary(userId)
      };

      // Cache results
      await cache.set(cacheKey, results, this.cacheTimeout);

      return results;
    } catch (error) {
      logger.error('Get user trips error:', {
        userId,
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start trip
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {Object} startData - Start data
   * @returns {Object} Started trip
   */
  async startTrip(tripId, userId, startData) {
    try {
      return await withTransaction(async (transaction) => {
        const { Trip } = require('../models');

        const trip = await Trip.findByPk(tripId, {
          lock: true,
          transaction
        });

        if (!trip) {
          throw new Error('Trip not found');
        }

        if (trip.traveler_id !== userId) {
          throw new Error('Access denied - not trip owner');
        }

        if (trip.status !== 'upcoming') {
          throw new Error('Trip cannot be started - invalid status');
        }

        // Update trip status
        const updatedTrip = await trip.update({
          status: 'active',
          actual_departure_time: startData.actualDepartureTime || new Date()
        }, { transaction });

        // Clear cache
        const cacheKey = generateCacheKey.trip(tripId);
        await cache.del(cacheKey);

        logBusinessEvent('trip_started', {
          tripId,
          userId,
          scheduledDeparture: trip.departure_time,
          actualDeparture: updatedTrip.actual_departure_time
        });

        return this.formatTripResponse(updatedTrip);
      });
    } catch (error) {
      logger.error('Start trip error:', {
        tripId,
        userId,
        startData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Complete trip
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {Object} completionData - Completion data
   * @returns {Object} Completed trip
   */
  async completeTrip(tripId, userId, completionData) {
    try {
      return await withTransaction(async (transaction) => {
        const { Trip } = require('../models');

        const trip = await Trip.findByPk(tripId, {
          lock: true,
          transaction
        });

        if (!trip) {
          throw new Error('Trip not found');
        }

        if (trip.traveler_id !== userId) {
          throw new Error('Access denied - not trip owner');
        }

        if (trip.status !== 'active') {
          throw new Error('Trip cannot be completed - invalid status');
        }

        // Update trip status
        const updatedTrip = await trip.update({
          status: 'completed',
          actual_arrival_time: completionData.actualArrivalTime || new Date()
        }, { transaction });

        // Clear cache
        const cacheKey = generateCacheKey.trip(tripId);
        await cache.del(cacheKey);

        logBusinessEvent('trip_completed', {
          tripId,
          userId,
          scheduledArrival: trip.arrival_time,
          actualArrival: updatedTrip.actual_arrival_time,
          duration: updatedTrip.actual_departure_time && updatedTrip.actual_arrival_time
            ? TimeUtils.calculateDuration(updatedTrip.actual_departure_time, updatedTrip.actual_arrival_time)
            : null
        });

        return this.formatTripResponse(updatedTrip);
      });
    } catch (error) {
      logger.error('Complete trip error:', {
        tripId,
        userId,
        completionData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format trip response for API
   * @private
   */
  formatTripResponse(trip) {
    const tripData = trip.toJSON ? trip.toJSON() : trip;

    return {
      id: tripData.id,
      title: tripData.title,
      description: tripData.description,
      type: tripData.trip_type,
      status: tripData.status,
      
      traveler: {
        id: tripData.traveler_id
        // Additional traveler info would be fetched from user service
      },

      route: {
        origin: {
          address: tripData.origin_address,
          coordinates: this.parseCoordinates(tripData.origin_coordinates),
          airport: tripData.origin_airport,
          terminal: tripData.origin_terminal,
          details: tripData.origin_details
        },
        destination: {
          address: tripData.destination_address,
          coordinates: this.parseCoordinates(tripData.destination_coordinates),
          airport: tripData.destination_airport,
          terminal: tripData.destination_terminal,
          details: tripData.destination_details
        },
        distance: tripData.distance
      },

      schedule: {
        departureTime: tripData.departure_time,
        arrivalTime: tripData.arrival_time,
        estimatedDuration: tripData.estimated_duration,
        actualDepartureTime: tripData.actual_departure_time,
        actualArrivalTime: tripData.actual_arrival_time
      },

      capacity: {
        total: {
          weight: tripData.weight_capacity,
          volume: tripData.volume_capacity,
          items: tripData.item_capacity
        },
        available: {
          weight: tripData.available_weight,
          volume: tripData.available_volume,
          items: tripData.available_items
        }
      },

      pricing: {
        basePrice: tripData.base_price,
        pricePerKg: tripData.price_per_kg,
        pricePerKm: tripData.price_per_km,
        expressMultiplier: tripData.express_multiplier,
        fragileMultiplier: tripData.fragile_multiplier
      },

      settings: {
        restrictions: tripData.restrictions,
        preferences: tripData.preferences,
        visibility: tripData.visibility,
        autoAccept: tripData.auto_accept,
        autoAcceptPrice: tripData.auto_accept_price,
        isRecurring: tripData.is_recurring,
        recurringPattern: tripData.recurring_pattern
      },

      metadata: {
        tags: tripData.tags,
        createdAt: tripData.created_at,
        updatedAt: tripData.updated_at,
        cancelledAt: tripData.cancelled_at,
        cancellationReason: tripData.cancellation_reason
      },

      weather: tripData.weather ? {
        travelConditions: tripData.weather.travel_conditions,
        hasAlerts: tripData.weather.alerts && tripData.weather.alerts.length > 0,
        lastUpdated: tripData.weather.fetched_at
      } : null
    };
  }

  /**
   * Format trip search result
   * @private
   */
  formatTripSearchResult(trip) {
    const tripData = trip.toJSON ? trip.toJSON() : trip;

    return {
      id: tripData.id,
      title: tripData.title,
      type: tripData.trip_type,
      route: {
        origin: tripData.origin_address,
        destination: tripData.destination_address,
        distance: tripData.distance
      },
      schedule: {
        departureTime: tripData.departure_time,
        arrivalTime: tripData.arrival_time
      },
      capacity: {
        weight: tripData.available_weight,
        volume: tripData.available_volume,
        items: tripData.available_items
      },
      pricing: {
        basePrice: tripData.base_price
      },
      createdAt: tripData.created_at
    };
  }

  /**
   * Parse coordinates from database format
   * @private
   */
  parseCoordinates(coords) {
    if (!coords) return null;
    
    if (coords.coordinates) {
      return {
        lng: coords.coordinates[0],
        lat: coords.coordinates[1]
      };
    }
    
    return coords;
  }

  /**
   * Get user trips summary
   * @private
   */
  async getUserTripsSummary(userId) {
    try {
      const { Trip, Sequelize } = require('../models');

      const summary = await Trip.findAll({
        where: { traveler_id: userId },
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
          [Sequelize.fn('AVG', Sequelize.col('base_price')), 'avgPrice'],
          [Sequelize.fn('SUM', Sequelize.col('distance')), 'totalDistance']
        ],
        group: ['status'],
        raw: true
      });

      const result = {
        total: 0,
        upcoming: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        totalDistance: 0,
        averagePrice: 0
      };

      summary.forEach(item => {
        result.total += parseInt(item.count);
        result[item.status] = parseInt(item.count);
        if (item.status === 'completed') {
          result.totalDistance = parseFloat(item.totalDistance) || 0;
          result.averagePrice = parseFloat(item.avgPrice) || 0;
        }
      });

      return result;
    } catch (error) {
      logger.error('Get user trips summary error:', {
        userId,
        error: error.message
      });
      return {
        total: 0,
        upcoming: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        totalDistance: 0,
        averagePrice: 0
      };
    }
  }

  /**
   * Create recurring trips
   * @private
   */
  async createRecurringTrips(parentTrip, pattern) {
    try {
      const { Trip } = require('../models');
      
      // Generate recurring dates
      const recurringDates = TimeUtils.generateRecurringDates(
        parentTrip.departure_time,
        pattern,
        10 // Create next 10 instances
      );

      const createdTrips = [];

      for (const date of recurringDates.slice(1)) { // Skip first date (parent trip)
        const duration = TimeUtils.calculateDuration(
          parentTrip.departure_time,
          parentTrip.arrival_time
        );

        const arrivalTime = TimeUtils.addTime(date, duration, 'minutes');

        const recurringTripData = {
          ...parentTrip.toJSON(),
          id: undefined, // Let database generate new ID
          departure_time: date,
          arrival_time: arrivalTime,
          parent_trip_id: parentTrip.id,
          created_at: undefined,
          updated_at: undefined
        };

        const recurringTrip = await Trip.create(recurringTripData);
        createdTrips.push(recurringTrip);
      }

      logBusinessEvent('recurring_trips_created', {
        parentTripId: parentTrip.id,
        createdCount: createdTrips.length,
        pattern
      });

      return createdTrips;
    } catch (error) {
      logger.error('Create recurring trips error:', {
        parentTripId: parentTrip.id,
        pattern,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Release all capacity reservations for a trip
   * @private
   */
  async releaseAllReservations(tripId) {
    try {
      const reservations = await this.capacityService.getActiveReservations(tripId);
      
      for (const reservation of reservations) {
        await this.capacityService.releaseCapacity(tripId, reservation.reservationId);
      }

      logger.info('Released all capacity reservations for trip', {
        tripId,
        releasedCount: reservations.length
      });
    } catch (error) {
      logger.error('Release all reservations error:', {
        tripId,
        error: error.message
      });
    }
  }
}

module.exports = TripService;