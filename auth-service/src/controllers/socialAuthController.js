const axios = require('axios');
const { User } = require('../models');
const jwtService = require('../services/jwtService');
const sessionService = require('../services/sessionService');
const emailService = require('../services/emailService');
const { logger, logAuthEvent, logSecurityEvent } = require('../config/logger');

class SocialAuthController {
  // Social Login (Google, Facebook, Apple)
  async socialLogin(req, res) {
    try {
      const { provider, accessToken, userInfo, deviceInfo = {} } = req.body;

      // Validate provider
      if (!['google', 'facebook', 'apple'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid social provider',
          errors: ['Supported providers are: google, facebook, apple']
        });
      }

      // Verify social token and get user info
      let verifiedUserInfo;
      try {
        verifiedUserInfo = await this.verifySocialToken(provider, accessToken, userInfo);
      } catch (error) {
        logSecurityEvent('social_token_verification_failed', 'medium', {
          provider,
          error: error.message
        }, req);

        return res.status(401).json({
          success: false,
          message: 'Social authentication failed',
          errors: ['Unable to verify your social account. Please try again.']
        });
      }

      // Check if user exists by email
      let user = await User.findOne({ where: { email: verifiedUserInfo.email } });

      if (user) {
        // User exists - log them in
        if (!user.canLogin()) {
          return res.status(401).json({
            success: false,
            message: 'Account access restricted',
            errors: [
              !user.isActive() 
                ? 'Your account is not active. Please contact support.'
                : 'Please verify your email address.'
            ]
          });
        }

        // Update user profile with social info if needed
        const updateData = {};
        if (!user.profilePictureUrl && verifiedUserInfo.profilePicture) {
          updateData.profilePictureUrl = verifiedUserInfo.profilePicture;
        }
        if (!user.isEmailVerified()) {
          updateData.emailVerifiedAt = new Date();
          updateData.status = 'active';
          updateData.verificationLevel = 'email_verified';
        }

        if (Object.keys(updateData).length > 0) {
          await user.update(updateData);
        }

        logAuthEvent('social_login_existing_user', user.id, {
          provider,
          email: user.email
        }, req);
      } else {
        // User doesn't exist - create new account
        user = await User.create({
          email: verifiedUserInfo.email,
          passwordHash: this.generateRandomPassword(), // Generate secure random password
          firstName: verifiedUserInfo.firstName,
          lastName: verifiedUserInfo.lastName,
          profilePictureUrl: verifiedUserInfo.profilePicture,
          userType: 'customer', // Default type
          status: 'active',
          emailVerifiedAt: new Date(), // Social accounts are pre-verified
          verificationLevel: 'email_verified',
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date()
        });

        // Send welcome email
        await emailService.sendWelcomeEmail(user, null); // No verification code needed

        logAuthEvent('social_registration', user.id, {
          provider,
          email: user.email
        }, req);
      }

      // Check if 2FA is enabled
      const twoFactorService = require('../services/twoFactorService');
      const requires2FA = await twoFactorService.is2FARequired(user.id);
      
      if (requires2FA) {
        // Return temporary token for 2FA verification
        const tempToken = jwtService.generateAccessToken({
          userId: user.id,
          email: user.email,
          userType: user.userType,
          temp2FA: true
        });

        return res.json({
          success: true,
          data: {
            requires2FA: true,
            tempToken,
            message: 'Two-factor authentication required'
          }
        });
      }

      // Generate device info
      const fullDeviceInfo = {
        deviceId: deviceInfo.deviceId || sessionService.generateDeviceFingerprint(req),
        deviceType: deviceInfo.deviceType || 'web',
        platform: deviceInfo.platform || 'web',
        appVersion: deviceInfo.appVersion,
        pushToken: deviceInfo.pushToken,
        ipAddress: req.ip,
        location: req.get('X-User-Location') || 'Unknown',
        userAgent: req.get('User-Agent')
      };

      // Generate tokens
      const tokenPair = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email,
        userType: user.userType,
        deviceId: fullDeviceInfo.deviceId
      });

      // Create session
      await sessionService.createSession(user.id, fullDeviceInfo, tokenPair.refreshToken, false);

      // Check for suspicious activity
      const suspiciousActivity = await sessionService.detectSuspiciousActivity(
        user.id,
        null,
        fullDeviceInfo
      );

      if (suspiciousActivity.suspicious) {
        await emailService.sendLoginAlert(user, fullDeviceInfo);
        logSecurityEvent('suspicious_social_login', suspiciousActivity.riskLevel, {
          userId: user.id,
          provider,
          flags: suspiciousActivity.flags
        }, req);
      }

      res.json({
        success: true,
        data: {
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
            profilePictureUrl: user.profilePictureUrl,
            verificationLevel: user.verificationLevel,
            lastLoginAt: new Date().toISOString()
          }
        },
        message: 'Social login successful'
      });
    } catch (error) {
      logger.error('Social login error:', error);
      res.status(500).json({
        success: false,
        message: 'Social login failed',
        errors: ['An error occurred during social authentication']
      });
    }
  }

  // Verify social token with provider
  async verifySocialToken(provider, accessToken, userInfo) {
    switch (provider) {
      case 'google':
        return this.verifyGoogleToken(accessToken, userInfo);
      case 'facebook':
        return this.verifyFacebookToken(accessToken, userInfo);
      case 'apple':
        return this.verifyAppleToken(accessToken, userInfo);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  // Verify Google token
  async verifyGoogleToken(accessToken, userInfo) {
    try {
      // Verify token with Google
      const response = await axios.get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`, {
        timeout: 10000
      });

      if (response.data.error) {
        throw new Error('Invalid Google token');
      }

      // Get user profile from Google
      const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 10000
      });

      const googleUser = profileResponse.data;

      // Verify user info matches
      if (googleUser.email !== userInfo.email || googleUser.id !== userInfo.id) {
        throw new Error('User info mismatch');
      }

      return {
        id: googleUser.id,
        email: googleUser.email,
        firstName: googleUser.given_name || userInfo.firstName,
        lastName: googleUser.family_name || userInfo.lastName,
        profilePicture: googleUser.picture || userInfo.profilePicture
      };
    } catch (error) {
      logger.error('Google token verification error:', error);
      throw new Error('Google token verification failed');
    }
  }

  // Verify Facebook token
  async verifyFacebookToken(accessToken, userInfo) {
    try {
      // Verify token with Facebook
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      
      if (!appId || !appSecret) {
        throw new Error('Facebook app credentials not configured');
      }

      // Verify app token
      const appTokenResponse = await axios.get(
        `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`,
        { timeout: 10000 }
      );

      const appToken = appTokenResponse.data.access_token;

      // Verify user token
      const verifyResponse = await axios.get(
        `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appToken}`,
        { timeout: 10000 }
      );

      if (!verifyResponse.data.data.is_valid) {
        throw new Error('Invalid Facebook token');
      }

      // Get user profile
      const profileResponse = await axios.get(
        `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${accessToken}`,
        { timeout: 10000 }
      );

      const facebookUser = profileResponse.data;

      // Verify user info matches
      if (facebookUser.email !== userInfo.email || facebookUser.id !== userInfo.id) {
        throw new Error('User info mismatch');
      }

      return {
        id: facebookUser.id,
        email: facebookUser.email,
        firstName: facebookUser.first_name || userInfo.firstName,
        lastName: facebookUser.last_name || userInfo.lastName,
        profilePicture: facebookUser.picture?.data?.url || userInfo.profilePicture
      };
    } catch (error) {
      logger.error('Facebook token verification error:', error);
      throw new Error('Facebook token verification failed');
    }
  }

  // Verify Apple token (simplified - in production you'd verify the JWT signature)
  async verifyAppleToken(identityToken, userInfo) {
    try {
      // In production, you would:
      // 1. Decode the JWT identity token
      // 2. Verify the signature using Apple's public keys
      // 3. Validate the claims (iss, aud, exp, etc.)
      
      // For now, we'll do basic validation
      if (!identityToken || !userInfo.id || !userInfo.email) {
        throw new Error('Invalid Apple token or user info');
      }

      // Basic JWT decode (without verification - NOT FOR PRODUCTION)
      const parts = identityToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Verify basic claims
      if (payload.iss !== 'https://appleid.apple.com') {
        throw new Error('Invalid issuer');
      }

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      // In production, verify the sub matches userInfo.id
      // For now, trust the provided userInfo

      return {
        id: userInfo.id,
        email: userInfo.email,
        firstName: userInfo.firstName || '',
        lastName: userInfo.lastName || '',
        profilePicture: userInfo.profilePicture || null
      };
    } catch (error) {
      logger.error('Apple token verification error:', error);
      throw new Error('Apple token verification failed');
    }
  }

  // Generate secure random password for social accounts
  generateRandomPassword() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  // Link social account to existing account
  async linkSocialAccount(req, res) {
    try {
      const { provider, accessToken, userInfo } = req.body;
      const user = req.user;

      // Verify social token
      let verifiedUserInfo;
      try {
        verifiedUserInfo = await this.verifySocialToken(provider, accessToken, userInfo);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Social account verification failed',
          errors: ['Unable to verify your social account']
        });
      }

      // Check if social account is already linked to another user
      const existingUser = await User.findOne({ 
        where: { email: verifiedUserInfo.email } 
      });

      if (existingUser && existingUser.id !== user.id) {
        return res.status(409).json({
          success: false,
          message: 'Social account already linked',
          errors: ['This social account is already linked to another user']
        });
      }

      // Update user profile with social info
      const updateData = {};
      if (!user.profilePictureUrl && verifiedUserInfo.profilePicture) {
        updateData.profilePictureUrl = verifiedUserInfo.profilePicture;
      }

      if (Object.keys(updateData).length > 0) {
        await user.update(updateData);
      }

      // In a full implementation, you'd store social account links in a separate table
      // For now, we'll just log the successful linking

      logAuthEvent('social_account_linked', user.id, {
        provider,
        socialEmail: verifiedUserInfo.email
      }, req);

      res.json({
        success: true,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`
      });
    } catch (error) {
      logger.error('Link social account error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to link social account',
        errors: ['An error occurred while linking your social account']
      });
    }
  }

  // Unlink social account
  async unlinkSocialAccount(req, res) {
    try {
      const { provider } = req.params;
      const user = req.user;

      if (!['google', 'facebook', 'apple'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid social provider',
          errors: ['Supported providers are: google, facebook, apple']
        });
      }

      // In a full implementation, you'd remove the social account link from the database
      // For now, we'll just log the unlinking

      logAuthEvent('social_account_unlinked', user.id, {
        provider
      }, req);

      res.json({
        success: true,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`
      });
    } catch (error) {
      logger.error('Unlink social account error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unlink social account',
        errors: ['An error occurred while unlinking your social account']
      });
    }
  }

  // Get linked social accounts
  async getLinkedAccounts(req, res) {
    try {
      const user = req.user;

      // In a full implementation, you'd query the social accounts table
      // For now, return empty array
      const linkedAccounts = [];

      res.json({
        success: true,
        data: {
          linkedAccounts,
          count: linkedAccounts.length
        }
      });
    } catch (error) {
      logger.error('Get linked accounts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve linked accounts',
        errors: ['An error occurred while retrieving your linked accounts']
      });
    }
  }
}

module.exports = new SocialAuthController();