const { DeliveryRequest, DeliveryOffer, Delivery, sequelize } = require('../models');
const { cache } = require('../config/redis');
const { Op } = require('sequelize');
const moment = require('moment');
const geolib = require('geolib');

class DeliveryRequestService {
  constructor() {
    this.cacheTimeout = 300; // 5 minutes
  }

  async createDeliveryRequest(customerId, requestData) {
    const transaction = await sequelize.transaction();
    
    try {
      // Validate coordinates
      if (requestData.pickup?.coordinates) {
        requestData.pickupCoordinates = {
          type: 'Point',
          coordinates: [requestData.pickup.coordinates.lng, requestData.pickup.coordinates.lat]
        };
      }
      
      if (requestData.delivery?.coordinates) {
        requestData.deliveryCoordinates = {
          type: 'Point',
          coordinates: [requestData.delivery.coordinates.lng, requestData.delivery.coordinates.lat]
        };
      }

      // Calculate estimated price based on distance and other factors
      const estimatedPrice = await this.calculateEstimatedPrice(requestData);
      
      // Set expiration date (default 7 days from now)
      const expiresAt = requestData.expiresAt || moment().add(7, 'days').toDate();

      const deliveryRequest = await DeliveryRequest.create({
        customerId,
        title: requestData.title,
        description: requestData.description,
        category: requestData.category,
        urgency: requestData.urgency || 'standard',
        
        // Item details
        itemName: requestData.item.name,
        itemDescription: requestData.item.description,
        quantity: requestData.item.quantity || 1,
        weight: requestData.item.weight,
        dimensions: requestData.item.dimensions,
        value: requestData.item.value,
        isFragile: requestData.item.isFragile || false,
        isPerishable: requestData.item.isPerishable || false,
        isHazardous: requestData.item.isHazardous || false,
        requiresSignature: requestData.item.requiresSignature || false,
        itemImages: requestData.item.images || [],

        // Pickup details
        pickupAddress: requestData.pickup.address,
        pickupCoordinates: requestData.pickupCoordinates,
        pickupContactName: requestData.pickup.contactName,
        pickupContactPhone: requestData.pickup.contactPhone,
        pickupInstructions: requestData.pickup.instructions,
        pickupTimeStart: requestData.pickup.timeWindow?.start,
        pickupTimeEnd: requestData.pickup.timeWindow?.end,
        flexiblePickupTiming: requestData.pickup.flexibleTiming || false,
        preferredPickupDays: requestData.pickup.preferredDays || [],

        // Delivery details
        deliveryAddress: requestData.delivery.address,
        deliveryCoordinates: requestData.deliveryCoordinates,
        deliveryContactName: requestData.delivery.contactName,
        deliveryContactPhone: requestData.delivery.contactPhone,
        deliveryInstructions: requestData.delivery.instructions,
        deliveryTimeStart: requestData.delivery.timeWindow?.start,
        deliveryTimeEnd: requestData.delivery.timeWindow?.end,
        requiresRecipientPresence: requestData.delivery.requiresRecipientPresence || false,

        // Pricing
        maxPrice: requestData.pricing?.maxPrice || requestData.maxPrice,
        autoAcceptPrice: requestData.pricing?.autoAcceptPrice || requestData.autoAcceptPrice,
        estimatedPrice,

        // Preferences
        preferredTravelers: requestData.preferences?.preferredTravelers || [],
        blacklistedTravelers: requestData.preferences?.blacklistedTravelers || [],
        minTravelerRating: requestData.preferences?.minTravelerRating || 0,
        verificationRequired: requestData.preferences?.verificationRequired || false,
        insuranceRequired: requestData.preferences?.insuranceRequired || false,
        backgroundCheckRequired: requestData.preferences?.backgroundCheckRequired || false,

        // Metadata
        notificationPreferences: requestData.notifications || {},
        specialInstructions: requestData.specialInstructions,
        tags: requestData.tags || [],
        expiresAt
      }, { transaction });

      await transaction.commit();

      // Trigger matching process in background
      this.triggerMatching(deliveryRequest.id);

      // Clear relevant caches
      await this.clearCaches(customerId);

      return deliveryRequest;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getDeliveryRequest(requestId, userId = null, userRole = null) {
    const cacheKey = `delivery_request:${requestId}:${userId || 'public'}`;
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const deliveryRequest = await DeliveryRequest.findByPk(requestId, {
      include: [
        {
          model: DeliveryOffer,
          as: 'offers',
          where: userRole === 'customer' || userRole === 'admin' ? {} : 
                 userId ? { travelerId: userId } : { status: 'accepted' },
          required: false,
          order: [['price', 'ASC']]
        },
        {
          model: Delivery,
          as: 'delivery',
          required: false
        }
      ]
    });

    if (!deliveryRequest) {
      return null;
    }

    // Check access permissions
    if (userId && userRole === 'customer' && deliveryRequest.customerId !== userId) {
      return null;
    }

    const result = deliveryRequest.toJSON();
    
    // Add calculated fields
    result.distance = deliveryRequest.calculateDistance();
    result.isExpired = deliveryRequest.isExpired();
    result.canReceiveOffers = deliveryRequest.canReceiveOffers();
    
    // Add offer statistics
    if (result.offers && result.offers.length > 0) {
      result.offerStats = await DeliveryOffer.getOfferStatistics(requestId);
    }

    // Cache for 5 minutes
    await cache.set(cacheKey, result, this.cacheTimeout);

    return result;
  }

  async getCustomerRequests(customerId, options = {}) {
    const {
      status,
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const where = { customerId };
    
    if (status) {
      where.status = status;
    }

    const { count, rows } = await DeliveryRequest.findAndCountAll({
      where,
      include: [
        {
          model: DeliveryOffer,
          as: 'offers',
          attributes: ['id', 'travelerId', 'price', 'status', 'createdAt'],
          required: false
        },
        {
          model: Delivery,
          as: 'delivery',
          attributes: ['id', 'status', 'deliveryNumber'],
          required: false
        }
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset
    });

    const requests = rows.map(request => {
      const result = request.toJSON();
      result.distance = request.calculateDistance();
      result.isExpired = request.isExpired();
      result.offersCount = result.offers ? result.offers.length : 0;
      result.pendingOffers = result.offers ? 
        result.offers.filter(offer => offer.status === 'pending').length : 0;
      return result;
    });

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async updateDeliveryRequest(requestId, customerId, updateData) {
    const transaction = await sequelize.transaction();
    
    try {
      const deliveryRequest = await DeliveryRequest.findOne({
        where: { id: requestId, customerId },
        transaction
      });

      if (!deliveryRequest) {
        throw new Error('Delivery request not found or unauthorized');
      }

      if (!deliveryRequest.canReceiveOffers()) {
        throw new Error('Cannot update delivery request in current status');
      }

      // Update coordinates if provided
      if (updateData.pickup?.coordinates) {
        updateData.pickupCoordinates = {
          type: 'Point',
          coordinates: [updateData.pickup.coordinates.lng, updateData.pickup.coordinates.lat]
        };
      }
      
      if (updateData.delivery?.coordinates) {
        updateData.deliveryCoordinates = {
          type: 'Point',
          coordinates: [updateData.delivery.coordinates.lng, updateData.delivery.coordinates.lat]
        };
      }

      // Recalculate estimated price if relevant fields changed
      if (updateData.pickup || updateData.delivery || updateData.item) {
        updateData.estimatedPrice = await this.calculateEstimatedPrice({
          ...deliveryRequest.toJSON(),
          ...updateData
        });
      }

      await deliveryRequest.update(updateData, { transaction });
      await transaction.commit();

      // Clear caches
      await this.clearCaches(customerId, requestId);

      return deliveryRequest;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancelDeliveryRequest(requestId, customerId, cancellationData) {
    const transaction = await sequelize.transaction();
    
    try {
      const deliveryRequest = await DeliveryRequest.findOne({
        where: { id: requestId, customerId },
        include: [
          {
            model: DeliveryOffer,
            as: 'offers',
            where: { status: 'pending' },
            required: false
          }
        ],
        transaction
      });

      if (!deliveryRequest) {
        throw new Error('Delivery request not found or unauthorized');
      }

      if (deliveryRequest.status === 'cancelled') {
        throw new Error('Delivery request is already cancelled');
      }

      if (deliveryRequest.status === 'delivered') {
        throw new Error('Cannot cancel completed delivery request');
      }

      // Update request status
      await deliveryRequest.update({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: cancellationData.reason
      }, { transaction });

      // Decline all pending offers
      if (deliveryRequest.offers && deliveryRequest.offers.length > 0) {
        await DeliveryOffer.update({
          status: 'declined',
          declinedAt: new Date(),
          declinedReason: 'Request cancelled by customer'
        }, {
          where: {
            deliveryRequestId: requestId,
            status: 'pending'
          },
          transaction
        });
      }

      await transaction.commit();

      // Clear caches
      await this.clearCaches(customerId, requestId);

      // TODO: Send notifications to travelers with pending offers

      return deliveryRequest;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async searchDeliveryRequests(searchCriteria, travelerId = null) {
    const {
      origin,
      destination,
      originLat,
      originLng,
      destinationLat,
      destinationLng,
      radius = 50,
      category,
      urgency,
      minPrice,
      maxPrice,
      maxWeight,
      pickupDateFrom,
      pickupDateTo,
      sortBy = 'created_at',
      page = 1,
      limit = 20
    } = searchCriteria;

    const offset = (page - 1) * limit;
    const where = {
      status: 'pending',
      expiresAt: {
        [Op.gt]: new Date()
      }
    };

    // Category filter
    if (category) {
      where.category = category;
    }

    // Urgency filter
    if (urgency) {
      where.urgency = urgency;
    }

    // Price filters
    if (minPrice) {
      where.maxPrice = {
        ...where.maxPrice,
        [Op.gte]: minPrice
      };
    }

    if (maxPrice) {
      where.maxPrice = {
        ...where.maxPrice,
        [Op.lte]: maxPrice
      };
    }

    // Weight filter
    if (maxWeight) {
      where.weight = {
        [Op.lte]: maxWeight
      };
    }

    // Date filters
    if (pickupDateFrom || pickupDateTo) {
      const dateFilter = {};
      if (pickupDateFrom) {
        dateFilter[Op.gte] = new Date(pickupDateFrom);
      }
      if (pickupDateTo) {
        dateFilter[Op.lte] = new Date(pickupDateTo);
      }
      where.pickupTimeStart = dateFilter;
    }

    // Geospatial filters
    if ((originLat && originLng) || (destinationLat && destinationLng)) {
      const spatialConditions = [];
      
      if (originLat && originLng) {
        spatialConditions.push(
          sequelize.where(
            sequelize.fn(
              'ST_DWithin',
              sequelize.col('pickup_coordinates'),
              sequelize.fn('ST_GeomFromText', `POINT(${originLng} ${originLat})`, 4326),
              radius * 1000 // Convert km to meters
            ),
            true
          )
        );
      }
      
      if (destinationLat && destinationLng) {
        spatialConditions.push(
          sequelize.where(
            sequelize.fn(
              'ST_DWithin',
              sequelize.col('delivery_coordinates'),
              sequelize.fn('ST_GeomFromText', `POINT(${destinationLng} ${destinationLat})`, 4326),
              radius * 1000
            ),
            true
          )
        );
      }
      
      where[Op.and] = spatialConditions;
    }

    // Exclude blacklisted traveler
    if (travelerId) {
      where.blacklistedTravelers = {
        [Op.not]: {
          [Op.contains]: [travelerId]
        }
      };
    }

    const orderMapping = {
      price: ['maxPrice', 'ASC'],
      distance: ['createdAt', 'ASC'], // TODO: Calculate actual distance
      created: ['createdAt', 'DESC'],
      urgency: [
        [sequelize.literal(`CASE WHEN urgency = 'urgent' THEN 1 WHEN urgency = 'express' THEN 2 ELSE 3 END`), 'ASC'],
        ['createdAt', 'DESC']
      ]
    };

    const order = orderMapping[sortBy] || ['createdAt', 'DESC'];

    const { count, rows } = await DeliveryRequest.findAndCountAll({
      where,
      attributes: {
        include: [
          // Calculate distance if coordinates provided
          ...(originLat && originLng && destinationLat && destinationLng ? [[
            sequelize.fn(
              'ST_Distance',
              sequelize.col('pickup_coordinates'),
              sequelize.col('delivery_coordinates')
            ),
            'route_distance'
          ]] : [])
        ]
      },
      order: Array.isArray(order[0]) ? order : [order],
      limit: parseInt(limit),
      offset
    });

    const requests = rows.map(request => {
      const result = request.toJSON();
      result.distance = request.calculateDistance();
      result.isExpired = request.isExpired();
      return result;
    });

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async duplicateDeliveryRequest(requestId, customerId, modifications = {}) {
    const originalRequest = await DeliveryRequest.findOne({
      where: { id: requestId, customerId }
    });

    if (!originalRequest) {
      throw new Error('Original delivery request not found or unauthorized');
    }

    const duplicateData = {
      ...originalRequest.toJSON(),
      ...modifications
    };

    // Remove fields that shouldn't be duplicated
    delete duplicateData.id;
    delete duplicateData.status;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.cancelledAt;
    delete duplicateData.cancellationReason;

    return await this.createDeliveryRequest(customerId, duplicateData);
  }

  async getPopularRoutes(options = {}) {
    const {
      period = 'month',
      category,
      limit = 10
    } = options;

    const cacheKey = `popular_routes:${period}:${category || 'all'}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    let dateFilter;
    switch (period) {
      case 'week':
        dateFilter = moment().subtract(1, 'week').toDate();
        break;
      case 'quarter':
        dateFilter = moment().subtract(3, 'months').toDate();
        break;
      default:
        dateFilter = moment().subtract(1, 'month').toDate();
    }

    const where = {
      createdAt: {
        [Op.gte]: dateFilter
      }
    };

    if (category) {
      where.category = category;
    }

    const routes = await DeliveryRequest.findAll({
      where,
      attributes: [
        'pickupAddress',
        'deliveryAddress',
        'category',
        [sequelize.fn('COUNT', '*'), 'requestCount'],
        [sequelize.fn('AVG', sequelize.col('max_price')), 'averagePrice'],
        [sequelize.fn('AVG', sequelize.col('weight')), 'averageWeight']
      ],
      group: ['pickupAddress', 'deliveryAddress', 'category'],
      order: [[sequelize.literal('requestCount'), 'DESC']],
      limit: parseInt(limit),
      raw: true
    });

    const result = routes.map(route => ({
      route: {
        origin: route.pickupAddress,
        destination: route.deliveryAddress
      },
      requestCount: parseInt(route.requestCount),
      averagePrice: parseFloat(route.averagePrice || 0),
      averageWeight: parseFloat(route.averageWeight || 0),
      popularCategories: [route.category],
      demandLevel: route.requestCount > 10 ? 'high' : 
                   route.requestCount > 5 ? 'medium' : 'low'
    }));

    // Cache for 1 hour
    await cache.set(cacheKey, result, 3600);

    return result;
  }

  async getRequestAnalytics(requestId, customerId) {
    const deliveryRequest = await DeliveryRequest.findOne({
      where: { id: requestId, customerId },
      include: [
        {
          model: DeliveryOffer,
          as: 'offers'
        }
      ]
    });

    if (!deliveryRequest) {
      throw new Error('Delivery request not found or unauthorized');
    }

    const offers = deliveryRequest.offers || [];
    const offerStats = await DeliveryOffer.getOfferStatistics(requestId);

    // Calculate market rate (this would typically come from a pricing service)
    const marketRate = await this.calculateMarketRate(deliveryRequest);

    const timeline = [
      {
        timestamp: deliveryRequest.createdAt,
        event: 'request_created'
      }
    ];

    // Add offer events to timeline
    offers.forEach(offer => {
      timeline.push({
        timestamp: offer.createdAt,
        event: 'offer_received',
        data: { price: offer.price }
      });
      
      if (offer.acceptedAt) {
        timeline.push({
          timestamp: offer.acceptedAt,
          event: 'offer_accepted',
          data: { price: offer.price }
        });
      }
    });

    return {
      requestId,
      views: 0, // TODO: Implement view tracking
      offers: offerStats,
      priceAnalysis: {
        yourMaxPrice: deliveryRequest.maxPrice,
        averageOffer: offerStats.averagePrice,
        lowestOffer: offerStats.minPrice,
        highestOffer: offerStats.maxPrice,
        marketRate
      },
      timeline: timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    };
  }

  // Private helper methods
  async calculateEstimatedPrice(requestData) {
    // This is a simplified pricing calculation
    // In a real system, this would use the pricing service
    
    let basePrice = 10; // Base price in USD
    
    // Distance factor
    if (requestData.pickupCoordinates && requestData.deliveryCoordinates) {
      const distance = geolib.getDistance(
        {
          latitude: requestData.pickupCoordinates.coordinates[1],
          longitude: requestData.pickupCoordinates.coordinates[0]
        },
        {
          latitude: requestData.deliveryCoordinates.coordinates[1],
          longitude: requestData.deliveryCoordinates.coordinates[0]
        }
      ) / 1000; // Convert to km
      
      basePrice += distance * 0.5; // $0.50 per km
    }
    
    // Weight factor
    if (requestData.item?.weight || requestData.weight) {
      const weight = requestData.item?.weight || requestData.weight;
      basePrice += weight * 2; // $2 per kg
    }
    
    // Urgency multiplier
    const urgencyMultipliers = {
      standard: 1.0,
      express: 1.5,
      urgent: 2.0
    };
    
    const urgency = requestData.urgency || 'standard';
    basePrice *= urgencyMultipliers[urgency];
    
    // Fragile item surcharge
    if (requestData.item?.isFragile || requestData.isFragile) {
      basePrice *= 1.2;
    }
    
    return Math.round(basePrice * 100) / 100; // Round to 2 decimal places
  }

  async calculateMarketRate(deliveryRequest) {
    // Get similar requests from the last 30 days
    const similarRequests = await DeliveryRequest.findAll({
      where: {
        category: deliveryRequest.category,
        urgency: deliveryRequest.urgency,
        weight: {
          [Op.between]: [deliveryRequest.weight * 0.8, deliveryRequest.weight * 1.2]
        },
        createdAt: {
          [Op.gte]: moment().subtract(30, 'days').toDate()
        }
      },
      include: [
        {
          model: DeliveryOffer,
          as: 'offers',
          where: { status: 'accepted' },
          required: true
        }
      ]
    });

    if (similarRequests.length === 0) {
      return deliveryRequest.estimatedPrice;
    }

    const acceptedPrices = similarRequests.map(req => 
      req.offers.find(offer => offer.status === 'accepted')?.price || 0
    ).filter(price => price > 0);

    if (acceptedPrices.length === 0) {
      return deliveryRequest.estimatedPrice;
    }

    return acceptedPrices.reduce((sum, price) => sum + price, 0) / acceptedPrices.length;
  }

  async triggerMatching(requestId) {
    // This would typically trigger a background job
    // For now, we'll just log it
    console.log(`Triggering matching for delivery request ${requestId}`);
    
    // TODO: Implement actual matching trigger
    // const matchingJob = require('../jobs/matchingJob');
    // await matchingJob.add({ requestId });
  }

  async clearCaches(customerId, requestId = null) {
    const patterns = [
      `customer_requests:${customerId}:*`,
      'popular_routes:*'
    ];
    
    if (requestId) {
      patterns.push(`delivery_request:${requestId}:*`);
    }
    
    // TODO: Implement cache pattern deletion
    // For now, just clear specific keys
    await cache.del(`customer_requests:${customerId}`);
    
    if (requestId) {
      await cache.del(`delivery_request:${requestId}`);
    }
  }
}

module.exports = new DeliveryRequestService();