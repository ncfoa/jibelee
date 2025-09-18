const { logger, logBusinessEvent } = require('../config/logger');
const { cache, generateCacheKey } = require('../config/redis');
const { TripService } = require('../services');
const { CommonUtils } = require('../utils');

/**
 * Trip template controller for managing trip templates
 */
class TemplateController {
  constructor() {
    this.tripService = new TripService();
    this.cacheTimeout = 600; // 10 minutes
  }

  /**
   * Get user's trip templates
   * GET /api/v1/trips/templates
   */
  async getTemplates(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, category, search } = req.query;

      const cacheKey = generateCacheKey.userTemplates(userId, { page, limit, category, search });
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached.templates,
          pagination: cached.pagination
        });
      }

      const { TripTemplate, Sequelize } = require('../models');
      const { Op } = Sequelize;

      // Build where clause
      const where = { 
        user_id: userId,
        is_active: true
      };

      if (category) {
        where.category = category;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { tags: { [Op.contains]: [search] } }
        ];
      }

      // Pagination
      const offset = (page - 1) * limit;

      // Execute query
      const { count, rows } = await TripTemplate.findAndCountAll({
        where,
        order: [['usage_count', 'DESC'], ['last_used_at', 'DESC'], ['created_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      const templates = rows.map(template => this.formatTemplateResponse(template));
      const pagination = CommonUtils.generatePagination(page, limit, count);

      // Cache results
      const result = { templates, pagination };
      await cache.set(cacheKey, result, this.cacheTimeout);

      res.json({
        success: true,
        data: templates,
        pagination
      });
    } catch (error) {
      logger.error('Get templates controller error:', {
        userId: req.user?.id,
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get templates',
        error: 'GET_TEMPLATES_ERROR'
      });
    }
  }

  /**
   * Create trip template
   * POST /api/v1/trips/templates
   */
  async createTemplate(req, res) {
    try {
      const userId = req.user.id;
      const templateData = req.body;

      const { TripTemplate } = require('../models');

      // Validate trip data
      const validation = this.validateTripData(templateData.tripData);
      if (!validation.isValid) {
        return res.status(422).json({
          success: false,
          message: 'Invalid trip data in template',
          error: 'INVALID_TRIP_DATA',
          details: validation.errors
        });
      }

      // Create template
      const template = await TripTemplate.create({
        user_id: userId,
        name: templateData.name,
        description: templateData.description,
        trip_data: templateData.tripData,
        category: templateData.category,
        tags: templateData.tags || [],
        is_public: templateData.isPublic || false,
        metadata: templateData.metadata || {}
      });

      // Clear user templates cache
      await this.clearUserTemplatesCache(userId);

      logBusinessEvent('template_created', {
        templateId: template.id,
        userId,
        name: templateData.name,
        category: templateData.category
      });

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: this.formatTemplateResponse(template)
      });
    } catch (error) {
      logger.error('Create template controller error:', {
        userId: req.user?.id,
        templateData: { ...templateData, tripData: 'omitted' },
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create template',
        error: 'CREATE_TEMPLATE_ERROR'
      });
    }
  }

  /**
   * Get template by ID
   * GET /api/v1/trips/templates/:id
   */
  async getTemplateById(req, res) {
    try {
      const { id: templateId } = req.params;
      const userId = req.user.id;

      const { TripTemplate } = require('../models');

      const template = await TripTemplate.findByPk(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found',
          error: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check access permissions
      if (!template.is_public && template.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to private template',
          error: 'ACCESS_DENIED'
        });
      }

      res.json({
        success: true,
        data: this.formatTemplateResponse(template)
      });
    } catch (error) {
      logger.error('Get template by ID controller error:', {
        templateId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get template',
        error: 'GET_TEMPLATE_ERROR'
      });
    }
  }

  /**
   * Update template
   * PUT /api/v1/trips/templates/:id
   */
  async updateTemplate(req, res) {
    try {
      const { id: templateId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const { TripTemplate } = require('../models');

      const template = await TripTemplate.findByPk(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found',
          error: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check ownership
      if (template.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - not template owner',
          error: 'ACCESS_DENIED'
        });
      }

      // Validate trip data if provided
      if (updateData.tripData) {
        const validation = this.validateTripData(updateData.tripData);
        if (!validation.isValid) {
          return res.status(422).json({
            success: false,
            message: 'Invalid trip data in template',
            error: 'INVALID_TRIP_DATA',
            details: validation.errors
          });
        }
      }

      // Update template
      const updatedTemplate = await template.update({
        name: updateData.name || template.name,
        description: updateData.description !== undefined ? updateData.description : template.description,
        trip_data: updateData.tripData || template.trip_data,
        category: updateData.category !== undefined ? updateData.category : template.category,
        tags: updateData.tags || template.tags,
        is_public: updateData.isPublic !== undefined ? updateData.isPublic : template.is_public,
        metadata: updateData.metadata || template.metadata
      });

      // Clear caches
      await this.clearUserTemplatesCache(userId);

      logBusinessEvent('template_updated', {
        templateId,
        userId,
        updatedFields: Object.keys(updateData)
      });

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: this.formatTemplateResponse(updatedTemplate)
      });
    } catch (error) {
      logger.error('Update template controller error:', {
        templateId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update template',
        error: 'UPDATE_TEMPLATE_ERROR'
      });
    }
  }

  /**
   * Delete template
   * DELETE /api/v1/trips/templates/:id
   */
  async deleteTemplate(req, res) {
    try {
      const { id: templateId } = req.params;
      const userId = req.user.id;

      const { TripTemplate } = require('../models');

      const template = await TripTemplate.findByPk(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found',
          error: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check ownership
      if (template.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - not template owner',
          error: 'ACCESS_DENIED'
        });
      }

      // Soft delete
      await template.destroy();

      // Clear caches
      await this.clearUserTemplatesCache(userId);

      logBusinessEvent('template_deleted', {
        templateId,
        userId,
        templateName: template.name
      });

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      logger.error('Delete template controller error:', {
        templateId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete template',
        error: 'DELETE_TEMPLATE_ERROR'
      });
    }
  }

  /**
   * Create trip from template
   * POST /api/v1/trips/templates/:id/create-trip
   */
  async createTripFromTemplate(req, res) {
    try {
      const { id: templateId } = req.params;
      const userId = req.user.id;
      const { departureTime, arrivalTime, overrides = {} } = req.body;

      if (!departureTime || !arrivalTime) {
        return res.status(400).json({
          success: false,
          message: 'Departure time and arrival time are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const { TripTemplate } = require('../models');

      const template = await TripTemplate.findByPk(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found',
          error: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check access permissions
      if (!template.is_public && template.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to private template',
          error: 'ACCESS_DENIED'
        });
      }

      // Create trip data from template
      const tripData = template.createTripFromTemplate({
        departureTime,
        arrivalTime,
        ...overrides
      });

      // Create the trip
      const trip = await this.tripService.createTrip(userId, tripData);

      // Increment template usage
      await template.incrementUsage();

      // Clear template cache
      await this.clearUserTemplatesCache(template.user_id);

      logBusinessEvent('trip_created_from_template', {
        tripId: trip.id,
        templateId,
        userId,
        templateName: template.name
      });

      res.status(201).json({
        success: true,
        message: 'Trip created from template successfully',
        data: trip
      });
    } catch (error) {
      logger.error('Create trip from template controller error:', {
        templateId: req.params.id,
        userId: req.user?.id,
        error: error.message
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('access denied') ? 403 :
                        error.message.includes('validation') ? 422 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create trip from template',
        error: 'CREATE_FROM_TEMPLATE_ERROR'
      });
    }
  }

  /**
   * Get public templates
   * GET /api/v1/trips/templates/public
   */
  async getPublicTemplates(req, res) {
    try {
      const { page = 1, limit = 20, category, search } = req.query;

      const cacheKey = generateCacheKey.publicTemplates({ page, limit, category, search });
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached.templates,
          pagination: cached.pagination
        });
      }

      const { TripTemplate, Sequelize } = require('../models');
      const { Op } = Sequelize;

      // Build where clause
      const where = { 
        is_public: true,
        is_active: true
      };

      if (category) {
        where.category = category;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { tags: { [Op.contains]: [search] } }
        ];
      }

      // Pagination
      const offset = (page - 1) * limit;

      // Execute query
      const { count, rows } = await TripTemplate.findAndCountAll({
        where,
        order: [['usage_count', 'DESC'], ['created_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      const templates = rows.map(template => this.formatPublicTemplateResponse(template));
      const pagination = CommonUtils.generatePagination(page, limit, count);

      // Cache results
      const result = { templates, pagination };
      await cache.set(cacheKey, result, this.cacheTimeout);

      res.json({
        success: true,
        data: templates,
        pagination
      });
    } catch (error) {
      logger.error('Get public templates controller error:', {
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get public templates',
        error: 'GET_PUBLIC_TEMPLATES_ERROR'
      });
    }
  }

  /**
   * Get popular templates
   * GET /api/v1/trips/templates/popular
   */
  async getPopularTemplates(req, res) {
    try {
      const { limit = 10 } = req.query;

      const cacheKey = generateCacheKey.popularTemplates(limit);
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      const { TripTemplate } = require('../models');

      const templates = await TripTemplate.findPopular(parseInt(limit), {
        where: { is_public: true }
      });

      const result = templates.map(template => this.formatPublicTemplateResponse(template));

      // Cache results for longer (1 hour)
      await cache.set(cacheKey, result, 3600);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get popular templates controller error:', {
        limit: req.query.limit,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get popular templates',
        error: 'GET_POPULAR_TEMPLATES_ERROR'
      });
    }
  }

  /**
   * Search templates by route
   * GET /api/v1/trips/templates/search
   */
  async searchTemplates(req, res) {
    try {
      const { origin, destination, category, page = 1, limit = 20 } = req.query;

      if (!origin || !destination) {
        return res.status(400).json({
          success: false,
          message: 'Origin and destination are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const cacheKey = generateCacheKey.templateSearch({ origin, destination, category, page, limit });
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached.templates,
          pagination: cached.pagination
        });
      }

      const { TripTemplate } = require('../models');

      // Search by route
      const templates = await TripTemplate.findByRoute(origin, destination, {
        where: { 
          is_active: true,
          ...(category && { category })
        },
        limit: parseInt(limit),
        offset: (page - 1) * limit
      });

      const result = templates.map(template => this.formatPublicTemplateResponse(template));
      const pagination = CommonUtils.generatePagination(page, limit, templates.length);

      // Cache results
      const cacheData = { templates: result, pagination };
      await cache.set(cacheKey, cacheData, this.cacheTimeout);

      res.json({
        success: true,
        data: result,
        pagination
      });
    } catch (error) {
      logger.error('Search templates controller error:', {
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search templates',
        error: 'SEARCH_TEMPLATES_ERROR'
      });
    }
  }

  /**
   * Get template categories
   * GET /api/v1/trips/templates/categories
   */
  async getTemplateCategories(req, res) {
    try {
      const cacheKey = generateCacheKey.templateCategories();
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      const { TripTemplate, Sequelize } = require('../models');

      const categories = await TripTemplate.findAll({
        attributes: [
          'category',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: {
          is_active: true,
          category: { [Sequelize.Op.ne]: null }
        },
        group: ['category'],
        order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
        raw: true
      });

      const result = categories.map(cat => ({
        name: cat.category,
        count: parseInt(cat.count)
      }));

      // Cache results for 1 hour
      await cache.set(cacheKey, result, 3600);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get template categories controller error:', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get template categories',
        error: 'GET_CATEGORIES_ERROR'
      });
    }
  }

  /**
   * Format template response
   * @private
   */
  formatTemplateResponse(template) {
    const templateData = template.toJSON ? template.toJSON() : template;

    return {
      id: templateData.id,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      tags: templateData.tags,
      isPublic: templateData.is_public,
      usageCount: templateData.usage_count,
      lastUsedAt: templateData.last_used_at,
      
      tripData: {
        title: templateData.trip_data.title,
        type: templateData.trip_data.type || templateData.trip_data.trip_type,
        route: {
          origin: templateData.trip_data.origin?.address,
          destination: templateData.trip_data.destination?.address
        },
        capacity: templateData.trip_data.capacity,
        pricing: templateData.trip_data.pricing,
        restrictions: templateData.trip_data.restrictions,
        preferences: templateData.trip_data.preferences
      },

      metadata: {
        createdAt: templateData.created_at,
        updatedAt: templateData.updated_at
      }
    };
  }

  /**
   * Format public template response (limited info)
   * @private
   */
  formatPublicTemplateResponse(template) {
    const formatted = this.formatTemplateResponse(template);
    
    // Remove owner information for public templates
    delete formatted.userId;
    
    return formatted;
  }

  /**
   * Validate trip data in template
   * @private
   */
  validateTripData(tripData) {
    const errors = [];

    // Check required fields
    if (!tripData.title) errors.push('Title is required');
    if (!tripData.type && !tripData.trip_type) errors.push('Trip type is required');
    if (!tripData.origin?.address) errors.push('Origin address is required');
    if (!tripData.destination?.address) errors.push('Destination address is required');
    if (!tripData.capacity) errors.push('Capacity is required');
    if (!tripData.pricing) errors.push('Pricing is required');

    // Validate capacity
    if (tripData.capacity) {
      if (!tripData.capacity.weight || tripData.capacity.weight <= 0) {
        errors.push('Weight capacity must be greater than 0');
      }
      if (!tripData.capacity.volume || tripData.capacity.volume <= 0) {
        errors.push('Volume capacity must be greater than 0');
      }
      if (!tripData.capacity.items || tripData.capacity.items <= 0) {
        errors.push('Item capacity must be greater than 0');
      }
    }

    // Validate pricing
    if (tripData.pricing) {
      if (tripData.pricing.basePrice === undefined || tripData.pricing.basePrice < 0) {
        errors.push('Base price must be 0 or greater');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear user templates cache
   * @private
   */
  async clearUserTemplatesCache(userId) {
    try {
      const patterns = [
        `user-templates:${userId}:*`,
        'public-templates:*',
        'popular-templates:*',
        'template-categories'
      ];

      for (const pattern of patterns) {
        await cache.delPattern(pattern);
      }
    } catch (error) {
      logger.error('Clear templates cache error:', {
        userId,
        error: error.message
      });
    }
  }
}

// Extend cache key generation for templates
Object.assign(generateCacheKey, {
  userTemplates: (userId, filters) => {
    const filterStr = Object.keys(filters).length > 0 
      ? `:${Buffer.from(JSON.stringify(filters)).toString('base64')}`
      : '';
    return `user-templates:${userId}${filterStr}`;
  },
  publicTemplates: (filters) => {
    const filterStr = Object.keys(filters).length > 0 
      ? `:${Buffer.from(JSON.stringify(filters)).toString('base64')}`
      : '';
    return `public-templates${filterStr}`;
  },
  popularTemplates: (limit) => `popular-templates:${limit}`,
  templateSearch: (params) => {
    const paramsStr = Buffer.from(JSON.stringify(params)).toString('base64');
    return `template-search:${paramsStr}`;
  },
  templateCategories: () => 'template-categories'
});

module.exports = new TemplateController();