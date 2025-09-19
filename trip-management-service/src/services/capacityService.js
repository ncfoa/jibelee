const { logger, logBusinessEvent } = require('../config/logger');
const { cache, generateCacheKey } = require('../config/redis');
const { withTransaction } = require('../config/database');
const { CapacityUtils } = require('../utils');

/**
 * Capacity management service for trips
 */
class CapacityService {
  constructor() {
    this.cacheTimeout = 300; // 5 minutes
  }

  /**
   * Check if trip has sufficient capacity for a delivery request
   * @param {string} tripId - Trip ID
   * @param {Object} requiredCapacity - Required capacity {weight, volume, items}
   * @returns {Object} Capacity check result
   */
  async checkCapacity(tripId, requiredCapacity) {
    try {
      // Get trip from cache or database
      const trip = await this.getTripWithCapacity(tripId);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      if (trip.status !== 'upcoming') {
        throw new Error('Trip is not available for new deliveries');
      }

      const availableCapacity = {
        weight: trip.available_weight,
        volume: trip.available_volume,
        items: trip.available_items
      };

      const capacityCheck = CapacityUtils.checkCapacity(availableCapacity, requiredCapacity);

      // Log capacity check
      logger.debug('Capacity check performed', {
        tripId,
        availableCapacity,
        requiredCapacity,
        canFit: capacityCheck.canFit,
        utilization: capacityCheck.utilization
      });

      return {
        success: true,
        tripId,
        canFit: capacityCheck.canFit,
        available: availableCapacity,
        required: requiredCapacity,
        details: capacityCheck.details,
        utilization: capacityCheck.utilization
      };
    } catch (error) {
      logger.error('Capacity check error:', {
        tripId,
        requiredCapacity,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reserve capacity for a delivery request
   * @param {string} tripId - Trip ID
   * @param {Object} capacityToReserve - Capacity to reserve
   * @param {string} reservationId - Unique reservation ID
   * @param {number} holdTime - Hold time in minutes (default: 15)
   * @returns {Object} Reservation result
   */
  async reserveCapacity(tripId, capacityToReserve, reservationId, holdTime = 15) {
    try {
      return await withTransaction(async (transaction) => {
        // Get trip with lock
        const { Trip } = require('../models');
        const trip = await Trip.findByPk(tripId, {
          lock: true,
          transaction
        });

        if (!trip) {
          throw new Error('Trip not found');
        }

        if (trip.status !== 'upcoming') {
          throw new Error('Trip is not available for capacity reservation');
        }

        // Check if capacity is available
        const availableCapacity = {
          weight: trip.available_weight,
          volume: trip.available_volume,
          items: trip.available_items
        };

        const capacityCheck = CapacityUtils.checkCapacity(availableCapacity, capacityToReserve);
        
        if (!capacityCheck.canFit) {
          throw new Error('Insufficient capacity available');
        }

        // Reserve capacity
        const updatedCapacity = CapacityUtils.reserveCapacity(availableCapacity, capacityToReserve);

        // Update trip capacity
        await trip.update({
          available_weight: updatedCapacity.weight,
          available_volume: updatedCapacity.volume,
          available_items: updatedCapacity.items
        }, { transaction });

        // Store reservation in cache with expiration
        const reservationKey = generateCacheKey.capacityReservation(tripId, reservationId);
        const reservationData = {
          tripId,
          reservationId,
          reservedCapacity: capacityToReserve,
          reservedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + holdTime * 60 * 1000).toISOString(),
          status: 'reserved'
        };

        await cache.set(reservationKey, reservationData, holdTime * 60);

        // Set up automatic release
        setTimeout(() => {
          this.releaseExpiredReservation(tripId, reservationId);
        }, holdTime * 60 * 1000);

        logBusinessEvent('capacity_reserved', {
          tripId,
          reservationId,
          reservedCapacity: capacityToReserve,
          remainingCapacity: updatedCapacity,
          holdTime
        });

        return {
          success: true,
          tripId,
          reservationId,
          reservedCapacity: capacityToReserve,
          remainingCapacity: updatedCapacity,
          expiresAt: reservationData.expiresAt
        };
      });
    } catch (error) {
      logger.error('Capacity reservation error:', {
        tripId,
        reservationId,
        capacityToReserve,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Release reserved capacity
   * @param {string} tripId - Trip ID
   * @param {string} reservationId - Reservation ID
   * @returns {Object} Release result
   */
  async releaseCapacity(tripId, reservationId) {
    try {
      return await withTransaction(async (transaction) => {
        // Get reservation from cache
        const reservationKey = generateCacheKey.capacityReservation(tripId, reservationId);
        const reservation = await cache.get(reservationKey);

        if (!reservation) {
          throw new Error('Reservation not found or already expired');
        }

        // Get trip with lock
        const { Trip } = require('../models');
        const trip = await Trip.findByPk(tripId, {
          lock: true,
          transaction
        });

        if (!trip) {
          throw new Error('Trip not found');
        }

        // Calculate total capacity
        const totalCapacity = {
          weight: trip.weight_capacity,
          volume: trip.volume_capacity,
          items: trip.item_capacity
        };

        const currentAvailable = {
          weight: trip.available_weight,
          volume: trip.available_volume,
          items: trip.available_items
        };

        // Release capacity
        const updatedCapacity = CapacityUtils.releaseCapacity(
          currentAvailable,
          reservation.reservedCapacity,
          totalCapacity
        );

        // Update trip capacity
        await trip.update({
          available_weight: updatedCapacity.weight,
          available_volume: updatedCapacity.volume,
          available_items: updatedCapacity.items
        }, { transaction });

        // Remove reservation from cache
        await cache.del(reservationKey);

        logBusinessEvent('capacity_released', {
          tripId,
          reservationId,
          releasedCapacity: reservation.reservedCapacity,
          updatedCapacity
        });

        return {
          success: true,
          tripId,
          reservationId,
          releasedCapacity: reservation.reservedCapacity,
          updatedCapacity
        };
      });
    } catch (error) {
      logger.error('Capacity release error:', {
        tripId,
        reservationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Confirm capacity reservation (convert to permanent allocation)
   * @param {string} tripId - Trip ID
   * @param {string} reservationId - Reservation ID
   * @param {string} deliveryId - Delivery ID for tracking
   * @returns {Object} Confirmation result
   */
  async confirmReservation(tripId, reservationId, deliveryId) {
    try {
      const reservationKey = generateCacheKey.capacityReservation(tripId, reservationId);
      const reservation = await cache.get(reservationKey);

      if (!reservation) {
        throw new Error('Reservation not found or already expired');
      }

      // Update reservation status
      reservation.status = 'confirmed';
      reservation.deliveryId = deliveryId;
      reservation.confirmedAt = new Date().toISOString();

      // Store confirmed reservation with longer TTL (24 hours)
      await cache.set(reservationKey, reservation, 24 * 60 * 60);

      logBusinessEvent('capacity_reservation_confirmed', {
        tripId,
        reservationId,
        deliveryId,
        confirmedCapacity: reservation.reservedCapacity
      });

      return {
        success: true,
        tripId,
        reservationId,
        deliveryId,
        confirmedCapacity: reservation.reservedCapacity
      };
    } catch (error) {
      logger.error('Capacity confirmation error:', {
        tripId,
        reservationId,
        deliveryId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get current capacity status for a trip
   * @param {string} tripId - Trip ID
   * @returns {Object} Capacity status
   */
  async getCapacityStatus(tripId) {
    try {
      const trip = await this.getTripWithCapacity(tripId);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      const totalCapacity = {
        weight: trip.weight_capacity,
        volume: trip.volume_capacity,
        items: trip.item_capacity
      };

      const availableCapacity = {
        weight: trip.available_weight,
        volume: trip.available_volume,
        items: trip.available_items
      };

      const utilization = CapacityUtils.calculateUtilization(totalCapacity, availableCapacity);

      // Get active reservations
      const reservations = await this.getActiveReservations(tripId);

      return {
        tripId,
        status: trip.status,
        totalCapacity,
        availableCapacity,
        utilization,
        activeReservations: reservations.length,
        reservationDetails: reservations,
        lastUpdated: trip.updated_at
      };
    } catch (error) {
      logger.error('Get capacity status error:', {
        tripId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Optimize capacity allocation for multiple delivery requests
   * @param {string} tripId - Trip ID
   * @param {Array} deliveryRequests - Array of delivery requests
   * @returns {Object} Optimization result
   */
  async optimizeCapacityAllocation(tripId, deliveryRequests) {
    try {
      const trip = await this.getTripWithCapacity(tripId);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      const availableCapacity = {
        weight: trip.available_weight,
        volume: trip.available_volume,
        items: trip.available_items
      };

      // Map delivery requests to items for optimization
      const items = deliveryRequests.map(request => ({
        id: request.id,
        weight: request.weight || 0,
        volume: request.volume || CapacityUtils.calculateVolume(request.dimensions || {}),
        value: request.max_price || 0,
        dimensions: request.dimensions,
        priority: request.urgency === 'urgent' ? 3 : request.urgency === 'express' ? 2 : 1
      }));

      const optimization = CapacityUtils.optimizeCapacityAllocation(availableCapacity, items);

      logBusinessEvent('capacity_optimization_performed', {
        tripId,
        totalRequests: deliveryRequests.length,
        fittableRequests: optimization.fittableItems.length,
        totalValue: optimization.totalValue,
        canFitAll: optimization.canFitAll
      });

      return {
        tripId,
        availableCapacity,
        optimization: {
          canFitAll: optimization.canFitAll,
          fittableItems: optimization.fittableItems.map(item => ({
            deliveryRequestId: item.id,
            capacity: {
              weight: item.weight,
              volume: item.volume,
              items: 1
            },
            value: item.value,
            priority: item.priority
          })),
          nonFittableItems: optimization.nonFittableItems.map(item => ({
            deliveryRequestId: item.id,
            reason: 'insufficient_capacity'
          })),
          remainingCapacity: optimization.remainingCapacity,
          totalValue: optimization.totalValue,
          recommendations: optimization.recommendations
        }
      };
    } catch (error) {
      logger.error('Capacity optimization error:', {
        tripId,
        requestCount: deliveryRequests.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get trip with capacity information
   * @private
   */
  async getTripWithCapacity(tripId) {
    try {
      // Try cache first
      const cacheKey = generateCacheKey.trip(tripId);
      let trip = await cache.get(cacheKey);

      if (!trip) {
        // Get from database
        const { Trip } = require('../models');
        trip = await Trip.findByPk(tripId);
        
        if (trip) {
          // Cache for future use
          await cache.set(cacheKey, trip.toJSON(), this.cacheTimeout);
        }
      }

      return trip;
    } catch (error) {
      logger.error('Get trip with capacity error:', {
        tripId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get active reservations for a trip
   * @private
   */
  async getActiveReservations(tripId) {
    try {
      const pattern = `capacity:${tripId}:*`;
      const keys = await cache.client.keys(pattern);
      const reservations = [];

      for (const key of keys) {
        const reservation = await cache.get(key);
        if (reservation && reservation.status === 'reserved') {
          reservations.push(reservation);
        }
      }

      return reservations;
    } catch (error) {
      logger.error('Get active reservations error:', {
        tripId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Release expired reservation
   * @private
   */
  async releaseExpiredReservation(tripId, reservationId) {
    try {
      const reservationKey = generateCacheKey.capacityReservation(tripId, reservationId);
      const reservation = await cache.get(reservationKey);

      if (reservation && reservation.status === 'reserved') {
        // Check if reservation is actually expired
        const expiresAt = new Date(reservation.expiresAt);
        if (new Date() > expiresAt) {
          await this.releaseCapacity(tripId, reservationId);
          
          logBusinessEvent('capacity_reservation_expired', {
            tripId,
            reservationId,
            expiredCapacity: reservation.reservedCapacity
          });
        }
      }
    } catch (error) {
      logger.error('Release expired reservation error:', {
        tripId,
        reservationId,
        error: error.message
      });
    }
  }

  /**
   * Cleanup expired reservations (scheduled job)
   */
  async cleanupExpiredReservations() {
    try {
      const pattern = 'capacity:*:*';
      const keys = await cache.client.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const reservation = await cache.get(key);
        if (reservation && reservation.status === 'reserved') {
          const expiresAt = new Date(reservation.expiresAt);
          if (new Date() > expiresAt) {
            await this.releaseExpiredReservation(reservation.tripId, reservation.reservationId);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired capacity reservations', {
          cleanedCount
        });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Cleanup expired reservations error:', error);
      return 0;
    }
  }

  /**
   * Get capacity analytics for a trip
   * @param {string} tripId - Trip ID
   * @returns {Object} Capacity analytics
   */
  async getCapacityAnalytics(tripId) {
    try {
      const trip = await this.getTripWithCapacity(tripId);
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      const totalCapacity = {
        weight: trip.weight_capacity,
        volume: trip.volume_capacity,
        items: trip.item_capacity
      };

      const availableCapacity = {
        weight: trip.available_weight,
        volume: trip.available_volume,
        items: trip.available_items
      };

      const usedCapacity = {
        weight: totalCapacity.weight - availableCapacity.weight,
        volume: totalCapacity.volume - availableCapacity.volume,
        items: totalCapacity.items - availableCapacity.items
      };

      const utilization = CapacityUtils.calculateUtilization(totalCapacity, availableCapacity);
      const activeReservations = await this.getActiveReservations(tripId);

      // Calculate efficiency metrics
      const efficiency = {
        weightEfficiency: totalCapacity.weight > 0 ? (usedCapacity.weight / totalCapacity.weight) * 100 : 0,
        volumeEfficiency: totalCapacity.volume > 0 ? (usedCapacity.volume / totalCapacity.volume) * 100 : 0,
        itemEfficiency: totalCapacity.items > 0 ? (usedCapacity.items / totalCapacity.items) * 100 : 0
      };

      const recommendations = [];
      
      if (utilization.overall < 30) {
        recommendations.push({
          type: 'underutilized',
          message: 'Trip capacity is underutilized',
          suggestion: 'Consider accepting more deliveries or reducing capacity for cost efficiency'
        });
      } else if (utilization.overall > 90) {
        recommendations.push({
          type: 'near_capacity',
          message: 'Trip is near full capacity',
          suggestion: 'Consider increasing capacity or being selective with remaining slots'
        });
      }

      return {
        tripId,
        totalCapacity,
        usedCapacity,
        availableCapacity,
        utilization,
        efficiency,
        activeReservations: activeReservations.length,
        recommendations,
        lastUpdated: trip.updated_at
      };
    } catch (error) {
      logger.error('Get capacity analytics error:', {
        tripId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = CapacityService;