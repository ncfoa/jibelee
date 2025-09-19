/**
 * Utility functions index file
 * Exports all utility classes and functions for easy importing
 */

const GeoUtils = require('./geoUtils');
const TimeUtils = require('./timeUtils');
const CapacityUtils = require('./capacityUtils');
const { logger } = require('../config/logger');

/**
 * Common utility functions used across the application
 */
class CommonUtils {
  /**
   * Generate a random string of specified length
   * @param {number} length - Length of the string
   * @param {string} charset - Character set to use
   * @returns {string}
   */
  static generateRandomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * Generate a unique trip number
   * @returns {string}
   */
  static generateTripNumber() {
    const timestamp = Date.now().toString(36);
    const random = this.generateRandomString(4, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
    return `TRIP-${timestamp}-${random}`;
  }

  /**
   * Generate a unique template ID
   * @returns {string}
   */
  static generateTemplateId() {
    const timestamp = Date.now().toString(36);
    const random = this.generateRandomString(4, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
    return `TPL-${timestamp}-${random}`;
  }

  /**
   * Sanitize string for database storage
   * @param {string} str - Input string
   * @returns {string}
   */
  static sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean}
   */
  static isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Format currency amount
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @returns {string}
   */
  static formatCurrency(amount, currency = 'USD') {
    try {
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
      });
      return formatter.format(amount / 100); // Convert cents to dollars
    } catch (error) {
      return `${currency} ${(amount / 100).toFixed(2)}`;
    }
  }

  /**
   * Parse currency amount to cents
   * @param {string|number} amount - Amount string or number
   * @returns {number}
   */
  static parseCurrency(amount) {
    if (typeof amount === 'number') return Math.round(amount * 100);
    if (typeof amount === 'string') {
      const cleaned = amount.replace(/[^\d.]/g, '');
      return Math.round(parseFloat(cleaned) * 100);
    }
    return 0;
  }

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object}
   */
  static deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      logger.error('Error deep cloning object:', error);
      return obj;
    }
  }

  /**
   * Merge objects deeply
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object}
   */
  static deepMerge(target, source) {
    try {
      const result = { ...target };
      
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = this.deepMerge(result[key] || {}, source[key]);
          } else {
            result[key] = source[key];
          }
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Error deep merging objects:', error);
      return target;
    }
  }

  /**
   * Check if value is empty
   * @param {*} value - Value to check
   * @returns {boolean}
   */
  static isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function}
   */
  static debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function}
   */
  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Retry function with exponential backoff
   * @param {Function} func - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise}
   */
  static async retry(func, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await func();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Calculate hash of a string
   * @param {string} str - String to hash
   * @returns {string}
   */
  static calculateHash(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Generate route hash for caching
   * @param {Object} origin - Origin coordinates
   * @param {Object} destination - Destination coordinates
   * @returns {string}
   */
  static generateRouteHash(origin, destination) {
    const routeString = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`;
    return this.calculateHash(routeString).substring(0, 16);
  }

  /**
   * Validate and normalize URL
   * @param {string} url - URL to validate
   * @returns {string|null}
   */
  static normalizeUrl(url) {
    try {
      if (!url) return null;
      
      // Add protocol if missing
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      const normalized = new URL(url);
      return normalized.toString();
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract domain from URL
   * @param {string} url - URL to extract domain from
   * @returns {string|null}
   */
  static extractDomain(url) {
    try {
      const normalized = this.normalizeUrl(url);
      if (!normalized) return null;
      
      const urlObj = new URL(normalized);
      return urlObj.hostname;
    } catch (error) {
      return null;
    }
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - Size in bytes
   * @returns {string}
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate pagination metadata
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @param {number} total - Total items
   * @returns {Object}
   */
  static generatePagination(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    return {
      current_page: page,
      per_page: limit,
      total_items: total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      next_page: page < totalPages ? page + 1 : null,
      prev_page: page > 1 ? page - 1 : null,
      offset
    };
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert snake_case to camelCase
   * @param {string} str - Snake case string
   * @returns {string}
   */
  static toCamelCase(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   * @param {string} str - Camel case string
   * @returns {string}
   */
  static toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Convert object keys to camelCase
   * @param {Object} obj - Object to convert
   * @returns {Object}
   */
  static keysToCamelCase(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.keysToCamelCase(item));
    }
    
    if (obj && typeof obj === 'object') {
      const converted = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const camelKey = this.toCamelCase(key);
          converted[camelKey] = this.keysToCamelCase(obj[key]);
        }
      }
      return converted;
    }
    
    return obj;
  }

  /**
   * Convert object keys to snake_case
   * @param {Object} obj - Object to convert
   * @returns {Object}
   */
  static keysToSnakeCase(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.keysToSnakeCase(item));
    }
    
    if (obj && typeof obj === 'object') {
      const converted = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const snakeKey = this.toSnakeCase(key);
          converted[snakeKey] = this.keysToSnakeCase(obj[key]);
        }
      }
      return converted;
    }
    
    return obj;
  }
}

module.exports = {
  GeoUtils,
  TimeUtils,
  CapacityUtils,
  CommonUtils
};