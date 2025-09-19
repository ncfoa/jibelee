const { DeliveryRequest, DeliveryOffer, Delivery, sequelize } = require('../models');
const { cache } = require('../config/redis');
const { Op } = require('sequelize');
const moment = require('moment');

class OfferService {
  constructor() {
    this.cacheTimeout = 300; // 5 minutes
  }

  async submitOffer(travelerId, requestId, offerData) {
    const transaction = await sequelize.transaction();
    
    try {
      // Validate offer eligibility
      await this.validateOfferEligibility(travelerId, requestId, transaction);
      
      // Check if traveler already has an offer for this request
      const existingOffer = await DeliveryOffer.findOne({
        where: {
          deliveryRequestId: requestId,
          travelerId,
          status: ['pending', 'accepted']
        },
        transaction
      });

      if (existingOffer) {
        throw new Error('You already have an active offer for this request');
      }

      // Get the delivery request
      const request = await DeliveryRequest.findByPk(requestId, { transaction });
      if (!request) {
        throw new Error('Delivery request not found');
      }

      if (!request.canReceiveOffers()) {
        throw new Error('This delivery request is not accepting offers');
      }

      // Validate pricing
      if (offerData.price > request.maxPrice) {
        throw new Error('Offer price exceeds maximum price');
      }

      if (offerData.price <= 0) {
        throw new Error('Offer price must be greater than zero');
      }

      // Check traveler restrictions
      if (request.blacklistedTravelers && request.blacklistedTravelers.includes(travelerId)) {
        throw new Error('You are not eligible to make offers on this request');
      }

      // Set default valid until (24 hours from now)
      const validUntil = offerData.validUntil || moment().add(24, 'hours').toDate();

      // Create the offer
      const offer = await DeliveryOffer.create({
        deliveryRequestId: requestId,
        travelerId,
        tripId: offerData.tripId,
        price: offerData.price,
        message: offerData.message,
        estimatedPickupTime: offerData.estimatedPickupTime,
        estimatedDeliveryTime: offerData.estimatedDeliveryTime,
        guarantees: offerData.guarantees || {},
        specialServices: offerData.specialServices || {},
        validUntil
      }, { transaction });

      await transaction.commit();

      // Clear caches
      await this.clearOfferCaches(requestId, travelerId);

      // Check for auto-acceptance
      if (request.autoAcceptPrice && offerData.price <= request.autoAcceptPrice) {
        setTimeout(() => this.autoAcceptOffer(offer.id), 1000);
      }

      // TODO: Send real-time notification to customer
      // await this.notificationService.sendOfferNotification(request.customerId, offer);

      return offer;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getRequestOffers(requestId, customerId = null) {
    const cacheKey = `request_offers:${requestId}:${customerId || 'public'}`;
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Verify access if customerId provided
    if (customerId) {
      const request = await DeliveryRequest.findOne({
        where: { id: requestId, customerId }
      });
      
      if (!request) {
        throw new Error('Delivery request not found or unauthorized');
      }
    }

    const offers = await DeliveryOffer.findAll({
      where: { deliveryRequestId: requestId },
      order: [
        ['status', 'ASC'], // Pending first
        ['price', 'ASC'],  // Lowest price first
        ['createdAt', 'ASC'] // Oldest first for same price
      ]
    });

    const result = offers.map(offer => {
      const offerData = offer.toJSON();
      offerData.isExpired = offer.isExpired();
      offerData.isValid = offer.isValid();
      offerData.canBeAccepted = offer.canBeAccepted();
      return offerData;
    });

    // Cache for 5 minutes
    await cache.set(cacheKey, result, this.cacheTimeout);

    return result;
  }

  async getTravelerOffers(travelerId, options = {}) {
    const {
      status,
      type = 'sent', // sent or received
      page = 1,
      limit = 20
    } = options;

    const offset = (page - 1) * limit;
    const where = { travelerId };

    if (status) {
      where.status = status;
    }

    const { count, rows } = await DeliveryOffer.findAndCountAll({
      where,
      include: [
        {
          model: DeliveryRequest,
          as: 'deliveryRequest',
          attributes: ['id', 'title', 'customerId', 'category', 'urgency', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const offers = rows.map(offer => {
      const result = offer.toJSON();
      result.type = 'sent';
      result.isExpired = offer.isExpired();
      result.canBeWithdrawn = offer.canBeWithdrawn();
      return result;
    });

    return {
      offers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async updateOffer(offerId, travelerId, updateData) {
    const transaction = await sequelize.transaction();
    
    try {
      const offer = await DeliveryOffer.findOne({
        where: { id: offerId, travelerId },
        include: [
          {
            model: DeliveryRequest,
            as: 'deliveryRequest'
          }
        ],
        transaction
      });

      if (!offer) {
        throw new Error('Offer not found or unauthorized');
      }

      if (offer.status !== 'pending') {
        throw new Error('Can only update pending offers');
      }

      if (offer.isExpired()) {
        throw new Error('Cannot update expired offer');
      }

      // Validate new price if provided
      if (updateData.price) {
        if (updateData.price > offer.deliveryRequest.maxPrice) {
          throw new Error('Updated price exceeds maximum price');
        }
        
        if (updateData.price <= 0) {
          throw new Error('Price must be greater than zero');
        }
      }

      // Update the offer
      await offer.update({
        ...updateData,
        updatedAt: new Date()
      }, { transaction });

      await transaction.commit();

      // Clear caches
      await this.clearOfferCaches(offer.deliveryRequestId, travelerId);

      return offer;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async acceptOffer(customerId, offerId, acceptanceData = {}) {
    const transaction = await sequelize.transaction();
    
    try {
      const offer = await DeliveryOffer.findOne({
        where: { id: offerId },
        include: [
          {
            model: DeliveryRequest,
            as: 'deliveryRequest'
          }
        ],
        lock: true,
        transaction
      });

      if (!offer) {
        throw new Error('Offer not found');
      }

      const request = offer.deliveryRequest;
      
      if (request.customerId !== customerId) {
        throw new Error('Not authorized to accept this offer');
      }

      if (!offer.canBeAccepted()) {
        throw new Error('Offer cannot be accepted in current state');
      }

      if (!request.canReceiveOffers()) {
        throw new Error('Request is not accepting offers');
      }

      // Accept the offer
      await offer.accept(transaction);

      // Decline all other offers for this request
      await DeliveryOffer.declineOtherOffers(request.id, offerId, transaction);

      // Update request status
      await request.update({ status: 'accepted' }, { transaction });

      // Create delivery record
      const deliveryNumber = await Delivery.generateDeliveryNumber();
      
      const delivery = await Delivery.create({
        deliveryRequestId: request.id,
        offerId: offer.id,
        customerId: request.customerId,
        travelerId: offer.travelerId,
        tripId: offer.tripId,
        deliveryNumber,
        finalPrice: offer.price,
        specialRequests: acceptanceData.specialRequests
      }, { transaction });

      await transaction.commit();

      // Clear caches
      await this.clearOfferCaches(request.id, offer.travelerId);

      // TODO: Reserve trip capacity
      // await this.capacityService.reserveCapacity(offer.tripId, {...}, delivery.id);

      // TODO: Send notifications
      // await this.notificationService.sendOfferAcceptedNotification(offer.travelerId, delivery);
      // await this.notificationService.sendDeliveryCreatedNotification(request.customerId, delivery);

      return {
        delivery,
        offer,
        request
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async declineOffer(customerId, offerId, declineData) {
    const transaction = await sequelize.transaction();
    
    try {
      const offer = await DeliveryOffer.findOne({
        where: { id: offerId },
        include: [
          {
            model: DeliveryRequest,
            as: 'deliveryRequest'
          }
        ],
        transaction
      });

      if (!offer) {
        throw new Error('Offer not found');
      }

      if (offer.deliveryRequest.customerId !== customerId) {
        throw new Error('Not authorized to decline this offer');
      }

      if (offer.status !== 'pending') {
        throw new Error('Can only decline pending offers');
      }

      // Decline the offer
      await offer.decline(declineData.reason || declineData.message, transaction);

      await transaction.commit();

      // Clear caches
      await this.clearOfferCaches(offer.deliveryRequestId, offer.travelerId);

      // TODO: Send notification to traveler
      // await this.notificationService.sendOfferDeclinedNotification(offer.travelerId, offer, declineData);

      return offer;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async withdrawOffer(travelerId, offerId, withdrawData) {
    const transaction = await sequelize.transaction();
    
    try {
      const offer = await DeliveryOffer.findOne({
        where: { id: offerId, travelerId },
        transaction
      });

      if (!offer) {
        throw new Error('Offer not found or unauthorized');
      }

      if (!offer.canBeWithdrawn()) {
        throw new Error('Cannot withdraw offer in current state');
      }

      // Withdraw the offer
      await offer.withdraw(transaction);

      await transaction.commit();

      // Clear caches
      await this.clearOfferCaches(offer.deliveryRequestId, travelerId);

      // TODO: Send notification to customer
      // await this.notificationService.sendOfferWithdrawnNotification(customerId, offer, withdrawData);

      return offer;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async autoAcceptOffer(offerId) {
    try {
      const offer = await DeliveryOffer.findOne({
        where: { id: offerId },
        include: [
          {
            model: DeliveryRequest,
            as: 'deliveryRequest'
          }
        ]
      });

      if (!offer || !offer.canBeAccepted()) {
        return;
      }

      const request = offer.deliveryRequest;
      
      if (!request.autoAcceptPrice || offer.price > request.autoAcceptPrice) {
        return;
      }

      // Auto-accept the offer
      await this.acceptOffer(request.customerId, offerId, {
        specialRequests: 'Auto-accepted based on your criteria'
      });

      console.log(`Auto-accepted offer ${offerId} for request ${request.id}`);
    } catch (error) {
      console.error('Auto-accept failed:', error.message);
    }
  }

  async expireOffers() {
    const expiredOffers = await DeliveryOffer.findExpiredOffers();
    
    if (expiredOffers.length === 0) {
      return { expired: 0 };
    }

    await DeliveryOffer.update(
      { status: 'expired' },
      {
        where: {
          id: expiredOffers.map(offer => offer.id)
        }
      }
    );

    // Clear caches for affected requests
    const requestIds = [...new Set(expiredOffers.map(offer => offer.deliveryRequestId))];
    await Promise.all(requestIds.map(requestId => this.clearOfferCaches(requestId)));

    return { expired: expiredOffers.length };
  }

  async getOfferStatistics(filters = {}) {
    const where = {};
    
    if (filters.travelerId) {
      where.travelerId = filters.travelerId;
    }
    
    if (filters.dateFrom) {
      where.createdAt = {
        [Op.gte]: filters.dateFrom
      };
    }
    
    if (filters.dateTo) {
      where.createdAt = {
        ...where.createdAt,
        [Op.lte]: filters.dateTo
      };
    }

    const offers = await DeliveryOffer.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.fn('AVG', sequelize.col('price')), 'averagePrice'],
        [sequelize.fn('MIN', sequelize.col('price')), 'minPrice'],
        [sequelize.fn('MAX', sequelize.col('price')), 'maxPrice']
      ],
      group: ['status'],
      raw: true
    });

    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
      withdrawn: 0,
      averagePrice: 0,
      minPrice: null,
      maxPrice: null,
      acceptanceRate: 0
    };

    offers.forEach(offer => {
      const status = offer.status;
      const count = parseInt(offer.count);
      
      stats[status] = count;
      stats.total += count;
      
      if (offer.averagePrice) {
        stats.averagePrice = parseFloat(offer.averagePrice);
      }
      
      if (offer.minPrice !== null) {
        stats.minPrice = stats.minPrice === null ? 
          parseFloat(offer.minPrice) : 
          Math.min(stats.minPrice, parseFloat(offer.minPrice));
      }
      
      if (offer.maxPrice !== null) {
        stats.maxPrice = stats.maxPrice === null ? 
          parseFloat(offer.maxPrice) : 
          Math.max(stats.maxPrice, parseFloat(offer.maxPrice));
      }
    });

    if (stats.total > 0) {
      stats.acceptanceRate = ((stats.accepted / stats.total) * 100).toFixed(2);
    }

    return stats;
  }

  // Private helper methods
  async validateOfferEligibility(travelerId, requestId, transaction) {
    const request = await DeliveryRequest.findByPk(requestId, { transaction });
    
    if (!request) {
      throw new Error('Delivery request not found');
    }

    // Check if request belongs to the same traveler (can't offer on own request)
    if (request.customerId === travelerId) {
      throw new Error('Cannot make offers on your own delivery requests');
    }

    // Check minimum rating requirement
    if (request.minTravelerRating > 0) {
      // TODO: Get traveler rating from user service
      // const travelerRating = await this.userService.getTravelerRating(travelerId);
      // if (travelerRating < request.minTravelerRating) {
      //   throw new Error('Your rating does not meet the minimum requirement');
      // }
    }

    // Check verification requirements
    if (request.verificationRequired) {
      // TODO: Check traveler verification status
      // const isVerified = await this.userService.isTravelerVerified(travelerId);
      // if (!isVerified) {
      //   throw new Error('Verification required for this request');
      // }
    }

    return true;
  }

  async clearOfferCaches(requestId, travelerId = null) {
    const keys = [
      `request_offers:${requestId}:*`,
      'offer_statistics:*'
    ];
    
    if (travelerId) {
      keys.push(`traveler_offers:${travelerId}:*`);
    }
    
    // TODO: Implement pattern-based cache clearing
    // For now, clear specific keys
    await cache.del(`request_offers:${requestId}`);
    
    if (travelerId) {
      await cache.del(`traveler_offers:${travelerId}`);
    }
  }
}

module.exports = new OfferService();