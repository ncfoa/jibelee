module.exports = (sequelize, DataTypes) => {
  const SystemConfiguration = sequelize.define('SystemConfiguration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Configuration category (platform, payment, notification, security, etc.)'
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Configuration key'
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Configuration value (can be string, number, boolean, object, or array)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of what this configuration controls'
    },
    is_sensitive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this configuration contains sensitive data'
    },
    requires_restart: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether changing this configuration requires service restart'
    },
    data_type: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'object', 'array'),
      allowNull: false,
      comment: 'Expected data type for validation'
    },
    default_value: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    allowed_values: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    validation_rules: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Validation rules for the configuration value'
    },
    is_encrypted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    environment: {
      type: DataTypes.STRING(20),
      defaultValue: 'production'
    },
    feature_flag: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    rollout_percentage: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      validate: { min: 0, max: 100 }
    },
    target_users: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: []
    },
    target_regions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    effective_from: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    effective_until: {
      type: DataTypes.DATE,
      allowNull: true
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    dependencies: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    impact_assessment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rollback_value: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    change_log: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    approval_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Admin user who last updated this configuration'
    },
    previous_value: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Previous value before last update'
    }
  }, {
    tableName: 'system_configuration',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['category', 'key']
      },
      {
        fields: ['category']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['updated_at']
      },
      {
        fields: ['requires_restart']
      }
    ]
  });

  SystemConfiguration.associate = (models) => {
    // Association with AdminUser (updated_by)
    SystemConfiguration.belongsTo(models.AdminUser, {
      foreignKey: 'updated_by',
      as: 'updatedBy'
    });
  };

  // Instance methods
  SystemConfiguration.prototype.updateValue = async function(newValue, adminId) {
    this.previous_value = this.value;
    this.value = newValue;
    this.updated_by = adminId;
    
    return await this.save();
  };

  SystemConfiguration.prototype.validate = function() {
    const rules = this.validation_rules || {};
    const value = this.value;

    // Type validation
    if (!this.validateType(value, this.data_type)) {
      throw new Error(`Invalid data type. Expected ${this.data_type}`);
    }

    // Custom validation rules
    if (rules.min !== undefined && value < rules.min) {
      throw new Error(`Value must be at least ${rules.min}`);
    }

    if (rules.max !== undefined && value > rules.max) {
      throw new Error(`Value must be at most ${rules.max}`);
    }

    if (rules.minLength !== undefined && value.length < rules.minLength) {
      throw new Error(`Value must be at least ${rules.minLength} characters long`);
    }

    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      throw new Error(`Value must be at most ${rules.maxLength} characters long`);
    }

    if (rules.enum && !rules.enum.includes(value)) {
      throw new Error(`Value must be one of: ${rules.enum.join(', ')}`);
    }

    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      throw new Error(`Value does not match required pattern`);
    }

    return true;
  };

  SystemConfiguration.prototype.validateType = function(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  };

  // Class methods
  SystemConfiguration.getByCategory = function(category) {
    return this.findAll({
      where: { category, is_active: true },
      order: [['key', 'ASC']]
    });
  };

  SystemConfiguration.getByKey = function(category, key) {
    return this.findOne({
      where: { category, key, is_active: true }
    });
  };

  SystemConfiguration.getValue = async function(category, key, defaultValue = null) {
    const config = await this.getByKey(category, key);
    return config ? config.value : defaultValue;
  };

  SystemConfiguration.setValue = async function(category, key, value, adminId, options = {}) {
    const {
      description,
      dataType = 'string',
      validationRules = {},
      isSensitive = false,
      requiresRestart = false
    } = options;

    const [config, created] = await this.findOrCreate({
      where: { category, key },
      defaults: {
        category,
        key,
        value,
        description,
        data_type: dataType,
        validation_rules: validationRules,
        is_sensitive: isSensitive,
        requires_restart: requiresRestart,
        updated_by: adminId
      }
    });

    if (!created) {
      await config.updateValue(value, adminId);
    }

    return config;
  };

  SystemConfiguration.getAllConfigurations = function(includeSecrets = false) {
    const whereClause = { is_active: true };
    
    if (!includeSecrets) {
      whereClause.is_sensitive = false;
    }

    return this.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['key', 'ASC']],
      include: ['updatedBy']
    });
  };

  SystemConfiguration.getConfigurationsByCategory = function(categories = []) {
    return this.findAll({
      where: {
        category: categories,
        is_active: true
      },
      order: [['category', 'ASC'], ['key', 'ASC']]
    });
  };

  SystemConfiguration.searchConfigurations = function(searchTerm) {
    return this.findAll({
      where: {
        is_active: true,
        [sequelize.Sequelize.Op.or]: [
          { key: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { description: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } },
          { category: { [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      order: [['category', 'ASC'], ['key', 'ASC']]
    });
  };

  SystemConfiguration.getRequiringRestart = function() {
    return this.findAll({
      where: {
        requires_restart: true,
        is_active: true,
        updated_at: {
          [sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      order: [['updated_at', 'DESC']]
    });
  };

  SystemConfiguration.getConfigurationHistory = function(category, key, limit = 10) {
    // This would require a separate history table in a real implementation
    // For now, we'll return the current configuration with previous_value
    return this.findAll({
      where: { category, key },
      order: [['updated_at', 'DESC']],
      limit
    });
  };

  SystemConfiguration.exportConfigurations = async function(categories = [], format = 'json') {
    const whereClause = {
      is_active: true,
      is_sensitive: false // Don't export sensitive configurations
    };

    if (categories.length > 0) {
      whereClause.category = categories;
    }

    const configs = await this.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['key', 'ASC']]
    });

    if (format === 'json') {
      const result = {};
      configs.forEach(config => {
        if (!result[config.category]) {
          result[config.category] = {};
        }
        result[config.category][config.key] = config.value;
      });
      return result;
    }

    // Return raw configurations for other formats
    return configs;
  };

  SystemConfiguration.importConfigurations = async function(configurations, adminId, options = {}) {
    const { overwrite = false, validate = true } = options;
    const results = [];

    for (const [category, categoryConfigs] of Object.entries(configurations)) {
      for (const [key, value] of Object.entries(categoryConfigs)) {
        try {
          const existingConfig = await this.getByKey(category, key);
          
          if (existingConfig && !overwrite) {
            results.push({
              category,
              key,
              status: 'skipped',
              message: 'Configuration already exists'
            });
            continue;
          }

          const config = await this.setValue(category, key, value, adminId);
          
          if (validate) {
            config.validate();
          }

          results.push({
            category,
            key,
            status: 'success',
            message: existingConfig ? 'Updated' : 'Created'
          });
        } catch (error) {
          results.push({
            category,
            key,
            status: 'error',
            message: error.message
          });
        }
      }
    }

    return results;
  };

  return SystemConfiguration;
};