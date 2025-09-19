// Provider configurations for notification channels
const logger = require('./logger').createComponentLogger('PROVIDERS');

// Firebase Cloud Messaging configuration
const firebaseConfig = {
  type: process.env.FIREBASE_TYPE || 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
  token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

// SendGrid configuration
const sendGridConfig = {
  apiKey: process.env.SENDGRID_API_KEY,
  from: {
    email: process.env.SENDGRID_FROM_EMAIL || 'noreply@p2pdelivery.com',
    name: process.env.SENDGRID_FROM_NAME || 'P2P Delivery'
  },
  replyTo: process.env.SENDGRID_REPLY_TO || 'support@p2pdelivery.com',
  webhookUrl: process.env.SENDGRID_WEBHOOK_URL,
  templates: {
    default: process.env.SENDGRID_DEFAULT_TEMPLATE_ID,
    welcome: process.env.SENDGRID_WELCOME_TEMPLATE_ID,
    delivery_update: process.env.SENDGRID_DELIVERY_UPDATE_TEMPLATE_ID,
    receipt: process.env.SENDGRID_RECEIPT_TEMPLATE_ID
  }
};

// Twilio configuration
const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  from: process.env.TWILIO_FROM_NUMBER,
  webhookUrl: process.env.TWILIO_WEBHOOK_URL,
  statusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL
};

// Apple Push Notification Service configuration
const apnsConfig = {
  keyId: process.env.APNS_KEY_ID,
  teamId: process.env.APNS_TEAM_ID,
  bundleId: process.env.APNS_BUNDLE_ID,
  key: process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  production: process.env.NODE_ENV === 'production',
  defaultTopic: process.env.APNS_DEFAULT_TOPIC || 'com.p2pdelivery.app'
};

// Socket.IO configuration for in-app notifications
const socketConfig = {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
};

// Email provider fallback configuration
const emailProviders = {
  primary: 'sendgrid',
  fallback: 'nodemailer',
  nodemailer: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    from: {
      email: process.env.SMTP_FROM_EMAIL || 'noreply@p2pdelivery.com',
      name: process.env.SMTP_FROM_NAME || 'P2P Delivery'
    }
  }
};

// SMS provider fallback configuration
const smsProviders = {
  primary: 'twilio',
  fallback: 'aws_sns',
  aws_sns: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    defaultSenderId: process.env.AWS_SNS_SENDER_ID || 'P2PDelivery'
  }
};

// Push notification provider configuration
const pushProviders = {
  android: {
    primary: 'fcm',
    fallback: null
  },
  ios: {
    primary: 'fcm',
    fallback: 'apns'
  },
  web: {
    primary: 'fcm',
    fallback: null
  }
};

// Rate limiting configuration
const rateLimits = {
  push: {
    perUser: {
      max: 100,
      window: 3600 // 1 hour
    },
    global: {
      max: 10000,
      window: 60 // 1 minute
    }
  },
  email: {
    perUser: {
      max: 50,
      window: 3600 // 1 hour
    },
    global: {
      max: 5000,
      window: 60 // 1 minute
    }
  },
  sms: {
    perUser: {
      max: 10,
      window: 3600 // 1 hour
    },
    global: {
      max: 1000,
      window: 60 // 1 minute
    }
  }
};

// Retry configuration
const retryConfig = {
  push: {
    attempts: 3,
    backoff: 'exponential',
    delay: 1000, // 1 second
    maxDelay: 30000 // 30 seconds
  },
  email: {
    attempts: 5,
    backoff: 'exponential',
    delay: 2000, // 2 seconds
    maxDelay: 60000 // 1 minute
  },
  sms: {
    attempts: 3,
    backoff: 'exponential',
    delay: 1000, // 1 second
    maxDelay: 30000 // 30 seconds
  },
  webhook: {
    attempts: 5,
    backoff: 'exponential',
    delay: 5000, // 5 seconds
    maxDelay: 300000 // 5 minutes
  }
};

// Template configuration
const templateConfig = {
  engine: 'handlebars',
  cache: true,
  cacheTTL: 1800, // 30 minutes
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
  fallbackLanguage: 'en'
};

// Analytics configuration
const analyticsConfig = {
  enabled: process.env.ANALYTICS_ENABLED !== 'false',
  trackDelivery: true,
  trackOpens: true,
  trackClicks: true,
  trackUnsubscribes: true,
  batchSize: 100,
  flushInterval: 30000, // 30 seconds
  retentionDays: 90
};

// Webhook configuration
const webhookConfig = {
  timeout: 10000, // 10 seconds
  maxRetries: 5,
  retryDelay: 5000, // 5 seconds
  verifySSL: process.env.NODE_ENV === 'production',
  userAgent: 'P2P-Delivery-Webhooks/1.0',
  maxPayloadSize: '1MB'
};

// Queue configuration
const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  },
  queues: {
    notifications: {
      name: 'notifications',
      concurrency: 10
    },
    bulk: {
      name: 'bulk-notifications',
      concurrency: 5
    },
    webhooks: {
      name: 'webhooks',
      concurrency: 20
    },
    analytics: {
      name: 'analytics',
      concurrency: 5
    }
  }
};

// Validation function for required configurations
const validateConfigurations = () => {
  const errors = [];

  // Validate Firebase configuration
  if (!firebaseConfig.project_id) {
    errors.push('FIREBASE_PROJECT_ID is required for push notifications');
  }
  if (!firebaseConfig.private_key) {
    errors.push('FIREBASE_PRIVATE_KEY is required for push notifications');
  }
  if (!firebaseConfig.client_email) {
    errors.push('FIREBASE_CLIENT_EMAIL is required for push notifications');
  }

  // Validate SendGrid configuration
  if (!sendGridConfig.apiKey) {
    logger.warn('SENDGRID_API_KEY not provided, email notifications will be disabled');
  }

  // Validate Twilio configuration
  if (!twilioConfig.accountSid || !twilioConfig.authToken) {
    logger.warn('Twilio credentials not provided, SMS notifications will be disabled');
  }

  // Log warnings for missing optional configurations
  if (!apnsConfig.keyId) {
    logger.info('APNS configuration not provided, using FCM for iOS push notifications');
  }

  if (errors.length > 0) {
    logger.error('Configuration validation failed:', errors);
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }

  logger.info('Provider configurations validated successfully');
};

module.exports = {
  firebase: firebaseConfig,
  sendGrid: sendGridConfig,
  twilio: twilioConfig,
  apns: apnsConfig,
  socket: socketConfig,
  emailProviders,
  smsProviders,
  pushProviders,
  rateLimits,
  retryConfig,
  templateConfig,
  analyticsConfig,
  webhookConfig,
  queueConfig,
  validateConfigurations
};