const { logger, logBusinessEvent } = require('../config/logger');
const { WeatherService } = require('../services');

/**
 * Weather controller for trip weather data and alerts
 */
class WeatherController {
  constructor() {
    this.weatherService = new WeatherService();
  }

  /**
   * Get weather data for a trip
   * GET /api/v1/trips/:id/weather
   */
  async getTripWeather(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user?.id;

      // Get weather summary
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

      const statusCode = error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get trip weather',
        error: 'GET_WEATHER_ERROR'
      });
    }
  }

  /**
   * Refresh weather data for a trip
   * POST /api/v1/trips/:id/weather/refresh
   */
  async refreshTripWeather(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user.id;

      // Verify trip ownership
      const { TripService } = require('../services');
      const tripService = new TripService();
      const trip = await tripService.getTripById(tripId, userId);
      
      if (trip.traveler.id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - not trip owner',
          error: 'ACCESS_DENIED'
        });
      }

      // Refresh weather data
      const weather = await this.weatherService.refreshWeatherData(tripId);

      logBusinessEvent('weather_data_refreshed', {
        tripId,
        userId
      });

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
   * Get detailed weather information
   * GET /api/v1/trips/:id/weather/detailed
   */
  async getDetailedWeather(req, res) {
    try {
      const { id: tripId } = req.params;
      const userId = req.user?.id;

      const { TripWeather } = require('../models');

      const weather = await TripWeather.findOne({
        where: { trip_id: tripId },
        order: [['fetched_at', 'DESC']]
      });

      if (!weather) {
        return res.status(404).json({
          success: false,
          message: 'Weather data not found for trip',
          error: 'WEATHER_NOT_FOUND'
        });
      }

      const detailedWeather = {
        tripId: weather.trip_id,
        origin: weather.origin_weather,
        destination: weather.destination_weather,
        route: weather.route_weather,
        travelConditions: weather.travel_conditions,
        alerts: weather.alerts || [],
        impactAssessment: weather.impact_assessment,
        dataSource: weather.data_source,
        dataQuality: weather.data_quality,
        forecastDate: weather.forecast_for_date,
        lastUpdated: weather.fetched_at,
        expiresAt: weather.expires_at
      };

      res.json({
        success: true,
        data: detailedWeather
      });
    } catch (error) {
      logger.error('Get detailed weather controller error:', {
        tripId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get detailed weather',
        error: 'GET_DETAILED_WEATHER_ERROR'
      });
    }
  }

  /**
   * Get weather alerts for user's trips
   * GET /api/v1/trips/weather/alerts
   */
  async getWeatherAlerts(req, res) {
    try {
      const userId = req.user.id;
      const { severity, limit = 20 } = req.query;

      const { TripWeather, Trip, Sequelize } = require('../models');
      const { Op } = Sequelize;

      // Build where clause for alerts
      let alertWhere = {
        alerts: {
          [Op.ne]: null,
          [Op.not]: []
        }
      };

      if (severity) {
        alertWhere.alerts = {
          [Op.contains]: [{ severity }]
        };
      }

      // Get weather data for user's upcoming trips with alerts
      const weatherAlerts = await TripWeather.findAll({
        where: alertWhere,
        include: [
          {
            model: Trip,
            as: 'trip',
            where: {
              traveler_id: userId,
              status: ['upcoming', 'active']
            },
            attributes: ['id', 'title', 'departure_time', 'arrival_time', 'origin_address', 'destination_address']
          }
        ],
        order: [['fetched_at', 'DESC']],
        limit: parseInt(limit)
      });

      const alerts = weatherAlerts.map(weather => ({
        tripId: weather.trip_id,
        trip: {
          title: weather.trip.title,
          departureTime: weather.trip.departure_time,
          route: {
            origin: weather.trip.origin_address,
            destination: weather.trip.destination_address
          }
        },
        alerts: weather.alerts,
        travelConditions: weather.travel_conditions,
        lastUpdated: weather.fetched_at
      }));

      res.json({
        success: true,
        data: alerts,
        meta: {
          totalAlerts: alerts.reduce((sum, item) => sum + item.alerts.length, 0),
          criticalAlerts: alerts.reduce((sum, item) => 
            sum + item.alerts.filter(alert => alert.severity === 'critical').length, 0
          )
        }
      });
    } catch (error) {
      logger.error('Get weather alerts controller error:', {
        userId: req.user?.id,
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get weather alerts',
        error: 'GET_WEATHER_ALERTS_ERROR'
      });
    }
  }

  /**
   * Get weather forecast for route
   * POST /api/v1/trips/weather/forecast
   */
  async getRouteForecast(req, res) {
    try {
      const { origin, destination, departureTime } = req.body;

      if (!origin || !destination || !departureTime) {
        return res.status(400).json({
          success: false,
          message: 'Origin, destination, and departure time are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // This would integrate with weather service to get route forecast
      // For now, return a simplified forecast
      const forecast = {
        route: {
          origin: origin.address || origin,
          destination: destination.address || destination
        },
        departureTime,
        forecast: {
          origin: {
            temperature: 20,
            condition: 'Clear',
            precipitation: 0,
            windSpeed: 5
          },
          destination: {
            temperature: 18,
            condition: 'Partly Cloudy',
            precipitation: 10,
            windSpeed: 8
          }
        },
        travelConditions: 'good',
        alerts: [],
        recommendations: [
          'Weather conditions are favorable for travel',
          'Light rain expected at destination - consider waterproof packaging'
        ]
      };

      res.json({
        success: true,
        data: forecast
      });
    } catch (error) {
      logger.error('Get route forecast controller error:', {
        body: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get route forecast',
        error: 'GET_ROUTE_FORECAST_ERROR'
      });
    }
  }
}

module.exports = new WeatherController();