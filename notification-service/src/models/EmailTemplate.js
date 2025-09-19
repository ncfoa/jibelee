module.exports = (sequelize, DataTypes) => {
  const EmailTemplate = sequelize.define('EmailTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'template_id',
      validate: {
        isUUID: 4
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    subjectTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'subject_template',
      validate: {
        notEmpty: true
      }
    },
    htmlTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'html_template',
      validate: {
        notEmpty: true
      }
    },
    textTemplate: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'text_template'
    },
    previewText: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'preview_text'
    },
    fromName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'P2P Delivery',
      field: 'from_name'
    },
    fromEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'noreply@p2pdelivery.com',
      field: 'from_email',
      validate: {
        isEmail: true
      }
    },
    replyTo: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'reply_to',
      validate: {
        isEmail: true
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'email_templates',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['template_id']
      },
      {
        fields: ['name']
      },
      {
        fields: ['from_email']
      }
    ],
    hooks: {
      beforeUpdate: (emailTemplate) => {
        emailTemplate.updatedAt = new Date();
      }
    }
  });

  // Instance methods
  EmailTemplate.prototype.generateSubject = function(variables = {}) {
    const handlebars = require('handlebars');
    const template = handlebars.compile(this.subjectTemplate);
    return template(variables);
  };

  EmailTemplate.prototype.generateHtmlContent = function(variables = {}) {
    const handlebars = require('handlebars');
    const template = handlebars.compile(this.htmlTemplate);
    return template(variables);
  };

  EmailTemplate.prototype.generateTextContent = function(variables = {}) {
    if (!this.textTemplate) {
      // Generate text version from HTML if no text template exists
      return this.generateTextFromHtml(variables);
    }
    
    const handlebars = require('handlebars');
    const template = handlebars.compile(this.textTemplate);
    return template(variables);
  };

  EmailTemplate.prototype.generateTextFromHtml = function(variables = {}) {
    const htmlContent = this.generateHtmlContent(variables);
    
    // Simple HTML to text conversion (in production, use a proper library like html-to-text)
    return htmlContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  };

  EmailTemplate.prototype.generatePreviewText = function(variables = {}) {
    if (this.previewText) {
      const handlebars = require('handlebars');
      const template = handlebars.compile(this.previewText);
      return template(variables);
    }
    
    // Generate preview text from HTML content
    const textContent = this.generateTextFromHtml(variables);
    return textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '');
  };

  EmailTemplate.prototype.validateTemplate = function() {
    const errors = [];
    
    // Check for required handlebars variables
    const handlebars = require('handlebars');
    
    try {
      handlebars.compile(this.subjectTemplate);
    } catch (error) {
      errors.push(`Invalid subject template: ${error.message}`);
    }
    
    try {
      handlebars.compile(this.htmlTemplate);
    } catch (error) {
      errors.push(`Invalid HTML template: ${error.message}`);
    }
    
    if (this.textTemplate) {
      try {
        handlebars.compile(this.textTemplate);
      } catch (error) {
        errors.push(`Invalid text template: ${error.message}`);
      }
    }
    
    // Check for basic HTML structure
    if (!this.htmlTemplate.includes('<html>') && !this.htmlTemplate.includes('{{>')) {
      errors.push('HTML template should include basic HTML structure or use partials');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  EmailTemplate.prototype.extractVariables = function() {
    const handlebars = require('handlebars');
    const variables = new Set();
    
    // Extract variables from subject template
    const subjectAst = handlebars.parse(this.subjectTemplate);
    this._extractVariablesFromAst(subjectAst, variables);
    
    // Extract variables from HTML template
    const htmlAst = handlebars.parse(this.htmlTemplate);
    this._extractVariablesFromAst(htmlAst, variables);
    
    // Extract variables from text template if it exists
    if (this.textTemplate) {
      const textAst = handlebars.parse(this.textTemplate);
      this._extractVariablesFromAst(textAst, variables);
    }
    
    return Array.from(variables);
  };

  EmailTemplate.prototype._extractVariablesFromAst = function(ast, variables) {
    ast.body.forEach(node => {
      if (node.type === 'MustacheStatement' || node.type === 'BlockStatement') {
        if (node.path && node.path.original) {
          variables.add(node.path.original);
        }
      }
    });
  };

  EmailTemplate.prototype.clone = function(newName) {
    return EmailTemplate.create({
      templateId: this.templateId,
      name: newName,
      subjectTemplate: this.subjectTemplate,
      htmlTemplate: this.htmlTemplate,
      textTemplate: this.textTemplate,
      previewText: this.previewText,
      fromName: this.fromName,
      fromEmail: this.fromEmail,
      replyTo: this.replyTo
    });
  };

  EmailTemplate.prototype.createVersion = function() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const versionName = `${this.name}_v${timestamp}`;
    return this.clone(versionName);
  };

  // Class methods
  EmailTemplate.findByTemplateId = function(templateId) {
    return this.findAll({
      where: { templateId },
      order: [['created_at', 'DESC']]
    });
  };

  EmailTemplate.findByName = function(name) {
    return this.findOne({
      where: { name }
    });
  };

  EmailTemplate.createFromNotificationTemplate = function(notificationTemplate, options = {}) {
    const emailTemplate = notificationTemplate.emailTemplate;
    
    if (!emailTemplate) {
      throw new Error('Notification template does not have email template data');
    }
    
    return this.create({
      templateId: notificationTemplate.id,
      name: options.name || `${notificationTemplate.name}_email`,
      subjectTemplate: emailTemplate.subject || 'Notification from P2P Delivery',
      htmlTemplate: emailTemplate.htmlBody || emailTemplate.body || '<p>{{message}}</p>',
      textTemplate: emailTemplate.textBody || null,
      previewText: emailTemplate.previewText || null,
      fromName: emailTemplate.fromName || 'P2P Delivery',
      fromEmail: emailTemplate.fromEmail || 'noreply@p2pdelivery.com',
      replyTo: emailTemplate.replyTo || null
    });
  };

  EmailTemplate.getTemplateStatistics = function() {
    return this.findAll({
      attributes: [
        'template_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'version_count'],
        [sequelize.fn('MAX', sequelize.col('created_at')), 'latest_version'],
        [sequelize.fn('MIN', sequelize.col('created_at')), 'first_version']
      ],
      group: ['template_id'],
      raw: true
    });
  };

  EmailTemplate.findDuplicateNames = function() {
    return this.findAll({
      attributes: [
        'name',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['name'],
      having: sequelize.literal('COUNT(id) > 1'),
      raw: true
    });
  };

  EmailTemplate.searchByContent = function(searchTerm) {
    return this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { name: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { subjectTemplate: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { htmlTemplate: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { textTemplate: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      order: [['updated_at', 'DESC']]
    });
  };

  EmailTemplate.validateAllTemplates = function() {
    return this.findAll().then(templates => {
      const results = [];
      templates.forEach(template => {
        const validation = template.validateTemplate();
        results.push({
          id: template.id,
          name: template.name,
          isValid: validation.isValid,
          errors: validation.errors
        });
      });
      return results;
    });
  };

  EmailTemplate.cleanupOldVersions = function(keepVersions = 5) {
    return this.findAll({
      attributes: ['template_id'],
      group: ['template_id']
    }).then(templateGroups => {
      const promises = templateGroups.map(group => {
        return this.findAll({
          where: { templateId: group.templateId },
          order: [['created_at', 'DESC']],
          offset: keepVersions
        }).then(oldVersions => {
          if (oldVersions.length > 0) {
            const idsToDelete = oldVersions.map(v => v.id);
            return this.destroy({
              where: {
                id: { [sequelize.Sequelize.Op.in]: idsToDelete }
              }
            });
          }
          return 0;
        });
      });
      
      return Promise.all(promises);
    });
  };

  EmailTemplate.getUsageStatistics = function(startDate, endDate) {
    // This would require joining with notifications table to get actual usage
    const query = `
      SELECT 
        et.id,
        et.name,
        et.template_id,
        COUNT(n.id) as usage_count,
        MAX(n.sent_at) as last_used
      FROM email_templates et
      LEFT JOIN notifications n ON et.template_id = n.template_id 
        AND n.notification_type = 'email'
        AND n.sent_at BETWEEN :startDate AND :endDate
      GROUP BY et.id, et.name, et.template_id
      ORDER BY usage_count DESC
    `;

    return sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { startDate, endDate }
    });
  };

  // Associations
  EmailTemplate.associate = (models) => {
    EmailTemplate.belongsTo(models.NotificationTemplate, {
      foreignKey: 'templateId',
      as: 'notificationTemplate'
    });
  };

  return EmailTemplate;
};