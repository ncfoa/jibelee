const axios = require('axios');
const { logger } = require('../config/logger');

class NotificationService {
  constructor() {
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3009';
    this.serviceToken = process.env.SERVICE_TOKEN || 'payment-service-token';
  }

  /**
   * Send payment success notification
   * @param {Object} paymentIntent - Payment intent object
   */
  async sendPaymentSuccessNotification(paymentIntent) {
    try {
      const notification = {
        userId: paymentIntent.customerId,
        type: 'payment_success',
        title: 'Payment Successful',
        message: `Your payment of ${this.formatAmount(paymentIntent.amount + paymentIntent.totalFees, paymentIntent.currency)} has been processed successfully.`,
        data: {
          paymentIntentId: paymentIntent.id,
          deliveryId: paymentIntent.deliveryId,
          amount: paymentIntent.amount + paymentIntent.totalFees,
          currency: paymentIntent.currency,
          receiptUrl: paymentIntent.receiptUrl
        },
        channels: ['push', 'email'],
        priority: 'high'
      };

      await this.sendNotification(notification);

      // Also notify traveler if assigned
      if (paymentIntent.travelerId) {
        const travelerNotification = {
          userId: paymentIntent.travelerId,
          type: 'payment_received',
          title: 'Payment Received',
          message: `Payment of ${this.formatAmount(paymentIntent.amount, paymentIntent.currency)} has been received for your delivery service.`,
          data: {
            paymentIntentId: paymentIntent.id,
            deliveryId: paymentIntent.deliveryId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency
          },
          channels: ['push', 'in_app'],
          priority: 'medium'
        };

        await this.sendNotification(travelerNotification);
      }

    } catch (error) {
      logger.error('Error sending payment success notification:', error);
    }
  }

  /**
   * Send payment failure notification
   * @param {Object} paymentIntent - Payment intent object
   * @param {string} errorMessage - Error message
   */
  async sendPaymentFailureNotification(paymentIntent, errorMessage) {
    try {
      const notification = {
        userId: paymentIntent.customerId,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `Your payment could not be processed. ${errorMessage || 'Please try again or use a different payment method.'}`,
        data: {
          paymentIntentId: paymentIntent.id,
          deliveryId: paymentIntent.deliveryId,
          amount: paymentIntent.amount + paymentIntent.totalFees,
          currency: paymentIntent.currency,
          errorMessage
        },
        channels: ['push', 'email', 'in_app'],
        priority: 'high'
      };

      await this.sendNotification(notification);

    } catch (error) {
      logger.error('Error sending payment failure notification:', error);
    }
  }

  /**
   * Send payment canceled notification
   * @param {Object} paymentIntent - Payment intent object
   * @param {string} reason - Cancellation reason
   */
  async sendPaymentCanceledNotification(paymentIntent, reason) {
    try {
      const notification = {
        userId: paymentIntent.customerId,
        type: 'payment_canceled',
        title: 'Payment Canceled',
        message: `Your payment has been canceled. ${this.getCancellationMessage(reason)}`,
        data: {
          paymentIntentId: paymentIntent.id,
          deliveryId: paymentIntent.deliveryId,
          amount: paymentIntent.amount + paymentIntent.totalFees,
          currency: paymentIntent.currency,
          reason
        },
        channels: ['push', 'in_app'],
        priority: 'medium'
      };

      await this.sendNotification(notification);

    } catch (error) {
      logger.error('Error sending payment canceled notification:', error);
    }
  }

  /**
   * Send fraud review notification
   * @param {Object} paymentIntent - Payment intent object
   */
  async sendFraudReviewNotification(paymentIntent) {
    try {
      // Notify customer
      const customerNotification = {
        userId: paymentIntent.customerId,
        type: 'payment_under_review',
        title: 'Payment Under Review',
        message: 'Your payment is being reviewed for security purposes. We will notify you once the review is complete.',
        data: {
          paymentIntentId: paymentIntent.id,
          deliveryId: paymentIntent.deliveryId
        },
        channels: ['email', 'in_app'],
        priority: 'medium'
      };

      await this.sendNotification(customerNotification);

      // Notify admin team
      const adminNotification = {
        type: 'fraud_review_required',
        title: 'Fraud Review Required',
        message: `Payment ${paymentIntent.id} requires manual review due to high fraud risk.`,
        data: {
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customerId,
          amount: paymentIntent.amount + paymentIntent.totalFees,
          currency: paymentIntent.currency,
          riskScore: paymentIntent.riskScore,
          riskLevel: paymentIntent.riskLevel
        },
        channels: ['email', 'slack'],
        priority: 'high',
        audience: 'admin'
      };

      await this.sendNotification(adminNotification);

    } catch (error) {
      logger.error('Error sending fraud review notification:', error);
    }
  }

  /**
   * Send escrow release notification
   * @param {string} customerId - Customer ID
   * @param {Object} escrow - Escrow account object
   * @param {Object} payoutBreakdown - Payout breakdown
   */
  async sendEscrowReleaseNotification(customerId, escrow, payoutBreakdown) {
    try {
      const notification = {
        userId: customerId,
        type: 'escrow_released',
        title: 'Delivery Completed',
        message: `Your delivery has been completed and payment of ${this.formatAmount(escrow.releasedAmount, escrow.currency)} has been released to the traveler.`,
        data: {
          escrowId: escrow.id,
          deliveryId: escrow.deliveryId,
          releasedAmount: escrow.releasedAmount,
          currency: escrow.currency,
          releaseReason: escrow.releaseReason,
          releasedAt: escrow.releasedAt
        },
        channels: ['push', 'email', 'in_app'],
        priority: 'medium'
      };

      await this.sendNotification(notification);

    } catch (error) {
      logger.error('Error sending escrow release notification:', error);
    }
  }

  /**
   * Send escrow dispute notification
   * @param {Object} escrow - Escrow account object
   * @param {Object} disputeData - Dispute data
   */
  async sendEscrowDisputeNotification(escrow, disputeData) {
    try {
      // Notify the other party about the dispute
      const otherPartyId = disputeData.disputedBy === escrow.paymentIntent.customerId 
        ? escrow.paymentIntent.travelerId 
        : escrow.paymentIntent.customerId;

      if (otherPartyId) {
        const notification = {
          userId: otherPartyId,
          type: 'escrow_disputed',
          title: 'Delivery Disputed',
          message: 'A dispute has been raised regarding your delivery. Please provide your response.',
          data: {
            escrowId: escrow.id,
            deliveryId: escrow.deliveryId,
            disputeReason: disputeData.disputeReason,
            disputedBy: disputeData.disputedBy
          },
          channels: ['push', 'email', 'in_app'],
          priority: 'high'
        };

        await this.sendNotification(notification);
      }

      // Notify admin team
      const adminNotification = {
        type: 'escrow_dispute_created',
        title: 'Escrow Dispute Created',
        message: `Escrow account ${escrow.id} has been disputed and requires resolution.`,
        data: {
          escrowId: escrow.id,
          deliveryId: escrow.deliveryId,
          amount: escrow.amount,
          currency: escrow.currency,
          disputeReason: disputeData.disputeReason,
          disputedBy: disputeData.disputedBy
        },
        channels: ['email', 'slack'],
        priority: 'high',
        audience: 'admin'
      };

      await this.sendNotification(adminNotification);

    } catch (error) {
      logger.error('Error sending escrow dispute notification:', error);
    }
  }

  /**
   * Send dispute resolution notification
   * @param {Object} escrow - Escrow account object
   * @param {Object} resolutionData - Resolution data
   * @param {Object} results - Resolution results (payout, refund)
   */
  async sendDisputeResolutionNotification(escrow, resolutionData, results) {
    try {
      const { resolution, resolutionReason } = resolutionData;
      const { payout, refund } = results;

      // Notify customer
      if (escrow.paymentIntent.customerId) {
        let message = `Your dispute has been resolved: ${resolutionReason}`;
        
        if (refund) {
          message += ` A refund of ${this.formatAmount(refund.amount, escrow.currency)} will be processed.`;
        }

        const customerNotification = {
          userId: escrow.paymentIntent.customerId,
          type: 'dispute_resolved',
          title: 'Dispute Resolved',
          message,
          data: {
            escrowId: escrow.id,
            deliveryId: escrow.deliveryId,
            resolution,
            resolutionReason,
            refund: refund ? {
              amount: refund.amount,
              currency: escrow.currency
            } : null
          },
          channels: ['push', 'email', 'in_app'],
          priority: 'high'
        };

        await this.sendNotification(customerNotification);
      }

      // Notify traveler
      if (escrow.paymentIntent.travelerId) {
        let message = `The dispute has been resolved: ${resolutionReason}`;
        
        if (payout) {
          message += ` A payout of ${this.formatAmount(payout.amount, escrow.currency)} has been processed.`;
        }

        const travelerNotification = {
          userId: escrow.paymentIntent.travelerId,
          type: 'dispute_resolved',
          title: 'Dispute Resolved',
          message,
          data: {
            escrowId: escrow.id,
            deliveryId: escrow.deliveryId,
            resolution,
            resolutionReason,
            payout: payout ? {
              id: payout.id,
              amount: payout.amount,
              currency: escrow.currency,
              status: payout.status
            } : null
          },
          channels: ['push', 'email', 'in_app'],
          priority: 'high'
        };

        await this.sendNotification(travelerNotification);
      }

    } catch (error) {
      logger.error('Error sending dispute resolution notification:', error);
    }
  }

  /**
   * Send payout notification
   * @param {string} userId - User ID
   * @param {Object} payout - Payout object
   */
  async sendPayoutNotification(userId, payout) {
    try {
      let message = `Your ${payout.type} payout of ${this.formatAmount(payout.netAmount, payout.currency)} has been processed.`;
      
      if (payout.type === 'instant') {
        message += ' Funds should arrive within 30 minutes.';
      } else {
        message += ' Funds should arrive within 1-2 business days.';
      }

      const notification = {
        userId,
        type: 'payout_processed',
        title: 'Payout Processed',
        message,
        data: {
          payoutId: payout.id,
          amount: payout.netAmount,
          currency: payout.currency,
          type: payout.type,
          status: payout.status,
          estimatedArrival: payout.estimatedArrival,
          fee: payout.fee
        },
        channels: ['push', 'email', 'in_app'],
        priority: 'medium'
      };

      await this.sendNotification(notification);

    } catch (error) {
      logger.error('Error sending payout notification:', error);
    }
  }

  /**
   * Send refund notification
   * @param {Object} refund - Refund object
   */
  async sendRefundNotification(refund) {
    try {
      const notification = {
        userId: refund.requestedBy,
        type: 'refund_processed',
        title: 'Refund Processed',
        message: `Your refund of ${this.formatAmount(refund.customerRefund, refund.currency)} has been processed and should appear in your account within 5-10 business days.`,
        data: {
          refundId: refund.id,
          amount: refund.customerRefund,
          currency: refund.currency,
          reason: refund.reason,
          status: refund.status,
          processedAt: refund.processedAt
        },
        channels: ['push', 'email', 'in_app'],
        priority: 'high'
      };

      await this.sendNotification(notification);

    } catch (error) {
      logger.error('Error sending refund notification:', error);
    }
  }

  /**
   * Send subscription notification
   * @param {string} userId - User ID
   * @param {string} eventType - Event type (created, renewed, canceled, etc.)
   * @param {Object} subscription - Subscription object
   */
  async sendSubscriptionNotification(userId, eventType, subscription) {
    try {
      const messages = {
        created: 'Your subscription has been activated successfully.',
        renewed: `Your ${subscription.planName} subscription has been renewed.`,
        canceled: 'Your subscription has been canceled.',
        payment_failed: 'Your subscription payment failed. Please update your payment method.',
        trial_ending: 'Your free trial is ending soon. Update your payment method to continue.'
      };

      const notification = {
        userId,
        type: `subscription_${eventType}`,
        title: this.getSubscriptionTitle(eventType),
        message: messages[eventType] || `Your subscription status has been updated.`,
        data: {
          subscriptionId: subscription.id,
          planId: subscription.planId,
          planName: subscription.planName,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          price: subscription.price,
          currency: subscription.currency
        },
        channels: eventType === 'payment_failed' ? ['push', 'email', 'in_app'] : ['push', 'in_app'],
        priority: eventType === 'payment_failed' ? 'high' : 'medium'
      };

      await this.sendNotification(notification);

    } catch (error) {
      logger.error('Error sending subscription notification:', error);
    }
  }

  /**
   * Send bulk notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification object
   */
  async sendBulkNotification(userIds, notification) {
    try {
      const bulkNotification = {
        ...notification,
        userIds,
        type: 'bulk_notification'
      };

      await this.sendNotification(bulkNotification);

    } catch (error) {
      logger.error('Error sending bulk notification:', error);
    }
  }

  // Helper methods
  async sendNotification(notification) {
    try {
      const response = await axios.post(
        `${this.notificationServiceUrl}/api/v1/notifications/send`,
        notification,
        {
          headers: {
            'Authorization': `Bearer ${this.serviceToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      if (response.status === 200) {
        logger.debug(`Notification sent successfully: ${notification.type}`);
      } else {
        logger.warn(`Notification service returned status ${response.status}`);
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Notification service unavailable');
      } else {
        logger.error('Error calling notification service:', error.message);
      }
      
      // Don't throw error to avoid breaking main payment flow
      // In production, you might want to queue notifications for retry
    }
  }

  formatAmount(amount, currency) {
    const value = (amount / 100).toFixed(2);
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CAD: 'C$',
      AUD: 'A$',
      JPY: '¥'
    };
    
    const symbol = symbols[currency] || currency;
    return `${symbol}${value}`;
  }

  getCancellationMessage(reason) {
    const messages = {
      requested_by_customer: 'You can create a new payment when ready.',
      duplicate: 'This appears to be a duplicate payment.',
      fraudulent: 'This payment was flagged as potentially fraudulent.',
      abandoned: 'The payment was not completed in time.'
    };

    return messages[reason] || 'Please contact support if you have questions.';
  }

  getSubscriptionTitle(eventType) {
    const titles = {
      created: 'Subscription Activated',
      renewed: 'Subscription Renewed',
      canceled: 'Subscription Canceled',
      payment_failed: 'Payment Failed',
      trial_ending: 'Trial Ending Soon'
    };

    return titles[eventType] || 'Subscription Update';
  }
}

module.exports = NotificationService;