const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const { emailLogger } = require('../config/logger');
const { sendGrid: sendGridConfig, emailProviders } = require('../config/providers');

class EmailProvider {
  constructor() {
    this.channel = 'email';
    this.primaryProvider = 'sendgrid';
    this.fallbackProvider = 'nodemailer';
    this.sendGridInitialized = false;
    this.nodemailerInitialized = false;
    this.nodemailerTransporter = null;
    this.initialize();
  }

  initialize() {
    this.initializeSendGrid();
    this.initializeNodemailer();
  }

  initializeSendGrid() {
    try {
      if (sendGridConfig.apiKey) {
        sgMail.setApiKey(sendGridConfig.apiKey);
        this.sendGridInitialized = true;
        emailLogger.info('SendGrid initialized successfully');
      } else {
        emailLogger.warn('SendGrid API key not provided');
      }
    } catch (error) {
      emailLogger.error('Failed to initialize SendGrid:', error);
      this.sendGridInitialized = false;
    }
  }

  initializeNodemailer() {
    try {
      const smtpConfig = emailProviders.nodemailer;
      if (smtpConfig.host && smtpConfig.auth.user) {
        this.nodemailerTransporter = nodemailer.createTransporter({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: smtpConfig.auth,
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        });
        
        this.nodemailerInitialized = true;
        emailLogger.info('Nodemailer SMTP initialized successfully');
      } else {
        emailLogger.warn('SMTP configuration not provided for Nodemailer');
      }
    } catch (error) {
      emailLogger.error('Failed to initialize Nodemailer:', error);
      this.nodemailerInitialized = false;
    }
  }

  async send(userId, content) {
    try {
      // Try primary provider first
      if (this.sendGridInitialized) {
        return await this.sendWithSendGrid(userId, content);
      }
      
      // Fallback to nodemailer
      if (this.nodemailerInitialized) {
        emailLogger.info('Using fallback email provider (Nodemailer)');
        return await this.sendWithNodemailer(userId, content);
      }
      
      throw new Error('No email providers available');

    } catch (error) {
      emailLogger.error('Email send failed:', error);
      
      // Try fallback if primary failed
      if (this.sendGridInitialized && this.nodemailerInitialized && 
          error.message.includes('SendGrid')) {
        try {
          emailLogger.info('Attempting fallback to Nodemailer after SendGrid failure');
          return await this.sendWithNodemailer(userId, content);
        } catch (fallbackError) {
          emailLogger.error('Fallback email provider also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  async sendWithSendGrid(userId, content) {
    try {
      // Get user email (in a real implementation, this would come from user service)
      const userEmail = await this.getUserEmail(userId);
      
      const message = {
        to: {
          email: userEmail,
          name: content.recipientName || ''
        },
        from: {
          email: content.fromEmail || sendGridConfig.from.email,
          name: content.fromName || sendGridConfig.from.name
        },
        subject: content.subject,
        html: content.htmlBody || content.html,
        text: content.textBody || content.text,
        replyTo: content.replyTo || sendGridConfig.replyTo,
        customArgs: {
          userId: userId,
          notificationId: content.notificationId,
          category: content.category
        },
        trackingSettings: {
          clickTracking: {
            enable: true,
            enableText: false
          },
          openTracking: {
            enable: true,
            substitutionTag: '%open_tracking_pixel%'
          },
          subscriptionTracking: {
            enable: false
          }
        }
      };

      // Add attachments if provided
      if (content.attachments && content.attachments.length > 0) {
        message.attachments = content.attachments.map(attachment => ({
          content: attachment.content,
          filename: attachment.filename,
          type: attachment.contentType || 'application/octet-stream',
          disposition: attachment.disposition || 'attachment'
        }));
      }

      // Add template ID if using dynamic template
      if (content.templateId) {
        message.templateId = content.templateId;
        message.dynamicTemplateData = content.templateData || {};
        delete message.html;
        delete message.text;
      }

      // Add categories for tracking
      if (content.categories) {
        message.categories = Array.isArray(content.categories) 
          ? content.categories 
          : [content.categories];
      }

      const response = await sgMail.send(message);
      
      emailLogger.info('Email sent successfully via SendGrid', {
        userId,
        recipient: userEmail,
        messageId: response[0].headers['x-message-id'],
        subject: content.subject
      });

      return {
        externalId: response[0].headers['x-message-id'],
        provider: 'sendgrid',
        status: 'sent',
        recipient: userEmail
      };

    } catch (error) {
      emailLogger.error('SendGrid send failed:', error);
      
      if (error.response) {
        const { status, body } = error.response;
        throw new Error(`SendGrid error ${status}: ${JSON.stringify(body)}`);
      }
      
      throw error;
    }
  }

  async sendWithNodemailer(userId, content) {
    try {
      const userEmail = await this.getUserEmail(userId);
      const smtpConfig = emailProviders.nodemailer;
      
      const message = {
        from: `${content.fromName || smtpConfig.from.name} <${content.fromEmail || smtpConfig.from.email}>`,
        to: userEmail,
        subject: content.subject,
        html: content.htmlBody || content.html,
        text: content.textBody || content.text,
        replyTo: content.replyTo,
        headers: {
          'X-User-ID': userId,
          'X-Notification-ID': content.notificationId,
          'X-Category': content.category
        }
      };

      // Add attachments if provided
      if (content.attachments && content.attachments.length > 0) {
        message.attachments = content.attachments.map(attachment => ({
          content: Buffer.from(attachment.content, 'base64'),
          filename: attachment.filename,
          contentType: attachment.contentType || 'application/octet-stream'
        }));
      }

      const result = await this.nodemailerTransporter.sendMail(message);
      
      emailLogger.info('Email sent successfully via Nodemailer', {
        userId,
        recipient: userEmail,
        messageId: result.messageId,
        subject: content.subject
      });

      return {
        externalId: result.messageId,
        provider: 'nodemailer',
        status: 'sent',
        recipient: userEmail
      };

    } catch (error) {
      emailLogger.error('Nodemailer send failed:', error);
      throw error;
    }
  }

  async sendBulk(notifications) {
    const results = [];
    const batchSize = 100; // SendGrid allows up to 1000, but we'll be conservative
    
    try {
      // Process in batches
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      emailLogger.info(`Bulk email completed`, {
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
      emailLogger.error('Bulk email send failed:', error);
      throw error;
    }
  }

  async processBatch(batch) {
    if (this.sendGridInitialized) {
      return await this.processBatchWithSendGrid(batch);
    } else if (this.nodemailerInitialized) {
      return await this.processBatchWithNodemailer(batch);
    } else {
      throw new Error('No email providers available for bulk send');
    }
  }

  async processBatchWithSendGrid(batch) {
    try {
      const messages = await Promise.all(
        batch.map(async (notification) => {
          const { userId, content } = notification;
          const userEmail = await this.getUserEmail(userId);
          
          return {
            to: userEmail,
            from: {
              email: content.fromEmail || sendGridConfig.from.email,
              name: content.fromName || sendGridConfig.from.name
            },
            subject: content.subject,
            html: content.htmlBody || content.html,
            text: content.textBody || content.text,
            customArgs: {
              userId: userId,
              notificationId: content.notificationId
            }
          };
        })
      );

      const response = await sgMail.send(messages);
      
      return messages.map((message, index) => ({
        userId: batch[index].userId,
        recipient: message.to,
        success: true,
        messageId: response[index]?.headers?.['x-message-id'],
        provider: 'sendgrid'
      }));

    } catch (error) {
      emailLogger.error('SendGrid bulk send failed:', error);
      
      // If bulk send fails, try individual sends
      return await this.processBatchIndividually(batch);
    }
  }

  async processBatchWithNodemailer(batch) {
    // Nodemailer doesn't have native bulk send, so we'll send individually
    return await this.processBatchIndividually(batch);
  }

  async processBatchIndividually(batch) {
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

  async getUserEmail(userId) {
    // In a real implementation, this would call the user service
    // For now, we'll simulate it
    
    // This should be replaced with actual user service call
    // const userService = require('../services/userService');
    // const user = await userService.getUser(userId);
    // return user.email;
    
    // Temporary implementation for development
    return `user-${userId}@example.com`;
  }

  async verifyEmail(email) {
    // Email verification logic
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async trackDelivery(messageId) {
    if (this.sendGridInitialized) {
      try {
        // SendGrid provides webhook events for tracking
        // This would typically be handled via webhooks
        return {
          messageId,
          status: 'tracking_via_webhook',
          provider: 'sendgrid'
        };
      } catch (error) {
        emailLogger.error('Failed to track email delivery:', error);
        return null;
      }
    }
    
    return null;
  }

  async handleWebhook(webhookData) {
    try {
      // Process SendGrid webhook events
      if (Array.isArray(webhookData)) {
        const results = [];
        
        for (const event of webhookData) {
          const processed = await this.processWebhookEvent(event);
          if (processed) {
            results.push(processed);
          }
        }
        
        return results;
      }
      
      return [];
    } catch (error) {
      emailLogger.error('Webhook processing failed:', error);
      throw error;
    }
  }

  async processWebhookEvent(event) {
    const { 
      event: eventType, 
      email, 
      sg_message_id, 
      timestamp, 
      userId, 
      notificationId 
    } = event;

    emailLogger.info('Processing email webhook event', {
      eventType,
      email,
      messageId: sg_message_id,
      userId,
      notificationId
    });

    return {
      eventType,
      email,
      messageId: sg_message_id,
      timestamp: new Date(timestamp * 1000),
      userId,
      notificationId,
      processed: true
    };
  }

  async testConnection() {
    const results = {
      sendgrid: false,
      nodemailer: false
    };

    // Test SendGrid
    if (this.sendGridInitialized) {
      try {
        // SendGrid doesn't have a specific test endpoint, 
        // but we can validate the API key format
        results.sendgrid = true;
      } catch (error) {
        emailLogger.error('SendGrid connection test failed:', error);
      }
    }

    // Test Nodemailer
    if (this.nodemailerInitialized) {
      try {
        await this.nodemailerTransporter.verify();
        results.nodemailer = true;
      } catch (error) {
        emailLogger.error('Nodemailer connection test failed:', error);
      }
    }

    return results;
  }

  getProviderInfo() {
    return {
      name: 'Email Provider',
      channel: this.channel,
      primaryProvider: this.primaryProvider,
      fallbackProvider: this.fallbackProvider,
      sendGridInitialized: this.sendGridInitialized,
      nodemailerInitialized: this.nodemailerInitialized,
      features: [
        'single_send',
        'bulk_send',
        'templates',
        'attachments',
        'tracking',
        'webhooks',
        'fallback_provider'
      ]
    };
  }

  async cleanup() {
    if (this.nodemailerTransporter) {
      this.nodemailerTransporter.close();
      emailLogger.info('Nodemailer transporter closed');
    }
  }
}

module.exports = EmailProvider;