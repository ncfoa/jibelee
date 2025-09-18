const axios = require('axios');
const { logger } = require('../config/logger');

class EmailService {
  constructor() {
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3009';
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@p2pdelivery.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'P2P Delivery Platform';
    this.baseUrl = process.env.FRONTEND_URL || 'https://app.p2pdelivery.com';
  }

  async sendEmail(to, subject, template, data = {}) {
    try {
      const payload = {
        to,
        subject,
        template,
        data: {
          ...data,
          fromName: this.fromName,
          baseUrl: this.baseUrl
        },
        from: {
          email: this.fromAddress,
          name: this.fromName
        }
      };

      const response = await axios.post(`${this.notificationServiceUrl}/api/v1/notifications/email`, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN || 'internal-service-token'}`
        }
      });

      logger.info('Email sent successfully', {
        to,
        subject,
        template,
        messageId: response.data?.messageId
      });

      return {
        success: true,
        messageId: response.data?.messageId
      };
    } catch (error) {
      logger.error('Error sending email:', {
        error: error.message,
        to,
        subject,
        template,
        status: error.response?.status,
        data: error.response?.data
      });

      // Fallback to console logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('\n=== EMAIL FALLBACK (Development) ===');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Template: ${template}`);
        console.log('Data:', JSON.stringify(data, null, 2));
        console.log('=====================================\n');
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendWelcomeEmail(user, verificationCode) {
    return this.sendEmail(
      user.email,
      'Welcome to P2P Delivery Platform',
      'welcome',
      {
        firstName: user.firstName,
        lastName: user.lastName,
        verificationCode,
        verificationUrl: `${this.baseUrl}/verify-email?email=${encodeURIComponent(user.email)}&code=${verificationCode}`
      }
    );
  }

  async sendEmailVerification(user, verificationCode) {
    return this.sendEmail(
      user.email,
      'Verify Your Email Address',
      'email-verification',
      {
        firstName: user.firstName,
        verificationCode,
        verificationUrl: `${this.baseUrl}/verify-email?email=${encodeURIComponent(user.email)}&code=${verificationCode}`,
        expiresIn: '30 minutes'
      }
    );
  }

  async sendPasswordReset(user, resetCode) {
    return this.sendEmail(
      user.email,
      'Password Reset Request',
      'password-reset',
      {
        firstName: user.firstName,
        resetCode,
        resetUrl: `${this.baseUrl}/reset-password?email=${encodeURIComponent(user.email)}&code=${resetCode}`,
        expiresIn: '1 hour'
      }
    );
  }

  async sendPasswordChanged(user) {
    return this.sendEmail(
      user.email,
      'Password Changed Successfully',
      'password-changed',
      {
        firstName: user.firstName,
        changedAt: new Date().toLocaleString(),
        ipAddress: user.lastLoginIp || 'Unknown',
        supportUrl: `${this.baseUrl}/support`
      }
    );
  }

  async sendLoginAlert(user, deviceInfo) {
    return this.sendEmail(
      user.email,
      'New Login to Your Account',
      'login-alert',
      {
        firstName: user.firstName,
        loginTime: new Date().toLocaleString(),
        deviceType: deviceInfo.deviceType || 'Unknown',
        platform: deviceInfo.platform || 'Unknown',
        location: deviceInfo.location || 'Unknown location',
        ipAddress: deviceInfo.ipAddress || 'Unknown',
        userAgent: deviceInfo.userAgent || 'Unknown',
        securityUrl: `${this.baseUrl}/account/security`
      }
    );
  }

  async send2FAEnabled(user) {
    return this.sendEmail(
      user.email,
      'Two-Factor Authentication Enabled',
      '2fa-enabled',
      {
        firstName: user.firstName,
        enabledAt: new Date().toLocaleString(),
        securityUrl: `${this.baseUrl}/account/security`
      }
    );
  }

  async send2FADisabled(user) {
    return this.sendEmail(
      user.email,
      'Two-Factor Authentication Disabled',
      '2fa-disabled',
      {
        firstName: user.firstName,
        disabledAt: new Date().toLocaleString(),
        securityUrl: `${this.baseUrl}/account/security`
      }
    );
  }

  async sendSuspiciousActivity(user, activityDetails) {
    return this.sendEmail(
      user.email,
      'Suspicious Account Activity Detected',
      'suspicious-activity',
      {
        firstName: user.firstName,
        activityType: activityDetails.type || 'Unknown',
        detectedAt: new Date().toLocaleString(),
        location: activityDetails.location || 'Unknown location',
        ipAddress: activityDetails.ipAddress || 'Unknown',
        deviceInfo: activityDetails.deviceInfo || 'Unknown device',
        securityUrl: `${this.baseUrl}/account/security`,
        supportUrl: `${this.baseUrl}/support`
      }
    );
  }

  async sendAccountDeactivated(user, reason) {
    return this.sendEmail(
      user.email,
      'Account Deactivated',
      'account-deactivated',
      {
        firstName: user.firstName,
        deactivatedAt: new Date().toLocaleString(),
        reason: reason || 'User request',
        reactivateUrl: `${this.baseUrl}/reactivate-account`,
        supportUrl: `${this.baseUrl}/support`
      }
    );
  }

  async sendAccountReactivated(user) {
    return this.sendEmail(
      user.email,
      'Account Reactivated',
      'account-reactivated',
      {
        firstName: user.firstName,
        reactivatedAt: new Date().toLocaleString(),
        loginUrl: `${this.baseUrl}/login`
      }
    );
  }

  async sendEmailChanged(user, newEmail, verificationCode) {
    // Send to old email
    await this.sendEmail(
      user.email,
      'Email Address Change Request',
      'email-change-old',
      {
        firstName: user.firstName,
        newEmail,
        changedAt: new Date().toLocaleString(),
        securityUrl: `${this.baseUrl}/account/security`
      }
    );

    // Send to new email
    return this.sendEmail(
      newEmail,
      'Verify Your New Email Address',
      'email-change-new',
      {
        firstName: user.firstName,
        verificationCode,
        verificationUrl: `${this.baseUrl}/verify-email?email=${encodeURIComponent(newEmail)}&code=${verificationCode}`,
        expiresIn: '30 minutes'
      }
    );
  }

  async sendSessionRevoked(user, sessionInfo) {
    return this.sendEmail(
      user.email,
      'Device Session Revoked',
      'session-revoked',
      {
        firstName: user.firstName,
        deviceType: sessionInfo.deviceType || 'Unknown',
        platform: sessionInfo.platform || 'Unknown',
        location: sessionInfo.location || 'Unknown location',
        revokedAt: new Date().toLocaleString(),
        securityUrl: `${this.baseUrl}/account/security`
      }
    );
  }

  async sendAllSessionsRevoked(user) {
    return this.sendEmail(
      user.email,
      'All Device Sessions Revoked',
      'all-sessions-revoked',
      {
        firstName: user.firstName,
        revokedAt: new Date().toLocaleString(),
        loginUrl: `${this.baseUrl}/login`,
        securityUrl: `${this.baseUrl}/account/security`
      }
    );
  }

  async sendBackupCodesGenerated(user) {
    return this.sendEmail(
      user.email,
      'New Backup Codes Generated',
      'backup-codes-generated',
      {
        firstName: user.firstName,
        generatedAt: new Date().toLocaleString(),
        securityUrl: `${this.baseUrl}/account/security`
      }
    );
  }

  async sendTestEmail(email) {
    return this.sendEmail(
      email,
      'Test Email from P2P Delivery Auth Service',
      'test-email',
      {
        testTime: new Date().toLocaleString(),
        serviceName: 'Authentication Service',
        version: process.env.APP_VERSION || '1.0.0'
      }
    );
  }

  // Utility method to validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Method to check if notification service is available
  async checkNotificationService() {
    try {
      const response = await axios.get(`${this.notificationServiceUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Notification service health check failed:', error.message);
      return false;
    }
  }

  // Batch email sending (for future use)
  async sendBulkEmails(emails) {
    const results = [];
    
    for (const emailData of emails) {
      try {
        const result = await this.sendEmail(
          emailData.to,
          emailData.subject,
          emailData.template,
          emailData.data
        );
        results.push({ ...emailData, result });
      } catch (error) {
        results.push({ 
          ...emailData, 
          result: { success: false, error: error.message } 
        });
      }
    }

    return results;
  }
}

module.exports = new EmailService();