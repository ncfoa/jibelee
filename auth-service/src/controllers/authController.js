const { User, UserSession, EmailVerificationToken, PasswordResetToken } = require('../models');
const jwtService = require('../services/jwtService');
const passwordService = require('../services/passwordService');
const sessionService = require('../services/sessionService');
const emailService = require('../services/emailService');
const { logger, logAuthEvent, logSecurityEvent } = require('../config/logger');

class AuthController {
  // User Registration
  async register(req, res) {
    try {
      const userData = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: userData.email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists',
          errors: ['An account with this email address already exists']
        });
      }

      // Validate password strength
      const passwordValidation = passwordService.validatePasswordStrength(userData.password, {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName
      });

      if (!passwordValidation.isValid) {
        return res.status(422).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors
        });
      }

      // Check referral code if provided
      let referredByUser = null;
      if (userData.referralCode) {
        referredByUser = await User.findOne({ where: { referralCode: userData.referralCode } });
        if (!referredByUser) {
          return res.status(400).json({
            success: false,
            message: 'Invalid referral code',
            errors: ['The referral code provided is not valid']
          });
        }
      }

      // Create user
      const user = await User.create({
        email: userData.email,
        passwordHash: userData.password, // Will be hashed by the model hook
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        dateOfBirth: userData.dateOfBirth,
        userType: userData.userType,
        preferredLanguage: userData.preferredLanguage,
        timezone: userData.timezone,
        referredByUserId: referredByUser?.id,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date()
      });

      // Generate email verification token
      const { code: verificationCode } = await EmailVerificationToken.createForUser(
        user.id,
        user.email,
        30 // 30 minutes expiry
      );

      // Send welcome email with verification code
      await emailService.sendWelcomeEmail(user, verificationCode);

      logAuthEvent('user_registered', user.id, {
        email: user.email,
        userType: user.userType,
        referralUsed: !!referredByUser
      }, req);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
            status: user.status,
            createdAt: user.createdAt
          },
          verificationRequired: true
        },
        message: 'Registration successful. Please verify your email.'
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        errors: ['An error occurred during registration. Please try again.']
      });
    }
  }

  // Email Verification
  async verifyEmail(req, res) {
    try {
      const { email, verificationCode } = req.body;

      // Find verification token
      const verificationToken = await EmailVerificationToken.findValidToken(email, verificationCode);
      if (!verificationToken) {
        logSecurityEvent('invalid_verification_attempt', 'medium', {
          email,
          code: verificationCode
        }, req);

        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code',
          errors: ['The verification code is invalid or has expired']
        });
      }

      // Get user
      const user = await User.findByPk(verificationToken.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          errors: ['The user associated with this verification code was not found']
        });
      }

      // Mark email as verified
      await user.update({
        emailVerifiedAt: new Date(),
        status: 'active',
        verificationLevel: 'email_verified'
      });

      // Mark token as used
      await verificationToken.markAsVerified();

      // Generate tokens for login
      const deviceInfo = {
        deviceId: req.get('X-Device-ID') || sessionService.generateDeviceFingerprint(req),
        deviceType: 'web',
        platform: 'web',
        ipAddress: req.ip,
        location: req.get('X-User-Location') || 'Unknown'
      };

      const tokenPair = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email,
        userType: user.userType,
        deviceId: deviceInfo.deviceId
      });

      // Create session
      await sessionService.createSession(user.id, deviceInfo, tokenPair.refreshToken, false);

      logAuthEvent('email_verified', user.id, {
        email: user.email,
        previousStatus: 'pending'
      }, req);

      res.json({
        success: true,
        data: {
          verified: true,
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
            verificationLevel: user.verificationLevel
          }
        },
        message: 'Email verified successfully'
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Email verification failed',
        errors: ['An error occurred during email verification']
      });
    }
  }

  // Resend Verification Code
  async resendVerification(req, res) {
    try {
      const { email } = req.body;

      // Check rate limiting
      const recentAttempts = await EmailVerificationToken.getRecentAttemptsCount(email, 60);
      if (recentAttempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many verification requests',
          errors: ['Please wait before requesting another verification code']
        });
      }

      // Find user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        // Don't reveal if email exists
        return res.json({
          success: true,
          message: 'If the email address exists, a verification code has been sent'
        });
      }

      // Check if already verified
      if (user.isEmailVerified()) {
        return res.status(400).json({
          success: false,
          message: 'Email already verified',
          errors: ['This email address is already verified']
        });
      }

      // Generate new verification token
      const { code: verificationCode } = await EmailVerificationToken.createForUser(
        user.id,
        user.email,
        30
      );

      // Send verification email
      await emailService.sendEmailVerification(user, verificationCode);

      logAuthEvent('verification_resent', user.id, { email }, req);

      res.json({
        success: true,
        message: 'Verification code sent successfully'
      });
    } catch (error) {
      logger.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend verification code',
        errors: ['An error occurred while sending the verification code']
      });
    }
  }

  // User Login
  async login(req, res) {
    try {
      const { email, password, deviceInfo = {}, rememberMe = false } = req.body;

      // Find user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        logSecurityEvent('login_attempt_invalid_email', 'low', { email }, req);
        
        // Use constant time delay to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errors: ['Email or password is incorrect']
        });
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        logSecurityEvent('login_attempt_invalid_password', 'medium', {
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
        const reason = !user.isActive() ? 'inactive_account' : 'unverified_email';
        logSecurityEvent('login_attempt_restricted_account', 'medium', {
          userId: user.id,
          reason,
          status: user.status,
          emailVerified: user.isEmailVerified()
        }, req);

        return res.status(401).json({
          success: false,
          message: 'Account access restricted',
          errors: [
            !user.isActive() 
              ? 'Your account is not active. Please contact support.'
              : 'Please verify your email address before logging in.'
          ],
          code: reason.toUpperCase()
        });
      }

      // Check if 2FA is enabled (will be handled in separate endpoint)
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
      await sessionService.createSession(user.id, fullDeviceInfo, tokenPair.refreshToken, rememberMe);

      // Send login alert email for new devices
      const suspiciousActivity = await sessionService.detectSuspiciousActivity(
        user.id,
        null,
        fullDeviceInfo
      );

      if (suspiciousActivity.suspicious) {
        await emailService.sendLoginAlert(user, fullDeviceInfo);
        logSecurityEvent('suspicious_login', suspiciousActivity.riskLevel, {
          userId: user.id,
          flags: suspiciousActivity.flags,
          deviceInfo: fullDeviceInfo
        }, req);
      }

      logAuthEvent('user_login', user.id, {
        email,
        deviceType: fullDeviceInfo.deviceType,
        platform: fullDeviceInfo.platform,
        suspicious: suspiciousActivity.suspicious
      }, req);

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
            profileComplete: !!(user.phoneNumber && user.dateOfBirth),
            verificationLevel: user.verificationLevel,
            lastLoginAt: new Date().toISOString()
          }
        },
        message: 'Login successful'
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        errors: ['An error occurred during login. Please try again.']
      });
    }
  }

  // Forgot Password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      // Find user (don't reveal if user exists)
      const user = await User.findOne({ where: { email } });
      
      if (user && user.isActive()) {
        // Generate reset token
        const { token: resetCode } = await PasswordResetToken.createForUser(user.id, 60); // 1 hour expiry

        // Send reset email
        await emailService.sendPasswordReset(user, resetCode);

        logAuthEvent('password_reset_requested', user.id, { email }, req);
      } else {
        // Log potential abuse
        logSecurityEvent('password_reset_invalid_email', 'low', { email }, req);
      }

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If the email address exists, a password reset code has been sent'
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request',
        errors: ['An error occurred while processing your request']
      });
    }
  }

  // Reset Password
  async resetPassword(req, res) {
    try {
      const { email, resetCode, newPassword, confirmPassword } = req.body;

      // Validate password match
      if (newPassword !== confirmPassword) {
        return res.status(422).json({
          success: false,
          message: 'Passwords do not match',
          errors: ['New password and confirmation password must match']
        });
      }

      // Find reset token
      const resetToken = await PasswordResetToken.findValidToken(resetCode);
      if (!resetToken) {
        logSecurityEvent('invalid_password_reset_attempt', 'medium', {
          email,
          resetCode
        }, req);

        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset code',
          errors: ['The reset code is invalid or has expired']
        });
      }

      // Get user
      const user = await User.findByPk(resetToken.userId);
      if (!user || user.email !== email) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reset request',
          errors: ['The reset code does not match the provided email']
        });
      }

      // Validate new password
      const passwordValidation = passwordService.validatePasswordStrength(newPassword, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      });

      if (!passwordValidation.isValid) {
        return res.status(422).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors
        });
      }

      // Check if new password is same as current
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: 'Password unchanged',
          errors: ['New password must be different from current password']
        });
      }

      // Update password
      await user.update({
        passwordHash: newPassword // Will be hashed by model hook
      });

      // Mark reset token as used
      await resetToken.markAsUsed();

      // Revoke all existing sessions for security
      await sessionService.revokeAllUserSessions(user.id);

      // Send confirmation email
      await emailService.sendPasswordChanged(user);

      logAuthEvent('password_reset_completed', user.id, { email }, req);

      res.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Password reset failed',
        errors: ['An error occurred while resetting your password']
      });
    }
  }

  // Change Password (authenticated)
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const user = req.user;

      // Validate current password
      const isValidCurrentPassword = await user.comparePassword(currentPassword);
      if (!isValidCurrentPassword) {
        logSecurityEvent('invalid_current_password', 'medium', {
          userId: user.id
        }, req);

        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          errors: ['Please provide your current password correctly']
        });
      }

      // Validate password match
      if (newPassword !== confirmPassword) {
        return res.status(422).json({
          success: false,
          message: 'Passwords do not match',
          errors: ['New password and confirmation password must match']
        });
      }

      // Check if new password is same as current
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: 'Password unchanged',
          errors: ['New password must be different from current password']
        });
      }

      // Validate new password strength
      const passwordValidation = passwordService.validatePasswordStrength(newPassword, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      });

      if (!passwordValidation.isValid) {
        return res.status(422).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors
        });
      }

      // Update password
      await user.update({
        passwordHash: newPassword
      });

      // Revoke all other sessions except current
      const currentSessionId = req.token?.sessionId;
      await sessionService.revokeAllUserSessions(user.id, currentSessionId);

      // Send confirmation email
      await emailService.sendPasswordChanged(user);

      logAuthEvent('password_changed', user.id, {}, req);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Password change failed',
        errors: ['An error occurred while changing your password']
      });
    }
  }

  // Refresh Token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwtService.verifyRefreshToken(refreshToken);

      // Validate session
      const session = await sessionService.validateSession(decoded.sessionId, refreshToken);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
          errors: ['Please login again'],
          code: 'REFRESH_TOKEN_INVALID'
        });
      }

      // Get user
      const user = await User.findByPk(decoded.sub);
      if (!user || !user.canLogin()) {
        return res.status(401).json({
          success: false,
          message: 'User account is not active',
          errors: ['Please contact support']
        });
      }

      // Generate new access token
      const newAccessToken = jwtService.generateAccessToken({
        userId: user.id,
        email: user.email,
        userType: user.userType,
        deviceId: decoded.deviceId
      });

      logAuthEvent('token_refreshed', user.id, {
        deviceId: decoded.deviceId
      }, req);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: jwtService.getTokenExpiry('access')
        }
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      
      if (error.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token expired',
          errors: ['Please login again'],
          code: 'REFRESH_TOKEN_EXPIRED'
        });
      }

      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        errors: ['Please login again']
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      const { deviceId, logoutFromAllDevices = false } = req.body;
      const user = req.user;
      const currentDeviceId = req.token?.deviceId;

      if (logoutFromAllDevices) {
        // Revoke all sessions
        await sessionService.revokeAllUserSessions(user.id);
        
        // Send notification email
        await emailService.sendAllSessionsRevoked(user);
        
        logAuthEvent('logout_all_devices', user.id, {}, req);
      } else {
        // Revoke specific session or current session
        const targetDeviceId = deviceId || currentDeviceId;
        if (targetDeviceId) {
          const sessions = await sessionService.getUserSessions(user.id);
          const targetSession = sessions.find(s => s.deviceId === targetDeviceId);
          
          if (targetSession) {
            await sessionService.revokeSession(targetSession.id);
          }
        }
        
        logAuthEvent('logout', user.id, {
          deviceId: targetDeviceId
        }, req);
      }

      // Blacklist current access token if available
      if (req.tokenString) {
        await jwtService.blacklistToken(req.tokenString);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        errors: ['An error occurred during logout']
      });
    }
  }

  // Validate Token
  async validateToken(req, res) {
    try {
      const user = req.user;
      const token = req.token;

      // Check if token is still valid and not blacklisted
      const isBlacklisted = await jwtService.isTokenBlacklisted(req.tokenString);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked',
          errors: ['Please login again']
        });
      }

      res.json({
        success: true,
        data: {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
            permissions: token.permissions || []
          },
          expiresAt: new Date(token.exp * 1000).toISOString()
        }
      });
    } catch (error) {
      logger.error('Token validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Token validation failed'
      });
    }
  }
}

module.exports = new AuthController();