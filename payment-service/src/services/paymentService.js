const { stripe, stripeConfig } = require('../config/stripe');
const { PaymentIntent, EscrowAccount, TransactionLog, FraudAnalysis } = require('../models');
const { logger, paymentLogger } = require('../config/logger');
const FraudDetectionService = require('./fraudDetectionService');
const EscrowService = require('./escrowService');
const NotificationService = require('./notificationService');

class PaymentService {
  constructor() {
    this.fraudDetection = new FraudDetectionService();
    this.escrowService = new EscrowService();
    this.notificationService = new NotificationService();
  }

  /**
   * Create a payment intent
   * @param {Object} paymentData - Payment creation data
   * @returns {Object} Created payment intent
   */
  async createPaymentIntent(paymentData) {
    const transaction = await PaymentIntent.sequelize.transaction();
    
    try {
      const {
        deliveryId,
        amount,
        currency = 'USD',
        customerId,
        customerEmail,
        travelerId,
        paymentMethodId,
        metadata = {},
        options = {}
      } = paymentData;

      // Validate minimum amount
      if (amount < stripeConfig.minPaymentAmount) {
        throw new Error(`Minimum payment amount is ${stripeConfig.minPaymentAmount} cents`);
      }

      // Perform fraud detection
      const fraudAnalysis = await this.fraudDetection.analyzePayment({
        ...paymentData,
        ipAddress: paymentData.ipAddress,
        userAgent: paymentData.userAgent,
        deviceFingerprint: paymentData.deviceFingerprint
      });

      if (fraudAnalysis.riskLevel === 'high' && fraudAnalysis.recommendation === 'block') {
        throw new Error('Payment blocked due to high fraud risk');
      }

      // Calculate fees
      const fees = this.calculateFees(amount, currency);
      const totalAmount = amount + fees.total;

      // Create Stripe payment intent
      const stripePaymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: false,
        capture_method: 'automatic',
        receipt_email: customerEmail,
        metadata: {
          ...metadata,
          deliveryId,
          customerId,
          travelerId: travelerId || null,
          paymentServiceVersion: '1.0.0'
        }
      });

      // Create payment intent record
      const paymentIntent = await PaymentIntent.create({
        deliveryId,
        stripePaymentIntentId: stripePaymentIntent.id,
        amount,
        currency: currency.toUpperCase(),
        status: stripePaymentIntent.status,
        customerId,
        customerEmail,
        travelerId,
        paymentMethodId,
        clientSecret: stripePaymentIntent.client_secret,
        platformFee: fees.platform,
        processingFee: fees.processing,
        insuranceFee: fees.insurance,
        totalFees: fees.total,
        metadata,
        riskScore: fraudAnalysis.riskScore,
        riskLevel: fraudAnalysis.riskLevel
      }, { transaction });

      // Create fraud analysis record
      await FraudAnalysis.create({
        paymentIntentId: paymentIntent.id,
        userId: customerId,
        riskScore: fraudAnalysis.riskScore,
        riskLevel: fraudAnalysis.riskLevel,
        riskFactors: fraudAnalysis.riskFactors,
        paymentMethodRisk: fraudAnalysis.paymentMethodRisk,
        userBehaviorRisk: fraudAnalysis.userBehaviorRisk,
        amountRisk: fraudAnalysis.amountRisk,
        geographicRisk: fraudAnalysis.geographicRisk,
        velocityRisk: fraudAnalysis.velocityRisk,
        deviceRisk: fraudAnalysis.deviceRisk,
        recommendation: fraudAnalysis.recommendation,
        requiresReview: fraudAnalysis.requiresManualReview,
        ipAddress: paymentData.ipAddress,
        userAgent: paymentData.userAgent,
        deviceFingerprint: paymentData.deviceFingerprint,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentMethodType: paymentData.paymentMethodType,
        modelVersion: '1.0.0',
        modelConfidence: 0.85
      }, { transaction });

      // Log transaction
      await TransactionLog.create({
        paymentIntentId: paymentIntent.id,
        transactionId: `pi_create_${paymentIntent.id}`,
        type: 'debit',
        category: 'payment',
        amount: totalAmount,
        currency: currency.toUpperCase(),
        status: 'pending',
        description: `Payment intent created for delivery ${deliveryId}`,
        fromUserId: customerId,
        toUserId: travelerId,
        fromAccountType: 'customer',
        toAccountType: 'traveler',
        provider: 'stripe',
        providerTransactionId: stripePaymentIntent.id,
        metadata: {
          deliveryId,
          fraudRiskLevel: fraudAnalysis.riskLevel
        }
      }, { transaction });

      await transaction.commit();

      // Log successful creation
      paymentLogger.paymentCreated(
        paymentIntent.id,
        totalAmount,
        currency,
        customerId
      );

      // Send notification if requires review
      if (fraudAnalysis.requiresManualReview) {
        await this.notificationService.sendFraudReviewNotification(paymentIntent);
      }

      return {
        id: paymentIntent.id,
        stripePaymentIntentId: stripePaymentIntent.id,
        clientSecret: stripePaymentIntent.client_secret,
        status: stripePaymentIntent.status,
        amount: totalAmount,
        currency: currency.toUpperCase(),
        fees: fees,
        fraudAnalysis: {
          riskScore: fraudAnalysis.riskScore,
          riskLevel: fraudAnalysis.riskLevel,
          requiresReview: fraudAnalysis.requiresManualReview
        }
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating payment intent:', error);
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  }

  /**
   * Confirm a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {Object} confirmationData - Confirmation data
   * @returns {Object} Confirmed payment result
   */
  async confirmPayment(paymentIntentId, confirmationData) {
    const transaction = await PaymentIntent.sequelize.transaction();

    try {
      const paymentIntent = await PaymentIntent.findByPk(paymentIntentId, {
        transaction,
        lock: true
      });

      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      if (paymentIntent.status === 'succeeded') {
        throw new Error('Payment already confirmed');
      }

      if (paymentIntent.status === 'canceled' || paymentIntent.status === 'failed') {
        throw new Error('Cannot confirm canceled or failed payment');
      }

      // Confirm with Stripe
      const confirmedIntent = await stripe.paymentIntents.confirm(
        paymentIntent.stripePaymentIntentId,
        {
          payment_method: confirmationData.paymentMethodId,
          return_url: confirmationData.returnUrl,
          receipt_email: confirmationData.receiptEmail || paymentIntent.customerEmail
        }
      );

      // Update payment intent status
      await paymentIntent.update({
        status: confirmedIntent.status,
        confirmedAt: new Date(),
        paymentMethodId: confirmedIntent.payment_method,
        receiptUrl: confirmedIntent.charges?.data[0]?.receipt_url
      }, { transaction });

      // Log transaction update
      await TransactionLog.create({
        paymentIntentId: paymentIntent.id,
        transactionId: `pi_confirm_${paymentIntent.id}`,
        type: 'debit',
        category: 'payment',
        amount: paymentIntent.amount + paymentIntent.totalFees,
        currency: paymentIntent.currency,
        status: confirmedIntent.status === 'succeeded' ? 'completed' : 'failed',
        description: `Payment ${confirmedIntent.status} for delivery ${paymentIntent.deliveryId}`,
        fromUserId: paymentIntent.customerId,
        toUserId: paymentIntent.travelerId,
        fromAccountType: 'customer',
        toAccountType: 'platform',
        provider: 'stripe',
        providerTransactionId: confirmedIntent.id,
        processedAt: new Date()
      }, { transaction });

      let escrowAccount = null;

      // If payment succeeded, create escrow account
      if (confirmedIntent.status === 'succeeded') {
        escrowAccount = await this.escrowService.createEscrowAccount({
          paymentIntentId: paymentIntent.id,
          deliveryId: paymentIntent.deliveryId,
          amount: paymentIntent.amount, // Exclude fees from escrow
          currency: paymentIntent.currency,
          holdDuration: 72, // 72 hours default
          releaseCondition: 'delivery_confirmed',
          autoRelease: true
        }, transaction);

        // Log successful payment
        paymentLogger.paymentConfirmed(
          paymentIntent.id,
          paymentIntent.amount + paymentIntent.totalFees,
          paymentIntent.currency,
          paymentIntent.customerId
        );

        // Send success notifications
        await this.notificationService.sendPaymentSuccessNotification(paymentIntent);
      } else {
        // Handle failed payment
        await paymentIntent.update({
          failedAt: new Date(),
          failureReason: confirmedIntent.last_payment_error?.message || 'Payment failed',
          failureCode: confirmedIntent.last_payment_error?.code
        }, { transaction });

        // Log failed payment
        paymentLogger.paymentFailed(
          paymentIntent.id,
          confirmedIntent.last_payment_error?.message || 'Payment failed',
          paymentIntent.customerId
        );

        // Send failure notification
        await this.notificationService.sendPaymentFailureNotification(
          paymentIntent,
          confirmedIntent.last_payment_error?.message
        );
      }

      await transaction.commit();

      return {
        id: paymentIntent.id,
        status: confirmedIntent.status,
        amount: paymentIntent.amount + paymentIntent.totalFees,
        currency: paymentIntent.currency,
        paymentMethodId: confirmedIntent.payment_method,
        receiptUrl: confirmedIntent.charges?.data[0]?.receipt_url,
        escrow: escrowAccount ? {
          id: escrowAccount.id,
          status: escrowAccount.status,
          amount: escrowAccount.amount,
          holdUntil: escrowAccount.holdUntil
        } : null,
        nextAction: confirmedIntent.next_action
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Error confirming payment:', error);
      
      // Update payment intent with failure info
      try {
        await PaymentIntent.update({
          status: 'failed',
          failedAt: new Date(),
          failureReason: error.message,
          failureCode: error.code || 'confirmation_failed'
        }, {
          where: { id: paymentIntentId }
        });
      } catch (updateError) {
        logger.error('Error updating failed payment:', updateError);
      }

      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Get payment status
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Object} Payment status and details
   */
  async getPaymentStatus(paymentIntentId) {
    try {
      const paymentIntent = await PaymentIntent.findByPk(paymentIntentId, {
        include: [
          {
            model: EscrowAccount,
            as: 'escrow'
          },
          {
            model: TransactionLog,
            as: 'transactionLogs',
            order: [['createdAt', 'ASC']]
          },
          {
            model: FraudAnalysis,
            as: 'fraudAnalysis'
          }
        ]
      });

      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      // Get latest status from Stripe if needed
      let stripeStatus = null;
      if (paymentIntent.stripePaymentIntentId && 
          ['processing', 'requires_action', 'requires_confirmation'].includes(paymentIntent.status)) {
        try {
          const stripeIntent = await stripe.paymentIntents.retrieve(
            paymentIntent.stripePaymentIntentId
          );
          stripeStatus = stripeIntent.status;
          
          // Update local status if different
          if (stripeStatus !== paymentIntent.status) {
            await paymentIntent.update({ status: stripeStatus });
          }
        } catch (stripeError) {
          logger.warn('Error fetching Stripe status:', stripeError);
        }
      }

      return {
        id: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.stripePaymentIntentId,
        status: stripeStatus || paymentIntent.status,
        amount: paymentIntent.amount,
        totalAmount: paymentIntent.amount + paymentIntent.totalFees,
        currency: paymentIntent.currency,
        deliveryId: paymentIntent.deliveryId,
        customer: {
          id: paymentIntent.customerId,
          email: paymentIntent.customerEmail
        },
        traveler: paymentIntent.travelerId ? {
          id: paymentIntent.travelerId
        } : null,
        fees: paymentIntent.getFeeBreakdown(),
        escrow: paymentIntent.escrow ? {
          id: paymentIntent.escrow.id,
          status: paymentIntent.escrow.status,
          amount: paymentIntent.escrow.amount,
          holdUntil: paymentIntent.escrow.holdUntil,
          releaseCondition: paymentIntent.escrow.releaseCondition
        } : null,
        fraudAnalysis: paymentIntent.fraudAnalysis ? {
          riskScore: paymentIntent.fraudAnalysis.riskScore,
          riskLevel: paymentIntent.fraudAnalysis.riskLevel,
          requiresReview: paymentIntent.fraudAnalysis.requiresReview
        } : null,
        timeline: paymentIntent.transactionLogs.map(log => ({
          status: log.status,
          timestamp: log.createdAt,
          description: log.description
        })),
        receiptUrl: paymentIntent.receiptUrl,
        createdAt: paymentIntent.createdAt,
        confirmedAt: paymentIntent.confirmedAt,
        failedAt: paymentIntent.failedAt,
        failureReason: paymentIntent.failureReason
      };

    } catch (error) {
      logger.error('Error getting payment status:', error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  /**
   * Cancel a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancellation result
   */
  async cancelPayment(paymentIntentId, reason = 'requested_by_customer') {
    const transaction = await PaymentIntent.sequelize.transaction();

    try {
      const paymentIntent = await PaymentIntent.findByPk(paymentIntentId, {
        transaction,
        lock: true
      });

      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      if (!['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status)) {
        throw new Error('Payment cannot be canceled in current status');
      }

      // Cancel with Stripe
      const canceledIntent = await stripe.paymentIntents.cancel(
        paymentIntent.stripePaymentIntentId,
        {
          cancellation_reason: reason
        }
      );

      // Update payment intent
      await paymentIntent.update({
        status: 'canceled',
        canceledAt: new Date(),
        metadata: {
          ...paymentIntent.metadata,
          cancellationReason: reason
        }
      }, { transaction });

      // Log transaction
      await TransactionLog.create({
        paymentIntentId: paymentIntent.id,
        transactionId: `pi_cancel_${paymentIntent.id}`,
        type: 'debit',
        category: 'payment',
        amount: 0,
        currency: paymentIntent.currency,
        status: 'canceled',
        description: `Payment canceled: ${reason}`,
        fromUserId: paymentIntent.customerId,
        provider: 'stripe',
        providerTransactionId: canceledIntent.id,
        metadata: { cancellationReason: reason }
      }, { transaction });

      await transaction.commit();

      // Send notification
      await this.notificationService.sendPaymentCanceledNotification(paymentIntent, reason);

      return {
        id: paymentIntent.id,
        status: 'canceled',
        canceledAt: new Date(),
        reason
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Error canceling payment:', error);
      throw new Error(`Payment cancellation failed: ${error.message}`);
    }
  }

  /**
   * Calculate fees for a payment
   * @param {number} amount - Payment amount in cents
   * @param {string} currency - Currency code
   * @returns {Object} Fee breakdown
   */
  calculateFees(amount, currency = 'USD') {
    // Platform fee (percentage of amount)
    const platformFee = Math.round(amount * stripeConfig.platformFeeRate);
    
    // Stripe processing fee
    const processingFee = Math.round(amount * stripeConfig.stripeFeeRate) + stripeConfig.stripeFeeFixed;
    
    // Insurance fee (optional, based on item value)
    const insuranceFee = 0; // Calculated separately if needed
    
    const total = platformFee + processingFee + insuranceFee;

    return {
      platform: platformFee,
      processing: processingFee,
      insurance: insuranceFee,
      total
    };
  }

  /**
   * Get payment history for a user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Payment history with pagination
   */
  async getPaymentHistory(userId, filters = {}) {
    try {
      const {
        type = 'all', // payment, payout, refund
        status,
        dateFrom,
        dateTo,
        deliveryId,
        page = 1,
        limit = 20
      } = filters;

      const where = {
        [filters.userType === 'traveler' ? 'travelerId' : 'customerId']: userId
      };

      if (status) {
        where.status = status;
      }

      if (deliveryId) {
        where.deliveryId = deliveryId;
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
      }

      const offset = (page - 1) * limit;

      const { rows: payments, count } = await PaymentIntent.findAndCountAll({
        where,
        include: [
          {
            model: EscrowAccount,
            as: 'escrow',
            required: false
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      const formattedPayments = payments.map(payment => ({
        id: payment.id,
        type: 'payment',
        status: payment.status,
        amount: payment.amount + payment.totalFees,
        currency: payment.currency,
        description: `Payment for delivery ${payment.deliveryId}`,
        delivery: {
          id: payment.deliveryId
        },
        counterpart: {
          id: payment.travelerId || payment.customerId,
          type: payment.travelerId ? 'traveler' : 'customer'
        },
        timestamp: payment.createdAt,
        receiptUrl: payment.receiptUrl
      }));

      // Calculate summary
      const summary = {
        totalPayments: count,
        totalAmount: payments.reduce((sum, p) => sum + p.amount + p.totalFees, 0) / 100,
        totalRefunds: 0, // Would be calculated from refunds table
        totalRefunded: 0
      };

      return {
        data: formattedPayments,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        summary
      };

    } catch (error) {
      logger.error('Error getting payment history:', error);
      throw new Error(`Failed to get payment history: ${error.message}`);
    }
  }

  /**
   * Process webhook from Stripe
   * @param {Object} event - Stripe webhook event
   * @returns {boolean} Processing success
   */
  async processWebhook(event) {
    try {
      logger.info(`Processing Stripe webhook: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
          
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
          
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object);
          break;
          
        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object);
          break;
          
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      return true;
    } catch (error) {
      logger.error('Error processing webhook:', error);
      return false;
    }
  }

  // Webhook handlers
  async handlePaymentSucceeded(paymentIntent) {
    try {
      await PaymentIntent.update({
        status: 'succeeded',
        confirmedAt: new Date()
      }, {
        where: { stripePaymentIntentId: paymentIntent.id }
      });

      logger.info(`Payment succeeded: ${paymentIntent.id}`);
    } catch (error) {
      logger.error('Error handling payment succeeded webhook:', error);
    }
  }

  async handlePaymentFailed(paymentIntent) {
    try {
      await PaymentIntent.update({
        status: 'failed',
        failedAt: new Date(),
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
      }, {
        where: { stripePaymentIntentId: paymentIntent.id }
      });

      logger.info(`Payment failed: ${paymentIntent.id}`);
    } catch (error) {
      logger.error('Error handling payment failed webhook:', error);
    }
  }

  async handlePaymentCanceled(paymentIntent) {
    try {
      await PaymentIntent.update({
        status: 'canceled',
        canceledAt: new Date()
      }, {
        where: { stripePaymentIntentId: paymentIntent.id }
      });

      logger.info(`Payment canceled: ${paymentIntent.id}`);
    } catch (error) {
      logger.error('Error handling payment canceled webhook:', error);
    }
  }

  async handleDisputeCreated(charge) {
    try {
      // Handle chargeback/dispute creation
      logger.warn(`Dispute created for charge: ${charge.id}`);
      
      // In a full implementation, this would:
      // 1. Find the related payment
      // 2. Create a dispute record
      // 3. Notify relevant parties
      // 4. Update payment status if needed
      
    } catch (error) {
      logger.error('Error handling dispute created webhook:', error);
    }
  }
}

module.exports = PaymentService;