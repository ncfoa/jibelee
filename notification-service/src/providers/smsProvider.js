const twilio = require('twilio');
const AWS = require('aws-sdk');
const { smsLogger } = require('../config/logger');
const { twilio: twilioConfig, smsProviders } = require('../config/providers');

class SMSProvider {
  constructor() {
    this.channel = 'sms';
    this.primaryProvider = 'twilio';
    this.fallbackProvider = 'aws_sns';
    this.twilioInitialized = false;
    this.snsInitialized = false;
    this.twilioClient = null;
    this.snsClient = null;
    this.initialize();
  }

  initialize() {
    this.initializeTwilio();
    this.initializeAWSSNS();
  }

  initializeTwilio() {
    try {
      if (twilioConfig.accountSid && twilioConfig.authToken) {
        this.twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
        this.twilioInitialized = true;
        smsLogger.info('Twilio SMS client initialized successfully');
      } else {
        smsLogger.warn('Twilio credentials not provided');
      }
    } catch (error) {
      smsLogger.error('Failed to initialize Twilio:', error);
      this.twilioInitialized = false;
    }
  }

  initializeAWSSNS() {
    try {
      const awsConfig = smsProviders.aws_sns;
      if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
        AWS.config.update({
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          region: awsConfig.region
        });
        
        this.snsClient = new AWS.SNS();
        this.snsInitialized = true;
        smsLogger.info('AWS SNS client initialized successfully');
      } else {
        smsLogger.warn('AWS SNS credentials not provided');
      }
    } catch (error) {
      smsLogger.error('Failed to initialize AWS SNS:', error);
      this.snsInitialized = false;
    }
  }

  async send(userId, content) {
    try {
      // Try primary provider first
      if (this.twilioInitialized) {
        return await this.sendWithTwilio(userId, content);
      }
      
      // Fallback to AWS SNS
      if (this.snsInitialized) {
        smsLogger.info('Using fallback SMS provider (AWS SNS)');
        return await this.sendWithAWSSNS(userId, content);
      }
      
      throw new Error('No SMS providers available');

    } catch (error) {
      smsLogger.error('SMS send failed:', error);
      
      // Try fallback if primary failed
      if (this.twilioInitialized && this.snsInitialized && 
          error.message.includes('Twilio')) {
        try {
          smsLogger.info('Attempting fallback to AWS SNS after Twilio failure');
          return await this.sendWithAWSSNS(userId, content);
        } catch (fallbackError) {
          smsLogger.error('Fallback SMS provider also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  async sendWithTwilio(userId, content) {
    try {
      // Get user phone number
      const phoneNumber = await this.getUserPhoneNumber(userId);
      
      if (!phoneNumber) {
        throw new Error('User phone number not found or not verified');
      }

      // Validate and format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Prepare message
      const messageOptions = {
        body: content.body || content.message,
        to: formattedPhone,
        from: content.from || twilioConfig.from || twilioConfig.messagingServiceSid
      };

      // Use messaging service if available
      if (twilioConfig.messagingServiceSid && !content.from) {
        messageOptions.messagingServiceSid = twilioConfig.messagingServiceSid;
        delete messageOptions.from;
      }

      // Add status callback if configured
      if (twilioConfig.statusCallbackUrl) {
        messageOptions.statusCallback = twilioConfig.statusCallbackUrl;
        messageOptions.provideFeedback = true;
      }

      // Add media URLs if provided (MMS)
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        messageOptions.mediaUrl = content.mediaUrls;
      }

      // Set validity period
      if (content.validityPeriod) {
        messageOptions.validityPeriod = content.validityPeriod;
      }

      const message = await this.twilioClient.messages.create(messageOptions);
      
      smsLogger.info('SMS sent successfully via Twilio', {
        userId,
        recipient: formattedPhone,
        messageSid: message.sid,
        status: message.status
      });

      return {
        externalId: message.sid,
        provider: 'twilio',
        status: this.mapTwilioStatus(message.status),
        recipient: formattedPhone,
        segments: message.numSegments,
        cost: this.calculateTwilioCost(message.numSegments, formattedPhone)
      };

    } catch (error) {
      smsLogger.error('Twilio SMS send failed:', error);
      
      if (error.code) {
        throw new Error(`Twilio error ${error.code}: ${error.message}`);
      }
      
      throw error;
    }
  }

  async sendWithAWSSNS(userId, content) {
    try {
      const phoneNumber = await this.getUserPhoneNumber(userId);
      
      if (!phoneNumber) {
        throw new Error('User phone number not found or not verified');
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const params = {
        Message: content.body || content.message,
        PhoneNumber: formattedPhone,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: content.priority === 'urgent' ? 'Transactional' : 'Promotional'
          }
        }
      };

      // Add sender ID if configured
      const awsConfig = smsProviders.aws_sns;
      if (awsConfig.defaultSenderId) {
        params.MessageAttributes['AWS.SNS.SMS.SenderID'] = {
          DataType: 'String',
          StringValue: awsConfig.defaultSenderId
        };
      }

      // Set max price per message
      if (content.maxPrice) {
        params.MessageAttributes['AWS.SNS.SMS.MaxPrice'] = {
          DataType: 'Number',
          StringValue: content.maxPrice.toString()
        };
      }

      const result = await this.snsClient.publish(params).promise();
      
      smsLogger.info('SMS sent successfully via AWS SNS', {
        userId,
        recipient: formattedPhone,
        messageId: result.MessageId
      });

      return {
        externalId: result.MessageId,
        provider: 'aws_sns',
        status: 'sent',
        recipient: formattedPhone
      };

    } catch (error) {
      smsLogger.error('AWS SNS SMS send failed:', error);
      throw error;
    }
  }

  async sendBulk(notifications) {
    const results = [];
    const batchSize = 10; // Process in smaller batches for SMS
    
    try {
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < notifications.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      smsLogger.info(`Bulk SMS completed`, {
        total: notifications.length,
        successful,
        failed
      });

      return {
        successful,
        failed,
        results
      };

    } catch (error) {
      smsLogger.error('Bulk SMS send failed:', error);
      throw error;
    }
  }

  async processBatch(batch) {
    const results = [];
    
    for (const notification of batch) {
      try {
        const result = await this.send(notification.userId, notification.content);
        results.push({
          userId: notification.userId,
          success: true,
          ...result
        });
      } catch (error) {
        results.push({
          userId: notification.userId,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async getUserPhoneNumber(userId) {
    // In a real implementation, this would call the user service
    // For now, we'll simulate it
    
    // This should be replaced with actual user service call
    // const userService = require('../services/userService');
    // const user = await userService.getUser(userId);
    // return user.phoneNumber;
    
    // Temporary implementation for development
    return `+1555${userId.substring(0, 7).replace(/\D/g, '').padStart(7, '0')}`;
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assume US for now)
    if (cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
    
    // Add + prefix
    if (!phoneNumber.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  validatePhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  mapTwilioStatus(twilioStatus) {
    const statusMap = {
      'queued': 'sent',
      'sending': 'sent', 
      'sent': 'sent',
      'delivered': 'delivered',
      'undelivered': 'failed',
      'failed': 'failed',
      'received': 'delivered'
    };
    
    return statusMap[twilioStatus] || 'unknown';
  }

  calculateTwilioCost(segments, phoneNumber) {
    // Simplified cost calculation (actual costs vary by destination)
    const baseRate = phoneNumber.startsWith('+1') ? 0.0075 : 0.05; // US vs international
    return segments * baseRate;
  }

  async getDeliveryStatus(messageId, provider = 'twilio') {
    try {
      if (provider === 'twilio' && this.twilioInitialized) {
        const message = await this.twilioClient.messages(messageId).fetch();
        return {
          messageId,
          status: this.mapTwilioStatus(message.status),
          provider: 'twilio',
          errorCode: message.errorCode,
          errorMessage: message.errorMessage,
          dateCreated: message.dateCreated,
          dateSent: message.dateSent,
          dateUpdated: message.dateUpdated
        };
      }
      
      // AWS SNS doesn't provide delivery status lookup
      return {
        messageId,
        status: 'unknown',
        provider,
        message: 'Status lookup not available for this provider'
      };

    } catch (error) {
      smsLogger.error('Failed to get delivery status:', error);
      return {
        messageId,
        status: 'error',
        provider,
        error: error.message
      };
    }
  }

  async handleWebhook(webhookData, provider = 'twilio') {
    try {
      if (provider === 'twilio') {
        return await this.handleTwilioWebhook(webhookData);
      }
      
      return null;
    } catch (error) {
      smsLogger.error('Webhook processing failed:', error);
      throw error;
    }
  }

  async handleTwilioWebhook(webhookData) {
    const {
      MessageSid,
      MessageStatus,
      To,
      From,
      ErrorCode,
      ErrorMessage
    } = webhookData;

    smsLogger.info('Processing Twilio SMS webhook', {
      messageSid: MessageSid,
      status: MessageStatus,
      to: To,
      errorCode: ErrorCode
    });

    return {
      messageId: MessageSid,
      status: this.mapTwilioStatus(MessageStatus),
      recipient: To,
      sender: From,
      errorCode: ErrorCode,
      errorMessage: ErrorMessage,
      timestamp: new Date(),
      processed: true
    };
  }

  async testConnection() {
    const results = {
      twilio: false,
      aws_sns: false
    };

    // Test Twilio
    if (this.twilioInitialized) {
      try {
        await this.twilioClient.api.accounts(twilioConfig.accountSid).fetch();
        results.twilio = true;
      } catch (error) {
        smsLogger.error('Twilio connection test failed:', error);
      }
    }

    // Test AWS SNS
    if (this.snsInitialized) {
      try {
        await this.snsClient.getSMSAttributes().promise();
        results.aws_sns = true;
      } catch (error) {
        smsLogger.error('AWS SNS connection test failed:', error);
      }
    }

    return results;
  }

  async getAccountBalance() {
    const balances = {};

    if (this.twilioInitialized) {
      try {
        const account = await this.twilioClient.api.accounts(twilioConfig.accountSid).fetch();
        balances.twilio = {
          balance: account.balance,
          currency: 'USD'
        };
      } catch (error) {
        smsLogger.error('Failed to get Twilio account balance:', error);
      }
    }

    return balances;
  }

  async getSMSUsage(startDate, endDate) {
    const usage = {};

    if (this.twilioInitialized) {
      try {
        const messages = await this.twilioClient.usage.records.list({
          category: 'sms',
          startDate: startDate,
          endDate: endDate
        });

        usage.twilio = {
          totalMessages: messages.reduce((sum, record) => sum + parseInt(record.count), 0),
          totalCost: messages.reduce((sum, record) => sum + parseFloat(record.price), 0),
          currency: 'USD'
        };
      } catch (error) {
        smsLogger.error('Failed to get Twilio usage:', error);
      }
    }

    return usage;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getProviderInfo() {
    return {
      name: 'SMS Provider',
      channel: this.channel,
      primaryProvider: this.primaryProvider,
      fallbackProvider: this.fallbackProvider,
      twilioInitialized: this.twilioInitialized,
      snsInitialized: this.snsInitialized,
      features: [
        'single_send',
        'bulk_send',
        'delivery_status',
        'webhooks',
        'mms_support',
        'international',
        'fallback_provider'
      ]
    };
  }
}

module.exports = SMSProvider;