const axios = require('axios');
const { logger, logApiCall, logBusinessEvent } = require('../config/logger');
const { cache, generateCacheKey } = require('../config/redis');
const { TimeUtils } = require('../utils');

/**
 * Weather service for trip weather data and alerts
 */
class WeatherService {
  constructor() {
    this.openWeatherApiKey = process.env.OPENWEATHER_API_KEY;
    this.cacheTimeout = 1800; // 30 minutes
    this.alertCacheTimeout = 3600; // 1 hour
    
    // Weather API clients
    this.openWeatherClient = axios.create({
      baseURL: 'https://api.openweathermap.org/data/2.5',
      timeout: 10000,
      params: {
        appid: this.openWeatherApiKey,
        units: 'metric'
      }
    });
  }

  /**
   * Fetch weather data for a trip
   * @param {string} tripId - Trip ID
   * @returns {Object} Weather data
   */
  async fetchTripWeather(tripId) {
    try {
      // Get trip details
      const { Trip } = require('../models');
      const trip = await Trip.findByPk(tripId);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      // Extract coordinates
      const originCoords = this.parseCoordinates(trip.origin_coordinates);
      const destinationCoords = this.parseCoordinates(trip.destination_coordinates);

      if (!originCoords || !destinationCoords) {
        throw new Error('Trip coordinates not available');
      }

      // Fetch weather for both locations
      const [originWeather, destinationWeather] = await Promise.all([
        this.getWeatherForLocation(originCoords, trip.departure_time),
        this.getWeatherForLocation(destinationCoords, trip.arrival_time)
      ]);

      // Analyze travel conditions
      const travelConditions = this.analyzeTravelConditions(originWeather, destinationWeather);
      
      // Generate alerts
      const alerts = this.generateWeatherAlerts(originWeather, destinationWeather, trip);
      
      // Calculate weather impact
      const impactAssessment = this.assessWeatherImpact(originWeather, destinationWeather, trip);

      // Store weather data
      const weatherData = await this.storeTripWeather({
        tripId,
        originWeather,
        destinationWeather,
        travelConditions,
        alerts,
        impactAssessment,
        forecastDate: trip.departure_time
      });

      logBusinessEvent('trip_weather_fetched', {
        tripId,
        travelConditions,
        alertCount: alerts.length,
        impactLevel: impactAssessment.level
      });

      return weatherData;
    } catch (error) {
      logger.error('Fetch trip weather error:', {
        tripId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get weather for a specific location and time
   * @private
   */
  async getWeatherForLocation(coordinates, dateTime) {
    try {
      const cacheKey = generateCacheKey.locationWeather(coordinates, dateTime);
      
      // Check cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const now = new Date();
      const targetDate = new Date(dateTime);
      const hoursDiff = (targetDate - now) / (1000 * 60 * 60);

      let weatherData;

      if (hoursDiff < 0) {
        // Historical weather (for completed trips)
        weatherData = await this.getHistoricalWeather(coordinates, targetDate);
      } else if (hoursDiff <= 48) {
        // Current or near-future weather
        weatherData = await this.getCurrentAndForecastWeather(coordinates);
      } else if (hoursDiff <= 120) {
        // 5-day forecast
        weatherData = await this.getForecastWeather(coordinates, targetDate);
      } else {
        // Long-term forecast (limited accuracy)
        weatherData = await this.getLongTermForecast(coordinates, targetDate);
      }

      // Cache the result
      await cache.set(cacheKey, weatherData, this.cacheTimeout);

      return weatherData;
    } catch (error) {
      logger.error('Get weather for location error:', {
        coordinates,
        dateTime,
        error: error.message
      });
      
      // Return default weather data on error
      return this.getDefaultWeatherData();
    }
  }

  /**
   * Get current and forecast weather from OpenWeatherMap
   * @private
   */
  async getCurrentAndForecastWeather(coordinates) {
    const startTime = Date.now();
    
    try {
      const response = await this.openWeatherClient.get('/onecall', {
        params: {
          lat: coordinates.lat,
          lon: coordinates.lng,
          exclude: 'minutely,alerts',
          units: 'metric'
        }
      });

      logApiCall('OpenWeatherMap', 'onecall', 'GET', Date.now() - startTime, response.status);

      const data = response.data;
      
      return {
        current: this.normalizeCurrentWeather(data.current),
        hourly: data.hourly?.slice(0, 48).map(hour => this.normalizeHourlyWeather(hour)),
        daily: data.daily?.slice(0, 7).map(day => this.normalizeDailyWeather(day)),
        provider: 'openweathermap',
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      logApiCall('OpenWeatherMap', 'onecall', 'GET', Date.now() - startTime, 'error');
      
      // Fallback to basic current weather
      return await this.getCurrentWeatherBasic(coordinates);
    }
  }

  /**
   * Get basic current weather (fallback)
   * @private
   */
  async getCurrentWeatherBasic(coordinates) {
    const startTime = Date.now();
    
    try {
      const response = await this.openWeatherClient.get('/weather', {
        params: {
          lat: coordinates.lat,
          lon: coordinates.lng
        }
      });

      logApiCall('OpenWeatherMap', 'weather', 'GET', Date.now() - startTime, response.status);

      const data = response.data;
      
      return {
        current: this.normalizeCurrentWeather({
          dt: Math.floor(Date.now() / 1000),
          temp: data.main.temp,
          humidity: data.main.humidity,
          pressure: data.main.pressure,
          wind_speed: data.wind?.speed || 0,
          wind_deg: data.wind?.deg || 0,
          weather: data.weather,
          visibility: data.visibility,
          clouds: { all: data.clouds?.all || 0 }
        }),
        provider: 'openweathermap',
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      logApiCall('OpenWeatherMap', 'weather', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Get forecast weather
   * @private
   */
  async getForecastWeather(coordinates, targetDate) {
    const startTime = Date.now();
    
    try {
      const response = await this.openWeatherClient.get('/forecast', {
        params: {
          lat: coordinates.lat,
          lon: coordinates.lng,
          cnt: 40 // 5 days, 8 forecasts per day
        }
      });

      logApiCall('OpenWeatherMap', 'forecast', 'GET', Date.now() - startTime, response.status);

      const forecasts = response.data.list.map(item => this.normalizeForecastWeather(item));
      
      // Find closest forecast to target date
      const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
      const closestForecast = forecasts.reduce((closest, current) => {
        const currentDiff = Math.abs(current.dt - targetTimestamp);
        const closestDiff = Math.abs(closest.dt - targetTimestamp);
        return currentDiff < closestDiff ? current : closest;
      });

      return {
        forecast: closestForecast,
        allForecasts: forecasts,
        provider: 'openweathermap',
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      logApiCall('OpenWeatherMap', 'forecast', 'GET', Date.now() - startTime, 'error');
      throw error;
    }
  }

  /**
   * Get historical weather (simplified - would need different API)
   * @private
   */
  async getHistoricalWeather(coordinates, date) {
    // OpenWeatherMap historical data requires subscription
    // For now, return estimated data based on seasonal patterns
    return {
      historical: {
        temperature: this.estimateHistoricalTemperature(coordinates, date),
        condition: 'Unknown',
        humidity: 60,
        windSpeed: 5,
        precipitation: 0
      },
      provider: 'estimated',
      fetchedAt: new Date().toISOString(),
      note: 'Historical weather data estimated'
    };
  }

  /**
   * Get long-term forecast (simplified)
   * @private
   */
  async getLongTermForecast(coordinates, date) {
    // Long-term forecasts are less accurate
    return {
      longTerm: {
        temperature: this.estimateSeasonalTemperature(coordinates, date),
        condition: 'Variable',
        reliability: 'low'
      },
      provider: 'estimated',
      fetchedAt: new Date().toISOString(),
      note: 'Long-term forecast has limited accuracy'
    };
  }

  /**
   * Normalize current weather data
   * @private
   */
  normalizeCurrentWeather(data) {
    return {
      dt: data.dt,
      temperature: Math.round(data.temp * 10) / 10,
      feelsLike: Math.round((data.feels_like || data.temp) * 10) / 10,
      humidity: data.humidity,
      pressure: data.pressure,
      windSpeed: Math.round((data.wind_speed || 0) * 10) / 10,
      windDirection: data.wind_deg || 0,
      condition: data.weather?.[0]?.main || 'Unknown',
      description: data.weather?.[0]?.description || 'Unknown',
      icon: data.weather?.[0]?.icon,
      visibility: data.visibility || 10000,
      cloudCover: data.clouds?.all || 0,
      uvIndex: data.uvi || 0
    };
  }

  /**
   * Normalize hourly weather data
   * @private
   */
  normalizeHourlyWeather(data) {
    return {
      dt: data.dt,
      temperature: Math.round(data.temp * 10) / 10,
      condition: data.weather?.[0]?.main || 'Unknown',
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      windSpeed: Math.round((data.wind_speed || 0) * 10) / 10,
      humidity: data.humidity
    };
  }

  /**
   * Normalize daily weather data
   * @private
   */
  normalizeDailyWeather(data) {
    return {
      dt: data.dt,
      tempMax: Math.round(data.temp.max * 10) / 10,
      tempMin: Math.round(data.temp.min * 10) / 10,
      condition: data.weather?.[0]?.main || 'Unknown',
      precipitation: data.rain || data.snow || 0,
      windSpeed: Math.round((data.wind_speed || 0) * 10) / 10,
      humidity: data.humidity
    };
  }

  /**
   * Normalize forecast weather data
   * @private
   */
  normalizeForecastWeather(data) {
    return {
      dt: data.dt,
      temperature: Math.round(data.main.temp * 10) / 10,
      condition: data.weather?.[0]?.main || 'Unknown',
      description: data.weather?.[0]?.description || 'Unknown',
      precipitation: data.rain?.['3h'] || data.snow?.['3h'] || 0,
      windSpeed: Math.round((data.wind?.speed || 0) * 10) / 10,
      humidity: data.main.humidity,
      cloudCover: data.clouds?.all || 0
    };
  }

  /**
   * Analyze travel conditions based on weather data
   * @private
   */
  analyzeTravelConditions(originWeather, destinationWeather) {
    let conditionScore = 100; // Start with perfect conditions

    const checkWeatherConditions = (weather) => {
      const current = weather.current || weather.forecast || weather.historical;
      if (!current) return 0;

      let score = 0;

      // Temperature checks
      if (current.temperature < -10 || current.temperature > 40) {
        score -= 30;
      } else if (current.temperature < 0 || current.temperature > 35) {
        score -= 15;
      }

      // Precipitation checks
      if (current.precipitation > 10) {
        score -= 25;
      } else if (current.precipitation > 5) {
        score -= 10;
      }

      // Wind speed checks
      if (current.windSpeed > 20) {
        score -= 20;
      } else if (current.windSpeed > 15) {
        score -= 10;
      }

      // Visibility checks
      if (current.visibility < 1000) {
        score -= 30;
      } else if (current.visibility < 5000) {
        score -= 15;
      }

      // Severe weather conditions
      const severeConditions = ['Thunderstorm', 'Tornado', 'Hurricane', 'Blizzard'];
      if (severeConditions.includes(current.condition)) {
        score -= 50;
      }

      return score;
    };

    conditionScore += checkWeatherConditions(originWeather);
    conditionScore += checkWeatherConditions(destinationWeather);
    conditionScore = conditionScore / 2; // Average of both locations

    // Convert score to condition rating
    if (conditionScore >= 90) return 'excellent';
    if (conditionScore >= 75) return 'good';
    if (conditionScore >= 50) return 'fair';
    if (conditionScore >= 25) return 'poor';
    return 'dangerous';
  }

  /**
   * Generate weather alerts
   * @private
   */
  generateWeatherAlerts(originWeather, destinationWeather, trip) {
    const alerts = [];

    const checkWeatherAlerts = (weather, location) => {
      const current = weather.current || weather.forecast || weather.historical;
      if (!current) return;

      // Temperature alerts
      if (current.temperature < -10) {
        alerts.push({
          type: 'extreme_cold',
          severity: 'high',
          location,
          message: `Extreme cold weather (${current.temperature}°C) at ${location}`,
          recommendation: 'Protect temperature-sensitive items'
        });
      } else if (current.temperature > 40) {
        alerts.push({
          type: 'extreme_heat',
          severity: 'high',
          location,
          message: `Extreme hot weather (${current.temperature}°C) at ${location}`,
          recommendation: 'Avoid heat-sensitive items'
        });
      }

      // Precipitation alerts
      if (current.precipitation > 10) {
        alerts.push({
          type: 'heavy_precipitation',
          severity: 'medium',
          location,
          message: `Heavy precipitation expected at ${location}`,
          recommendation: 'Ensure waterproof packaging'
        });
      }

      // Wind alerts
      if (current.windSpeed > 20) {
        alerts.push({
          type: 'high_winds',
          severity: 'medium',
          location,
          message: `High winds (${current.windSpeed} m/s) at ${location}`,
          recommendation: 'Secure loose items'
        });
      }

      // Severe weather alerts
      const severeConditions = ['Thunderstorm', 'Tornado', 'Hurricane'];
      if (severeConditions.includes(current.condition)) {
        alerts.push({
          type: 'severe_weather',
          severity: 'critical',
          location,
          message: `${current.condition} conditions at ${location}`,
          recommendation: 'Consider postponing the trip'
        });
      }

      // Visibility alerts
      if (current.visibility < 1000) {
        alerts.push({
          type: 'poor_visibility',
          severity: 'high',
          location,
          message: `Poor visibility (${current.visibility}m) at ${location}`,
          recommendation: 'Exercise extreme caution during travel'
        });
      }
    };

    checkWeatherAlerts(originWeather, 'origin');
    checkWeatherAlerts(destinationWeather, 'destination');

    return alerts;
  }

  /**
   * Assess weather impact on trip
   * @private
   */
  assessWeatherImpact(originWeather, destinationWeather, trip) {
    const impacts = [];
    let overallLevel = 'low';

    // Check for delays
    const severeConditions = ['Thunderstorm', 'Tornado', 'Hurricane', 'Blizzard'];
    const originCurrent = originWeather.current || originWeather.forecast || {};
    const destCurrent = destinationWeather.current || destinationWeather.forecast || {};

    if (severeConditions.includes(originCurrent.condition) || 
        severeConditions.includes(destCurrent.condition)) {
      impacts.push({
        type: 'potential_delays',
        description: 'Severe weather may cause travel delays',
        likelihood: 'high'
      });
      overallLevel = 'high';
    }

    // Check for item safety
    if ((originCurrent.temperature < 0 || destCurrent.temperature < 0) ||
        (originCurrent.temperature > 35 || destCurrent.temperature > 35)) {
      impacts.push({
        type: 'item_safety',
        description: 'Extreme temperatures may affect temperature-sensitive items',
        likelihood: 'medium'
      });
      if (overallLevel === 'low') overallLevel = 'medium';
    }

    // Check for packaging requirements
    if ((originCurrent.precipitation > 5) || (destCurrent.precipitation > 5)) {
      impacts.push({
        type: 'packaging_requirements',
        description: 'Wet conditions require waterproof packaging',
        likelihood: 'high'
      });
      if (overallLevel === 'low') overallLevel = 'medium';
    }

    return {
      level: overallLevel,
      impacts,
      assessedAt: new Date().toISOString()
    };
  }

  /**
   * Store trip weather data
   * @private
   */
  async storeTripWeather(weatherData) {
    try {
      const { TripWeather } = require('../models');
      
      // Check if weather data already exists for this trip and date
      const existingWeather = await TripWeather.findOne({
        where: {
          trip_id: weatherData.tripId,
          forecast_for_date: weatherData.forecastDate
        }
      });

      const weatherRecord = {
        trip_id: weatherData.tripId,
        origin_weather: weatherData.originWeather,
        destination_weather: weatherData.destinationWeather,
        travel_conditions: weatherData.travelConditions,
        alerts: weatherData.alerts,
        impact_assessment: weatherData.impactAssessment,
        data_source: 'openweathermap',
        data_quality: 'good',
        forecast_for_date: weatherData.forecastDate,
        fetched_at: new Date(),
        expires_at: new Date(Date.now() + this.cacheTimeout * 1000)
      };

      let weather;
      if (existingWeather) {
        weather = await existingWeather.update(weatherRecord);
      } else {
        weather = await TripWeather.create(weatherRecord);
      }

      return weather.toJSON();
    } catch (error) {
      logger.error('Store trip weather error:', {
        tripId: weatherData.tripId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Parse coordinates from various formats
   * @private
   */
  parseCoordinates(coords) {
    try {
      if (!coords) return null;
      
      if (typeof coords === 'object' && coords.coordinates) {
        // GeoJSON format
        return {
          lng: coords.coordinates[0],
          lat: coords.coordinates[1]
        };
      } else if (typeof coords === 'object' && coords.lat && coords.lng) {
        // Direct object format
        return coords;
      } else if (typeof coords === 'string') {
        // String format parsing
        const match = coords.match(/POINT\(([^)]+)\)/);
        if (match) {
          const [lng, lat] = match[1].split(' ').map(Number);
          return { lat, lng };
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Parse coordinates error:', { coords, error: error.message });
      return null;
    }
  }

  /**
   * Get default weather data (fallback)
   * @private
   */
  getDefaultWeatherData() {
    return {
      current: {
        temperature: 20,
        condition: 'Unknown',
        humidity: 60,
        windSpeed: 5,
        precipitation: 0,
        visibility: 10000
      },
      provider: 'default',
      fetchedAt: new Date().toISOString(),
      note: 'Default weather data used due to API unavailability'
    };
  }

  /**
   * Estimate historical temperature (simplified)
   * @private
   */
  estimateHistoricalTemperature(coordinates, date) {
    // Very simplified seasonal temperature estimation
    const month = date.getMonth();
    const lat = Math.abs(coordinates.lat);
    
    // Northern hemisphere seasonal adjustment
    let baseTemp = 15;
    if (month >= 5 && month <= 7) baseTemp += 10; // Summer
    else if (month >= 11 || month <= 1) baseTemp -= 10; // Winter
    
    // Latitude adjustment (very simplified)
    if (lat > 60) baseTemp -= 15;
    else if (lat > 40) baseTemp -= 5;
    else if (lat < 20) baseTemp += 10;
    
    return baseTemp;
  }

  /**
   * Estimate seasonal temperature
   * @private
   */
  estimateSeasonalTemperature(coordinates, date) {
    return this.estimateHistoricalTemperature(coordinates, date);
  }

  /**
   * Get weather summary for trip
   */
  async getWeatherSummary(tripId) {
    try {
      const { TripWeather } = require('../models');
      
      const weather = await TripWeather.findOne({
        where: { trip_id: tripId },
        order: [['fetched_at', 'DESC']]
      });

      if (!weather) {
        throw new Error('Weather data not found for trip');
      }

      return {
        tripId,
        travelConditions: weather.travel_conditions,
        hasAlerts: weather.alerts && weather.alerts.length > 0,
        alertCount: weather.alerts ? weather.alerts.length : 0,
        criticalAlerts: weather.alerts ? weather.alerts.filter(alert => alert.severity === 'critical').length : 0,
        impactLevel: weather.impact_assessment?.level || 'unknown',
        lastUpdated: weather.fetched_at,
        dataQuality: weather.data_quality
      };
    } catch (error) {
      logger.error('Get weather summary error:', {
        tripId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Refresh weather data for trip
   */
  async refreshWeatherData(tripId) {
    try {
      // Clear cache
      const cachePattern = `*weather*${tripId}*`;
      await cache.delPattern(cachePattern);

      // Fetch fresh weather data
      return await this.fetchTripWeather(tripId);
    } catch (error) {
      logger.error('Refresh weather data error:', {
        tripId,
        error: error.message
      });
      throw error;
    }
  }
}

// Extend cache key generation for weather
Object.assign(generateCacheKey, {
  locationWeather: (coords, dateTime) => {
    const coordStr = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
    const dateStr = new Date(dateTime).toISOString().split('T')[0];
    return `weather:location:${coordStr}:${dateStr}`;
  },
  tripWeather: (tripId) => `weather:trip:${tripId}`
});

module.exports = WeatherService;