const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { logger } = require('../config/logger');

class PasswordService {
  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.minLength = 8;
    this.maxLength = 128;
  }

  async hashPassword(password) {
    try {
      if (!password) {
        throw new Error('Password is required');
      }

      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      logger.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  async comparePassword(password, hash) {
    try {
      if (!password || !hash) {
        return false;
      }

      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Error comparing password:', error);
      return false;
    }
  }

  validatePasswordStrength(password, userInfo = {}) {
    const errors = [];

    // Check minimum length
    if (!password || password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }

    // Check maximum length
    if (password && password.length > this.maxLength) {
      errors.push(`Password must be no more than ${this.maxLength} characters long`);
    }

    if (!password) {
      return {
        isValid: false,
        errors,
        strength: 'weak'
      };
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check if password contains user information
    if (userInfo.email && password.toLowerCase().includes(userInfo.email.toLowerCase())) {
      errors.push('Password cannot contain your email address');
    }

    if (userInfo.firstName && password.toLowerCase().includes(userInfo.firstName.toLowerCase())) {
      errors.push('Password cannot contain your first name');
    }

    if (userInfo.lastName && password.toLowerCase().includes(userInfo.lastName.toLowerCase())) {
      errors.push('Password cannot contain your last name');
    }

    // Check for common passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common, please choose a different one');
    }

    // Check for sequential characters
    if (/123456|abcdef|qwerty|asdfgh|zxcvbn/.test(password.toLowerCase())) {
      errors.push('Password cannot contain sequential characters');
    }

    // Check for repeated characters
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password cannot contain more than 2 repeated characters');
    }

    const strength = this.calculatePasswordStrength(password);

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  calculatePasswordStrength(password) {
    if (!password) return 'weak';

    let score = 0;

    // Length bonus
    score += Math.min(password.length * 4, 25);

    // Character variety bonuses
    if (/[a-z]/.test(password)) score += 5;
    if (/[A-Z]/.test(password)) score += 5;
    if (/\d/.test(password)) score += 5;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 10;

    // Bonus for mixed case
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 5;

    // Bonus for numbers and letters
    if (/\d/.test(password) && /[a-zA-Z]/.test(password)) score += 5;

    // Bonus for numbers and symbols
    if (/\d/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 5;

    // Bonus for letters and symbols
    if (/[a-zA-Z]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 5;

    // Length bonuses
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;

    // Penalties
    if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
    if (/123456|abcdef|qwerty/.test(password.toLowerCase())) score -= 15; // Sequential

    // Determine strength
    if (score < 30) return 'weak';
    if (score < 60) return 'medium';
    if (score < 90) return 'strong';
    return 'very_strong';
  }

  generateSecurePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  generateResetCode() {
    // Generate 6-digit numeric code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  hashResetCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  async isPasswordPreviouslyUsed(userId, newPassword) {
    // This would typically check against a password history table
    // For now, we'll implement basic logic
    // In a full implementation, you'd store hashed versions of previous passwords
    
    try {
      // This is a placeholder - implement password history checking
      // You might want to store the last 5-10 password hashes for each user
      return false;
    } catch (error) {
      logger.error('Error checking password history:', error);
      return false;
    }
  }

  getPasswordPolicy() {
    return {
      minLength: this.minLength,
      maxLength: this.maxLength,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      preventSequentialChars: true,
      preventRepeatedChars: true,
      preventUserInfo: true
    };
  }

  estimatePasswordCrackTime(password) {
    if (!password) return 'instantly';

    const charsets = {
      lowercase: 26,
      uppercase: 26,
      numbers: 10,
      symbols: 32
    };

    let charset = 0;
    if (/[a-z]/.test(password)) charset += charsets.lowercase;
    if (/[A-Z]/.test(password)) charset += charsets.uppercase;
    if (/\d/.test(password)) charset += charsets.numbers;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) charset += charsets.symbols;

    const entropy = password.length * Math.log2(charset);
    const combinations = Math.pow(2, entropy);
    
    // Assume 1 billion guesses per second
    const secondsToCrack = combinations / (2 * 1000000000);

    if (secondsToCrack < 1) return 'instantly';
    if (secondsToCrack < 60) return `${Math.round(secondsToCrack)} seconds`;
    if (secondsToCrack < 3600) return `${Math.round(secondsToCrack / 60)} minutes`;
    if (secondsToCrack < 86400) return `${Math.round(secondsToCrack / 3600)} hours`;
    if (secondsToCrack < 31536000) return `${Math.round(secondsToCrack / 86400)} days`;
    if (secondsToCrack < 31536000000) return `${Math.round(secondsToCrack / 31536000)} years`;
    return 'centuries';
  }
}

module.exports = new PasswordService();