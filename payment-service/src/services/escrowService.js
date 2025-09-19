const moment = require('moment');
const { EscrowAccount, PaymentIntent, TransactionLog, Payout } = require('../models');
const { logger, paymentLogger } = require('../config/logger');
const PayoutService = require('./payoutService');
const NotificationService = require('./notificationService');

class EscrowService {
  constructor() {
    this.payoutService = new PayoutService();
    this.notificationService = new NotificationService();
    
    // Default hold durations (in hours)
    this.defaultHoldDurations = {
      standard: 72,    // 3 days
      express: 48,     // 2 days  
      urgent: 24       // 1 day
    };
  }

  /**
   * Create an escrow account
   * @param {Object} escrowData - Escrow account data
   * @param {Object} transaction - Database transaction
   * @returns {Object} Created escrow account
   */
  async createEscrowAccount(escrowData, transaction = null) {
    const {
      paymentIntentId,
      deliveryId,
      amount,
      currency,
      holdDuration,
      releaseCondition = 'delivery_confirmed',
      autoRelease = true
    } = escrowData;

    try {
      // Calculate hold until date
      const holdUntil = moment().add(holdDuration || this.defaultHoldDurations.standard, 'hours').toDate();

      // Create escrow account
      const escrowAccount = await EscrowAccount.create({
        paymentIntentId,
        deliveryId,
        amount,
        currency,
        status: 'held',
        holdUntil,
        releaseCondition,
        autoReleaseEnabled: autoRelease
      }, { transaction });

      // Log escrow creation
      await TransactionLog.create({
        escrowAccountId: escrowAccount.id,
        paymentIntentId,
        transactionId: `escrow_create_${escrowAccount.id}`,
        type: 'credit',
        category: 'payment',
        amount,
        currency,
        status: 'completed',
        description: `Funds held in escrow for delivery ${deliveryId}`,
        provider: 'internal',
        metadata: {
          deliveryId,
          holdUntil,
          releaseCondition
        }
      }, { transaction });

      // Log escrow creation
      paymentLogger.escrowCreated(escrowAccount.id, paymentIntentId, amount);

      // Schedule automatic release if enabled
      if (autoRelease) {
        await this.scheduleAutoRelease(escrowAccount.id, holdUntil);
      }

      return escrowAccount;

    } catch (error) {
      logger.error('Error creating escrow account:', error);
      throw new Error(`Escrow account creation failed: ${error.message}`);
    }
  }

  /**
   * Release escrow funds
   * @param {string} escrowId - Escrow account ID
   * @param {Object} releaseData - Release data
   * @returns {Object} Release result
   */
  async releaseEscrowFunds(escrowId, releaseData) {
    const transaction = await EscrowAccount.sequelize.transaction();

    try {
      const escrow = await EscrowAccount.findByPk(escrowId, {
        include: [
          {
            model: PaymentIntent,
            as: 'paymentIntent'
          }
        ],
        transaction,
        lock: true
      });

      if (!escrow) {
        throw new Error('Escrow account not found');
      }

      if (escrow.status !== 'held') {
        throw new Error('Escrow funds are not in held status');
      }

      const {
        releaseAmount = escrow.amount,
        releaseReason = 'delivery_confirmed',
        releaseNotes,
        qrScanId,
        qrScanTimestamp,
        qrScanLocation,
        deductions = {}
      } = releaseData;

      // Validate release amount
      const maxReleasable = escrow.amount - (escrow.deductedAmount || 0);
      if (releaseAmount > maxReleasable) {
        throw new Error(`Cannot release ${releaseAmount}. Maximum releasable: ${maxReleasable}`);
      }

      // Calculate payout breakdown
      const payoutBreakdown = this.calculatePayoutBreakdown(escrow, releaseAmount, deductions);

      // Process payout to traveler
      let payout = null;
      if (payoutBreakdown.travelerAmount > 0 && escrow.paymentIntent.travelerId) {
        payout = await this.payoutService.processPayout(
          escrow.paymentIntent.travelerId,
          payoutBreakdown.travelerAmount,
          {
            type: 'standard',
            description: `Delivery earnings for delivery ${escrow.deliveryId}`,
            sourceType: 'delivery_earnings',
            sourceId: escrow.deliveryId,
            metadata: {
              escrowId: escrow.id,
              deliveryId: escrow.deliveryId,
              releaseReason
            }
          },
          transaction
        );
      }

      // Update escrow account
      await escrow.update({
        status: 'released',
        releasedAt: new Date(),
        releasedAmount: releaseAmount,
        releaseReason,
        releaseNotes,
        qrScanId,
        qrScanTimestamp,
        qrScanLocation,
        deductedAmount: (escrow.deductedAmount || 0) + (deductions.total || 0)
      }, { transaction });

      // Log escrow release
      await TransactionLog.create({
        escrowAccountId: escrow.id,
        paymentIntentId: escrow.paymentIntentId,
        payoutId: payout?.id,
        transactionId: `escrow_release_${escrow.id}`,
        type: 'debit',
        category: 'payout',
        amount: releaseAmount,
        currency: escrow.currency,
        status: 'completed',
        description: `Escrow funds released: ${releaseReason}`,
        fromUserId: escrow.paymentIntent.customerId,
        toUserId: escrow.paymentIntent.travelerId,
        fromAccountType: 'platform',
        toAccountType: 'traveler',
        provider: 'internal',
        processedAt: new Date(),
        metadata: {
          deliveryId: escrow.deliveryId,
          releaseReason,
          payoutBreakdown,
          qrScanId
        }
      }, { transaction });

      await transaction.commit();

      // Log successful release
      paymentLogger.escrowReleased(
        escrow.id,
        releaseAmount,
        escrow.paymentIntent.travelerId
      );

      // Send notifications
      await this.sendReleaseNotifications(escrow, payoutBreakdown, payout);

      return {
        escrowId: escrow.id,
        status: 'released',
        releasedAmount: releaseAmount,
        releasedAt: new Date(),
        releaseReason,
        payout: payout ? {
          id: payout.id,
          amount: payout.amount,
          status: payout.status,
          estimatedArrival: payout.arrivalDate
        } : null,
        breakdown: payoutBreakdown
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Error releasing escrow funds:', error);
      throw new Error(`Escrow release failed: ${error.message}`);
    }
  }

  /**
   * Get escrow account status
   * @param {string} escrowId - Escrow account ID
   * @returns {Object} Escrow account details
   */
  async getEscrowStatus(escrowId) {
    try {
      const escrow = await EscrowAccount.findByPk(escrowId, {
        include: [
          {
            model: PaymentIntent,
            as: 'paymentIntent'
          },
          {
            model: TransactionLog,
            as: 'transactionLogs',
            order: [['createdAt', 'ASC']]
          }
        ]
      });

      if (!escrow) {
        throw new Error('Escrow account not found');
      }

      const remainingHoldTime = escrow.getRemainingHoldTime();
      const releasableAmount = escrow.calculateReleasableAmount();

      return {
        id: escrow.id,
        status: escrow.status,
        amount: escrow.amount,
        currency: escrow.currency,
        deliveryId: escrow.deliveryId,
        paymentIntent: {
          id: escrow.paymentIntent.id,
          customerId: escrow.paymentIntent.customerId,
          travelerId: escrow.paymentIntent.travelerId
        },
        holdUntil: escrow.holdUntil,
        remainingHoldTime: Math.max(0, remainingHoldTime),
        releaseCondition: escrow.releaseCondition,
        autoReleaseEnabled: escrow.autoReleaseEnabled,
        releasableAmount,
        releasedAmount: escrow.releasedAmount,
        releasedAt: escrow.releasedAt,
        releaseReason: escrow.releaseReason,
        releaseNotes: escrow.releaseNotes,
        deductedAmount: escrow.deductedAmount,
        deductionReason: escrow.deductionReason,
        qrScanId: escrow.qrScanId,
        qrScanTimestamp: escrow.qrScanTimestamp,
        qrScanLocation: escrow.qrScanLocation,
        timeline: escrow.transactionLogs.map(log => ({
          action: log.description,
          timestamp: log.createdAt,
          amount: log.amount,
          status: log.status
        })),
        createdAt: escrow.createdAt,
        updatedAt: escrow.updatedAt
      };

    } catch (error) {
      logger.error('Error getting escrow status:', error);
      throw new Error(`Failed to get escrow status: ${error.message}`);
    }
  }

  /**
   * Dispute escrow funds
   * @param {string} escrowId - Escrow account ID
   * @param {Object} disputeData - Dispute data
   * @returns {Object} Dispute result
   */
  async disputeEscrow(escrowId, disputeData) {
    const transaction = await EscrowAccount.sequelize.transaction();

    try {
      const escrow = await EscrowAccount.findByPk(escrowId, {
        transaction,
        lock: true
      });

      if (!escrow) {
        throw new Error('Escrow account not found');
      }

      if (escrow.status !== 'held') {
        throw new Error('Can only dispute held escrow funds');
      }

      const {
        disputeReason,
        disputedBy,
        evidence = [],
        requestedAmount
      } = disputeData;

      // Update escrow status
      await escrow.update({
        status: 'disputed',
        disputedAt: new Date(),
        disputeReason,
        metadata: {
          ...escrow.metadata,
          dispute: {
            disputedBy,
            evidence,
            requestedAmount,
            createdAt: new Date()
          }
        }
      }, { transaction });

      // Log dispute
      await TransactionLog.create({
        escrowAccountId: escrow.id,
        paymentIntentId: escrow.paymentIntentId,
        transactionId: `escrow_dispute_${escrow.id}`,
        type: 'credit',
        category: 'dispute',
        amount: requestedAmount || escrow.amount,
        currency: escrow.currency,
        status: 'pending',
        description: `Escrow disputed: ${disputeReason}`,
        provider: 'internal',
        metadata: {
          disputeReason,
          disputedBy,
          evidence: evidence.length
        }
      }, { transaction });

      await transaction.commit();

      // Send dispute notifications
      await this.notificationService.sendEscrowDisputeNotification(escrow, disputeData);

      return {
        escrowId: escrow.id,
        status: 'disputed',
        disputedAt: new Date(),
        disputeReason,
        disputedBy
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Error disputing escrow:', error);
      throw new Error(`Escrow dispute failed: ${error.message}`);
    }
  }

  /**
   * Resolve escrow dispute
   * @param {string} escrowId - Escrow account ID
   * @param {Object} resolutionData - Resolution data
   * @returns {Object} Resolution result
   */
  async resolveDisputeEscrow(escrowId, resolutionData) {
    const transaction = await EscrowAccount.sequelize.transaction();

    try {
      const escrow = await EscrowAccount.findByPk(escrowId, {
        include: [
          {
            model: PaymentIntent,
            as: 'paymentIntent'
          }
        ],
        transaction,
        lock: true
      });

      if (!escrow) {
        throw new Error('Escrow account not found');
      }

      if (escrow.status !== 'disputed') {
        throw new Error('Escrow is not in disputed status');
      }

      const {
        resolution, // 'release_to_traveler', 'refund_to_customer', 'partial_split'
        resolutionAmount,
        resolutionReason,
        resolvedBy,
        resolutionNotes
      } = resolutionData;

      let releaseAmount = 0;
      let refundAmount = 0;

      switch (resolution) {
        case 'release_to_traveler':
          releaseAmount = resolutionAmount || escrow.amount;
          break;
        case 'refund_to_customer':
          refundAmount = resolutionAmount || escrow.amount;
          break;
        case 'partial_split':
          releaseAmount = resolutionData.travelerAmount || 0;
          refundAmount = resolutionData.customerAmount || 0;
          break;
        default:
          throw new Error('Invalid resolution type');
      }

      // Process payout if releasing to traveler
      let payout = null;
      if (releaseAmount > 0 && escrow.paymentIntent.travelerId) {
        const payoutBreakdown = this.calculatePayoutBreakdown(escrow, releaseAmount);
        
        payout = await this.payoutService.processPayout(
          escrow.paymentIntent.travelerId,
          payoutBreakdown.travelerAmount,
          {
            type: 'standard',
            description: `Dispute resolution payout for delivery ${escrow.deliveryId}`,
            sourceType: 'delivery_earnings',
            sourceId: escrow.deliveryId,
            metadata: {
              escrowId: escrow.id,
              disputeResolution: resolution,
              resolvedBy
            }
          },
          transaction
        );
      }

      // Process refund if refunding to customer
      let refund = null;
      if (refundAmount > 0) {
        // This would integrate with RefundService
        // For now, just log the refund requirement
        logger.info(`Refund required: ${refundAmount} cents to customer ${escrow.paymentIntent.customerId}`);
      }

      // Update escrow status
      await escrow.update({
        status: 'released',
        releasedAt: new Date(),
        releasedAmount: releaseAmount,
        releaseReason: 'dispute_resolved',
        disputeResolution: resolutionReason,
        releaseNotes: resolutionNotes,
        metadata: {
          ...escrow.metadata,
          disputeResolution: {
            resolution,
            resolvedBy,
            resolutionAmount,
            resolutionReason,
            resolutionNotes,
            resolvedAt: new Date()
          }
        }
      }, { transaction });

      // Log resolution
      await TransactionLog.create({
        escrowAccountId: escrow.id,
        paymentIntentId: escrow.paymentIntentId,
        payoutId: payout?.id,
        transactionId: `escrow_resolve_${escrow.id}`,
        type: 'debit',
        category: 'dispute',
        amount: releaseAmount + refundAmount,
        currency: escrow.currency,
        status: 'completed',
        description: `Dispute resolved: ${resolution}`,
        provider: 'internal',
        processedAt: new Date(),
        metadata: {
          resolution,
          releaseAmount,
          refundAmount,
          resolvedBy,
          resolutionReason
        }
      }, { transaction });

      await transaction.commit();

      // Send resolution notifications
      await this.notificationService.sendDisputeResolutionNotification(
        escrow,
        resolutionData,
        { payout, refund }
      );

      return {
        escrowId: escrow.id,
        status: 'released',
        resolution,
        releaseAmount,
        refundAmount,
        resolvedAt: new Date(),
        payout: payout ? {
          id: payout.id,
          amount: payout.amount,
          status: payout.status
        } : null
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Error resolving escrow dispute:', error);
      throw new Error(`Escrow dispute resolution failed: ${error.message}`);
    }
  }

  /**
   * Get escrow accounts for a delivery
   * @param {string} deliveryId - Delivery ID
   * @returns {Array} Escrow accounts
   */
  async getEscrowAccountsByDelivery(deliveryId) {
    try {
      const escrowAccounts = await EscrowAccount.findAll({
        where: { deliveryId },
        include: [
          {
            model: PaymentIntent,
            as: 'paymentIntent'
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      return escrowAccounts.map(escrow => ({
        id: escrow.id,
        status: escrow.status,
        amount: escrow.amount,
        currency: escrow.currency,
        holdUntil: escrow.holdUntil,
        remainingHoldTime: escrow.getRemainingHoldTime(),
        releaseCondition: escrow.releaseCondition,
        releasedAmount: escrow.releasedAmount,
        releasedAt: escrow.releasedAt,
        createdAt: escrow.createdAt
      }));

    } catch (error) {
      logger.error('Error getting escrow accounts by delivery:', error);
      throw new Error(`Failed to get escrow accounts: ${error.message}`);
    }
  }

  /**
   * Process automatic escrow releases
   * @returns {Array} Released escrow accounts
   */
  async processAutoReleases() {
    try {
      const now = new Date();
      
      // Find escrow accounts ready for auto-release
      const escrowsToRelease = await EscrowAccount.findAll({
        where: {
          status: 'held',
          autoReleaseEnabled: true,
          holdUntil: {
            [require('sequelize').Op.lte]: now
          }
        },
        include: [
          {
            model: PaymentIntent,
            as: 'paymentIntent'
          }
        ]
      });

      const released = [];

      for (const escrow of escrowsToRelease) {
        try {
          const result = await this.releaseEscrowFunds(escrow.id, {
            releaseReason: 'auto_release_timeout',
            releaseNotes: 'Automatic release after hold period expired'
          });
          
          released.push(result);
          logger.info(`Auto-released escrow ${escrow.id} for delivery ${escrow.deliveryId}`);
        } catch (error) {
          logger.error(`Failed to auto-release escrow ${escrow.id}:`, error);
        }
      }

      return released;

    } catch (error) {
      logger.error('Error processing auto releases:', error);
      return [];
    }
  }

  // Helper methods
  calculatePayoutBreakdown(escrow, releaseAmount, deductions = {}) {
    const platformFeeRate = 0.10; // 10% platform fee
    
    // Calculate deductions
    const totalDeductions = (deductions.damages || 0) + 
                           (deductions.penalties || 0) + 
                           (deductions.additionalFees || 0);
    
    const netAmount = releaseAmount - totalDeductions;
    const platformFee = Math.round(netAmount * platformFeeRate);
    const travelerAmount = netAmount - platformFee;

    return {
      releaseAmount,
      totalDeductions,
      netAmount,
      platformFee,
      travelerAmount,
      breakdown: {
        damages: deductions.damages || 0,
        penalties: deductions.penalties || 0,
        additionalFees: deductions.additionalFees || 0,
        platformFee
      }
    };
  }

  async scheduleAutoRelease(escrowId, releaseDate) {
    // In a production system, this would schedule a job using Bull queue
    // For now, we'll just log the scheduling
    logger.info(`Scheduled auto-release for escrow ${escrowId} at ${releaseDate}`);
    
    // This would typically use a job queue like:
    // await this.escrowReleaseQueue.add('auto-release', { escrowId }, {
    //   delay: releaseDate.getTime() - Date.now()
    // });
  }

  async sendReleaseNotifications(escrow, payoutBreakdown, payout) {
    try {
      // Notify traveler about payout
      if (escrow.paymentIntent.travelerId && payout) {
        await this.notificationService.sendPayoutNotification(
          escrow.paymentIntent.travelerId,
          payout
        );
      }

      // Notify customer about escrow release
      if (escrow.paymentIntent.customerId) {
        await this.notificationService.sendEscrowReleaseNotification(
          escrow.paymentIntent.customerId,
          escrow,
          payoutBreakdown
        );
      }
    } catch (error) {
      logger.error('Error sending release notifications:', error);
    }
  }
}

module.exports = EscrowService;