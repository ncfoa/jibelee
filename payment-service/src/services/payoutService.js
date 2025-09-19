const { stripe, stripeConfig } = require('../config/stripe');
const { PayoutAccount, Payout, TransactionLog } = require('../models');
const { logger, paymentLogger } = require('../config/logger');
const NotificationService = require('./notificationService');

class PayoutService {
  constructor() {
    this.notificationService = new NotificationService();
    
    // Minimum payout amounts (in cents)
    this.minimumAmounts = {
      standard: stripeConfig.minPayoutAmount || 100,  // $1.00
      instant: stripeConfig.minInstantPayoutAmount || 500  // $5.00
    };
  }

  /**
   * Create a payout account (Stripe Connect)
   * @param {string} userId - User ID
   * @param {Object} accountData - Account creation data
   * @returns {Object} Created payout account
   */
  async createPayoutAccount(userId, accountData) {
    try {
      const {
        accountType = 'express',
        country,
        currency = 'USD',
        businessProfile = {},
        tosAcceptance,
        individual = {},
        company = {}
      } = accountData;

      // Check if user already has a payout account
      const existingAccount = await PayoutAccount.findOne({
        where: { userId }
      });

      if (existingAccount) {
        throw new Error('User already has a payout account');
      }

      // Create Stripe Connect account
      const stripeAccountData = {
        type: accountType,
        country: country.toUpperCase(),
        default_currency: currency.toLowerCase(),
        business_profile: businessProfile,
        tos_acceptance: tosAcceptance
      };

      // Add individual or company data
      if (accountType === 'express' || accountType === 'standard') {
        if (individual.firstName) {
          stripeAccountData.individual = individual;
        }
        if (company.name) {
          stripeAccountData.company = company;
        }
      }

      const stripeAccount = await stripe.accounts.create(stripeAccountData);

      // Store payout account in database
      const payoutAccount = await PayoutAccount.create({
        userId,
        stripeAccountId: stripeAccount.id,
        accountType,
        country: country.toUpperCase(),
        currency: currency.toUpperCase(),
        status: stripeAccount.details_submitted ? 'pending' : 'incomplete',
        capabilities: stripeAccount.capabilities || {},
        requirements: stripeAccount.requirements || {},
        verificationStatus: 'unverified',
        accountHolderType: individual.firstName ? 'individual' : 'company',
        businessProfile: businessProfile,
        tosAcceptance: tosAcceptance
      });

      // Log account creation
      logger.info(`Payout account created for user ${userId}: ${stripeAccount.id}`);

      return {
        id: payoutAccount.id,
        stripeAccountId: stripeAccount.id,
        status: payoutAccount.status,
        country: payoutAccount.country,
        currency: payoutAccount.currency,
        accountType: payoutAccount.accountType,
        capabilities: stripeAccount.capabilities,
        requirements: stripeAccount.requirements,
        onboardingUrl: this.generateOnboardingUrl(stripeAccount.id),
        dashboardUrl: this.generateDashboardUrl(stripeAccount.id)
      };

    } catch (error) {
      logger.error('Error creating payout account:', error);
      throw new Error(`Payout account creation failed: ${error.message}`);
    }
  }

  /**
   * Get payout account status
   * @param {string} userId - User ID
   * @returns {Object} Payout account status
   */
  async getPayoutAccountStatus(userId) {
    try {
      const payoutAccount = await PayoutAccount.findOne({
        where: { userId }
      });

      if (!payoutAccount) {
        return {
          exists: false,
          message: 'No payout account found'
        };
      }

      // Sync with Stripe to get latest status
      const stripeAccount = await stripe.accounts.retrieve(payoutAccount.stripeAccountId);
      
      // Update local record if needed
      const updates = {};
      if (stripeAccount.capabilities !== payoutAccount.capabilities) {
        updates.capabilities = stripeAccount.capabilities;
      }
      if (stripeAccount.requirements !== payoutAccount.requirements) {
        updates.requirements = stripeAccount.requirements;
      }
      
      // Determine verification status
      const isVerified = stripeAccount.details_submitted && 
                        stripeAccount.capabilities?.transfers === 'active' &&
                        (!stripeAccount.requirements?.currently_due || 
                         stripeAccount.requirements.currently_due.length === 0);
      
      if (isVerified && payoutAccount.verificationStatus !== 'verified') {
        updates.verificationStatus = 'verified';
        updates.verifiedAt = new Date();
        updates.status = 'active';
      }

      if (Object.keys(updates).length > 0) {
        await payoutAccount.update(updates);
      }

      // Get balance from Stripe
      let balance = { available: 0, pending: 0 };
      try {
        const stripeBalance = await stripe.balance.retrieve({
          stripeAccount: payoutAccount.stripeAccountId
        });
        
        if (stripeBalance.available && stripeBalance.available.length > 0) {
          balance.available = stripeBalance.available[0].amount;
        }
        if (stripeBalance.pending && stripeBalance.pending.length > 0) {
          balance.pending = stripeBalance.pending[0].amount;
        }
      } catch (balanceError) {
        logger.warn('Could not fetch balance:', balanceError);
      }

      return {
        exists: true,
        id: payoutAccount.id,
        stripeAccountId: payoutAccount.stripeAccountId,
        status: payoutAccount.status,
        verificationStatus: payoutAccount.verificationStatus,
        country: payoutAccount.country,
        currency: payoutAccount.currency,
        accountType: payoutAccount.accountType,
        capabilities: stripeAccount.capabilities,
        requirements: stripeAccount.requirements,
        balance,
        payoutSchedule: payoutAccount.payoutSchedule,
        canReceivePayouts: payoutAccount.canReceivePayouts(),
        hasRequiredDocuments: payoutAccount.hasRequiredDocuments(),
        onboardingUrl: !isVerified ? this.generateOnboardingUrl(payoutAccount.stripeAccountId) : null,
        dashboardUrl: this.generateDashboardUrl(payoutAccount.stripeAccountId),
        createdAt: payoutAccount.createdAt,
        verifiedAt: payoutAccount.verifiedAt
      };

    } catch (error) {
      logger.error('Error getting payout account status:', error);
      throw new Error(`Failed to get payout account status: ${error.message}`);
    }
  }

  /**
   * Process a payout
   * @param {string} userId - User ID
   * @param {number} amount - Payout amount in cents
   * @param {Object} options - Payout options
   * @param {Object} transaction - Database transaction
   * @returns {Object} Payout result
   */
  async processPayout(userId, amount, options = {}, transaction = null) {
    const dbTransaction = transaction || await Payout.sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      const {
        type = 'standard',
        description = 'Delivery earnings payout',
        sourceType = 'delivery_earnings',
        sourceId = null,
        metadata = {}
      } = options;

      // Get payout account
      const payoutAccount = await PayoutAccount.findOne({
        where: { userId },
        transaction: dbTransaction
      });

      if (!payoutAccount) {
        throw new Error('Payout account not found');
      }

      if (!payoutAccount.canReceivePayouts()) {
        throw new Error('Payout account is not active or not verified');
      }

      // Validate minimum amount
      const minAmount = this.minimumAmounts[type];
      if (amount < minAmount) {
        throw new Error(`Minimum payout amount for ${type} is ${minAmount} cents`);
      }

      // Calculate fees
      const fee = this.calculatePayoutFees(amount, type);
      const netAmount = amount - fee;

      // Create payout record
      const payout = await Payout.create({
        userId,
        payoutAccountId: payoutAccount.id,
        amount,
        currency: payoutAccount.currency,
        type,
        status: 'pending',
        fee,
        netAmount,
        description,
        sourceType,
        sourceId,
        metadata,
        requestedAt: new Date()
      }, { transaction: dbTransaction });

      // Process with Stripe
      let stripePayout;
      try {
        stripePayout = await stripe.payouts.create({
          amount: netAmount,
          currency: payoutAccount.currency.toLowerCase(),
          method: type === 'instant' ? 'instant' : 'standard',
          description,
          metadata: {
            payoutId: payout.id,
            userId,
            sourceType,
            sourceId: sourceId || '',
            ...metadata
          }
        }, {
          stripeAccount: payoutAccount.stripeAccountId
        });

        // Update payout with Stripe information
        await payout.update({
          stripePayoutId: stripePayout.id,
          status: stripePayout.status,
          processedAt: new Date(),
          arrivalDate: new Date(stripePayout.arrival_date * 1000)
        }, { transaction: dbTransaction });

      } catch (stripeError) {
        // Update payout as failed
        await payout.update({
          status: 'failed',
          failedAt: new Date(),
          failureReason: stripeError.message,
          failureCode: stripeError.code
        }, { transaction: dbTransaction });

        throw new Error(`Stripe payout failed: ${stripeError.message}`);
      }

      // Log transaction
      await TransactionLog.create({
        payoutId: payout.id,
        transactionId: `payout_${payout.id}`,
        type: 'debit',
        category: 'payout',
        amount: netAmount,
        currency: payoutAccount.currency,
        status: stripePayout.status === 'paid' ? 'completed' : 'processing',
        description: `${type} payout: ${description}`,
        fromUserId: null,
        toUserId: userId,
        fromAccountType: 'platform',
        toAccountType: 'traveler',
        provider: 'stripe',
        providerTransactionId: stripePayout.id,
        providerFee: fee,
        processedAt: new Date(),
        metadata: {
          sourceType,
          sourceId,
          payoutType: type,
          stripePayoutId: stripePayout.id
        }
      }, { transaction: dbTransaction });

      if (shouldCommit) {
        await dbTransaction.commit();
      }

      // Log successful payout
      paymentLogger.payoutProcessed(
        payout.id,
        netAmount,
        payoutAccount.currency,
        userId
      );

      // Send notification
      await this.notificationService.sendPayoutNotification(userId, payout);

      return {
        id: payout.id,
        stripePayoutId: stripePayout.id,
        amount: netAmount,
        currency: payoutAccount.currency,
        type,
        status: stripePayout.status,
        fee,
        estimatedArrival: new Date(stripePayout.arrival_date * 1000),
        description,
        createdAt: payout.createdAt
      };

    } catch (error) {
      if (shouldCommit) {
        await dbTransaction.rollback();
      }
      logger.error('Error processing payout:', error);
      throw new Error(`Payout processing failed: ${error.message}`);
    }
  }

  /**
   * Request instant payout
   * @param {string} userId - User ID
   * @param {Object} payoutData - Payout data
   * @returns {Object} Instant payout result
   */
  async requestInstantPayout(userId, payoutData) {
    const { amount, description = 'Instant payout request' } = payoutData;

    return this.processPayout(userId, amount, {
      type: 'instant',
      description,
      sourceType: 'instant_payout_request'
    });
  }

  /**
   * Get payout history
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Payout history with pagination
   */
  async getPayoutHistory(userId, filters = {}) {
    try {
      const {
        status,
        type,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = filters;

      const where = { userId };

      if (status) {
        where.status = status;
      }

      if (type) {
        where.type = type;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const offset = (page - 1) * limit;

      const { rows: payouts, count } = await Payout.findAndCountAll({
        where,
        include: [
          {
            model: PayoutAccount,
            as: 'payoutAccount',
            attributes: ['currency', 'country']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return {
        data: payouts.map(payout => ({
          id: payout.id,
          stripePayoutId: payout.stripePayoutId,
          amount: payout.amount,
          netAmount: payout.netAmount,
          fee: payout.fee,
          currency: payout.currency,
          type: payout.type,
          status: payout.status,
          description: payout.description,
          sourceType: payout.sourceType,
          sourceId: payout.sourceId,
          requestedAt: payout.requestedAt,
          processedAt: payout.processedAt,
          paidAt: payout.paidAt,
          arrivalDate: payout.arrivalDate,
          failureReason: payout.failureReason,
          receiptUrl: payout.receiptUrl
        })),
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        summary: {
          totalPayouts: count,
          totalAmount: payouts.reduce((sum, p) => sum + p.netAmount, 0),
          pendingAmount: payouts
            .filter(p => ['pending', 'in_transit'].includes(p.status))
            .reduce((sum, p) => sum + p.netAmount, 0)
        }
      };

    } catch (error) {
      logger.error('Error getting payout history:', error);
      throw new Error(`Failed to get payout history: ${error.message}`);
    }
  }

  /**
   * Update payout account settings
   * @param {string} userId - User ID
   * @param {Object} updates - Account updates
   * @returns {Object} Updated account information
   */
  async updatePayoutAccount(userId, updates) {
    try {
      const payoutAccount = await PayoutAccount.findOne({
        where: { userId }
      });

      if (!payoutAccount) {
        throw new Error('Payout account not found');
      }

      const allowedUpdates = ['payoutSchedule', 'settings'];
      const filteredUpdates = {};

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      });

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid updates provided');
      }

      // Update Stripe account if needed
      if (updates.payoutSchedule) {
        await stripe.accounts.update(payoutAccount.stripeAccountId, {
          settings: {
            payouts: {
              schedule: updates.payoutSchedule
            }
          }
        });
      }

      // Update local record
      await payoutAccount.update(filteredUpdates);

      return {
        id: payoutAccount.id,
        stripeAccountId: payoutAccount.stripeAccountId,
        payoutSchedule: payoutAccount.payoutSchedule,
        settings: payoutAccount.settings,
        updatedAt: payoutAccount.updatedAt
      };

    } catch (error) {
      logger.error('Error updating payout account:', error);
      throw new Error(`Failed to update payout account: ${error.message}`);
    }
  }

  /**
   * Process webhook from Stripe Connect
   * @param {Object} event - Stripe webhook event
   * @returns {boolean} Processing success
   */
  async processPayoutWebhook(event) {
    try {
      logger.info(`Processing payout webhook: ${event.type}`);

      switch (event.type) {
        case 'payout.paid':
          await this.handlePayoutPaid(event.data.object);
          break;
          
        case 'payout.failed':
          await this.handlePayoutFailed(event.data.object);
          break;
          
        case 'account.updated':
          await this.handleAccountUpdated(event.data.object);
          break;
          
        default:
          logger.info(`Unhandled payout webhook event type: ${event.type}`);
      }

      return true;
    } catch (error) {
      logger.error('Error processing payout webhook:', error);
      return false;
    }
  }

  // Helper methods
  calculatePayoutFees(amount, type) {
    if (type === 'instant') {
      return Math.max(
        stripeConfig.instantPayoutFeeMin,
        Math.round(amount * stripeConfig.instantPayoutFeeRate)
      );
    }
    
    // Standard payouts are free
    return 0;
  }

  generateOnboardingUrl(stripeAccountId) {
    // In production, this would create an actual Stripe onboarding link
    return `https://connect.stripe.com/setup/s/${stripeAccountId}`;
  }

  generateDashboardUrl(stripeAccountId) {
    // In production, this would create an actual Stripe Express dashboard link
    return `https://connect.stripe.com/express/dashboard/${stripeAccountId}`;
  }

  // Webhook handlers
  async handlePayoutPaid(payout) {
    try {
      const localPayout = await Payout.findOne({
        where: { stripePayoutId: payout.id }
      });

      if (localPayout) {
        await localPayout.update({
          status: 'paid',
          paidAt: new Date(payout.arrival_date * 1000)
        });

        logger.info(`Payout paid: ${payout.id}`);
      }
    } catch (error) {
      logger.error('Error handling payout paid webhook:', error);
    }
  }

  async handlePayoutFailed(payout) {
    try {
      const localPayout = await Payout.findOne({
        where: { stripePayoutId: payout.id }
      });

      if (localPayout) {
        await localPayout.update({
          status: 'failed',
          failedAt: new Date(),
          failureReason: payout.failure_message,
          failureCode: payout.failure_code
        });

        logger.info(`Payout failed: ${payout.id}`);
      }
    } catch (error) {
      logger.error('Error handling payout failed webhook:', error);
    }
  }

  async handleAccountUpdated(account) {
    try {
      const payoutAccount = await PayoutAccount.findOne({
        where: { stripeAccountId: account.id }
      });

      if (payoutAccount) {
        const updates = {
          capabilities: account.capabilities,
          requirements: account.requirements
        };

        // Check if verification status changed
        const isVerified = account.details_submitted && 
                          account.capabilities?.transfers === 'active' &&
                          (!account.requirements?.currently_due || 
                           account.requirements.currently_due.length === 0);

        if (isVerified && payoutAccount.verificationStatus !== 'verified') {
          updates.verificationStatus = 'verified';
          updates.verifiedAt = new Date();
          updates.status = 'active';
        }

        await payoutAccount.update(updates);
        logger.info(`Payout account updated: ${account.id}`);
      }
    } catch (error) {
      logger.error('Error handling account updated webhook:', error);
    }
  }
}

module.exports = PayoutService;