const deliveryRequestService = require('../services/deliveryRequestService');
const matchingService = require('../services/matchingService');
const { validationResult } = require('express-validator');

class DeliveryRequestController {
  // POST /api/v1/delivery-requests
  async createDeliveryRequest(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const customerId = req.user.id;
      const deliveryRequest = await deliveryRequestService.createDeliveryRequest(customerId, req.body);

      res.status(201).json({
        success: true,
        data: {
          id: deliveryRequest.id,
          title: deliveryRequest.title,
          status: deliveryRequest.status,
          customer: {
            id: customerId,
            firstName: req.user.firstName,
            lastName: req.user.lastName
          },
          item: {
            name: deliveryRequest.itemName,
            weight: deliveryRequest.weight,
            value: deliveryRequest.value
          },
          route: {
            origin: deliveryRequest.pickupAddress.split(',')[0],
            destination: deliveryRequest.deliveryAddress.split(',')[0],
            distance: deliveryRequest.calculateDistance()
          },
          estimatedPrice: {
            min: Math.round(deliveryRequest.estimatedPrice * 0.8 * 100) / 100,
            max: Math.round(deliveryRequest.estimatedPrice * 1.2 * 100) / 100,
            recommended: deliveryRequest.estimatedPrice
          },
          urgency: deliveryRequest.urgency,
          createdAt: deliveryRequest.createdAt,
          expiresAt: deliveryRequest.expiresAt
        }
      });
    } catch (error) {
      console.error('Create delivery request error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create delivery request'
      });
    }
  }

  // GET /api/v1/delivery-requests/:requestId
  async getDeliveryRequest(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role || 'customer';

      const deliveryRequest = await deliveryRequestService.getDeliveryRequest(requestId, userId, userRole);

      if (!deliveryRequest) {
        return res.status(404).json({
          success: false,
          message: 'Delivery request not found'
        });
      }

      res.json({
        success: true,
        data: deliveryRequest
      });
    } catch (error) {
      console.error('Get delivery request error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get delivery request'
      });
    }
  }

  // GET /api/v1/delivery-requests/my-requests
  async getMyRequests(req, res) {
    try {
      const customerId = req.user.id;
      const options = {
        status: req.query.status,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sort: req.query.sort || 'created_at',
        order: req.query.order || 'DESC'
      };

      const result = await deliveryRequestService.getCustomerRequests(customerId, options);

      res.json({
        success: true,
        data: result.requests,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get my requests error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get delivery requests'
      });
    }
  }

  // PUT /api/v1/delivery-requests/:requestId
  async updateDeliveryRequest(req, res) {
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
      const customerId = req.user.id;

      const deliveryRequest = await deliveryRequestService.updateDeliveryRequest(
        requestId, 
        customerId, 
        req.body
      );

      res.json({
        success: true,
        data: deliveryRequest,
        message: 'Delivery request updated successfully'
      });
    } catch (error) {
      console.error('Update delivery request error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 
                         error.message.includes('Cannot update') ? 409 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update delivery request'
      });
    }
  }

  // POST /api/v1/delivery-requests/:requestId/cancel
  async cancelDeliveryRequest(req, res) {
    try {
      const { requestId } = req.params;
      const customerId = req.user.id;
      const cancellationData = {
        reason: req.body.reason,
        message: req.body.message
      };

      const deliveryRequest = await deliveryRequestService.cancelDeliveryRequest(
        requestId, 
        customerId, 
        cancellationData
      );

      res.json({
        success: true,
        data: deliveryRequest,
        message: 'Delivery request cancelled successfully'
      });
    } catch (error) {
      console.error('Cancel delivery request error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 
                         error.message.includes('already cancelled') || error.message.includes('Cannot cancel') ? 409 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to cancel delivery request'
      });
    }
  }

  // GET /api/v1/delivery-requests/search
  async searchDeliveryRequests(req, res) {
    try {
      const travelerId = req.user?.role === 'traveler' ? req.user.id : null;
      const searchCriteria = {
        origin: req.query.origin,
        destination: req.query.destination,
        originLat: parseFloat(req.query.originLat),
        originLng: parseFloat(req.query.originLng),
        destinationLat: parseFloat(req.query.destinationLat),
        destinationLng: parseFloat(req.query.destinationLng),
        radius: parseInt(req.query.radius) || 50,
        category: req.query.category,
        urgency: req.query.urgency,
        minPrice: parseFloat(req.query.minPrice),
        maxPrice: parseFloat(req.query.maxPrice),
        maxWeight: parseFloat(req.query.maxWeight),
        pickupDateFrom: req.query.pickupDateFrom,
        pickupDateTo: req.query.pickupDateTo,
        sortBy: req.query.sortBy || 'created_at',
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await deliveryRequestService.searchDeliveryRequests(searchCriteria, travelerId);

      res.json({
        success: true,
        data: result.requests,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Search delivery requests error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search delivery requests'
      });
    }
  }

  // POST /api/v1/delivery-requests/:requestId/find-matches
  async findMatches(req, res) {
    try {
      const { requestId } = req.params;
      const criteria = {
        maxDistance: parseInt(req.body.maxDistance) || 10,
        maxDetour: parseInt(req.body.maxDetour) || 20,
        timeFlexibility: parseInt(req.body.timeFlexibility) || 6
      };

      const matches = await matchingService.findMatches(requestId, criteria);

      res.json({
        success: true,
        data: matches
      });
    } catch (error) {
      console.error('Find matches error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to find matches'
      });
    }
  }

  // GET /api/v1/delivery-requests/popular-routes
  async getPopularRoutes(req, res) {
    try {
      const options = {
        period: req.query.period || 'month',
        category: req.query.category,
        limit: parseInt(req.query.limit) || 10
      };

      const routes = await deliveryRequestService.getPopularRoutes(options);

      res.json({
        success: true,
        data: routes
      });
    } catch (error) {
      console.error('Get popular routes error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get popular routes'
      });
    }
  }

  // POST /api/v1/delivery-requests/:requestId/duplicate
  async duplicateDeliveryRequest(req, res) {
    try {
      const { requestId } = req.params;
      const customerId = req.user.id;
      const modifications = req.body.modifications || {};

      const newRequest = await deliveryRequestService.duplicateDeliveryRequest(
        requestId, 
        customerId, 
        modifications
      );

      res.status(201).json({
        success: true,
        data: newRequest,
        message: 'Delivery request duplicated successfully'
      });
    } catch (error) {
      console.error('Duplicate delivery request error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to duplicate delivery request'
      });
    }
  }

  // GET /api/v1/delivery-requests/:requestId/analytics
  async getRequestAnalytics(req, res) {
    try {
      const { requestId } = req.params;
      const customerId = req.user.id;

      const analytics = await deliveryRequestService.getRequestAnalytics(requestId, customerId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get request analytics error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get request analytics'
      });
    }
  }

  // GET /api/v1/delivery-requests/recommendations
  async getRecommendations(req, res) {
    try {
      // Mock recommendations for now
      const recommendations = {
        recommendations: [
          {
            type: 'similar_requests',
            title: 'Similar requests in your area',
            requests: []
          },
          {
            type: 'price_suggestions',
            title: 'Optimize your pricing',
            suggestions: []
          }
        ]
      };

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get recommendations'
      });
    }
  }

  // POST /api/v1/delivery-requests/:requestId/report
  async reportDeliveryRequest(req, res) {
    try {
      // Mock implementation for reporting
      res.json({
        success: true,
        message: 'Report submitted successfully',
        data: {
          reportId: `report-${Date.now()}`,
          status: 'submitted'
        }
      });
    } catch (error) {
      console.error('Report delivery request error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit report'
      });
    }
  }

  // GET /api/v1/delivery-requests/statistics
  async getStatistics(req, res) {
    try {
      const customerId = req.user.id;
      const options = {
        period: req.query.period || 'month',
        groupBy: req.query.groupBy
      };

      // Mock statistics for now
      const statistics = {
        summary: {
          totalRequests: 0,
          activeRequests: 0,
          completedRequests: 0,
          cancelledRequests: 0,
          averagePrice: 0,
          averageOffers: 0
        },
        trends: [],
        categories: []
      };

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get statistics'
      });
    }
  }
}

module.exports = new DeliveryRequestController();