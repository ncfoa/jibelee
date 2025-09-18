const twoFactorService = require('../services/twoFactorService');
const jwtService = require('../services/jwtService');
const sessionService = require('../services/sessionService');
const emailService = require('../services/emailService');
const { logger, logAuthEvent, logSecurityEvent } = require('../config/logger');

class TwoFactorController {
  // Setup 2FA (generate QR code and backup codes)
  async setup2FA(req, res) {
    try {
      const user = req.user;

      // Check if 2FA is already enabled
      const currentStatus = await twoFactorService.get2FAStatus(user.id);
      if (currentStatus.enabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is already enabled',
          errors: ['Two-factor authentication is already enabled for your account']
        });
      }

      // Generate QR code and backup codes
      const setup = await twoFactorService.setup2FA(user.id, user.email);

      logAuthEvent('2fa_setup_initiated', user.id, {}, req);

      res.json({
        success: true,
        data: {
          qrCode: setup.qrCode,
          secret: setup.secret,
          backupCodes: setup.backupCodes
        },
        message: 'Scan the QR code with your authenticator app, then verify with a code to enable 2FA'
      });
    } catch (error) {
      logger.error('2FA setup error:', error);
      res.status(500).json({
        success: false,
        message: '2FA setup failed',
        errors: ['An error occurred while setting up two-factor authentication']
      });
    }
  }

  // Enable 2FA (verify setup and activate)
  async enable2FA(req, res) {
    try {
      const { code } = req.body;
      const user = req.user;

      if (!code) {
        return res.status(422).json({
          success: false,
          message: 'Verification code required',
          errors: ['Please provide a verification code from your authenticator app']
        });
      }

      // Enable 2FA with verification
      const result = await twoFactorService.enable2FA(user.id, code);

      // Send confirmation email
      await emailService.send2FAEnabled(user);

      logAuthEvent('2fa_enabled', user.id, {}, req);

      res.json({
        success: true,
        data: {
          enabled: result.enabled,
          backupCodes: result.backupCodes
        },
        message: 'Two-factor authentication has been enabled successfully'
      });
    } catch (error) {
      logger.error('2FA enable error:', error);
      
      if (error.message.includes('Invalid verification token')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code',
          errors: ['The verification code is incorrect. Please try again.']
        });
      }

      res.status(500).json({
        success: false,
        message: '2FA enable failed',
        errors: ['An error occurred while enabling two-factor authentication']
      });
    }
  }

  // Disable 2FA
  async disable2FA(req, res) {
    try {
      const { code } = req.body;
      const user = req.user;

      if (!code) {
        return res.status(422).json({
          success: false,
          message: 'Verification code required',
          errors: ['Please provide a verification code or backup code to disable 2FA']
        });
      }

      // Disable 2FA with verification
      await twoFactorService.disable2FA(user.id, code);

      // Send confirmation email
      await emailService.send2FADisabled(user);

      logAuthEvent('2fa_disabled', user.id, {}, req);

      res.json({
        success: true,
        data: {
          disabled: true
        },
        message: 'Two-factor authentication has been disabled'
      });
    } catch (error) {
      logger.error('2FA disable error:', error);
      
      if (error.message.includes('Invalid verification token')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code',
          errors: ['The verification code or backup code is incorrect']
        });
      }

      res.status(500).json({
        success: false,
        message: '2FA disable failed',
        errors: ['An error occurred while disabling two-factor authentication']
      });
    }
  }

  // Verify 2FA code (during login or for sensitive operations)
  async verify2FA(req, res) {
    try {
      const { code } = req.body;
      const user = req.user;

      if (!code) {
        return res.status(422).json({
          success: false,
          message: 'Verification code required',
          errors: ['Please provide a verification code from your authenticator app']
        });
      }

      // Verify 2FA code
      const verification = await twoFactorService.verify2FA(user.id, code);

      if (!verification.verified) {
        logSecurityEvent('2fa_verification_failed', 'medium', {
          userId: user.id,
          reason: verification.reason
        }, req);

        return res.status(400).json({
          success: false,
          message: 'Invalid verification code',
          errors: ['The verification code is incorrect or expired']
        });
      }

      logAuthEvent('2fa_verified', user.id, {
        method: verification.method
      }, req);

      const responseData = {
        verified: true,
        method: verification.method
      };

      // If backup code was used, include remaining count
      if (verification.remainingBackupCodes !== undefined) {
        responseData.remainingBackupCodes = verification.remainingBackupCodes;
        
        // Warn if running low on backup codes
        if (verification.remainingBackupCodes <= 2) {
          responseData.warning = 'You are running low on backup codes. Consider regenerating them.';
        }
      }

      res.json({
        success: true,
        data: responseData,
        message: 'Two-factor authentication verified successfully'
      });
    } catch (error) {
      logger.error('2FA verification error:', error);
      res.status(500).json({
        success: false,
        message: '2FA verification failed',
        errors: ['An error occurred during verification']
      });
    }
  }

  // 2FA Login (complete login after 2FA verification)
  async login2FA(req, res) {
    try {
      const { email, password, twoFactorCode } = req.body;

      // This endpoint handles the complete 2FA login flow
      // First verify email/password, then 2FA code

      const { User } = require('../models');
      
      // Find user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        logSecurityEvent('2fa_login_invalid_email', 'low', { email }, req);
        
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errors: ['Email or password is incorrect']
        });
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        logSecurityEvent('2fa_login_invalid_password', 'medium', {
          userId: user.id,
          email
        }, req);

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errors: ['Email or password is incorrect']
        });
      }

      // Check if user can login
      if (!user.canLogin()) {
        return res.status(401).json({
          success: false,
          message: 'Account access restricted',
          errors: ['Your account is not active or verified']
        });
      }

      // Verify 2FA code
      const verification = await twoFactorService.verify2FA(user.id, twoFactorCode);
      if (!verification.verified) {
        logSecurityEvent('2fa_login_invalid_code', 'high', {
          userId: user.id,
          reason: verification.reason
        }, req);

        return res.status(401).json({
          success: false,
          message: 'Invalid two-factor authentication code',
          errors: ['The two-factor authentication code is incorrect']
        });
      }

      // Generate device info
      const deviceInfo = {
        deviceId: req.get('X-Device-ID') || sessionService.generateDeviceFingerprint(req),
        deviceType: req.get('X-Device-Type') || 'web',
        platform: req.get('X-Platform') || 'web',
        appVersion: req.get('X-App-Version'),
        pushToken: req.get('X-Push-Token'),
        ipAddress: req.ip,
        location: req.get('X-User-Location') || 'Unknown',
        userAgent: req.get('User-Agent')
      };

      // Generate tokens
      const tokenPair = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email,
        userType: user.userType,
        deviceId: deviceInfo.deviceId
      });

      // Create session
      await sessionService.createSession(user.id, deviceInfo, tokenPair.refreshToken, false);

      logAuthEvent('2fa_login_success', user.id, {
        email,
        method: verification.method,
        deviceType: deviceInfo.deviceType
      }, req);

      const responseData = {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          status: user.status,
          verificationLevel: user.verificationLevel,
          lastLoginAt: new Date().toISOString()
        }
      };

      // Add backup code warning if applicable
      if (verification.remainingBackupCodes !== undefined && verification.remainingBackupCodes <= 2) {
        responseData.warning = 'You are running low on backup codes. Consider regenerating them.';
      }

      res.json({
        success: true,
        data: responseData,
        message: 'Login successful'
      });
    } catch (error) {
      logger.error('2FA login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        errors: ['An error occurred during login']
      });
    }
  }

  // Get 2FA status
  async get2FAStatus(req, res) {
    try {
      const user = req.user;
      const status = await twoFactorService.get2FAStatus(user.id);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Get 2FA status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get 2FA status',
        errors: ['An error occurred while retrieving 2FA status']
      });
    }
  }

  // Regenerate backup codes
  async regenerateBackupCodes(req, res) {
    try {
      const { code } = req.body;
      const user = req.user;

      if (!code) {
        return res.status(422).json({
          success: false,
          message: 'Verification code required',
          errors: ['Please provide a verification code to regenerate backup codes']
        });
      }

      // Regenerate backup codes with verification
      const result = await twoFactorService.regenerateBackupCodes(user.id, code);

      // Send notification email
      await emailService.sendBackupCodesGenerated(user);

      logAuthEvent('2fa_backup_codes_regenerated', user.id, {}, req);

      res.json({
        success: true,
        data: {
          backupCodes: result.backupCodes
        },
        message: 'Backup codes regenerated successfully. Please save them in a secure location.'
      });
    } catch (error) {
      logger.error('Regenerate backup codes error:', error);
      
      if (error.message.includes('Invalid verification token')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code',
          errors: ['The verification code is incorrect']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to regenerate backup codes',
        errors: ['An error occurred while regenerating backup codes']
      });
    }
  }

  // Get recovery codes (same as backup codes, for compatibility)
  async getRecoveryCodes(req, res) {
    try {
      const { code } = req.body;
      const user = req.user;

      if (!code) {
        return res.status(422).json({
          success: false,
          message: 'Verification code required',
          errors: ['Please provide a verification code to view recovery codes']
        });
      }

      // Get recovery codes with verification
      const result = await twoFactorService.getRecoveryCodes(user.id, code);

      logAuthEvent('2fa_recovery_codes_accessed', user.id, {}, req);

      res.json({
        success: true,
        data: {
          backupCodes: result.backupCodes,
          count: result.count
        },
        message: 'Recovery codes retrieved successfully'
      });
    } catch (error) {
      logger.error('Get recovery codes error:', error);
      
      if (error.message.includes('Invalid verification token')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code',
          errors: ['The verification code is incorrect']
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recovery codes',
        errors: ['An error occurred while retrieving recovery codes']
      });
    }
  }
}

module.exports = new TwoFactorController();