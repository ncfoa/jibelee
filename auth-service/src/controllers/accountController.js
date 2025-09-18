const { User } = require('../models');
const passwordService = require('../services/passwordService');
const sessionService = require('../services/sessionService');
const emailService = require('../services/emailService');
const { logger, logAuthEvent, logSecurityEvent } = require('../config/logger');

class AccountController {
  // Account Deactivation
  async deactivateAccount(req, res) {
    try {
      const { reason, feedback, password } = req.body;
      const user = req.user;

      // Verify current password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        logSecurityEvent('account_deactivation_invalid_password', 'medium', {
          userId: user.id
        }, req);

        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          errors: ['Please provide your current password correctly']
        });
      }

      // Update user status
      await user.update({
        status: 'deactivated',
        deletedAt: new Date() // Soft delete
      });

      // Revoke all sessions
      await sessionService.revokeAllUserSessions(user.id);

      // Send confirmation email
      await emailService.sendAccountDeactivated(user, reason);

      // Log deactivation with reason and feedback
      logAuthEvent('account_deactivated', user.id, {
        reason,
        feedback: feedback ? 'provided' : 'none'
      }, req);

      res.json({
        success: true,
        message: 'Account deactivated successfully. You can reactivate it anytime by contacting support.'
      });
    } catch (error) {
      logger.error('Account deactivation error:', error);
      res.status(500).json({
        success: false,
        message: 'Account deactivation failed',
        errors: ['An error occurred while deactivating your account']
      });
    }
  }

  // Account Deletion Request
  async deleteAccount(req, res) {
    try {
      const { reason, feedback, password, confirmDeletion } = req.body;
      const user = req.user;

      // Verify current password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        logSecurityEvent('account_deletion_invalid_password', 'high', {
          userId: user.id
        }, req);

        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          errors: ['Please provide your current password correctly']
        });
      }

      // Verify deletion confirmation
      if (!confirmDeletion) {
        return res.status(400).json({
          success: false,
          message: 'Deletion confirmation required',
          errors: ['You must confirm account deletion']
        });
      }

      // In a production environment, you might want to:
      // 1. Schedule the deletion for later (grace period)
      // 2. Anonymize data instead of hard deletion
      // 3. Check for active deliveries, payments, etc.

      // For now, we'll mark the account for deletion
      await user.update({
        status: 'banned', // Use banned status to prevent login
        deletedAt: new Date()
      });

      // Revoke all sessions
      await sessionService.revokeAllUserSessions(user.id);

      // Log deletion request with reason and feedback
      logAuthEvent('account_deletion_requested', user.id, {
        reason,
        feedback: feedback ? 'provided' : 'none'
      }, req);

      // Send confirmation email to a backup email if available
      // For now, send to the same email before it's processed
      try {
        await emailService.sendEmail(
          user.email,
          'Account Deletion Confirmation',
          'account-deletion-confirmation',
          {
            firstName: user.firstName,
            deletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 7 days from now
            reason,
            supportUrl: `${process.env.FRONTEND_URL}/support`
          }
        );
      } catch (emailError) {
        logger.error('Failed to send deletion confirmation email:', emailError);
      }

      res.json({
        success: true,
        message: 'Account deletion request submitted. Your account will be permanently deleted within 7 days. Contact support if you change your mind.'
      });
    } catch (error) {
      logger.error('Account deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Account deletion request failed',
        errors: ['An error occurred while processing your deletion request']
      });
    }
  }

  // Reactivate Account
  async reactivateAccount(req, res) {
    try {
      const { email, password } = req.body;

      // Find deactivated user
      const user = await User.findOne({ 
        where: { 
          email,
          status: 'deactivated'
        },
        paranoid: false // Include soft-deleted records
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Deactivated account not found',
          errors: ['No deactivated account found with this email address']
        });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        logSecurityEvent('account_reactivation_invalid_password', 'medium', {
          userId: user.id,
          email
        }, req);

        return res.status(400).json({
          success: false,
          message: 'Invalid credentials',
          errors: ['Email or password is incorrect']
        });
      }

      // Reactivate account
      await user.update({
        status: 'active',
        deletedAt: null // Remove soft delete
      });

      // Send confirmation email
      await emailService.sendAccountReactivated(user);

      logAuthEvent('account_reactivated', user.id, {
        email
      }, req);

      res.json({
        success: true,
        message: 'Account reactivated successfully. You can now log in normally.'
      });
    } catch (error) {
      logger.error('Account reactivation error:', error);
      res.status(500).json({
        success: false,
        message: 'Account reactivation failed',
        errors: ['An error occurred while reactivating your account']
      });
    }
  }

  // Get Account Status
  async getAccountStatus(req, res) {
    try {
      const user = req.user;

      const accountInfo = {
        id: user.id,
        email: user.email,
        status: user.status,
        verificationLevel: user.verificationLevel,
        emailVerified: user.isEmailVerified(),
        phoneVerified: user.isPhoneVerified(),
        createdAt: user.createdAt,
        lastLoginAt: user.updatedAt, // Approximate
        profileComplete: !!(user.phoneNumber && user.dateOfBirth),
        termsAccepted: !!user.termsAcceptedAt,
        privacyAccepted: !!user.privacyAcceptedAt
      };

      // Get 2FA status
      const twoFactorService = require('../services/twoFactorService');
      const twoFactorStatus = await twoFactorService.get2FAStatus(user.id);
      accountInfo.twoFactorEnabled = twoFactorStatus.enabled;

      // Get session count
      const sessions = await sessionService.getUserSessions(user.id);
      accountInfo.activeSessions = sessions.length;

      res.json({
        success: true,
        data: accountInfo
      });
    } catch (error) {
      logger.error('Get account status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve account status',
        errors: ['An error occurred while retrieving account information']
      });
    }
  }

  // Update Account Settings
  async updateAccountSettings(req, res) {
    try {
      const { 
        preferredLanguage, 
        timezone, 
        preferredCurrency,
        phoneNumber 
      } = req.body;
      const user = req.user;

      const updateData = {};

      if (preferredLanguage) {
        const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt'];
        if (!validLanguages.includes(preferredLanguage)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid language',
            errors: ['Please select a valid language']
          });
        }
        updateData.preferredLanguage = preferredLanguage;
      }

      if (timezone) {
        updateData.timezone = timezone;
      }

      if (preferredCurrency) {
        const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
        if (!validCurrencies.includes(preferredCurrency)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid currency',
            errors: ['Please select a valid currency']
          });
        }
        updateData.preferredCurrency = preferredCurrency;
      }

      if (phoneNumber) {
        // Validate phone number format
        if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid phone number',
            errors: ['Phone number must be in E.164 format (e.g., +1234567890)']
          });
        }

        // Check if phone number is already used by another user
        const existingUser = await User.findOne({
          where: { 
            phoneNumber,
            id: { [User.sequelize.Op.ne]: user.id }
          }
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Phone number already in use',
            errors: ['This phone number is already associated with another account']
          });
        }

        updateData.phoneNumber = phoneNumber;
        // Reset phone verification if phone number changed
        if (phoneNumber !== user.phoneNumber) {
          updateData.phoneVerifiedAt = null;
        }
      }

      // Update user
      if (Object.keys(updateData).length > 0) {
        await user.update(updateData);
      }

      logAuthEvent('account_settings_updated', user.id, {
        updatedFields: Object.keys(updateData)
      }, req);

      res.json({
        success: true,
        message: 'Account settings updated successfully',
        data: {
          updatedFields: Object.keys(updateData)
        }
      });
    } catch (error) {
      logger.error('Update account settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update account settings',
        errors: ['An error occurred while updating your settings']
      });
    }
  }

  // Export Account Data (GDPR compliance)
  async exportAccountData(req, res) {
    try {
      const user = req.user;

      // Get user data
      const userData = {
        profile: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          dateOfBirth: user.dateOfBirth,
          userType: user.userType,
          status: user.status,
          verificationLevel: user.verificationLevel,
          preferredLanguage: user.preferredLanguage,
          timezone: user.timezone,
          preferredCurrency: user.preferredCurrency,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        sessions: await sessionService.getUserSessions(user.id),
        // In a full implementation, you'd include:
        // - Delivery history
        // - Payment history
        // - Reviews and ratings
        // - Support tickets
        // - etc.
      };

      // Get 2FA status
      const twoFactorService = require('../services/twoFactorService');
      userData.twoFactorAuth = await twoFactorService.get2FAStatus(user.id);

      logAuthEvent('account_data_exported', user.id, {}, req);

      res.json({
        success: true,
        data: userData,
        message: 'Account data exported successfully',
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Export account data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export account data',
        errors: ['An error occurred while exporting your data']
      });
    }
  }

  // Get Security Log (recent account activity)
  async getSecurityLog(req, res) {
    try {
      const user = req.user;
      const { page = 1, limit = 20 } = req.query;

      // In a full implementation, you'd query an audit log table
      // For now, return recent sessions as security events
      const sessions = await sessionService.getUserSessions(user.id);
      
      const securityEvents = sessions.map(session => ({
        type: 'login',
        timestamp: session.createdAt,
        deviceType: session.deviceType,
        platform: session.platform,
        location: session.location,
        ipAddress: session.ipAddress,
        status: session.revokedAt ? 'revoked' : 'active'
      }));

      // Sort by timestamp (newest first)
      securityEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedEvents = securityEvents.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          events: paginatedEvents,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: securityEvents.length,
            totalPages: Math.ceil(securityEvents.length / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get security log error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve security log',
        errors: ['An error occurred while retrieving your security log']
      });
    }
  }
}

module.exports = new AccountController();