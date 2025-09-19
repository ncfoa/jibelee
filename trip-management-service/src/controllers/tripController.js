const { logger, logBusinessEvent } = require('../config/logger');
const { TripService, WeatherService, CapacityService } = require('../services');
const { CommonUtils } = require('../utils');

/**
 * Trip controller handling all trip-related endpoints
 */
class TripController {
  constructor() {
    this.tripService = new TripService();
    this.weatherService = new WeatherService();
    this.capacityService = new CapacityService();
  }

  /**
   * Create a new trip
   * POST /api/v1/trips
   */
  async createTrip(req, res) {
    try {
      const userId = req.user.id;
      const tripData = req.body;

      // Create the trip
      const trip = await this.tripService.createTrip(userId, tripData);

      res.status(201).json({
        success: true,
        message: 'Trip created successfully',
        data: trip
      });
    } catch (error) {
      logger.error('Create trip controller error:', {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('validation') ? 422 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create trip',
        error: 'CREATE_TRIP_ERROR'
      });
    }
  }

  /**
   * Get trip by ID
   * GET /api/v1/trips/:id
   */
  async getTripById(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user?.id;

      const trip = await this.tripService.getTripById(tripId, userId);

      res.json({
        success: true,
        data: trip
      });
    } catch (error) {
      logger.error('Get trip by ID controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get trip',
        error: 'GET_TRIP_ERROR'
      });
    }
  }

  /**
   * Update trip
   * PUT /api/v1/trips/:id
   */
  async updateTrip(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const trip = await this.tripService.updateTrip(tripId, userId, updateData);

      res.json({
        success: true,
        message: 'Trip updated successfully',
        data: trip
      });
    } catch (error) {
      logger.error('Update trip controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('cannot update') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update trip',
        error: 'UPDATE_TRIP_ERROR'
      });
    }
  }

  /**
   * Cancel trip
   * POST /api/v1/trips/:id/cancel
   */
  async cancelTrip(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;
      const cancellationData = req.body;

      const trip = await this.tripService.cancelTrip(tripId, userId, cancellationData);

      res.json({
        success: true,
        message: 'Trip cancelled successfully',
        data: trip
      });
    } catch (error) {
      logger.error('Cancel trip controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('cannot be cancelled') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to cancel trip',
        error: 'CANCEL_TRIP_ERROR'
      });
    }
  }

  /**
   * Search trips
   * GET /api/v1/trips/search
   */
  async searchTrips(req, res) {
    try {
      const searchCriteria = req.query;
      const userId = req.user?.id;

      const results = await this.tripService.searchTrips(searchCriteria, userId);

      res.json({
        success: true,
        data: results.trips,
        pagination: results.pagination,
        filters: results.filters
      });
    } catch (error) {
      logger.error('Search trips controller error:', {
        searchCriteria: req.query,
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search trips',
        error: 'SEARCH_TRIPS_ERROR'
      });
    }
  }

  /**
   * Get user's trips
   * GET /api/v1/trips/my-trips
   */
  async getMyTrips(req, res) {
    try {
      const userId = req.user.id;
      const filters = req.query;

      const results = await this.tripService.getUserTrips(userId, filters);

      res.json({
        success: true,
        data: results.trips,
        pagination: results.pagination,
        summary: results.summary
      });
    } catch (error) {
      logger.error('Get my trips controller error:', {
        userId: req.user?.id,
        filters: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get user trips',
        error: 'GET_USER_TRIPS_ERROR'
      });
    }
  }

  /**
   * Start trip
   * POST /api/v1/trips/:id/start
   */
  async startTrip(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;
      const startData = req.body;

      const trip = await this.tripService.startTrip(tripId, userId, startData);

      res.json({
        success: true,
        message: 'Trip started successfully',
        data: trip
      });
    } catch (error) {
      logger.error('Start trip controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('cannot be started') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to start trip',
        error: 'START_TRIP_ERROR'
      });
    }
  }

  /**
   * Update trip status
   * POST /api/v1/trips/:id/status
   */
  async updateTripStatus(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;
      const statusData = req.body;

      // Handle different status updates
      let result;
      switch (statusData.status) {
        case 'active':
          result = await this.tripService.startTrip(tripId, userId, statusData);
          break;
        case 'completed':
          result = await this.tripService.completeTrip(tripId, userId, statusData);
          break;
        case 'cancelled':
          result = await this.tripService.cancelTrip(tripId, userId, statusData);
          break;
        default:
          throw new Error(`Invalid status update: ${statusData.status}`);
      }

      res.json({
        success: true,
        message: `Trip status updated to ${statusData.status}`,
        data: result
      });
    } catch (error) {
      logger.error('Update trip status controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        statusData: req.body,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('Invalid status') ? 400 :
                        error.message.includes('cannot be') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update trip status',
        error: 'UPDATE_STATUS_ERROR'
      });
    }
  }

  /**
   * Complete trip
   * POST /api/v1/trips/:id/complete
   */
  async completeTrip(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;
      const completionData = req.body;

      const trip = await this.tripService.completeTrip(tripId, userId, completionData);

      res.json({
        success: true,
        message: 'Trip completed successfully',
        data: trip
      });
    } catch (error) {
      logger.error('Complete trip controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('cannot be completed') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to complete trip',
        error: 'COMPLETE_TRIP_ERROR'
      });
    }
  }

  /**
   * Duplicate trip
   * POST /api/v1/trips/:id/duplicate
   */
  async duplicateTrip(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;
      const modifications = req.body;

      // Get original trip
      const originalTrip = await this.tripService.getTripById(tripId, userId);
      
      if (originalTrip.traveler.id !== userId) {
        throw new Error('Access denied - not trip owner');
      }

      // Create new trip data based on original
      const newTripData = {
        title: modifications.title || `Copy of ${originalTrip.title}`,
        description: modifications.description || originalTrip.description,
        type: originalTrip.type,
        origin: originalTrip.route.origin,
        destination: originalTrip.route.destination,
        departureTime: modifications.departureTime || originalTrip.schedule.departureTime,
        arrivalTime: modifications.arrivalTime || originalTrip.schedule.arrivalTime,
        capacity: modifications.capacity || originalTrip.capacity.total,
        pricing: modifications.pricing || originalTrip.pricing,
        restrictions: originalTrip.settings.restrictions,
        preferences: originalTrip.settings.preferences,
        visibility: originalTrip.settings.visibility,
        tags: originalTrip.metadata.tags
      };

      const duplicatedTrip = await this.tripService.createTrip(userId, newTripData);

      res.status(201).json({
        success: true,
        message: 'Trip duplicated successfully',
        data: duplicatedTrip
      });
    } catch (error) {
      logger.error('Duplicate trip controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to duplicate trip',
        error: 'DUPLICATE_TRIP_ERROR'
      });
    }
  }

  /**
   * Get trip weather
   * GET /api/v1/trips/:id/weather
   */
  async getTripWeather(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user?.id;

      // Verify access to trip
      await this.tripService.getTripById(tripId, userId);

      // Get weather data
      const weather = await this.weatherService.getWeatherSummary(tripId);

      res.json({
        success: true,
        data: weather
      });
    } catch (error) {
      logger.error('Get trip weather controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get trip weather',
        error: 'GET_WEATHER_ERROR'
      });
    }
  }

  /**
   * Refresh trip weather
   * POST /api/v1/trips/:id/weather/refresh
   */
  async refreshTripWeather(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user?.id;

      // Verify access to trip
      const trip = await this.tripService.getTripById(tripId, userId);
      
      if (trip.traveler.id !== userId) {
        throw new Error('Access denied - not trip owner');
      }

      // Refresh weather data
      const weather = await this.weatherService.refreshWeatherData(tripId);

      res.json({
        success: true,
        message: 'Weather data refreshed successfully',
        data: weather
      });
    } catch (error) {
      logger.error('Refresh trip weather controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to refresh weather data',
        error: 'REFRESH_WEATHER_ERROR'
      });
    }
  }

  /**
   * Get trip capacity status
   * GET /api/v1/trips/:id/capacity
   */
  async getCapacityStatus(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user?.id;

      // Verify access to trip
      await this.tripService.getTripById(tripId, userId);

      // Get capacity status
      const capacity = await this.capacityService.getCapacityStatus(tripId);

      res.json({
        success: true,
        data: capacity
      });
    } catch (error) {
      logger.error('Get capacity status controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get capacity status',
        error: 'GET_CAPACITY_ERROR'
      });
    }
  }

  /**
   * Check capacity for delivery request
   * POST /api/v1/trips/:id/capacity/check
   */
  async checkCapacity(req, res) {
    try {
      const { id: tripId } = req.params;
      const { capacity: requiredCapacity } = req.body;

      if (!requiredCapacity) {
        return res.status(400).json({
          success: false,
          message: 'Required capacity must be specified',
          error: 'MISSING_CAPACITY'
        });
      }

      // Check capacity
      const capacityCheck = await this.capacityService.checkCapacity(tripId, requiredCapacity);

      res.json({
        success: true,
        data: capacityCheck
      });
    } catch (error) {
      logger.error('Check capacity controller error:', {
        tripId: req.params.id,
        requiredCapacity: req.body.capacity,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to check capacity',
        error: 'CHECK_CAPACITY_ERROR'
      });
    }
  }

  /**
   * Reserve trip capacity
   * POST /api/v1/trips/:id/capacity/reserve
   */
  async reserveCapacity(req, res) {
    try {
      const { id: tripId } = req.params;
      const { capacity, reservationId, holdTime } = req.body;

      if (!capacity || !reservationId) {
        return res.status(400).json({
          success: false,
          message: 'Capacity and reservation ID are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Reserve capacity
      const reservation = await this.capacityService.reserveCapacity(
        tripId, 
        capacity, 
        reservationId, 
        holdTime
      );

      res.status(201).json({
        success: true,
        message: 'Capacity reserved successfully',
        data: reservation
      });
    } catch (error) {
      logger.error('Reserve capacity controller error:', {
        tripId: req.params.id,
        capacity: req.body.capacity,
        reservationId: req.body.reservationId,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Insufficient capacity') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to reserve capacity',
        error: 'RESERVE_CAPACITY_ERROR'
      });
    }
  }

  /**
   * Release capacity reservation
   * POST /api/v1/trips/:id/capacity/release
   */
  async releaseCapacity(req, res) {
    try {
      const { id: tripId } = req.params;
      const { reservationId } = req.body;

      if (!reservationId) {
        return res.status(400).json({
          success: false,
          message: 'Reservation ID is required',
          error: 'MISSING_RESERVATION_ID'
        });
      }

      // Release capacity
      const result = await this.capacityService.releaseCapacity(tripId, reservationId);

      res.json({
        success: true,
        message: 'Capacity released successfully',
        data: result
      });
    } catch (error) {
      logger.error('Release capacity controller error:', {
        tripId: req.params.id,
        reservationId: req.body.reservationId,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to release capacity',
        error: 'RELEASE_CAPACITY_ERROR'
      });
    }
  }

  /**
   * Share trip
   * POST /api/v1/trips/:id/share
   */
  async shareTrip(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;
      const { method, platform, message } = req.body;

      // Verify access to trip
      const trip = await this.tripService.getTripById(tripId, userId);
      
      if (trip.traveler.id !== userId) {
        throw new Error('Access denied - not trip owner');
      }

      // Generate share URLs
      const baseUrl = process.env.APP_BASE_URL || 'https://app.p2pdelivery.com';
      const shareUrl = `${baseUrl}/trips/${tripId}`;
      const deepLink = `p2pdelivery://trip/${tripId}`;

      // Generate QR code if requested
      let qrCode = null;
      if (method === 'qr') {
        const QRCode = require('qrcode');
        qrCode = await QRCode.toDataURL(shareUrl);
      }

      logBusinessEvent('trip_shared', {
        tripId,
        userId,
        method,
        platform
      });

      res.json({
        success: true,
        message: 'Trip shared successfully',
        data: {
          shareUrl,
          deepLink,
          qrCode,
          message: message || `Check out my trip: ${trip.title}`
        }
      });
    } catch (error) {
      logger.error('Share trip controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to share trip',
        error: 'SHARE_TRIP_ERROR'
      });
    }
  }

  /**
   * Export trip data
   * GET /api/v1/trips/:id/export
   */
  async exportTripData(req, res) {
    try {
      const { id: tripId } = req.params;
      const { format = 'json' } = req.query;
      const userId = req.user.id;

      // Verify access to trip
      const trip = await this.tripService.getTripById(tripId, userId);
      
      if (trip.traveler.id !== userId) {
        throw new Error('Access denied - not trip owner');
      }

      // Format data based on requested format
      let exportData;
      let contentType;
      let filename;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(trip, null, 2);
          contentType = 'application/json';
          filename = `trip-${tripId}.json`;
          break;
        
        case 'csv':
          const { Parser } = require('json2csv');
          const parser = new Parser();
          exportData = parser.parse([trip]);
          contentType = 'text/csv';
          filename = `trip-${tripId}.csv`;
          break;
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);

      logBusinessEvent('trip_exported', {
        tripId,
        userId,
        format
      });
    } catch (error) {
      logger.error('Export trip data controller error:', {
        tripId: req.params.id,
        format: req.query.format,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('Unsupported') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to export trip data',
        error: 'EXPORT_TRIP_ERROR'
      });
    }
  }
}

module.exports = new TripController();