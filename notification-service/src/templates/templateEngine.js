const handlebars = require('handlebars');
const moment = require('moment-timezone');
const { logger } = require('../config/logger');
const { templateConfig } = require('../config/providers');

class TemplateEngine {
  constructor() {
    this.handlebars = handlebars;
    this.setupHelpers();
    this.setupPartials();
    logger.info('Template engine initialized');
  }

  setupHelpers() {
    // Currency formatting helper
    this.handlebars.registerHelper('currency', (amount, currency = 'USD', locale = 'en-US') => {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency
        }).format(amount);
      } catch (error) {
        return `${currency} ${amount}`;
      }
    });

    // Date formatting helper
    this.handlebars.registerHelper('date', (date, format = 'short', locale = 'en-US') => {
      try {
        const dateObj = new Date(date);
        return new Intl.DateTimeFormat(locale, {
          dateStyle: format
        }).format(dateObj);
      } catch (error) {
        return date;
      }
    });

    // Time formatting helper
    this.handlebars.registerHelper('time', (date, timezone = 'UTC', format = 'short') => {
      try {
        return moment.tz(date, timezone).format(format === 'short' ? 'h:mm A' : 'h:mm:ss A z');
      } catch (error) {
        return date;
      }
    });

    // Relative time helper
    this.handlebars.registerHelper('fromNow', (date, timezone = 'UTC') => {
      try {
        return moment.tz(date, timezone).fromNow();
      } catch (error) {
        return date;
      }
    });

    // Number formatting helper
    this.handlebars.registerHelper('number', (value, locale = 'en-US') => {
      try {
        return new Intl.NumberFormat(locale).format(value);
      } catch (error) {
        return value;
      }
    });

    // Capitalize helper
    this.handlebars.registerHelper('capitalize', (str) => {
      if (typeof str !== 'string') return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Uppercase helper
    this.handlebars.registerHelper('upper', (str) => {
      if (typeof str !== 'string') return str;
      return str.toUpperCase();
    });

    // Lowercase helper
    this.handlebars.registerHelper('lower', (str) => {
      if (typeof str !== 'string') return str;
      return str.toLowerCase();
    });

    // Truncate helper
    this.handlebars.registerHelper('truncate', (str, length = 100, suffix = '...') => {
      if (typeof str !== 'string') return str;
      if (str.length <= length) return str;
      return str.substring(0, length) + suffix;
    });

    // Conditional helpers
    this.handlebars.registerHelper('eq', (a, b) => a === b);
    this.handlebars.registerHelper('ne', (a, b) => a !== b);
    this.handlebars.registerHelper('gt', (a, b) => a > b);
    this.handlebars.registerHelper('gte', (a, b) => a >= b);
    this.handlebars.registerHelper('lt', (a, b) => a < b);
    this.handlebars.registerHelper('lte', (a, b) => a <= b);

    // Array helpers
    this.handlebars.registerHelper('length', (array) => {
      return Array.isArray(array) ? array.length : 0;
    });

    this.handlebars.registerHelper('join', (array, separator = ', ') => {
      return Array.isArray(array) ? array.join(separator) : array;
    });

    // URL helpers
    this.handlebars.registerHelper('url', (path, baseUrl = process.env.BASE_URL || 'https://p2pdelivery.com') => {
      return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    });

    // Conditional block helper
    this.handlebars.registerHelper('if_eq', function(a, b, options) {
      if (a === b) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Math helpers
    this.handlebars.registerHelper('add', (a, b) => a + b);
    this.handlebars.registerHelper('subtract', (a, b) => a - b);
    this.handlebars.registerHelper('multiply', (a, b) => a * b);
    this.handlebars.registerHelper('divide', (a, b) => b !== 0 ? a / b : 0);

    // Default value helper
    this.handlebars.registerHelper('default', (value, defaultValue) => {
      return value !== undefined && value !== null && value !== '' ? value : defaultValue;
    });

    // JSON helper
    this.handlebars.registerHelper('json', (obj) => {
      return JSON.stringify(obj);
    });

    logger.info('Handlebars helpers registered');
  }

  setupPartials() {
    // Register common partials
    const commonPartials = {
      header: `
        <div style="background-color: #007AFF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">{{title}}</h1>
        </div>
      `,
      
      footer: `
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d;">
          <p>© {{year}} P2P Delivery. All rights reserved.</p>
          <p>
            <a href="{{url 'unsubscribe'}}" style="color: #007AFF;">Unsubscribe</a> | 
            <a href="{{url 'privacy'}}" style="color: #007AFF;">Privacy Policy</a> | 
            <a href="{{url 'support'}}" style="color: #007AFF;">Support</a>
          </p>
        </div>
      `,
      
      button: `
        <div style="text-align: center; margin: 20px 0;">
          <a href="{{url}}" 
             style="background-color: {{color}}; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            {{text}}
          </a>
        </div>
      `,
      
      notification_item: `
        <div style="border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin: 10px 0;">
          <h3 style="margin: 0 0 10px 0; color: #495057;">{{title}}</h3>
          <p style="margin: 0; color: #6c757d;">{{message}}</p>
          {{#if timestamp}}
            <small style="color: #adb5bd;">{{time timestamp}}</small>
          {{/if}}
        </div>
      `
    };

    Object.entries(commonPartials).forEach(([name, template]) => {
      this.handlebars.registerPartial(name, template);
    });

    logger.info('Handlebars partials registered');
  }

  async generateContent(template, channel, variables, language = 'en') {
    try {
      const channelTemplate = this.getChannelTemplate(template, channel);
      
      if (!channelTemplate) {
        throw new Error(`No ${channel} template found for template: ${template.name}`);
      }

      // Validate required variables
      this.validateVariables(template.variables, variables);

      // Add system variables
      const enrichedVariables = this.enrichVariables(variables, language);

      // Generate content based on channel
      switch (channel) {
        case 'push':
          return this.generatePushContent(channelTemplate, enrichedVariables);
        case 'email':
          return this.generateEmailContent(channelTemplate, enrichedVariables);
        case 'sms':
          return this.generateSMSContent(channelTemplate, enrichedVariables);
        case 'in_app':
          return this.generateInAppContent(channelTemplate, enrichedVariables);
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }

    } catch (error) {
      logger.error('Template content generation failed:', error);
      throw error;
    }
  }

  getChannelTemplate(template, channel) {
    switch (channel) {
      case 'push':
        return template.pushTemplate || template.push_template;
      case 'email':
        return template.emailTemplate || template.email_template;
      case 'sms':
        return template.smsTemplate || template.sms_template;
      case 'in_app':
        return template.inAppTemplate || template.in_app_template;
      default:
        return null;
    }
  }

  validateVariables(templateVariables, providedVariables) {
    if (!templateVariables || !Array.isArray(templateVariables)) {
      return true;
    }

    const required = templateVariables.filter(v => v.required);
    const missing = required.filter(v => !(v.name in providedVariables));

    if (missing.length > 0) {
      throw new Error(
        `Missing required variables: ${missing.map(v => v.name).join(', ')}`
      );
    }

    return true;
  }

  enrichVariables(variables, language = 'en') {
    const enriched = {
      ...variables,
      // System variables
      year: new Date().getFullYear(),
      currentDate: new Date().toISOString(),
      language,
      // Platform URLs
      baseUrl: process.env.BASE_URL || 'https://p2pdelivery.com',
      supportUrl: process.env.SUPPORT_URL || 'https://p2pdelivery.com/support',
      unsubscribeUrl: process.env.UNSUBSCRIBE_URL || 'https://p2pdelivery.com/unsubscribe'
    };

    // Add user-specific URLs if userId is provided
    if (variables.userId) {
      enriched.profileUrl = `${enriched.baseUrl}/profile/${variables.userId}`;
      enriched.settingsUrl = `${enriched.baseUrl}/settings`;
      enriched.unsubscribeUrl = `${enriched.unsubscribeUrl}?user=${variables.userId}`;
    }

    // Add delivery-specific URLs if deliveryId is provided
    if (variables.deliveryId) {
      enriched.trackingUrl = `${enriched.baseUrl}/track/${variables.deliveryId}`;
      enriched.deliveryUrl = `${enriched.baseUrl}/deliveries/${variables.deliveryId}`;
    }

    return enriched;
  }

  generatePushContent(template, variables) {
    try {
      const content = {
        title: this.compileTemplate(template.title, variables),
        body: this.compileTemplate(template.body, variables),
        icon: template.icon,
        sound: template.sound || 'default',
        clickAction: template.clickAction,
        category: template.category,
        badge: template.badge,
        color: template.color,
        priority: template.priority,
        data: this.processTemplateObject(template.data || {}, variables)
      };

      // Remove undefined values
      Object.keys(content).forEach(key => {
        if (content[key] === undefined) {
          delete content[key];
        }
      });

      return content;

    } catch (error) {
      logger.error('Push content generation failed:', error);
      throw new Error(`Push template compilation failed: ${error.message}`);
    }
  }

  generateEmailContent(template, variables) {
    try {
      const content = {
        subject: this.compileTemplate(template.subject, variables),
        htmlBody: this.compileTemplate(template.htmlBody || template.html, variables),
        textBody: this.compileTemplate(template.textBody || template.text || '', variables),
        fromName: template.fromName || 'P2P Delivery',
        fromEmail: template.fromEmail || 'noreply@p2pdelivery.com',
        replyTo: template.replyTo,
        previewText: template.previewText ? this.compileTemplate(template.previewText, variables) : undefined
      };

      // Generate text version from HTML if not provided
      if (!content.textBody && content.htmlBody) {
        content.textBody = this.htmlToText(content.htmlBody);
      }

      // Process attachments if present
      if (template.attachments) {
        content.attachments = template.attachments.map(attachment => ({
          ...attachment,
          filename: this.compileTemplate(attachment.filename, variables),
          content: attachment.content // Assuming content is already processed
        }));
      }

      return content;

    } catch (error) {
      logger.error('Email content generation failed:', error);
      throw new Error(`Email template compilation failed: ${error.message}`);
    }
  }

  generateSMSContent(template, variables) {
    try {
      const body = this.compileTemplate(template.body || template.message, variables);
      
      // Check SMS length limits
      if (body.length > 1600) { // Max for concatenated SMS
        logger.warn(`SMS content exceeds recommended length: ${body.length} characters`);
      }

      const content = {
        body,
        from: template.from,
        mediaUrls: template.mediaUrls ? 
          template.mediaUrls.map(url => this.compileTemplate(url, variables)) : 
          undefined
      };

      return content;

    } catch (error) {
      logger.error('SMS content generation failed:', error);
      throw new Error(`SMS template compilation failed: ${error.message}`);
    }
  }

  generateInAppContent(template, variables) {
    try {
      const content = {
        title: this.compileTemplate(template.title, variables),
        message: this.compileTemplate(template.message || template.body, variables),
        icon: template.icon,
        color: template.color,
        sound: template.sound,
        badge: template.badge,
        category: template.category,
        priority: template.priority,
        persistent: template.persistent,
        expiresAt: template.expiresAt,
        actions: this.processTemplateObject(template.actions || [], variables),
        data: this.processTemplateObject(template.data || {}, variables)
      };

      return content;

    } catch (error) {
      logger.error('In-app content generation failed:', error);
      throw new Error(`In-app template compilation failed: ${error.message}`);
    }
  }

  compileTemplate(templateString, variables) {
    if (!templateString || typeof templateString !== 'string') {
      return templateString;
    }

    try {
      const template = this.handlebars.compile(templateString);
      return template(variables);
    } catch (error) {
      logger.error('Template compilation failed:', { templateString, error: error.message });
      throw new Error(`Template compilation failed: ${error.message}`);
    }
  }

  processTemplateObject(obj, variables) {
    if (typeof obj === 'string') {
      return this.compileTemplate(obj, variables);
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

  htmlToText(html) {
    if (!html) return '';
    
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  validateTemplate(templateString) {
    try {
      this.handlebars.compile(templateString);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  extractVariables(templateString) {
    if (!templateString || typeof templateString !== 'string') {
      return [];
    }

    const variables = new Set();
    
    try {
      const ast = this.handlebars.parse(templateString);
      this.walkAST(ast, (node) => {
        if ((node.type === 'MustacheStatement' || node.type === 'BlockStatement') && node.path) {
          variables.add(node.path.original);
        }
      });
    } catch (error) {
      logger.error('Failed to extract variables from template:', error);
    }

    return Array.from(variables);
  }

  walkAST(node, callback) {
    callback(node);
    
    if (node.body) {
      node.body.forEach(child => this.walkAST(child, callback));
    }
    
    if (node.program) {
      this.walkAST(node.program, callback);
    }
    
    if (node.inverse) {
      this.walkAST(node.inverse, callback);
    }
  }

  precompileTemplate(templateString) {
    try {
      return this.handlebars.precompile(templateString);
    } catch (error) {
      logger.error('Template precompilation failed:', error);
      throw error;
    }
  }

  registerHelper(name, helperFunction) {
    this.handlebars.registerHelper(name, helperFunction);
    logger.info(`Custom helper registered: ${name}`);
  }

  registerPartial(name, partialTemplate) {
    this.handlebars.registerPartial(name, partialTemplate);
    logger.info(`Custom partial registered: ${name}`);
  }

  getHelpers() {
    return Object.keys(this.handlebars.helpers);
  }

  getPartials() {
    return Object.keys(this.handlebars.partials);
  }
}

module.exports = TemplateEngine;