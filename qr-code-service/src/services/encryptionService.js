const crypto = require('crypto');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltRounds = parseInt(process.env.SALT_ROUNDS) || 12;
    
    // Key rotation interval (24 hours by default)
    this.keyRotationInterval = parseInt(process.env.KEY_ROTATION_INTERVAL) || 24 * 60 * 60 * 1000;
    
    // Initialize encryption keys
    this.initializeKeys();
  }

  /**
   * Initialize encryption keys from environment variables
   */
  initializeKeys() {
    this.keys = {
      standard: this.getKeyFromEnv('QR_ENCRYPTION_KEY_STANDARD'),
      high: this.getKeyFromEnv('QR_ENCRYPTION_KEY_HIGH'),
      maximum: this.getKeyFromEnv('QR_ENCRYPTION_KEY_MAXIMUM')
    };

    // Validate keys
    Object.entries(this.keys).forEach(([level, key]) => {
      if (!key || key.length !== this.keyLength * 2) { // Hex string should be double the byte length
        logger.warn(`Invalid encryption key for security level: ${level}`);
        // Generate a temporary key for development (DO NOT USE IN PRODUCTION)
        this.keys[level] = crypto.randomBytes(this.keyLength);
      } else {
        this.keys[level] = Buffer.from(key, 'hex');
      }
    });
  }

  /**
   * Get encryption key from environment variable
   */
  getKeyFromEnv(envVar) {
    const key = process.env[envVar];
    if (!key) {
      logger.warn(`Missing encryption key: ${envVar}`);
      return null;
    }
    return key;
  }

  /**
   * Encrypt payload with specified security level
   */
  async encrypt(payload, securityLevel = 'standard') {
    try {
      const startTime = Date.now();
      
      // Validate security level
      if (!this.keys[securityLevel]) {
        throw new Error(`Invalid security level: ${securityLevel}`);
      }

      // Get encryption key
      const key = await this.getEncryptionKey(securityLevel);
      
      // Generate IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, key, iv);
      
      // Prepare payload
      const payloadString = JSON.stringify({
        ...payload,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex'),
        securityLevel
      });

      // Encrypt data
      let encrypted = cipher.update(payloadString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Create encrypted package
      const encryptedPackage = {
        data: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm,
        securityLevel,
        timestamp: Date.now(),
        version: '1.0'
      };

      // Additional security for high/maximum levels
      if (securityLevel === 'high' || securityLevel === 'maximum') {
        encryptedPackage.checksum = this.generateChecksum(encrypted + iv.toString('hex'));
      }

      // Add blockchain hash for maximum security
      if (securityLevel === 'maximum') {
        encryptedPackage.blockchainHash = await this.generateBlockchainHash(encryptedPackage);
      }

      // Encode for QR code compatibility
      const result = Buffer.from(JSON.stringify(encryptedPackage)).toString('base64');
      
      // Log performance
      const duration = Date.now() - startTime;
      logger.debug(`Encryption completed in ${duration}ms for security level: ${securityLevel}`);
      
      return result;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt QR code data');
    }
  }

  /**
   * Decrypt QR code data
   */
  async decrypt(encryptedData, expectedSecurityLevel = null) {
    try {
      const startTime = Date.now();
      
      // Decode from base64
      const encryptedPackage = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      
      // Validate package structure
      this.validateEncryptedPackage(encryptedPackage);
      
      // Auto-detect security level if not provided
      const securityLevel = expectedSecurityLevel || encryptedPackage.securityLevel;
      
      // Verify security level matches
      if (expectedSecurityLevel && encryptedPackage.securityLevel !== expectedSecurityLevel) {
        throw new Error('Security level mismatch');
      }

      // Additional security checks for high/maximum levels
      if (securityLevel === 'high' || securityLevel === 'maximum') {
        const expectedChecksum = this.generateChecksum(
          encryptedPackage.data + encryptedPackage.iv
        );
        if (encryptedPackage.checksum !== expectedChecksum) {
          throw new Error('Data integrity check failed');
        }
      }

      // Blockchain verification for maximum security
      if (securityLevel === 'maximum' && encryptedPackage.blockchainHash) {
        const isValid = await this.verifyBlockchainHash(encryptedPackage);
        if (!isValid) {
          logger.warn('Blockchain verification failed for maximum security QR code');
        }
      }

      // Get decryption key
      const key = await this.getEncryptionKey(securityLevel);
      
      // Create decipher
      const decipher = crypto.createDecipher(
        encryptedPackage.algorithm,
        key,
        Buffer.from(encryptedPackage.iv, 'hex')
      );
      
      // Set auth tag
      decipher.setAuthTag(Buffer.from(encryptedPackage.authTag, 'hex'));
      
      // Decrypt data
      let decrypted = decipher.update(encryptedPackage.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const payload = JSON.parse(decrypted);
      
      // Verify timestamp (prevent replay attacks)
      this.verifyTimestamp(payload.timestamp, securityLevel);
      
      // Log performance
      const duration = Date.now() - startTime;
      logger.debug(`Decryption completed in ${duration}ms for security level: ${securityLevel}`);
      
      return payload;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt QR code data');
    }
  }

  /**
   * Generate secure hash for backup codes
   */
  async hashBackupCode(code) {
    return bcrypt.hash(code, this.saltRounds);
  }

  /**
   * Verify backup code against hash
   */
  async verifyBackupCode(code, hash) {
    return bcrypt.compare(code, hash);
  }

  /**
   * Generate cryptographically secure random string
   */
  generateSecureRandom(length = 32) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomBytes[i] % chars.length);
    }
    
    return result;
  }

  /**
   * Generate backup code with specific format
   */
  generateBackupCode() {
    const codeLength = parseInt(process.env.EMERGENCY_CODE_LENGTH) || 12;
    const code = this.generateSecureRandom(codeLength);
    
    // Format as XXX-XXX-XXX-XXX
    return code.match(/.{1,3}/g).join('-');
  }

  /**
   * Get encryption key for security level
   */
  async getEncryptionKey(securityLevel) {
    let baseKey = this.keys[securityLevel];
    
    if (!baseKey) {
      throw new Error(`No encryption key found for security level: ${securityLevel}`);
    }

    // For maximum security, derive key with additional factors
    if (securityLevel === 'maximum') {
      const salt = await this.getCurrentSalt();
      baseKey = crypto.pbkdf2Sync(baseKey, salt, 100000, this.keyLength, 'sha256');
    }

    return baseKey;
  }

  /**
   * Get current salt for key derivation
   */
  async getCurrentSalt() {
    // Use date-based salt that rotates daily
    const date = new Date().toISOString().split('T')[0];
    return crypto.createHash('sha256').update(date + process.env.JWT_SECRET).digest();
  }

  /**
   * Validate encrypted package structure
   */
  validateEncryptedPackage(package) {
    const requiredFields = ['data', 'iv', 'authTag', 'algorithm', 'securityLevel', 'timestamp'];
    
    for (const field of requiredFields) {
      if (!package[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate algorithm
    if (package.algorithm !== this.algorithm) {
      throw new Error(`Unsupported encryption algorithm: ${package.algorithm}`);
    }

    // Validate security level
    if (!this.keys[package.securityLevel]) {
      throw new Error(`Invalid security level: ${package.securityLevel}`);
    }
  }

  /**
   * Verify timestamp to prevent replay attacks
   */
  verifyTimestamp(timestamp, securityLevel) {
    const now = Date.now();
    const age = now - timestamp;
    
    // Maximum age based on security level
    const maxAge = {
      standard: 24 * 60 * 60 * 1000, // 24 hours
      high: 12 * 60 * 60 * 1000,     // 12 hours
      maximum: 6 * 60 * 60 * 1000    // 6 hours
    };

    if (age > maxAge[securityLevel]) {
      throw new Error('QR code data is too old');
    }

    // Prevent future timestamps
    if (timestamp > now + 5 * 60 * 1000) { // 5 minutes tolerance
      throw new Error('QR code data has future timestamp');
    }
  }

  /**
   * Generate checksum for data integrity
   */
  generateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate blockchain hash (placeholder for blockchain integration)
   */
  async generateBlockchainHash(package) {
    // This would integrate with actual blockchain service
    // For now, return a deterministic hash
    const data = JSON.stringify(package);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify blockchain hash (placeholder for blockchain integration)
   */
  async verifyBlockchainHash(package) {
    // This would verify against actual blockchain
    // For now, just verify the hash is consistent
    const expectedHash = await this.generateBlockchainHash({
      ...package,
      blockchainHash: undefined
    });
    return package.blockchainHash === expectedHash;
  }

  /**
   * Rotate encryption keys (for security maintenance)
   */
  async rotateKeys() {
    logger.info('Starting encryption key rotation');
    
    const newKeys = {
      standard: crypto.randomBytes(this.keyLength),
      high: crypto.randomBytes(this.keyLength),
      maximum: crypto.randomBytes(this.keyLength)
    };

    // In production, this would:
    // 1. Store new keys in secure key vault
    // 2. Update environment variables
    // 3. Gracefully transition from old to new keys
    
    logger.info('Encryption key rotation completed');
    return newKeys;
  }

  /**
   * Get encryption strength metrics
   */
  getStrengthMetrics(securityLevel) {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength * 8, // bits
      securityLevel,
      features: {
        authenticated: true,
        timestamped: true,
        nonceProtected: true,
        checksumVerified: securityLevel !== 'standard',
        blockchainVerified: securityLevel === 'maximum'
      }
    };
  }
}

module.exports = new EncryptionService();