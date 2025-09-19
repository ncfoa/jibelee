const crypto = require('crypto');

class CryptoUtils {
  /**
   * Generate cryptographically secure UUID v4
   */
  static generateSecureUUID() {
    return crypto.randomUUID();
  }

  /**
   * Generate secure random bytes
   */
  static generateRandomBytes(length = 32) {
    return crypto.randomBytes(length);
  }

  /**
   * Generate secure random string with custom character set
   */
  static generateRandomString(length = 32, charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789') {
    const randomBytes = crypto.randomBytes(length);
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += charset.charAt(randomBytes[i] % charset.length);
    }
    
    return result;
  }

  /**
   * Generate secure hash using SHA-256
   */
  static generateHash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Generate HMAC signature
   */
  static generateHMAC(data, key, algorithm = 'sha256') {
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data, signature, key, algorithm = 'sha256') {
    const expectedSignature = this.generateHMAC(data, key, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Generate time-based one-time password (TOTP)
   */
  static generateTOTP(secret, timeStep = 30, digits = 6) {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(time, 4);
    
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0x0f;
    const code = (hash.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, digits);
    
    return code.toString().padStart(digits, '0');
  }

  /**
   * Generate secure session token
   */
  static generateSessionToken(length = 64) {
    return this.generateRandomString(length);
  }

  /**
   * Generate nonce for cryptographic operations
   */
  static generateNonce(length = 16) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Derive key using PBKDF2
   */
  static deriveKey(password, salt, iterations = 100000, keyLength = 32, algorithm = 'sha256') {
    return crypto.pbkdf2Sync(password, salt, iterations, keyLength, algorithm);
  }

  /**
   * Generate salt for key derivation
   */
  static generateSalt(length = 32) {
    return crypto.randomBytes(length);
  }

  /**
   * Constant time string comparison
   */
  static constantTimeEquals(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  }

  /**
   * Generate checksum for data integrity
   */
  static generateChecksum(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Verify data integrity using checksum
   */
  static verifyChecksum(data, expectedChecksum, algorithm = 'sha256') {
    const actualChecksum = this.generateChecksum(data, algorithm);
    return this.constantTimeEquals(actualChecksum, expectedChecksum);
  }

  /**
   * Generate digital signature (placeholder for actual implementation)
   */
  static generateSignature(data, privateKey) {
    // This would use actual private key cryptography
    // For now, using HMAC as a placeholder
    return crypto.createHmac('sha256', privateKey).update(data).digest('hex');
  }

  /**
   * Verify digital signature (placeholder for actual implementation)
   */
  static verifySignature(data, signature, publicKey) {
    // This would use actual public key cryptography
    // For now, using HMAC verification as a placeholder
    const expectedSignature = this.generateSignature(data, publicKey);
    return this.constantTimeEquals(signature, expectedSignature);
  }

  /**
   * Generate entropy for random operations
   */
  static generateEntropy(length = 32) {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * Hash password with salt
   */
  static hashPassword(password, salt = null) {
    if (!salt) {
      salt = this.generateSalt();
    }
    
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  /**
   * Verify password against hash
   */
  static verifyPassword(password, hash, salt) {
    const saltBuffer = Buffer.from(salt, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const verifyHash = crypto.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha512');
    
    return crypto.timingSafeEqual(hashBuffer, verifyHash);
  }

  /**
   * Generate API key
   */
  static generateAPIKey(prefix = 'qr', length = 32) {
    const randomPart = this.generateRandomString(length);
    return `${prefix}_${randomPart}`;
  }

  /**
   * Generate secure token with expiration
   */
  static generateExpiringToken(data, expirationHours = 24) {
    const expirationTime = Date.now() + (expirationHours * 60 * 60 * 1000);
    const tokenData = {
      data,
      exp: expirationTime,
      nonce: this.generateNonce()
    };
    
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    const signature = this.generateHMAC(token, process.env.JWT_SECRET || 'default-secret');
    
    return `${token}.${signature}`;
  }

  /**
   * Verify and decode expiring token
   */
  static verifyExpiringToken(token) {
    try {
      const [tokenPart, signature] = token.split('.');
      
      // Verify signature
      const expectedSignature = this.generateHMAC(tokenPart, process.env.JWT_SECRET || 'default-secret');
      if (!this.constantTimeEquals(signature, expectedSignature)) {
        throw new Error('Invalid token signature');
      }
      
      // Decode token data
      const tokenData = JSON.parse(Buffer.from(tokenPart, 'base64').toString());
      
      // Check expiration
      if (Date.now() > tokenData.exp) {
        throw new Error('Token has expired');
      }
      
      return tokenData.data;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Generate fingerprint for data
   */
  static generateFingerprint(data, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm).update(JSON.stringify(data)).digest('hex');
    // Return first 16 characters as fingerprint
    return hash.substring(0, 16);
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data, fields = ['password', 'token', 'key', 'secret']) {
    const masked = { ...data };
    
    fields.forEach(field => {
      if (masked[field]) {
        const value = masked[field].toString();
        if (value.length <= 4) {
          masked[field] = '*'.repeat(value.length);
        } else {
          masked[field] = value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
        }
      }
    });
    
    return masked;
  }
}

module.exports = CryptoUtils;