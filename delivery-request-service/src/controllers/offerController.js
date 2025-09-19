const offerService = require('../services/offerService');
const { validationResult } = require('express-validator');

class OfferController {
  // POST /api/v1/delivery-requests/:requestId/offers
  async createOffer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { requestId } = req.params;
      const travelerId = req.user.id;

      const offer = await offerService.submitOffer(travelerId, requestId, req.body);

      res.status(201).json({
        success: true,
        data: {
          id: offer.id,
          requestId: offer.deliveryRequestId,
          traveler: {
            id: travelerId,
            firstName: req.user.firstName,
            lastName: req.user.lastName
          },
          price: offer.price,
          status: offer.status,
          estimatedPickupTime: offer.estimatedPickupTime,
          estimatedDeliveryTime: offer.estimatedDeliveryTime,
          createdAt: offer.createdAt
        }
      });
    } catch (error) {
      console.error('Create offer error:', error);
      const statusCode = error.message.includes('not found') ? 404 :
                         error.message.includes('already have') || 
                         error.message.includes('not accepting') ||
                         error.message.includes('not eligible') ? 409 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create offer'
      });
    }
  }

  // GET /api/v1/delivery-requests/:requestId/offers
  async getRequestOffers(req, res) {
    try {
      const { requestId } = req.params;
      const customerId = req.user?.role === 'customer' ? req.user.id : null;

      const offers = await offerService.getRequestOffers(requestId, customerId);

      // Transform offers for response
      const transformedOffers = offers.map(offer => ({
        id: offer.id,
        traveler: {
          id: offer.travelerId,
          // TODO: Get traveler details from user service
          firstName: 'Traveler',
          lastName: 'User',
          profilePicture: null,
          rating: {
            average: 4.5,
            count: 10
          },
          verificationLevel: 'verified',
          statistics: {
            totalDeliveries: 25,
            successRate: 96.0,
            onTimeRate: 94.5
          }
        },
        price: offer.price,
        message: offer.message,
        trip: offer.tripId ? {
          id: offer.tripId,
          title: 'Trip Details',
          type: 'flight',
          departureTime: offer.estimatedPickupTime
        } : null,
        timeline: {
          estimatedPickupTime: offer.estimatedPickupTime,
          estimatedDeliveryTime: offer.estimatedDeliveryTime
        },
        guarantees: offer.guarantees || {},
        status: offer.status,
        createdAt: offer.createdAt,
        validUntil: offer.validUntil,
        isExpired: offer.isExpired,
        canBeAccepted: offer.canBeAccepted
      }));

      res.json({
        success: true,
        data: transformedOffers
      });
    } catch (error) {
      console.error('Get request offers error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get offers'
      });
    }
  }

  // GET /api/v1/offers/my-offers
  async getMyOffers(req, res) {
    try {
      const travelerId = req.user.id;
      const options = {
        status: req.query.status,
        type: req.query.type || 'sent',
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await offerService.getTravelerOffers(travelerId, options);

      res.json({
        success: true,
        data: result.offers,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get my offers error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get offers'
      });
    }
  }

  // PUT /api/v1/offers/:offerId
  async updateOffer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { offerId } = req.params;
      const travelerId = req.user.id;

      const offer = await offerService.updateOffer(offerId, travelerId, req.body);

      res.json({
        success: true,
        data: offer,
        message: 'Offer updated successfully'
      });
    } catch (error) {
      console.error('Update offer error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 :
                         error.message.includes('Can only update') || 
                         error.message.includes('Cannot update') ? 409 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update offer'
      });
    }
  }

  // POST /api/v1/offers/:offerId/accept
  async acceptOffer(req, res) {
    try {
      const { offerId } = req.params;
      const customerId = req.user.id;
      const acceptanceData = {
        message: req.body.message,
        paymentMethod: req.body.paymentMethod,
        specialRequests: req.body.specialRequests
      };

      const result = await offerService.acceptOffer(customerId, offerId, acceptanceData);

      res.json({
        success: true,
        data: {
          deliveryId: result.delivery.id,
          status: 'accepted',
          traveler: {
            id: result.offer.travelerId,
            firstName: 'Traveler',
            lastName: 'User',
            phoneNumber: '+1234567890' // TODO: Get from user service
          },
          finalPrice: result.delivery.finalPrice,
          estimatedPickupTime: result.offer.estimatedPickupTime,
          estimatedDeliveryTime: result.offer.estimatedDeliveryTime,
          qrCodes: {
            pickup: 'pickup_qr_code_data', // TODO: Generate QR codes
            delivery: 'delivery_qr_code_data'
          },
          contractId: `contract-${result.delivery.id}`
        }
      });
    } catch (error) {
      console.error('Accept offer error:', error);
      const statusCode = error.message.includes('not found') ? 404 :
                         error.message.includes('not authorized') ? 403 :
                         error.message.includes('cannot be accepted') ||
                         error.message.includes('not accepting') ? 409 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to accept offer'
      });
    }
  }

  // POST /api/v1/offers/:offerId/decline
  async declineOffer(req, res) {
    try {
      const { offerId } = req.params;
      const customerId = req.user.id;
      const declineData = {
        reason: req.body.reason,
        message: req.body.message
      };

      const offer = await offerService.declineOffer(customerId, offerId, declineData);

      res.json({
        success: true,
        data: {
          id: offer.id,
          status: offer.status,
          declinedAt: offer.declinedAt,
          declinedReason: offer.declinedReason
        },
        message: 'Offer declined successfully'
      });
    } catch (error) {
      console.error('Decline offer error:', error);
      const statusCode = error.message.includes('not found') ? 404 :
                         error.message.includes('not authorized') ? 403 :
                         error.message.includes('Can only decline') ? 409 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to decline offer'
      });
    }
  }

  // DELETE /api/v1/offers/:offerId
  async withdrawOffer(req, res) {
    try {
      const { offerId } = req.params;
      const travelerId = req.user.id;
      const withdrawData = {
        reason: req.body.reason,
        message: req.body.message
      };

      const offer = await offerService.withdrawOffer(travelerId, offerId, withdrawData);

      res.json({
        success: true,
        data: {
          id: offer.id,
          status: offer.status
        },
        message: 'Offer withdrawn successfully'
      });
    } catch (error) {
      console.error('Withdraw offer error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 :
                         error.message.includes('Cannot withdraw') ? 409 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to withdraw offer'
      });
    }
  }

  // GET /api/v1/offers/statistics
  async getOfferStatistics(req, res) {
    try {
      const travelerId = req.user?.role === 'traveler' ? req.user.id : null;
      const filters = {
        travelerId,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : null,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo) : null
      };

      const statistics = await offerService.getOfferStatistics(filters);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get offer statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get offer statistics'
      });
    }
  }
}

module.exports = new OfferController();