const moment = require('moment-timezone');
const { logger } = require('../config/logger');

/**
 * Time utility functions for trip management
 */
class TimeUtils {
  /**
   * Get current UTC timestamp
   * @returns {Date}
   */
  static now() {
    return new Date();
  }

  /**
   * Get current timestamp in specific timezone
   * @param {string} timezone - Timezone (e.g., 'America/New_York')
   * @returns {moment.Moment}
   */
  static nowInTimezone(timezone = 'UTC') {
    try {
      return moment().tz(timezone);
    } catch (error) {
      logger.error('Error getting time in timezone:', error);
      return moment().utc();
    }
  }

  /**
   * Convert timestamp to specific timezone
   * @param {Date|string} timestamp - Input timestamp
   * @param {string} timezone - Target timezone
   * @returns {moment.Moment}
   */
  static toTimezone(timestamp, timezone = 'UTC') {
    try {
      return moment(timestamp).tz(timezone);
    } catch (error) {
      logger.error('Error converting to timezone:', error);
      return moment(timestamp).utc();
    }
  }

  /**
   * Format timestamp for display
   * @param {Date|string} timestamp - Input timestamp
   * @param {string} format - Moment.js format string
   * @param {string} timezone - Timezone for display
   * @returns {string}
   */
  static format(timestamp, format = 'YYYY-MM-DD HH:mm:ss', timezone = 'UTC') {
    try {
      return moment(timestamp).tz(timezone).format(format);
    } catch (error) {
      logger.error('Error formatting timestamp:', error);
      return 'Invalid date';
    }
  }

  /**
   * Calculate duration between two timestamps in minutes
   * @param {Date|string} start - Start timestamp
   * @param {Date|string} end - End timestamp
   * @returns {number} Duration in minutes
   */
  static calculateDuration(start, end) {
    try {
      const startMoment = moment(start);
      const endMoment = moment(end);
      return endMoment.diff(startMoment, 'minutes');
    } catch (error) {
      logger.error('Error calculating duration:', error);
      return 0;
    }
  }

  /**
   * Add time to a timestamp
   * @param {Date|string} timestamp - Base timestamp
   * @param {number} amount - Amount to add
   * @param {string} unit - Unit (minutes, hours, days, etc.)
   * @returns {Date}
   */
  static addTime(timestamp, amount, unit = 'minutes') {
    try {
      return moment(timestamp).add(amount, unit).toDate();
    } catch (error) {
      logger.error('Error adding time:', error);
      return new Date(timestamp);
    }
  }

  /**
   * Subtract time from a timestamp
   * @param {Date|string} timestamp - Base timestamp
   * @param {number} amount - Amount to subtract
   * @param {string} unit - Unit (minutes, hours, days, etc.)
   * @returns {Date}
   */
  static subtractTime(timestamp, amount, unit = 'minutes') {
    try {
      return moment(timestamp).subtract(amount, unit).toDate();
    } catch (error) {
      logger.error('Error subtracting time:', error);
      return new Date(timestamp);
    }
  }

  /**
   * Check if a timestamp is in the past
   * @param {Date|string} timestamp - Timestamp to check
   * @returns {boolean}
   */
  static isPast(timestamp) {
    try {
      return moment(timestamp).isBefore(moment());
    } catch (error) {
      logger.error('Error checking if timestamp is past:', error);
      return false;
    }
  }

  /**
   * Check if a timestamp is in the future
   * @param {Date|string} timestamp - Timestamp to check
   * @returns {boolean}
   */
  static isFuture(timestamp) {
    try {
      return moment(timestamp).isAfter(moment());
    } catch (error) {
      logger.error('Error checking if timestamp is future:', error);
      return false;
    }
  }

  /**
   * Check if a timestamp is between two other timestamps
   * @param {Date|string} timestamp - Timestamp to check
   * @param {Date|string} start - Start of range
   * @param {Date|string} end - End of range
   * @returns {boolean}
   */
  static isBetween(timestamp, start, end) {
    try {
      const momentTimestamp = moment(timestamp);
      return momentTimestamp.isBetween(moment(start), moment(end), null, '[]');
    } catch (error) {
      logger.error('Error checking if timestamp is between:', error);
      return false;
    }
  }

  /**
   * Get relative time description (e.g., "2 hours ago", "in 3 days")
   * @param {Date|string} timestamp - Timestamp to describe
   * @param {Date|string} relativeTo - Reference timestamp (default: now)
   * @returns {string}
   */
  static getRelativeTime(timestamp, relativeTo = null) {
    try {
      const base = relativeTo ? moment(relativeTo) : moment();
      return moment(timestamp).from(base);
    } catch (error) {
      logger.error('Error getting relative time:', error);
      return 'Unknown time';
    }
  }

  /**
   * Get time until a future timestamp
   * @param {Date|string} timestamp - Future timestamp
   * @returns {Object} Time components {days, hours, minutes, seconds}
   */
  static getTimeUntil(timestamp) {
    try {
      const now = moment();
      const target = moment(timestamp);
      
      if (target.isBefore(now)) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
      }
      
      const duration = moment.duration(target.diff(now));
      
      return {
        days: Math.floor(duration.asDays()),
        hours: duration.hours(),
        minutes: duration.minutes(),
        seconds: duration.seconds(),
        isPast: false
      };
    } catch (error) {
      logger.error('Error getting time until:', error);
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    }
  }

  /**
   * Format duration in human-readable format
   * @param {number} minutes - Duration in minutes
   * @returns {string}
   */
  static formatDuration(minutes) {
    try {
      if (minutes < 60) {
        return `${minutes} minutes`;
      } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 
          ? `${hours} hours ${remainingMinutes} minutes`
          : `${hours} hours`;
      } else {
        const days = Math.floor(minutes / 1440);
        const remainingHours = Math.floor((minutes % 1440) / 60);
        const remainingMinutes = minutes % 60;
        
        let result = `${days} days`;
        if (remainingHours > 0) result += ` ${remainingHours} hours`;
        if (remainingMinutes > 0) result += ` ${remainingMinutes} minutes`;
        
        return result;
      }
    } catch (error) {
      logger.error('Error formatting duration:', error);
      return '0 minutes';
    }
  }

  /**
   * Get start and end of day for a given timestamp
   * @param {Date|string} timestamp - Input timestamp
   * @param {string} timezone - Timezone
   * @returns {Object} {start, end}
   */
  static getDayBounds(timestamp, timezone = 'UTC') {
    try {
      const momentDate = moment(timestamp).tz(timezone);
      return {
        start: momentDate.clone().startOf('day').toDate(),
        end: momentDate.clone().endOf('day').toDate()
      };
    } catch (error) {
      logger.error('Error getting day bounds:', error);
      const date = new Date(timestamp);
      return { start: date, end: date };
    }
  }

  /**
   * Get start and end of week for a given timestamp
   * @param {Date|string} timestamp - Input timestamp
   * @param {string} timezone - Timezone
   * @returns {Object} {start, end}
   */
  static getWeekBounds(timestamp, timezone = 'UTC') {
    try {
      const momentDate = moment(timestamp).tz(timezone);
      return {
        start: momentDate.clone().startOf('week').toDate(),
        end: momentDate.clone().endOf('week').toDate()
      };
    } catch (error) {
      logger.error('Error getting week bounds:', error);
      const date = new Date(timestamp);
      return { start: date, end: date };
    }
  }

  /**
   * Get start and end of month for a given timestamp
   * @param {Date|string} timestamp - Input timestamp
   * @param {string} timezone - Timezone
   * @returns {Object} {start, end}
   */
  static getMonthBounds(timestamp, timezone = 'UTC') {
    try {
      const momentDate = moment(timestamp).tz(timezone);
      return {
        start: momentDate.clone().startOf('month').toDate(),
        end: momentDate.clone().endOf('month').toDate()
      };
    } catch (error) {
      logger.error('Error getting month bounds:', error);
      const date = new Date(timestamp);
      return { start: date, end: date };
    }
  }

  /**
   * Validate timestamp format
   * @param {Date|string} timestamp - Timestamp to validate
   * @returns {boolean}
   */
  static isValidTimestamp(timestamp) {
    try {
      return moment(timestamp).isValid();
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse various timestamp formats
   * @param {string} timestampString - Timestamp string
   * @param {string} format - Expected format (optional)
   * @returns {Date|null}
   */
  static parseTimestamp(timestampString, format = null) {
    try {
      let parsed;
      if (format) {
        parsed = moment(timestampString, format);
      } else {
        parsed = moment(timestampString);
      }
      
      return parsed.isValid() ? parsed.toDate() : null;
    } catch (error) {
      logger.error('Error parsing timestamp:', error);
      return null;
    }
  }

  /**
   * Get timezone offset for a location (simplified)
   * @param {Object} coordinates - {lat, lng}
   * @returns {string} Timezone string
   */
  static getTimezoneFromCoordinates(coordinates) {
    try {
      // This is a simplified version. In production, use a proper timezone lookup service
      const { lat, lng } = coordinates;
      
      // Simple timezone mapping based on longitude
      const timezoneOffset = Math.round(lng / 15);
      
      // Map to common timezones (very simplified)
      const timezoneMap = {
        '-8': 'America/Los_Angeles',
        '-7': 'America/Denver',
        '-6': 'America/Chicago',
        '-5': 'America/New_York',
        '0': 'Europe/London',
        '1': 'Europe/Paris',
        '8': 'Asia/Shanghai',
        '9': 'Asia/Tokyo'
      };
      
      return timezoneMap[timezoneOffset.toString()] || 'UTC';
    } catch (error) {
      logger.error('Error getting timezone from coordinates:', error);
      return 'UTC';
    }
  }

  /**
   * Check if two time periods overlap
   * @param {Object} period1 - {start, end}
   * @param {Object} period2 - {start, end}
   * @returns {boolean}
   */
  static doPeriodsOverlap(period1, period2) {
    try {
      const start1 = moment(period1.start);
      const end1 = moment(period1.end);
      const start2 = moment(period2.start);
      const end2 = moment(period2.end);
      
      return start1.isBefore(end2) && start2.isBefore(end1);
    } catch (error) {
      logger.error('Error checking period overlap:', error);
      return false;
    }
  }

  /**
   * Generate recurring dates based on pattern
   * @param {Date} startDate - Start date
   * @param {Object} pattern - Recurring pattern
   * @param {number} count - Number of dates to generate
   * @returns {Array} Array of dates
   */
  static generateRecurringDates(startDate, pattern, count = 10) {
    try {
      const dates = [];
      let currentDate = moment(startDate);
      
      const { frequency, interval = 1, daysOfWeek, endDate } = pattern;
      const endMoment = endDate ? moment(endDate) : null;
      
      for (let i = 0; i < count; i++) {
        if (endMoment && currentDate.isAfter(endMoment)) {
          break;
        }
        
        dates.push(currentDate.toDate());
        
        switch (frequency) {
          case 'daily':
            currentDate.add(interval, 'days');
            break;
          case 'weekly':
            if (daysOfWeek && daysOfWeek.length > 0) {
              // Find next occurrence of specified days
              let nextDay = currentDate.clone().add(1, 'day');
              while (!daysOfWeek.includes(nextDay.day())) {
                nextDay.add(1, 'day');
              }
              currentDate = nextDay;
            } else {
              currentDate.add(interval, 'weeks');
            }
            break;
          case 'monthly':
            currentDate.add(interval, 'months');
            break;
          case 'yearly':
            currentDate.add(interval, 'years');
            break;
          default:
            currentDate.add(interval, 'days');
        }
      }
      
      return dates;
    } catch (error) {
      logger.error('Error generating recurring dates:', error);
      return [];
    }
  }

  /**
   * Calculate business days between two dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {number} Number of business days
   */
  static getBusinessDays(startDate, endDate) {
    try {
      const start = moment(startDate);
      const end = moment(endDate);
      let businessDays = 0;
      
      const current = start.clone();
      while (current.isSameOrBefore(end, 'day')) {
        if (current.day() !== 0 && current.day() !== 6) { // Not Sunday or Saturday
          businessDays++;
        }
        current.add(1, 'day');
      }
      
      return businessDays;
    } catch (error) {
      logger.error('Error calculating business days:', error);
      return 0;
    }
  }

  /**
   * Get next business day
   * @param {Date|string} date - Input date
   * @returns {Date}
   */
  static getNextBusinessDay(date) {
    try {
      let nextDay = moment(date).add(1, 'day');
      while (nextDay.day() === 0 || nextDay.day() === 6) {
        nextDay.add(1, 'day');
      }
      return nextDay.toDate();
    } catch (error) {
      logger.error('Error getting next business day:', error);
      return new Date(date);
    }
  }

  /**
   * Format time range
   * @param {Date|string} start - Start time
   * @param {Date|string} end - End time
   * @param {string} timezone - Timezone
   * @returns {string}
   */
  static formatTimeRange(start, end, timezone = 'UTC') {
    try {
      const startMoment = moment(start).tz(timezone);
      const endMoment = moment(end).tz(timezone);
      
      if (startMoment.isSame(endMoment, 'day')) {
        return `${startMoment.format('MMM DD, YYYY')} ${startMoment.format('HH:mm')} - ${endMoment.format('HH:mm')} (${timezone})`;
      } else {
        return `${startMoment.format('MMM DD, YYYY HH:mm')} - ${endMoment.format('MMM DD, YYYY HH:mm')} (${timezone})`;
      }
    } catch (error) {
      logger.error('Error formatting time range:', error);
      return 'Invalid time range';
    }
  }

  /**
   * Get ISO week number
   * @param {Date|string} date - Input date
   * @returns {number}
   */
  static getWeekNumber(date) {
    try {
      return moment(date).isoWeek();
    } catch (error) {
      logger.error('Error getting week number:', error);
      return 1;
    }
  }

  /**
   * Check if date is a weekend
   * @param {Date|string} date - Input date
   * @returns {boolean}
   */
  static isWeekend(date) {
    try {
      const day = moment(date).day();
      return day === 0 || day === 6; // Sunday or Saturday
    } catch (error) {
      logger.error('Error checking if weekend:', error);
      return false;
    }
  }
}

module.exports = TimeUtils;