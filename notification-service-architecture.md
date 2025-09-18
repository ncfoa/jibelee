# Notification Service - Detailed Architecture

## 🏗️ Service Overview

The Notification Service provides comprehensive multi-channel notification delivery for the P2P Delivery Platform, including push notifications, email, SMS, in-app notifications, and webhook integrations. It features intelligent delivery optimization, template management, and analytics.

**Port:** 3009  
**Base URL:** `/api/v1/notifications`  
**Database:** `notification_db` (PostgreSQL)

## 🎯 Core Responsibilities

### Primary Functions
- **Multi-channel Delivery**: Push notifications, email, SMS, and in-app messages
- **Template Management**: Dynamic template system with personalization
- **Smart Delivery**: Intelligent timing and channel selection
- **Preference Management**: User-controlled notification preferences
- **Analytics & Tracking**: Comprehensive delivery and engagement metrics
- **Webhook Integration**: External system integration capabilities
- **Bulk Operations**: Mass notification campaigns and announcements

### Key Features
- **Real-time Delivery**: Sub-second push notification delivery
- **Template Engine**: Dynamic content generation with variables
- **A/B Testing**: Message optimization and performance testing
- **Delivery Optimization**: Best time and channel selection
- **International Support**: Multi-language and timezone-aware delivery
- **Fallback Mechanisms**: Automatic channel failover for critical messages

## 🗄️ Database Schema

### Core Tables

#### 1. Notification Templates Table
```sql
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category notification_category_enum NOT NULL,
    
    -- Template content for different channels
    push_template JSONB,
    email_template JSONB,
    sms_template JSONB,
    in_app_template JSONB,
    
    variables JSONB DEFAULT '[]', -- Array of variable definitions
    targeting JSONB DEFAULT '{}', -- Targeting conditions
    
    status template_status_enum NOT NULL DEFAULT 'active',
    version INTEGER DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);
```

#### 2. Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    template_id UUID,
    
    notification_type notification_type_enum NOT NULL,
    category notification_category_enum NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Channel-specific data
    push_data JSONB,
    email_data JSONB,
    sms_data JSONB,
    in_app_data JSONB,
    
    status notification_status_enum NOT NULL DEFAULT 'sent',
    priority notification_priority_enum NOT NULL DEFAULT 'normal',
    
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    clicked_at TIMESTAMP,
    
    -- Tracking data
    external_id VARCHAR(255), -- Provider-specific ID (FCM, etc.)
    failure_reason TEXT,
    
    -- Related entities
    delivery_id UUID,
    trip_id UUID,
    
    metadata JSONB DEFAULT '{}'
);
```

#### 3. Notification Preferences Table
```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Channel preferences
    push_enabled BOOLEAN DEFAULT TRUE,
    push_categories JSONB DEFAULT '{}',
    push_quiet_hours JSONB,
    
    email_enabled BOOLEAN DEFAULT TRUE,
    email_categories JSONB DEFAULT '{}',
    email_frequency VARCHAR(20) DEFAULT 'immediate',
    
    sms_enabled BOOLEAN DEFAULT FALSE,
    sms_categories JSONB DEFAULT '{}',
    
    in_app_enabled BOOLEAN DEFAULT TRUE,
    in_app_categories JSONB DEFAULT '{}',
    
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Device Tokens Table
```sql
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token VARCHAR(500) NOT NULL,
    platform platform_enum NOT NULL,
    device_id VARCHAR(255),
    app_version VARCHAR(20),
    
    active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. Bulk Notifications Table
```sql
CREATE TABLE bulk_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID,
    operation bulk_operation_enum NOT NULL,
    status bulk_status_enum NOT NULL DEFAULT 'processing',
    
    total_recipients INTEGER NOT NULL,
    processed_count INTEGER DEFAULT 0,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    batch_size INTEGER DEFAULT 100,
    delay_between_batches INTEGER DEFAULT 10, -- seconds
    
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);
```

#### 6. Notification Webhooks Table
```sql
CREATE TABLE notification_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(500) NOT NULL,
    events TEXT[] NOT NULL, -- Array of event types
    secret VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    
    filters JSONB DEFAULT '{}', -- Event filtering criteria
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_triggered_at TIMESTAMP,
    
    -- Statistics
    total_attempts INTEGER DEFAULT 0,
    successful_attempts INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0
);
```

### Enums
```sql
CREATE TYPE notification_category_enum AS ENUM (
    'delivery_update', 'new_request', 'payment', 'system', 'promotional', 'security'
);

CREATE TYPE template_status_enum AS ENUM ('active', 'inactive', 'draft');

CREATE TYPE notification_type_enum AS ENUM ('push', 'email', 'sms', 'in_app');

CREATE TYPE notification_status_enum AS ENUM ('sent', 'delivered', 'read', 'failed', 'bounced');

CREATE TYPE notification_priority_enum AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE platform_enum AS ENUM ('ios', 'android', 'web', 'windows', 'macos', 'linux');

CREATE TYPE bulk_operation_enum AS ENUM ('send', 'cancel', 'reschedule');

CREATE TYPE bulk_status_enum AS ENUM ('processing', 'completed', 'failed', 'canceled');
```

## 🔧 Technology Stack

### Backend Framework
```javascript
// Node.js with Express.js or Python with FastAPI
const express = require('express');
const firebase = require('firebase-admin');
const twilio = require('twilio');
const sendgrid = require('@sendgrid/mail');
const bull = require('bull');
const handlebars = require('handlebars');
```

### Key Dependencies
- **Express.js/FastAPI**: Web framework
- **Firebase Admin**: Push notifications (FCM)
- **Twilio**: SMS delivery
- **SendGrid**: Email delivery
- **Bull Queue**: Background job processing
- **Handlebars**: Template engine
- **Socket.io**: Real-time in-app notifications
- **Moment.js**: Timezone handling

### External Integrations
- **Firebase Cloud Messaging**: Push notifications
- **Apple Push Notification Service**: iOS push notifications
- **SendGrid/Mailgun**: Email delivery
- **Twilio/AWS SNS**: SMS delivery
- **Webhook endpoints**: External system integrations

## 📊 API Endpoints (20 Total)

### Template Management Endpoints

#### 1. Create Notification Template
```http
POST /api/v1/notifications/templates
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "delivery_picked_up",
  "description": "Notification when delivery is picked up",
  "category": "delivery_update",
  "pushTemplate": {
    "title": "📦 Package Picked Up",
    "body": "{{travelerName}} has picked up your package for delivery to {{deliveryAddress}}",
    "icon": "pickup_icon",
    "sound": "default",
    "clickAction": "DELIVERY_TRACKING",
    "data": {
      "deliveryId": "{{deliveryId}}",
      "type": "pickup_confirmation"
    }
  },
  "emailTemplate": {
    "subject": "Your package has been picked up - {{deliveryNumber}}",
    "htmlBody": "<h2>Great news!</h2><p>{{travelerName}} has picked up your package...</p>",
    "textBody": "Your package {{deliveryNumber}} has been picked up by {{travelerName}}..."
  },
  "smsTemplate": {
    "body": "📦 Your package {{deliveryNumber}} has been picked up by {{travelerName}}. Track: {{trackingUrl}}"
  },
  "inAppTemplate": {
    "title": "Package Picked Up",
    "message": "{{travelerName}} has your package and is on the way!",
    "actionButton": {
      "text": "Track Delivery",
      "action": "OPEN_TRACKING",
      "data": { "deliveryId": "{{deliveryId}}" }
    }
  },
  "variables": [
    { "name": "travelerName", "type": "string", "required": true },
    { "name": "deliveryAddress", "type": "string", "required": true },
    { "name": "deliveryNumber", "type": "string", "required": true },
    { "name": "deliveryId", "type": "uuid", "required": true },
    { "name": "trackingUrl", "type": "url", "required": false }
  ]
}
```

#### 2. Get Notification Templates
```http
GET /api/v1/notifications/templates
Authorization: Bearer <admin_access_token>
Query Parameters:
- category: delivery_update|payment|system
- status: active|inactive|draft
- page: 1
- limit: 50
```

#### 3. Update Template
```http
PUT /api/v1/notifications/templates/:templateId
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "pushTemplate": {
    "title": "📦 Package Picked Up - Updated",
    "body": "{{travelerName}} has successfully picked up your package!"
  },
  "status": "active"
}
```

#### 4. Delete Template
```http
DELETE /api/v1/notifications/templates/:templateId
Authorization: Bearer <admin_access_token>
```

### Notification Sending Endpoints

#### 5. Send Single Notification
```http
POST /api/v1/notifications/send
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "templateId": "template-uuid",
  "channels": ["push", "email"],
  "variables": {
    "travelerName": "John Doe",
    "deliveryAddress": "123 Oak Street, Boston, MA",
    "deliveryNumber": "DEL-001234",
    "deliveryId": "delivery-uuid"
  },
  "priority": "high",
  "scheduleAt": "2025-01-15T14:30:00Z",
  "metadata": {
    "source": "delivery_service",
    "campaign": "pickup_notifications"
  }
}
```

#### 6. Send Custom Notification
```http
POST /api/v1/notifications/send-custom
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "type": "push",
  "title": "Custom Notification",
  "message": "This is a custom message",
  "data": {
    "customField": "customValue"
  },
  "priority": "normal"
}
```

#### 7. Send Bulk Notifications
```http
POST /api/v1/notifications/send-bulk
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "templateId": "template-uuid",
  "recipients": [
    {
      "userId": "user1-uuid",
      "variables": { "name": "John", "amount": "$25.00" }
    },
    {
      "userId": "user2-uuid",
      "variables": { "name": "Jane", "amount": "$30.00" }
    }
  ],
  "channels": ["push", "email"],
  "batchSize": 100,
  "delayBetweenBatches": 10,
  "scheduleAt": "2025-01-15T09:00:00Z"
}
```

### User Preference Management Endpoints

#### 8. Get User Preferences
```http
GET /api/v1/notifications/preferences
Authorization: Bearer <access_token>
```

#### 9. Update User Preferences
```http
PUT /api/v1/notifications/preferences
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "pushEnabled": true,
  "pushCategories": {
    "delivery_update": true,
    "new_request": true,
    "payment": true,
    "promotional": false
  },
  "pushQuietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "timezone": "America/New_York"
  },
  "emailEnabled": true,
  "emailFrequency": "immediate",
  "emailCategories": {
    "delivery_update": true,
    "payment": true,
    "promotional": false
  },
  "smsEnabled": false,
  "language": "en",
  "timezone": "America/New_York"
}
```

#### 10. Register Device Token
```http
POST /api/v1/notifications/device-tokens
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "fcm_token_string_here",
  "platform": "ios",
  "deviceId": "device-uuid",
  "appVersion": "1.0.0"
}
```

#### 11. Update Device Token
```http
PUT /api/v1/notifications/device-tokens/:tokenId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "active": false
}
```

### Notification History & Analytics Endpoints

#### 12. Get User Notifications
```http
GET /api/v1/notifications/me
Authorization: Bearer <access_token>
Query Parameters:
- type: push|email|sms|in_app
- category: delivery_update|payment|system
- status: sent|delivered|read
- startDate: 2025-01-01
- endDate: 2025-01-31
- page: 1
- limit: 50
```

#### 13. Mark Notification as Read
```http
POST /api/v1/notifications/:notificationId/read
Authorization: Bearer <access_token>
```

#### 14. Mark Notification as Clicked
```http
POST /api/v1/notifications/:notificationId/clicked
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "clickedAt": "2025-01-15T10:30:00Z",
  "actionTaken": "OPEN_TRACKING"
}
```

#### 15. Get Notification Analytics
```http
GET /api/v1/notifications/analytics
Authorization: Bearer <admin_access_token>
Query Parameters:
- templateId: template-uuid
- category: delivery_update
- startDate: 2025-01-01
- endDate: 2025-01-31
- groupBy: day|week|month
```

### Webhook Management Endpoints

#### 16. Create Webhook
```http
POST /api/v1/notifications/webhooks
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "url": "https://external-system.com/webhook/notifications",
  "events": ["notification_sent", "notification_delivered", "notification_failed"],
  "secret": "webhook_secret_key",
  "filters": {
    "categories": ["delivery_update", "payment"],
    "priority": ["high", "urgent"]
  }
}
```

#### 17. Get Webhooks
```http
GET /api/v1/notifications/webhooks
Authorization: Bearer <admin_access_token>
```

#### 18. Update Webhook
```http
PUT /api/v1/notifications/webhooks/:webhookId
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "active": false,
  "events": ["notification_delivered"]
}
```

#### 19. Delete Webhook
```http
DELETE /api/v1/notifications/webhooks/:webhookId
Authorization: Bearer <admin_access_token>
```

### Testing & Debug Endpoints

#### 20. Test Notification
```http
POST /api/v1/notifications/test
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "templateId": "template-uuid",
  "userId": "test-user-uuid",
  "channels": ["push"],
  "variables": {
    "travelerName": "Test Traveler",
    "deliveryNumber": "TEST-001"
  }
}
```

## 🏗️ Service Architecture

### Directory Structure
```
notification-service/
├── src/
│   ├── controllers/
│   │   ├── notificationController.js
│   │   ├── templateController.js
│   │   ├── preferenceController.js
│   │   ├── webhookController.js
│   │   └── analyticsController.js
│   ├── models/
│   │   ├── Notification.js
│   │   ├── NotificationTemplate.js
│   │   ├── NotificationPreference.js
│   │   ├── DeviceToken.js
│   │   └── BulkNotification.js
│   ├── services/
│   │   ├── notificationService.js
│   │   ├── templateService.js
│   │   ├── deliveryOptimizationService.js
│   │   ├── analyticsService.js
│   │   └── webhookService.js
│   ├── providers/
│   │   ├── pushProvider.js
│   │   ├── emailProvider.js
│   │   ├── smsProvider.js
│   │   └── inAppProvider.js
│   ├── channels/
│   │   ├── fcmChannel.js
│   │   ├── apnsChannel.js
│   │   ├── sendgridChannel.js
│   │   ├── twilioChannel.js
│   │   └── socketChannel.js
│   ├── templates/
│   │   ├── templateEngine.js
│   │   ├── variableProcessor.js
│   │   └── localizationService.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── validationMiddleware.js
│   │   ├── rateLimitMiddleware.js
│   │   └── preferenceMiddleware.js
│   ├── routes/
│   │   ├── notificationRoutes.js
│   │   ├── templateRoutes.js
│   │   ├── preferenceRoutes.js
│   │   └── webhookRoutes.js
│   ├── utils/
│   │   ├── timezoneUtils.js
│   │   ├── localizationUtils.js
│   │   ├── validationUtils.js
│   │   └── analyticsUtils.js
│   ├── jobs/
│   │   ├── notificationDeliveryJob.js
│   │   ├── bulkNotificationJob.js
│   │   ├── retryFailedJob.js
│   │   └── analyticsJob.js
│   ├── config/
│   │   ├── database.js
│   │   ├── providers.js
│   │   ├── templates.js
│   │   └── webhooks.js
│   └── app.js
├── templates/
│   ├── email/
│   ├── sms/
│   └── push/
├── tests/
├── docker/
│   └── Dockerfile
├── package.json
└── README.md
```

### Core Components

#### 1. Notification Service
```javascript
class NotificationService {
  constructor() {
    this.pushProvider = new PushProvider();
    this.emailProvider = new EmailProvider();
    this.smsProvider = new SMSProvider();
    this.inAppProvider = new InAppProvider();
    this.templateEngine = new TemplateEngine();
    this.deliveryOptimization = new DeliveryOptimizationService();
  }

  async sendNotification(notificationData) {
    const {
      userId,
      templateId,
      channels = ['push'],
      variables = {},
      priority = 'normal',
      scheduleAt,
      metadata = {}
    } = notificationData;

    // Get user preferences
    const userPreferences = await this.getUserPreferences(userId);
    
    // Filter channels based on user preferences
    const allowedChannels = this.filterChannelsByPreferences(channels, userPreferences);
    
    if (allowedChannels.length === 0) {
      throw new NoAllowedChannelsError('User has disabled all requested notification channels');
    }

    // Get template
    const template = templateId ? 
      await this.templateRepository.findById(templateId) : 
      null;

    // Optimize delivery timing if not scheduled
    const optimizedSchedule = scheduleAt || 
      await this.deliveryOptimization.getOptimalDeliveryTime(userId, priority);

    const results = [];

    for (const channel of allowedChannels) {
      try {
        const result = await this.sendToChannel(
          channel,
          userId,
          template,
          variables,
          userPreferences,
          optimizedSchedule,
          priority,
          metadata
        );
        
        results.push({ channel, success: true, ...result });
      } catch (error) {
        console.error(`Failed to send ${channel} notification:`, error);
        results.push({ 
          channel, 
          success: false, 
          error: error.message 
        });

        // Try fallback channel for critical notifications
        if (priority === 'urgent' || priority === 'high') {
          await this.tryFallbackChannel(channel, userId, template, variables, userPreferences);
        }
      }
    }

    return {
      notificationId: crypto.randomBytes(8).toString('hex'),
      results,
      totalChannels: allowedChannels.length,
      successfulChannels: results.filter(r => r.success).length
    };
  }

  async sendToChannel(channel, userId, template, variables, preferences, scheduleAt, priority, metadata) {
    const channelProvider = this.getChannelProvider(channel);
    
    // Generate content from template
    const content = template ? 
      await this.templateEngine.generateContent(template, channel, variables, preferences.language) :
      this.createCustomContent(variables, channel);

    // Check quiet hours for non-urgent notifications
    if (priority !== 'urgent' && this.isInQuietHours(preferences, channel)) {
      scheduleAt = this.getNextAllowedTime(preferences, channel);
    }

    // Create notification record
    const notification = await this.notificationRepository.create({
      userId,
      templateId: template?.id,
      notificationType: channel,
      category: template?.category || 'system',
      title: content.title,
      message: content.message,
      pushData: channel === 'push' ? content : null,
      emailData: channel === 'email' ? content : null,
      smsData: channel === 'sms' ? content : null,
      inAppData: channel === 'in_app' ? content : null,
      priority,
      metadata
    });

    // Schedule or send immediately
    if (scheduleAt && scheduleAt > new Date()) {
      return this.scheduleNotification(notification.id, scheduleAt, channelProvider, content);
    } else {
      return this.sendImmediate(notification.id, channelProvider, content, userId);
    }
  }

  async sendImmediate(notificationId, channelProvider, content, userId) {
    try {
      const result = await channelProvider.send(userId, content);
      
      // Update notification with delivery info
      await this.notificationRepository.update(notificationId, {
        status: 'delivered',
        deliveredAt: new Date(),
        externalId: result.externalId
      });

      // Track analytics
      await this.analyticsService.trackDelivery(notificationId, 'delivered');

      // Trigger webhooks
      await this.webhookService.triggerWebhooks('notification_delivered', {
        notificationId,
        userId,
        channel: channelProvider.channel,
        deliveredAt: new Date()
      });

      return {
        notificationId,
        externalId: result.externalId,
        status: 'delivered'
      };

    } catch (error) {
      // Update notification with failure info
      await this.notificationRepository.update(notificationId, {
        status: 'failed',
        failedAt: new Date(),
        failureReason: error.message
      });

      // Track failure
      await this.analyticsService.trackDelivery(notificationId, 'failed', error.message);

      throw error;
    }
  }

  getChannelProvider(channel) {
    const providers = {
      push: this.pushProvider,
      email: this.emailProvider,
      sms: this.smsProvider,
      in_app: this.inAppProvider
    };

    return providers[channel];
  }

  filterChannelsByPreferences(requestedChannels, preferences) {
    return requestedChannels.filter(channel => {
      switch (channel) {
        case 'push':
          return preferences.pushEnabled;
        case 'email':
          return preferences.emailEnabled;
        case 'sms':
          return preferences.smsEnabled;
        case 'in_app':
          return preferences.inAppEnabled;
        default:
          return false;
      }
    });
  }
}
```

#### 2. Template Engine
```javascript
class TemplateEngine {
  constructor() {
    this.handlebars = require('handlebars');
    this.localizationService = new LocalizationService();
    this.setupHelpers();
  }

  setupHelpers() {
    // Register custom Handlebars helpers
    this.handlebars.registerHelper('currency', (amount, currency = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    });

    this.handlebars.registerHelper('date', (date, format = 'short') => {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: format
      }).format(new Date(date));
    });

    this.handlebars.registerHelper('time', (date, timezone = 'UTC') => {
      return new Intl.DateTimeFormat('en-US', {
        timeStyle: 'short',
        timeZone: timezone
      }).format(new Date(date));
    });
  }

  async generateContent(template, channel, variables, language = 'en') {
    const channelTemplate = this.getChannelTemplate(template, channel);
    
    if (!channelTemplate) {
      throw new TemplateNotFoundError(`No ${channel} template found`);
    }

    // Localize template if needed
    const localizedTemplate = await this.localizationService.localizeTemplate(
      channelTemplate,
      language
    );

    // Validate variables
    this.validateVariables(template.variables, variables);

    // Generate content based on channel
    switch (channel) {
      case 'push':
        return this.generatePushContent(localizedTemplate, variables);
      case 'email':
        return this.generateEmailContent(localizedTemplate, variables);
      case 'sms':
        return this.generateSMSContent(localizedTemplate, variables);
      case 'in_app':
        return this.generateInAppContent(localizedTemplate, variables);
      default:
        throw new UnsupportedChannelError(`Unsupported channel: ${channel}`);
    }
  }

  generatePushContent(template, variables) {
    const titleTemplate = this.handlebars.compile(template.title);
    const bodyTemplate = this.handlebars.compile(template.body);

    return {
      title: titleTemplate(variables),
      body: bodyTemplate(variables),
      icon: template.icon,
      sound: template.sound,
      clickAction: template.clickAction,
      data: this.processTemplateObject(template.data, variables)
    };
  }

  generateEmailContent(template, variables) {
    const subjectTemplate = this.handlebars.compile(template.subject);
    const htmlTemplate = this.handlebars.compile(template.htmlBody);
    const textTemplate = this.handlebars.compile(template.textBody || '');

    return {
      subject: subjectTemplate(variables),
      htmlBody: htmlTemplate(variables),
      textBody: textTemplate(variables),
      fromName: template.fromName || 'P2P Delivery',
      fromEmail: template.fromEmail || 'noreply@p2pdelivery.com',
      replyTo: template.replyTo,
      attachments: template.attachments
    };
  }

  generateSMSContent(template, variables) {
    const bodyTemplate = this.handlebars.compile(template.body);

    const content = {
      body: bodyTemplate(variables),
      from: template.from
    };

    // Ensure SMS doesn't exceed character limits
    if (content.body.length > 160) {
      console.warn(`SMS content exceeds 160 characters: ${content.body.length}`);
    }

    return content;
  }

  generateInAppContent(template, variables) {
    const titleTemplate = this.handlebars.compile(template.title);
    const messageTemplate = this.handlebars.compile(template.message);

    return {
      title: titleTemplate(variables),
      message: messageTemplate(variables),
      icon: template.icon,
      actionButton: template.actionButton ? {
        text: template.actionButton.text,
        action: template.actionButton.action,
        data: this.processTemplateObject(template.actionButton.data, variables)
      } : null,
      metadata: this.processTemplateObject(template.metadata || {}, variables)
    };
  }

  processTemplateObject(obj, variables) {
    if (typeof obj === 'string') {
      const template = this.handlebars.compile(obj);
      return template(variables);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.processTemplateObject(item, variables));
    }

    if (typeof obj === 'object' && obj !== null) {
      const processed = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = this.processTemplateObject(value, variables);
      }
      return processed;
    }

    return obj;
  }

  validateVariables(templateVariables, providedVariables) {
    const required = templateVariables.filter(v => v.required);
    const missing = required.filter(v => !(v.name in providedVariables));

    if (missing.length > 0) {
      throw new MissingVariablesError(
        `Missing required variables: ${missing.map(v => v.name).join(', ')}`
      );
    }
  }
}
```

#### 3. Push Provider (Firebase)
```javascript
class PushProvider {
  constructor() {
    this.fcm = firebase.messaging();
    this.channel = 'push';
  }

  async send(userId, content) {
    // Get user's device tokens
    const deviceTokens = await this.deviceTokenRepository.findActiveByUserId(userId);
    
    if (deviceTokens.length === 0) {
      throw new NoDeviceTokensError('No active device tokens found for user');
    }

    const results = [];
    
    for (const deviceToken of deviceTokens) {
      try {
        const message = this.buildMessage(content, deviceToken);
        const response = await this.fcm.send(message);
        
        results.push({
          tokenId: deviceToken.id,
          platform: deviceToken.platform,
          success: true,
          messageId: response
        });

        // Update token last used time
        await this.deviceTokenRepository.update(deviceToken.id, {
          lastUsedAt: new Date()
        });

      } catch (error) {
        console.error(`Failed to send push to token ${deviceToken.id}:`, error);
        
        results.push({
          tokenId: deviceToken.id,
          platform: deviceToken.platform,
          success: false,
          error: error.message
        });

        // Handle invalid tokens
        if (this.isInvalidTokenError(error)) {
          await this.deviceTokenRepository.update(deviceToken.id, {
            active: false
          });
        }
      }
    }

    const successfulSends = results.filter(r => r.success);
    
    if (successfulSends.length === 0) {
      throw new PushDeliveryFailedError('Failed to deliver push notification to any device');
    }

    return {
      externalId: successfulSends[0].messageId,
      deliveredDevices: successfulSends.length,
      totalDevices: deviceTokens.length,
      results
    };
  }

  buildMessage(content, deviceToken) {
    const baseMessage = {
      token: deviceToken.token,
      notification: {
        title: content.title,
        body: content.body
      },
      data: this.convertDataToStrings(content.data || {})
    };

    // Platform-specific customizations
    if (deviceToken.platform === 'ios') {
      baseMessage.apns = {
        payload: {
          aps: {
            sound: content.sound || 'default',
            badge: 1,
            'mutable-content': 1
          }
        }
      };
    } else if (deviceToken.platform === 'android') {
      baseMessage.android = {
        notification: {
          icon: content.icon,
          sound: content.sound || 'default',
          clickAction: content.clickAction
        },
        priority: 'high'
      };
    }

    return baseMessage;
  }

  convertDataToStrings(data) {
    const stringData = {};
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return stringData;
  }

  isInvalidTokenError(error) {
    return error.code === 'messaging/registration-token-not-registered' ||
           error.code === 'messaging/invalid-registration-token';
  }
}
```

#### 4. Email Provider (SendGrid)
```javascript
class EmailProvider {
  constructor() {
    this.sendgrid = require('@sendgrid/mail');
    this.sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
    this.channel = 'email';
  }

  async send(userId, content) {
    // Get user email
    const user = await this.userRepository.findById(userId);
    
    if (!user.email || !user.emailVerifiedAt) {
      throw new InvalidEmailError('User email not found or not verified');
    }

    const message = {
      to: user.email,
      from: {
        email: content.fromEmail,
        name: content.fromName
      },
      subject: content.subject,
      html: content.htmlBody,
      text: content.textBody,
      replyTo: content.replyTo,
      attachments: content.attachments,
      customArgs: {
        userId,
        notificationId: content.notificationId
      },
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    try {
      const response = await this.sendgrid.send(message);
      
      return {
        externalId: response[0].headers['x-message-id'],
        status: 'sent',
        recipient: user.email
      };

    } catch (error) {
      console.error('SendGrid error:', error);
      
      if (error.response) {
        const { status, body } = error.response;
        throw new EmailDeliveryError(`SendGrid error ${status}: ${JSON.stringify(body)}`);
      }
      
      throw new EmailDeliveryError(error.message);
    }
  }
}
```

#### 5. Delivery Optimization Service
```javascript
class DeliveryOptimizationService {
  async getOptimalDeliveryTime(userId, priority) {
    // Get user preferences and timezone
    const preferences = await this.getUserPreferences(userId);
    const timezone = preferences.timezone || 'UTC';
    
    // For urgent notifications, send immediately
    if (priority === 'urgent') {
      return new Date();
    }

    // Get user's historical engagement patterns
    const engagementPatterns = await this.getEngagementPatterns(userId);
    
    // Check quiet hours
    const now = moment().tz(timezone);
    const quietHours = preferences.pushQuietHours;
    
    if (this.isInQuietHours(now, quietHours)) {
      // Schedule for end of quiet hours
      return this.getEndOfQuietHours(quietHours, timezone);
    }

    // Find optimal time based on engagement patterns
    const optimalHour = this.findOptimalEngagementTime(engagementPatterns);
    
    if (optimalHour && this.isWithinBusinessHours(optimalHour, timezone)) {
      return moment().tz(timezone).hour(optimalHour).minute(0).second(0).toDate();
    }

    // Default to immediate delivery
    return new Date();
  }

  async getEngagementPatterns(userId) {
    // Analyze user's notification interaction history
    const interactions = await this.notificationRepository.getUserInteractionHistory(userId, 30); // 30 days
    
    const hourlyEngagement = {};
    
    interactions.forEach(interaction => {
      const hour = moment(interaction.readAt || interaction.clickedAt).hour();
      hourlyEngagement[hour] = (hourlyEngagement[hour] || 0) + 1;
    });

    return hourlyEngagement;
  }

  findOptimalEngagementTime(patterns) {
    if (Object.keys(patterns).length === 0) return null;
    
    // Find hour with highest engagement
    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  isInQuietHours(currentTime, quietHours) {
    if (!quietHours || !quietHours.enabled) return false;
    
    const start = moment(quietHours.start, 'HH:mm');
    const end = moment(quietHours.end, 'HH:mm');
    const current = moment(currentTime.format('HH:mm'), 'HH:mm');
    
    if (start.isBefore(end)) {
      // Same day quiet hours (e.g., 22:00 to 08:00 next day)
      return current.isBetween(start, end);
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00 next day)
      return current.isAfter(start) || current.isBefore(end);
    }
  }
}
```

#### 6. Webhook Service
```javascript
class WebhookService {
  constructor() {
    this.axios = require('axios');
    this.crypto = require('crypto');
  }

  async triggerWebhooks(eventType, eventData) {
    // Get active webhooks for this event type
    const webhooks = await this.webhookRepository.findActiveByEvent(eventType);
    
    for (const webhook of webhooks) {
      try {
        // Check if event matches webhook filters
        if (!this.matchesFilters(eventData, webhook.filters)) {
          continue;
        }

        await this.sendWebhook(webhook, eventType, eventData);
        
        // Update success statistics
        await this.webhookRepository.incrementStats(webhook.id, 'successful');
        
      } catch (error) {
        console.error(`Webhook ${webhook.id} failed:`, error);
        
        // Update failure statistics
        await this.webhookRepository.incrementStats(webhook.id, 'failed');
        
        // Schedule retry for critical webhooks
        if (this.isCriticalEvent(eventType)) {
          await this.scheduleWebhookRetry(webhook.id, eventType, eventData);
        }
      }
    }
  }

  async sendWebhook(webhook, eventType, eventData) {
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: eventData
    };

    // Generate signature for security
    const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
    
    const response = await this.axios.post(webhook.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'User-Agent': 'P2P-Delivery-Webhooks/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    // Update last triggered time
    await this.webhookRepository.update(webhook.id, {
      lastTriggeredAt: new Date()
    });

    return response.status;
  }

  generateSignature(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  matchesFilters(eventData, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }

    // Check category filters
    if (filters.categories && !filters.categories.includes(eventData.category)) {
      return false;
    }

    // Check priority filters
    if (filters.priority && !filters.priority.includes(eventData.priority)) {
      return false;
    }

    // Check user filters
    if (filters.userIds && !filters.userIds.includes(eventData.userId)) {
      return false;
    }

    return true;
  }
}
```

## 📈 Performance Optimization

### 1. Database Indexing
```sql
-- Notification indexes
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status, sent_at);
CREATE INDEX idx_notifications_type_category ON notifications(notification_type, category);
CREATE INDEX idx_notifications_external_id ON notifications(external_id);
CREATE INDEX idx_notifications_delivery_trip ON notifications(delivery_id, trip_id);

-- Template indexes
CREATE INDEX idx_templates_category_status ON notification_templates(category, status);
CREATE INDEX idx_templates_name ON notification_templates(name);

-- Preference indexes
CREATE INDEX idx_preferences_user_id ON notification_preferences(user_id);

-- Device token indexes
CREATE INDEX idx_device_tokens_user_active ON device_tokens(user_id, active) WHERE active = true;
CREATE INDEX idx_device_tokens_platform ON device_tokens(platform);

-- Analytics indexes
CREATE INDEX idx_notifications_analytics ON notifications(sent_at, notification_type, status);
CREATE INDEX idx_notifications_engagement ON notifications(user_id, read_at, clicked_at);
```

### 2. Caching Strategy
```javascript
class NotificationCacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async cacheUserPreferences(userId, preferences) {
    await this.redis.setex(`prefs:${userId}`, 3600, JSON.stringify(preferences)); // 1 hour
  }

  async getCachedPreferences(userId) {
    const cached = await this.redis.get(`prefs:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheTemplate(templateId, template) {
    await this.redis.setex(`template:${templateId}`, 1800, JSON.stringify(template)); // 30 min
  }

  async cacheDeviceTokens(userId, tokens) {
    await this.redis.setex(`tokens:${userId}`, 900, JSON.stringify(tokens)); // 15 min
  }
}
```

### 3. Queue Optimization
```javascript
class NotificationQueue {
  constructor() {
    this.highPriorityQueue = new Bull('notifications-high', {
      redis: process.env.REDIS_URL,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });

    this.normalPriorityQueue = new Bull('notifications-normal', {
      redis: process.env.REDIS_URL,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25
      }
    });

    this.setupProcessors();
  }

  async addNotificationJob(notificationData, priority = 'normal') {
    const queue = priority === 'high' || priority === 'urgent' ? 
      this.highPriorityQueue : this.normalPriorityQueue;

    return queue.add('send-notification', notificationData, {
      priority: this.getPriorityScore(priority),
      attempts: priority === 'urgent' ? 5 : 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  getPriorityScore(priority) {
    const scores = {
      urgent: 100,
      high: 75,
      normal: 50,
      low: 25
    };
    return scores[priority] || 50;
  }
}
```

## 🧪 Testing Strategy

### 1. Template Testing
```javascript
describe('TemplateEngine', () => {
  describe('generatePushContent', () => {
    it('should generate push notification content with variables', () => {
      const template = {
        title: 'Hello {{name}}!',
        body: 'Your delivery {{deliveryNumber}} is ready',
        data: { deliveryId: '{{deliveryId}}' }
      };

      const variables = {
        name: 'John',
        deliveryNumber: 'DEL-001',
        deliveryId: 'uuid-123'
      };

      const content = templateEngine.generatePushContent(template, variables);
      
      expect(content.title).toBe('Hello John!');
      expect(content.body).toBe('Your delivery DEL-001 is ready');
      expect(content.data.deliveryId).toBe('uuid-123');
    });
  });
});
```

### 2. Delivery Testing
```javascript
describe('NotificationService', () => {
  it('should send notification through multiple channels', async () => {
    const notificationData = {
      userId: 'user-123',
      templateId: 'template-123',
      channels: ['push', 'email'],
      variables: { name: 'John' }
    };

    const result = await notificationService.sendNotification(notificationData);
    
    expect(result.successfulChannels).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => r.success)).toBe(true);
  });
});
```

## 📊 Performance Benchmarks

### Expected Performance Metrics
- **Push Notification Delivery**: < 100ms average response time
- **Email Delivery**: < 2s average response time
- **SMS Delivery**: < 1s average response time
- **Template Processing**: < 50ms average response time
- **Bulk Operations**: 1000+ notifications/minute
- **Throughput**: 5000+ notifications/second per instance

This Notification Service architecture provides comprehensive multi-channel notification delivery with intelligent optimization, template management, and detailed analytics for the P2P Delivery Platform.