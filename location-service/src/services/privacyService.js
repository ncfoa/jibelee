const GeoUtils = require('../utils/geoUtils');
const { logger, locationLogger } = require('../utils/logger');

class PrivacyService {
  constructor() {
    this.anonymizationQueue = [];
    this.deletionQueue = [];
  }

  /**
   * Filter location data based on privacy settings
   */
  async filterLocationData(locationData, privacySettings = {}) {
    const {
      trackingLevel = 'precise',
      shareWithCustomer = true,
      shareWithTraveler = true,
      anonymizeAfterHours = 24
    } = privacySettings;

    let filteredLocation = { ...locationData };

    // Apply tracking level filtering
    switch (trackingLevel) {
      case 'minimal':
        filteredLocation = this.applyMinimalTracking(filteredLocation);
        break;
      case 'approximate':
        filteredLocation = this.applyApproximateTracking(filteredLocation);
        break;
      case 'precise':
      default:
        // No filtering for precise tracking
        break;
    }

    // Remove sensitive metadata
    if (trackingLevel !== 'precise') {
      delete filteredLocation.batteryLevel;
      delete filteredLocation.networkType;
      delete filteredLocation.deviceInfo;
    }

    return filteredLocation;
  }

  /**
   * Apply minimal tracking (very low precision, infrequent updates)
   */
  applyMinimalTracking(locationData) {
    const { coordinates } = locationData;
    
    // Reduce accuracy to city level (~5km radius)
    const generalizedCoords = this.generalizeCoordinates(coordinates, 5000);
    
    return {
      ...locationData,
      coordinates: generalizedCoords,
      accuracy: Math.max(locationData.accuracy || 0, 5000),
      // Remove precise timing
      timestamp: this.roundTimestamp(locationData.timestamp, 30), // 30-minute intervals
      // Remove speed and bearing for privacy
      speed: null,
      bearing: null,
      altitude: null
    };
  }

  /**
   * Apply approximate tracking (reduced precision)
   */
  applyApproximateTracking(locationData) {
    const { coordinates } = locationData;
    
    // Reduce accuracy to neighborhood level (~500m radius)
    const generalizedCoords = this.generalizeCoordinates(coordinates, 500);
    
    return {
      ...locationData,
      coordinates: generalizedCoords,
      accuracy: Math.max(locationData.accuracy || 0, 500),
      // Round timestamp to 5-minute intervals
      timestamp: this.roundTimestamp(locationData.timestamp, 5),
      // Keep speed but remove bearing
      bearing: null
    };
  }

  /**
   * Generalize coordinates by adding random offset within radius
   */
  generalizeCoordinates(coordinates, radiusMeters) {
    const { latitude, longitude } = coordinates;
    
    // Generate random offset within the radius
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusMeters;
    
    // Convert distance to degrees (approximate)
    const latOffset = (distance * Math.cos(angle)) / 111000; // ~111km per degree
    const lngOffset = (distance * Math.sin(angle)) / (111000 * Math.cos(latitude * Math.PI / 180));
    
    return {
      latitude: latitude + latOffset,
      longitude: longitude + lngOffset
    };
  }

  /**
   * Round timestamp to specified minute intervals
   */
  roundTimestamp(timestamp, intervalMinutes) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
    
    date.setMinutes(roundedMinutes, 0, 0); // Set seconds and milliseconds to 0
    return date.toISOString();
  }

  /**
   * Schedule data anonymization
   */
  async scheduleDataAnonymization(userId, deliveryId, hoursDelay = 24) {
    const anonymizationTime = new Date(Date.now() + hoursDelay * 60 * 60 * 1000);
    
    const task = {
      id: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      deliveryId,
      scheduledFor: anonymizationTime,
      status: 'scheduled',
      type: 'anonymization'
    };

    this.anonymizationQueue.push(task);
    
    // In production, this would be stored in a database and processed by a job queue
    setTimeout(() => {
      this.processAnonymization(task);
    }, hoursDelay * 60 * 60 * 1000);

    logger.info('Data anonymization scheduled', {
      taskId: task.id,
      userId,
      deliveryId,
      scheduledFor: anonymizationTime
    });

    return task;
  }

  /**
   * Process data anonymization
   */
  async processAnonymization(task) {
    try {
      const { userId, deliveryId } = task;
      
      // Mock anonymization process
      const anonymizedRecords = await this.anonymizeLocationData(userId, deliveryId);
      
      task.status = 'completed';
      task.completedAt = new Date();
      task.recordsAnonymized = anonymizedRecords;

      locationLogger.privacySettingsUpdated({
        userId,
        changes: [`anonymized_${anonymizedRecords}_records`]
      });

      logger.info('Data anonymization completed', {
        taskId: task.id,
        userId,
        deliveryId,
        recordsAnonymized: anonymizedRecords
      });

      return task;
    } catch (error) {
      logger.error('Data anonymization failed', {
        taskId: task.id,
        error: error.message
      });
      
      task.status = 'failed';
      task.error = error.message;
      throw error;
    }
  }

  /**
   * Anonymize location data for a user/delivery
   */
  async anonymizeLocationData(userId, deliveryId = null) {
    // Mock anonymization - in production, this would:
    // 1. Remove personally identifiable information
    // 2. Generalize coordinates to broader areas
    // 3. Remove precise timestamps
    // 4. Keep only aggregated statistics
    
    const mockRecordsAnonymized = Math.floor(Math.random() * 100) + 50;
    
    // Create anonymized summary
    const summary = {
      userId: 'anonymous',
      deliveryId: deliveryId || 'anonymous',
      totalDistance: Math.random() * 100,
      averageSpeed: Math.random() * 60 + 20,
      duration: Math.random() * 180 + 30,
      routeType: 'highway', // Generalized route type
      timeOfDay: 'afternoon', // Generalized time
      anonymizedAt: new Date()
    };

    logger.info('Location data anonymized', {
      userId,
      deliveryId,
      recordsProcessed: mockRecordsAnonymized,
      summary
    });

    return mockRecordsAnonymized;
  }

  /**
   * Schedule data deletion
   */
  async scheduleDataDeletion(userId, deliveryId = null, daysDelay = 1) {
    const deletionTime = new Date(Date.now() + daysDelay * 24 * 60 * 60 * 1000);
    
    const task = {
      id: `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      deliveryId,
      scheduledFor: deletionTime,
      status: 'scheduled',
      type: 'deletion',
      cancellationDeadline: new Date(Date.now() + (daysDelay * 24 * 60 * 60 * 1000) / 2)
    };

    this.deletionQueue.push(task);
    
    // In production, this would be stored in database and processed by job queue
    setTimeout(() => {
      this.processDeletion(task);
    }, daysDelay * 24 * 60 * 60 * 1000);

    logger.warn('Data deletion scheduled', {
      taskId: task.id,
      userId,
      deliveryId,
      scheduledFor: deletionTime,
      cancellationDeadline: task.cancellationDeadline
    });

    return task;
  }

  /**
   * Process data deletion
   */
  async processDeletion(task) {
    try {
      const { userId, deliveryId } = task;
      
      // Check if task was cancelled
      if (task.status === 'cancelled') {
        logger.info('Data deletion cancelled', { taskId: task.id });
        return task;
      }
      
      // Mock deletion process
      const deletedRecords = await this.deleteLocationData(userId, deliveryId);
      
      task.status = 'completed';
      task.completedAt = new Date();
      task.recordsDeleted = deletedRecords;

      locationLogger.dataDeleted({
        userId,
        deletionId: task.id,
        recordsDeleted: deletedRecords
      });

      logger.warn('Data deletion completed', {
        taskId: task.id,
        userId,
        deliveryId,
        recordsDeleted: deletedRecords
      });

      return task;
    } catch (error) {
      logger.error('Data deletion failed', {
        taskId: task.id,
        error: error.message
      });
      
      task.status = 'failed';
      task.error = error.message;
      throw error;
    }
  }

  /**
   * Delete location data for a user/delivery
   */
  async deleteLocationData(userId, deliveryId = null) {
    // Mock deletion - in production, this would:
    // 1. Delete location tracking records
    // 2. Delete geofence events
    // 3. Delete route history
    // 4. Preserve data required for legal compliance
    
    const mockRecordsDeleted = Math.floor(Math.random() * 200) + 100;
    
    logger.warn('Location data deleted', {
      userId,
      deliveryId,
      recordsDeleted: mockRecordsDeleted
    });

    return mockRecordsDeleted;
  }

  /**
   * Cancel scheduled deletion
   */
  async cancelDataDeletion(taskId) {
    const task = this.deletionQueue.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error('Deletion task not found');
    }
    
    if (task.status !== 'scheduled') {
      throw new Error('Cannot cancel task that is not scheduled');
    }
    
    if (new Date() > task.cancellationDeadline) {
      throw new Error('Cancellation deadline has passed');
    }
    
    task.status = 'cancelled';
    task.cancelledAt = new Date();
    
    logger.info('Data deletion cancelled', {
      taskId,
      userId: task.userId,
      deliveryId: task.deliveryId
    });
    
    return task;
  }

  /**
   * Export user's location data
   */
  async exportUserData(userId, format = 'json', dateRange = null) {
    const exportId = `export_${userId}_${Date.now()}`;
    
    try {
      // Mock data export - in production, this would:
      // 1. Query all location data for the user
      // 2. Format according to requested format (JSON, CSV, GPX, etc.)
      // 3. Generate downloadable file
      // 4. Store securely with expiration
      
      const mockData = {
        userId,
        exportId,
        format,
        dateRange,
        generatedAt: new Date(),
        recordCount: Math.floor(Math.random() * 1000) + 500,
        fileSize: '2.5 MB',
        data: {
          locationTracking: [],
          geofenceEvents: [],
          privacySettings: {},
          dataProcessingLog: []
        }
      };

      locationLogger.dataExported({
        userId,
        exportId,
        format,
        recordCount: mockData.recordCount
      });

      logger.info('User data exported', {
        userId,
        exportId,
        format,
        recordCount: mockData.recordCount
      });

      return {
        exportId,
        status: 'completed',
        downloadUrl: `https://api.example.com/downloads/${exportId}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ...mockData
      };
    } catch (error) {
      logger.error('Data export failed', {
        userId,
        exportId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get privacy audit log for user
   */
  async getPrivacyAuditLog(userId, limit = 50, offset = 0) {
    // Mock audit log - in production, this would query actual audit records
    const auditEvents = [
      {
        id: 'audit_1',
        event: 'privacy_settings_updated',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        details: {
          changes: ['trackingLevel: approximate -> precise'],
          reason: 'user_request'
        }
      },
      {
        id: 'audit_2',
        event: 'data_shared',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        details: {
          recipient: 'customer',
          dataType: 'current_location',
          deliveryId: 'delivery_123',
          purpose: 'delivery_tracking'
        }
      },
      {
        id: 'audit_3',
        event: 'data_anonymized',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        details: {
          recordsAffected: 245,
          criteria: 'older_than_30_days'
        }
      },
      {
        id: 'audit_4',
        event: 'data_exported',
        timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        details: {
          format: 'json',
          recordCount: 1247,
          exportId: 'export_123'
        }
      }
    ];

    return {
      auditEvents: auditEvents.slice(offset, offset + limit),
      total: auditEvents.length,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < auditEvents.length
      }
    };
  }

  /**
   * Update user privacy preferences
   */
  async updatePrivacySettings(userId, newSettings) {
    // Mock settings update - in production, this would update database
    const currentSettings = await this.getPrivacySettings(userId);
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    // Log the changes
    const changes = Object.keys(newSettings).map(key => 
      `${key}: ${currentSettings[key]} -> ${newSettings[key]}`
    );

    locationLogger.privacySettingsUpdated({
      userId,
      changes
    });

    logger.info('Privacy settings updated', {
      userId,
      changes: newSettings
    });

    return updatedSettings;
  }

  /**
   * Get user privacy settings
   */
  async getPrivacySettings(userId) {
    // Mock settings retrieval - in production, this would query database
    return {
      userId,
      trackingLevel: 'precise',
      shareWithCustomer: true,
      shareWithTraveler: true,
      shareWithPlatform: true,
      shareWithThirdParties: false,
      dataRetentionDays: 90,
      deleteAfterDelivery: false,
      anonymizationEnabled: true,
      anonymizationDelayHours: 24,
      notificationsEnabled: true,
      updatedAt: new Date()
    };
  }

  /**
   * Check if data sharing is allowed
   */
  async canShareData(userId, recipient, dataType) {
    const settings = await this.getPrivacySettings(userId);
    
    const sharingRules = {
      customer: settings.shareWithCustomer,
      traveler: settings.shareWithTraveler,
      platform: settings.shareWithPlatform,
      third_party: settings.shareWithThirdParties
    };

    return sharingRules[recipient] || false;
  }

  /**
   * Log data access for audit trail
   */
  async logDataAccess(userId, accessor, dataType, purpose) {
    const accessLog = {
      id: `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      accessor,
      dataType,
      purpose,
      timestamp: new Date(),
      ipAddress: '0.0.0.0', // Would be actual IP
      userAgent: 'Unknown' // Would be actual user agent
    };

    logger.info('Data access logged', accessLog);

    // In production, this would be stored in audit database
    return accessLog;
  }
}

module.exports = PrivacyService;