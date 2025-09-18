const { logger } = require('../config/logger');

/**
 * Capacity management utility functions
 */
class CapacityUtils {
  /**
   * Calculate volume from dimensions
   * @param {Object} dimensions - {length, width, height} in cm
   * @returns {number} Volume in liters
   */
  static calculateVolume(dimensions) {
    try {
      const { length, width, height } = dimensions;
      if (!length || !width || !height) return 0;
      
      // Convert cm³ to liters (1 liter = 1000 cm³)
      return (length * width * height) / 1000;
    } catch (error) {
      logger.error('Error calculating volume:', error);
      return 0;
    }
  }

  /**
   * Check if capacity requirements can be met
   * @param {Object} available - Available capacity {weight, volume, items}
   * @param {Object} required - Required capacity {weight, volume, items}
   * @returns {Object} Capacity check result
   */
  static checkCapacity(available, required) {
    try {
      const result = {
        canFit: true,
        details: {},
        utilization: {}
      };

      // Check weight
      result.details.weight = {
        available: available.weight || 0,
        required: required.weight || 0,
        sufficient: (available.weight || 0) >= (required.weight || 0)
      };
      
      // Check volume
      result.details.volume = {
        available: available.volume || 0,
        required: required.volume || 0,
        sufficient: (available.volume || 0) >= (required.volume || 0)
      };
      
      // Check items
      result.details.items = {
        available: available.items || 0,
        required: required.items || 0,
        sufficient: (available.items || 0) >= (required.items || 0)
      };

      // Overall capacity check
      result.canFit = result.details.weight.sufficient && 
                     result.details.volume.sufficient && 
                     result.details.items.sufficient;

      // Calculate utilization percentages
      if (available.weight > 0) {
        result.utilization.weight = Math.min(100, (required.weight / available.weight) * 100);
      }
      if (available.volume > 0) {
        result.utilization.volume = Math.min(100, (required.volume / available.volume) * 100);
      }
      if (available.items > 0) {
        result.utilization.items = Math.min(100, (required.items / available.items) * 100);
      }

      return result;
    } catch (error) {
      logger.error('Error checking capacity:', error);
      return {
        canFit: false,
        details: {},
        utilization: {},
        error: error.message
      };
    }
  }

  /**
   * Reserve capacity from available capacity
   * @param {Object} available - Current available capacity
   * @param {Object} toReserve - Capacity to reserve
   * @returns {Object} Updated available capacity
   */
  static reserveCapacity(available, toReserve) {
    try {
      const capacityCheck = this.checkCapacity(available, toReserve);
      
      if (!capacityCheck.canFit) {
        throw new Error('Insufficient capacity available');
      }

      return {
        weight: (available.weight || 0) - (toReserve.weight || 0),
        volume: (available.volume || 0) - (toReserve.volume || 0),
        items: (available.items || 0) - (toReserve.items || 0)
      };
    } catch (error) {
      logger.error('Error reserving capacity:', error);
      throw error;
    }
  }

  /**
   * Release reserved capacity back to available capacity
   * @param {Object} available - Current available capacity
   * @param {Object} toRelease - Capacity to release
   * @param {Object} totalCapacity - Total capacity limits
   * @returns {Object} Updated available capacity
   */
  static releaseCapacity(available, toRelease, totalCapacity) {
    try {
      const updated = {
        weight: (available.weight || 0) + (toRelease.weight || 0),
        volume: (available.volume || 0) + (toRelease.volume || 0),
        items: (available.items || 0) + (toRelease.items || 0)
      };

      // Ensure we don't exceed total capacity
      if (totalCapacity) {
        updated.weight = Math.min(updated.weight, totalCapacity.weight || updated.weight);
        updated.volume = Math.min(updated.volume, totalCapacity.volume || updated.volume);
        updated.items = Math.min(updated.items, totalCapacity.items || updated.items);
      }

      return updated;
    } catch (error) {
      logger.error('Error releasing capacity:', error);
      throw error;
    }
  }

  /**
   * Calculate capacity utilization percentage
   * @param {Object} total - Total capacity
   * @param {Object} available - Available capacity
   * @returns {Object} Utilization percentages
   */
  static calculateUtilization(total, available) {
    try {
      const utilization = {};

      if (total.weight > 0) {
        const used = total.weight - (available.weight || 0);
        utilization.weight = Math.max(0, (used / total.weight) * 100);
      } else {
        utilization.weight = 0;
      }

      if (total.volume > 0) {
        const used = total.volume - (available.volume || 0);
        utilization.volume = Math.max(0, (used / total.volume) * 100);
      } else {
        utilization.volume = 0;
      }

      if (total.items > 0) {
        const used = total.items - (available.items || 0);
        utilization.items = Math.max(0, (used / total.items) * 100);
      } else {
        utilization.items = 0;
      }

      // Calculate overall utilization (weighted average)
      utilization.overall = (utilization.weight + utilization.volume + utilization.items) / 3;

      return utilization;
    } catch (error) {
      logger.error('Error calculating utilization:', error);
      return { weight: 0, volume: 0, items: 0, overall: 0 };
    }
  }

  /**
   * Optimize capacity allocation for multiple items
   * @param {Object} availableCapacity - Available capacity
   * @param {Array} items - Array of items with capacity requirements
   * @returns {Object} Optimization result
   */
  static optimizeCapacityAllocation(availableCapacity, items) {
    try {
      const result = {
        canFitAll: true,
        fittableItems: [],
        nonFittableItems: [],
        remainingCapacity: { ...availableCapacity },
        totalValue: 0,
        recommendations: []
      };

      // Sort items by value-to-capacity ratio (greedy approach)
      const sortedItems = items.map((item, index) => ({
        ...item,
        originalIndex: index,
        efficiency: this.calculateItemEfficiency(item)
      })).sort((a, b) => b.efficiency - a.efficiency);

      let currentCapacity = { ...availableCapacity };

      for (const item of sortedItems) {
        const capacityCheck = this.checkCapacity(currentCapacity, {
          weight: item.weight || 0,
          volume: item.volume || this.calculateVolume(item.dimensions || {}),
          items: 1
        });

        if (capacityCheck.canFit) {
          result.fittableItems.push(item);
          currentCapacity = this.reserveCapacity(currentCapacity, {
            weight: item.weight || 0,
            volume: item.volume || this.calculateVolume(item.dimensions || {}),
            items: 1
          });
          result.totalValue += item.value || 0;
        } else {
          result.nonFittableItems.push(item);
          result.canFitAll = false;
        }
      }

      result.remainingCapacity = currentCapacity;

      // Generate recommendations
      if (!result.canFitAll) {
        result.recommendations.push({
          type: 'capacity_exceeded',
          message: `${result.nonFittableItems.length} items could not fit`,
          suggestion: 'Consider increasing capacity or splitting across multiple trips'
        });
      }

      const utilization = this.calculateUtilization(availableCapacity, currentCapacity);
      if (utilization.overall < 50) {
        result.recommendations.push({
          type: 'underutilized',
          message: `Capacity is only ${utilization.overall.toFixed(1)}% utilized`,
          suggestion: 'Consider accepting additional deliveries'
        });
      }

      return result;
    } catch (error) {
      logger.error('Error optimizing capacity allocation:', error);
      return {
        canFitAll: false,
        fittableItems: [],
        nonFittableItems: items,
        remainingCapacity: availableCapacity,
        totalValue: 0,
        recommendations: [{ type: 'error', message: error.message }]
      };
    }
  }

  /**
   * Calculate item efficiency (value per capacity unit)
   * @param {Object} item - Item with weight, volume, value
   * @returns {number} Efficiency score
   */
  static calculateItemEfficiency(item) {
    try {
      const weight = item.weight || 0;
      const volume = item.volume || this.calculateVolume(item.dimensions || {});
      const value = item.value || 0;

      if (weight === 0 && volume === 0) return value;

      // Normalize capacity usage (weight in kg, volume in liters)
      const capacityScore = weight + (volume / 10); // Adjust volume weight
      
      return capacityScore > 0 ? value / capacityScore : 0;
    } catch (error) {
      logger.error('Error calculating item efficiency:', error);
      return 0;
    }
  }

  /**
   * Validate capacity values
   * @param {Object} capacity - Capacity object to validate
   * @returns {Object} Validation result
   */
  static validateCapacity(capacity) {
    try {
      const errors = [];
      const warnings = [];

      // Check for required fields
      if (capacity.weight === undefined) {
        errors.push('Weight capacity is required');
      } else if (capacity.weight < 0) {
        errors.push('Weight capacity cannot be negative');
      } else if (capacity.weight > 100) {
        warnings.push('Weight capacity seems unusually high (>100kg)');
      }

      if (capacity.volume === undefined) {
        errors.push('Volume capacity is required');
      } else if (capacity.volume < 0) {
        errors.push('Volume capacity cannot be negative');
      } else if (capacity.volume > 500) {
        warnings.push('Volume capacity seems unusually high (>500L)');
      }

      if (capacity.items === undefined) {
        errors.push('Item capacity is required');
      } else if (capacity.items < 0) {
        errors.push('Item capacity cannot be negative');
      } else if (!Number.isInteger(capacity.items)) {
        errors.push('Item capacity must be a whole number');
      } else if (capacity.items > 50) {
        warnings.push('Item capacity seems unusually high (>50 items)');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Error validating capacity:', error);
      return {
        isValid: false,
        errors: ['Capacity validation failed'],
        warnings: []
      };
    }
  }

  /**
   * Generate capacity recommendations based on historical data
   * @param {Array} historicalTrips - Array of historical trip data
   * @returns {Object} Capacity recommendations
   */
  static generateCapacityRecommendations(historicalTrips) {
    try {
      if (!historicalTrips || historicalTrips.length === 0) {
        return {
          recommendations: [{
            type: 'default',
            message: 'No historical data available',
            suggested_capacity: { weight: 5, volume: 10, items: 3 }
          }]
        };
      }

      // Analyze historical capacity utilization
      const utilizationData = historicalTrips.map(trip => {
        const total = {
          weight: trip.weight_capacity || 0,
          volume: trip.volume_capacity || 0,
          items: trip.item_capacity || 0
        };
        const available = {
          weight: trip.available_weight || 0,
          volume: trip.available_volume || 0,
          items: trip.available_items || 0
        };
        
        return this.calculateUtilization(total, available);
      });

      // Calculate averages
      const avgUtilization = {
        weight: utilizationData.reduce((sum, u) => sum + u.weight, 0) / utilizationData.length,
        volume: utilizationData.reduce((sum, u) => sum + u.volume, 0) / utilizationData.length,
        items: utilizationData.reduce((sum, u) => sum + u.items, 0) / utilizationData.length,
        overall: utilizationData.reduce((sum, u) => sum + u.overall, 0) / utilizationData.length
      };

      const recommendations = [];

      // Generate recommendations based on utilization patterns
      if (avgUtilization.overall < 30) {
        recommendations.push({
          type: 'reduce_capacity',
          message: 'Your trips are typically underutilized',
          suggestion: 'Consider reducing capacity to lower costs and attract more customers'
        });
      } else if (avgUtilization.overall > 90) {
        recommendations.push({
          type: 'increase_capacity',
          message: 'Your trips are typically at high utilization',
          suggestion: 'Consider increasing capacity to accommodate more deliveries'
        });
      }

      // Identify bottlenecks
      const bottlenecks = [];
      if (avgUtilization.weight > avgUtilization.volume && avgUtilization.weight > avgUtilization.items) {
        bottlenecks.push('weight');
      }
      if (avgUtilization.volume > avgUtilization.weight && avgUtilization.volume > avgUtilization.items) {
        bottlenecks.push('volume');
      }
      if (avgUtilization.items > avgUtilization.weight && avgUtilization.items > avgUtilization.volume) {
        bottlenecks.push('items');
      }

      if (bottlenecks.length > 0) {
        recommendations.push({
          type: 'bottleneck',
          message: `Your ${bottlenecks.join(' and ')} capacity is the limiting factor`,
          suggestion: `Consider increasing ${bottlenecks.join(' and ')} capacity`
        });
      }

      return {
        average_utilization: avgUtilization,
        bottlenecks,
        recommendations
      };
    } catch (error) {
      logger.error('Error generating capacity recommendations:', error);
      return {
        recommendations: [{
          type: 'error',
          message: 'Unable to analyze capacity data',
          suggestion: 'Review your trip capacity settings manually'
        }]
      };
    }
  }

  /**
   * Calculate optimal capacity for a route based on demand
   * @param {Object} routeData - Route information and historical demand
   * @returns {Object} Optimal capacity recommendation
   */
  static calculateOptimalCapacity(routeData) {
    try {
      const { distance, demand_history, trip_type, duration_hours } = routeData;

      // Base capacity recommendations by trip type
      const baseCapacity = {
        flight: { weight: 8, volume: 15, items: 4 },
        train: { weight: 12, volume: 25, items: 6 },
        bus: { weight: 10, volume: 20, items: 5 },
        car: { weight: 15, volume: 30, items: 8 },
        ship: { weight: 50, volume: 100, items: 20 },
        other: { weight: 10, volume: 20, items: 5 }
      };

      let recommended = { ...baseCapacity[trip_type] || baseCapacity.other };

      // Adjust based on distance
      if (distance > 1000) {
        // Long distance - increase capacity
        recommended.weight *= 1.5;
        recommended.volume *= 1.5;
        recommended.items *= 1.3;
      } else if (distance < 100) {
        // Short distance - optimize for frequency
        recommended.weight *= 0.7;
        recommended.volume *= 0.7;
        recommended.items *= 0.8;
      }

      // Adjust based on historical demand
      if (demand_history && demand_history.length > 0) {
        const avgDemand = demand_history.reduce((sum, d) => ({
          weight: sum.weight + (d.weight || 0),
          volume: sum.volume + (d.volume || 0),
          items: sum.items + (d.items || 0)
        }), { weight: 0, volume: 0, items: 0 });

        avgDemand.weight /= demand_history.length;
        avgDemand.volume /= demand_history.length;
        avgDemand.items /= demand_history.length;

        // Adjust recommendations based on actual demand
        recommended.weight = Math.max(recommended.weight, avgDemand.weight * 1.2);
        recommended.volume = Math.max(recommended.volume, avgDemand.volume * 1.2);
        recommended.items = Math.max(recommended.items, avgDemand.items * 1.2);
      }

      // Round to reasonable values
      recommended.weight = Math.round(recommended.weight * 2) / 2; // Round to 0.5
      recommended.volume = Math.round(recommended.volume);
      recommended.items = Math.round(recommended.items);

      return {
        recommended_capacity: recommended,
        confidence: demand_history && demand_history.length > 5 ? 'high' : 'medium',
        factors_considered: ['trip_type', 'distance', 'demand_history'].filter(f => 
          routeData[f] !== undefined
        )
      };
    } catch (error) {
      logger.error('Error calculating optimal capacity:', error);
      return {
        recommended_capacity: { weight: 10, volume: 20, items: 5 },
        confidence: 'low',
        factors_considered: []
      };
    }
  }

  /**
   * Format capacity for display
   * @param {Object} capacity - Capacity object
   * @returns {string} Formatted capacity string
   */
  static formatCapacity(capacity) {
    try {
      const parts = [];
      
      if (capacity.weight) {
        parts.push(`${capacity.weight}kg`);
      }
      if (capacity.volume) {
        parts.push(`${capacity.volume}L`);
      }
      if (capacity.items) {
        parts.push(`${capacity.items} items`);
      }
      
      return parts.join(', ') || 'No capacity specified';
    } catch (error) {
      logger.error('Error formatting capacity:', error);
      return 'Invalid capacity';
    }
  }
}

module.exports = CapacityUtils;