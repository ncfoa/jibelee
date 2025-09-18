const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { logger } = require('../config/logger');
const { UserTwoFactorAuth } = require('../models');

class TwoFactorService {
  constructor() {
    this.issuer = 'P2P Delivery Platform';
    this.window = 2; // Allow 2 time steps tolerance (60 seconds each way)
  }

  generateSecret(userEmail) {
    try {
      const secret = speakeasy.generateSecret({
        name: `${this.issuer} (${userEmail})`,
        issuer: this.issuer,
        length: 32
      });

      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }

  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return qrCodeDataURL;
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  verifyToken(secret, token) {
    try {
      if (!secret || !token) {
        return false;
      }

      // Remove spaces and ensure token is 6 digits
      const cleanToken = token.replace(/\s/g, '');
      if (!/^\d{6}$/.test(cleanToken)) {
        return false;
      }

      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: cleanToken,
        window: this.window
      });
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      return false;
    }
  }

  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  async setup2FA(userId, userEmail) {
    try {
      // Check if 2FA is already set up
      const existing2FA = await UserTwoFactorAuth.findByUserId(userId);
      if (existing2FA && existing2FA.enabled) {
        throw new Error('2FA is already enabled for this user');
      }

      // Generate secret and backup codes
      const { secret, otpauthUrl } = this.generateSecret(userEmail);
      const backupCodes = this.generateBackupCodes();
      const qrCode = await this.generateQRCode(otpauthUrl);

      // Create or update 2FA record (but don't enable yet)
      if (existing2FA) {
        await existing2FA.update({
          secretKey: secret,
          backupCodes: backupCodes,
          enabled: false,
          enabledAt: null
        });
      } else {
        await UserTwoFactorAuth.create({
          userId,
          secretKey: secret,
          backupCodes: backupCodes,
          enabled: false
        });
      }

      return {
        qrCode,
        secret, // Only return for initial setup
        backupCodes
      };
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      throw error;
    }
  }

  async enable2FA(userId, verificationToken) {
    try {
      const twoFA = await UserTwoFactorAuth.findByUserId(userId);
      if (!twoFA) {
        throw new Error('2FA setup not found. Please set up 2FA first.');
      }

      if (twoFA.enabled) {
        throw new Error('2FA is already enabled');
      }

      // Verify the token
      const isValid = this.verifyToken(twoFA.secretKey, verificationToken);
      if (!isValid) {
        throw new Error('Invalid verification token');
      }

      // Enable 2FA
      await twoFA.enable();

      return {
        enabled: true,
        backupCodes: twoFA.backupCodes
      };
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw error;
    }
  }

  async disable2FA(userId, verificationToken) {
    try {
      const twoFA = await UserTwoFactorAuth.findByUserId(userId);
      if (!twoFA || !twoFA.enabled) {
        throw new Error('2FA is not enabled for this user');
      }

      // Verify the token or backup code
      const isValidToken = this.verifyToken(twoFA.secretKey, verificationToken);
      const isValidBackupCode = twoFA.backupCodes.includes(verificationToken);

      if (!isValidToken && !isValidBackupCode) {
        throw new Error('Invalid verification token or backup code');
      }

      // If backup code was used, remove it
      if (isValidBackupCode) {
        await twoFA.useBackupCode(verificationToken);
      }

      // Disable 2FA
      await twoFA.disable();

      return { disabled: true };
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }

  async verify2FA(userId, token) {
    try {
      const twoFA = await UserTwoFactorAuth.findByUserId(userId);
      if (!twoFA || !twoFA.enabled) {
        return { verified: false, reason: '2FA not enabled' };
      }

      // Try TOTP token first
      const isValidToken = this.verifyToken(twoFA.secretKey, token);
      if (isValidToken) {
        return { verified: true, method: 'totp' };
      }

      // Try backup code
      const isValidBackupCode = twoFA.backupCodes.includes(token);
      if (isValidBackupCode) {
        await twoFA.useBackupCode(token);
        return { 
          verified: true, 
          method: 'backup_code',
          remainingBackupCodes: twoFA.getBackupCodesCount()
        };
      }

      return { verified: false, reason: 'Invalid token or backup code' };
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      return { verified: false, reason: 'Verification failed' };
    }
  }

  async regenerateBackupCodes(userId, verificationToken) {
    try {
      const twoFA = await UserTwoFactorAuth.findByUserId(userId);
      if (!twoFA || !twoFA.enabled) {
        throw new Error('2FA is not enabled for this user');
      }

      // Verify the token
      const isValid = this.verifyToken(twoFA.secretKey, verificationToken);
      if (!isValid) {
        throw new Error('Invalid verification token');
      }

      // Generate new backup codes
      const newBackupCodes = twoFA.regenerateBackupCodes();
      await twoFA.save();

      return {
        backupCodes: newBackupCodes,
        generated: true
      };
    } catch (error) {
      logger.error('Error regenerating backup codes:', error);
      throw error;
    }
  }

  async get2FAStatus(userId) {
    try {
      const twoFA = await UserTwoFactorAuth.findByUserId(userId);
      
      return {
        enabled: twoFA ? twoFA.enabled : false,
        hasBackupCodes: twoFA ? twoFA.hasBackupCodes() : false,
        backupCodesCount: twoFA ? twoFA.getBackupCodesCount() : 0,
        enabledAt: twoFA ? twoFA.enabledAt : null
      };
    } catch (error) {
      logger.error('Error getting 2FA status:', error);
      throw error;
    }
  }

  async is2FARequired(userId) {
    try {
      const twoFA = await UserTwoFactorAuth.findByUserId(userId);
      return twoFA && twoFA.enabled;
    } catch (error) {
      logger.error('Error checking 2FA requirement:', error);
      return false;
    }
  }

  generateCurrentToken(secret) {
    try {
      return speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });
    } catch (error) {
      logger.error('Error generating current token:', error);
      return null;
    }
  }

  getTimeRemaining() {
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const countDown = 30 - (epoch % 30);
    return countDown;
  }

  validateBackupCode(code) {
    // Backup codes should be 8-character hex strings
    return /^[A-F0-9]{8}$/i.test(code);
  }

  async getRecoveryCodes(userId, verificationToken) {
    try {
      const twoFA = await UserTwoFactorAuth.findByUserId(userId);
      if (!twoFA || !twoFA.enabled) {
        throw new Error('2FA is not enabled for this user');
      }

      // Verify the token
      const isValid = this.verifyToken(twoFA.secretKey, verificationToken);
      if (!isValid) {
        throw new Error('Invalid verification token');
      }

      return {
        backupCodes: twoFA.backupCodes,
        count: twoFA.getBackupCodesCount()
      };
    } catch (error) {
      logger.error('Error getting recovery codes:', error);
      throw error;
    }
  }
}

module.exports = new TwoFactorService();