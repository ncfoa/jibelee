const { body, param, query } = require('express-validator');

// Notification validation rules
const sendNotificationValidation = [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('templateId')
    .optional()
    .isUUID()
    .withMessage('Template ID must be a valid UUID'),
  
  body('channels')
    .optional()
    .isArray()
    .withMessage('Channels must be an array')
    .custom((channels) => {
      const validChannels = ['push', 'email', 'sms', 'in_app'];
      const invalidChannels = channels.filter(channel => !validChannels.includes(channel));
      if (invalidChannels.length > 0) {
        throw new Error(`Invalid channels: ${invalidChannels.join(', ')}`);
      }
      return true;
    }),
  
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, normal, high, urgent'),
  
  body('scheduleAt')
    .optional()
    .isISO8601()
    .withMessage('Schedule date must be a valid ISO 8601 date')
    .custom((value) => {
      const scheduleDate = new Date(value);
      const now = new Date();
      if (scheduleDate <= now) {
        throw new Error('Schedule date must be in the future');
      }
      return true;
    }),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

// Custom notification validation
const sendCustomNotificationValidation = [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('type')
    .isIn(['push', 'email', 'sms', 'in_app'])
    .withMessage('Type must be one of: push, email, sms, in_app'),
  
  body('title')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  
  body('message')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
  
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, normal, high, urgent')
];

// Bulk notifications validation
const sendBulkNotificationsValidation = [
  body('notifications')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Notifications must be an array with 1-1000 items'),
  
  body('notifications.*.userId')
    .isUUID()
    .withMessage('Each notification must have a valid user ID'),
  
  body('notifications.*.templateId')
    .optional()
    .isUUID()
    .withMessage('Template ID must be a valid UUID'),
  
  body('notifications.*.channels')
    .optional()
    .isArray()
    .withMessage('Channels must be an array')
];

// Device token validation
const deviceTokenValidation = [
  body('token')
    .isLength({ min: 10, max: 500 })
    .withMessage('Token must be between 10 and 500 characters'),
  
  body('platform')
    .isIn(['ios', 'android', 'web', 'windows', 'macos', 'linux'])
    .withMessage('Platform must be one of: ios, android, web, windows, macos, linux'),
  
  body('deviceId')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Device ID must be less than 255 characters'),
  
  body('appVersion')
    .optional()
    .isLength({ max: 20 })
    .withMessage('App version must be less than 20 characters')
];

// Preferences validation
const updatePreferencesValidation = [
  body('pushEnabled')
    .optional()
    .isBoolean()
    .withMessage('Push enabled must be a boolean'),
  
  body('pushCategories')
    .optional()
    .isObject()
    .withMessage('Push categories must be an object'),
  
  body('pushQuietHours')
    .optional()
    .isObject()
    .withMessage('Push quiet hours must be an object'),
  
  body('pushQuietHours.enabled')
    .optional()
    .isBoolean()
    .withMessage('Quiet hours enabled must be a boolean'),
  
  body('pushQuietHours.start')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Quiet hours start must be in HH:MM format'),
  
  body('pushQuietHours.end')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Quiet hours end must be in HH:MM format'),
  
  body('emailEnabled')
    .optional()
    .isBoolean()
    .withMessage('Email enabled must be a boolean'),
  
  body('emailCategories')
    .optional()
    .isObject()
    .withMessage('Email categories must be an object'),
  
  body('emailFrequency')
    .optional()
    .isIn(['immediate', 'daily', 'weekly', 'never'])
    .withMessage('Email frequency must be one of: immediate, daily, weekly, never'),
  
  body('smsEnabled')
    .optional()
    .isBoolean()
    .withMessage('SMS enabled must be a boolean'),
  
  body('smsCategories')
    .optional()
    .isObject()
    .withMessage('SMS categories must be an object'),
  
  body('inAppEnabled')
    .optional()
    .isBoolean()
    .withMessage('In-app enabled must be a boolean'),
  
  body('inAppCategories')
    .optional()
    .isObject()
    .withMessage('In-app categories must be an object'),
  
  body('language')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language must be between 2 and 10 characters'),
  
  body('timezone')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Timezone must be between 1 and 50 characters')
];

// Channel preferences validation
const updateChannelPreferencesValidation = [
  param('channel')
    .isIn(['push', 'email', 'sms', 'in_app'])
    .withMessage('Channel must be one of: push, email, sms, in_app'),
  
  body('enabled')
    .isBoolean()
    .withMessage('Enabled must be a boolean'),
  
  body('categories')
    .optional()
    .isObject()
    .withMessage('Categories must be an object')
];

// Quiet hours validation
const updateQuietHoursValidation = [
  body('enabled')
    .isBoolean()
    .withMessage('Enabled must be a boolean'),
  
  body('start')
    .if(body('enabled').equals(true))
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('end')
    .if(body('enabled').equals(true))
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('timezone')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Timezone must be between 1 and 50 characters')
];

// User setting validation
const updateUserSettingValidation = [
  param('settingKey')
    .isLength({ min: 1, max: 100 })
    .withMessage('Setting key must be between 1 and 100 characters'),
  
  body('value')
    .exists()
    .withMessage('Value is required')
];

// Bulk user settings validation
const bulkUpdateUserSettingsValidation = [
  body('settings')
    .isObject()
    .withMessage('Settings must be an object')
    .custom((settings) => {
      const keys = Object.keys(settings);
      if (keys.length === 0) {
        throw new Error('Settings object cannot be empty');
      }
      if (keys.length > 50) {
        throw new Error('Cannot update more than 50 settings at once');
      }
      return true;
    })
];

// Test notification validation
const testNotificationValidation = [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('channel')
    .isIn(['push', 'email', 'sms', 'in_app'])
    .withMessage('Channel must be one of: push, email, sms, in_app'),
  
  body('templateId')
    .optional()
    .isUUID()
    .withMessage('Template ID must be a valid UUID'),
  
  body('templateData')
    .optional()
    .isObject()
    .withMessage('Template data must be an object'),
  
  body('testMode')
    .optional()
    .isBoolean()
    .withMessage('Test mode must be a boolean')
];

// Template validation
const createTemplateValidation = [
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Template name must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Template name can only contain letters, numbers, underscores, and hyphens'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('category')
    .isIn(['delivery_update', 'new_request', 'payment', 'system', 'promotional', 'security'])
    .withMessage('Category must be one of the valid notification categories'),
  
  body('pushTemplate')
    .optional()
    .isObject()
    .withMessage('Push template must be an object'),
  
  body('emailTemplate')
    .optional()
    .isObject()
    .withMessage('Email template must be an object'),
  
  body('smsTemplate')
    .optional()
    .isObject()
    .withMessage('SMS template must be an object'),
  
  body('inAppTemplate')
    .optional()
    .isObject()
    .withMessage('In-app template must be an object'),
  
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array')
];

// Parameter validations
const uuidParam = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`)
];

// Query validations
const paginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const dateRangeQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(endDate);
        if (end <= start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    })
];

module.exports = {
  sendNotificationValidation,
  sendCustomNotificationValidation,
  sendBulkNotificationsValidation,
  deviceTokenValidation,
  updatePreferencesValidation,
  updateChannelPreferencesValidation,
  updateQuietHoursValidation,
  updateUserSettingValidation,
  bulkUpdateUserSettingsValidation,
  testNotificationValidation,
  createTemplateValidation,
  uuidParam,
  paginationQuery,
  dateRangeQuery
};