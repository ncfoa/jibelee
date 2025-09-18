const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logger } = require('../config/logger');
const { redisUtils } = require('../config/redis');

class JWTService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '30m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    this.issuer = 'p2p-delivery-platform';
    this.audience = 'p2p-delivery-users';

    this.validateConfig();
  }

  validateConfig() {
    if (!this.accessTokenSecret || this.accessTokenSecret === 'your-super-secret-jwt-key') {
      throw new Error('JWT_SECRET must be set in production');
    }
    
    if (!this.refreshTokenSecret || this.refreshTokenSecret === 'your-super-secret-refresh-key') {
      throw new Error('JWT_REFRESH_SECRET must be set in production');
    }
  }

  generateAccessToken(payload) {
    try {
      const tokenPayload = {
        sub: payload.userId || payload.sub,
        email: payload.email,
        userType: payload.userType,
        permissions: payload.permissions || [],
        deviceId: payload.deviceId,
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      };

      return jwt.sign(tokenPayload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256'
      });
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  generateRefreshToken(payload) {
    try {
      const tokenPayload = {
        sub: payload.userId || payload.sub,
        email: payload.email,
        deviceId: payload.deviceId,
        type: 'refresh',
        jti: crypto.randomUUID(), // JWT ID for token rotation
        iat: Math.floor(Date.now() / 1000)
      };

      return jwt.sign(tokenPayload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256'
      });
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw new Error(`Access token verification failed: ${error.message}`);
    }
  }

  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
  }

  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.error('Error decoding token:', error);
      return null;
    }
  }

  getTokenExpiry(tokenType = 'access') {
    const expiry = tokenType === 'access' ? this.accessTokenExpiry : this.refreshTokenExpiry;
    
    // Convert string expiry to seconds
    if (typeof expiry === 'string') {
      const unit = expiry.slice(-1);
      const value = parseInt(expiry.slice(0, -1));
      
      switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 24 * 60 * 60;
        default: return 1800; // 30 minutes default
      }
    }
    
    return expiry;
  }

  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    const accessTokenExpiry = this.getTokenExpiry('access');
    
    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpiry,
      tokenType: 'Bearer'
    };
  }

  async blacklistToken(token, expirySeconds = null) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload.jti) {
        return false;
      }

      const key = `blacklist:${decoded.payload.jti}`;
      const expiry = expirySeconds || (decoded.payload.exp - Math.floor(Date.now() / 1000));
      
      if (expiry > 0) {
        await redisUtils.setex(key, expiry, { blacklisted: true });
      }
      
      return true;
    } catch (error) {
      logger.error('Error blacklisting token:', error);
      return false;
    }
  }

  async isTokenBlacklisted(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload.jti) {
        return false;
      }

      const key = `blacklist:${decoded.payload.jti}`;
      const blacklisted = await redisUtils.get(key);
      return !!blacklisted;
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      return false;
    }
  }

  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  getTokenClaims(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded;
    } catch (error) {
      logger.error('Error getting token claims:', error);
      return null;
    }
  }

  isTokenExpired(token) {
    try {
      const claims = this.getTokenClaims(token);
      if (!claims || !claims.exp) {
        return true;
      }

      return claims.exp < Math.floor(Date.now() / 1000);
    } catch (error) {
      return true;
    }
  }

  getTokenRemainingTime(token) {
    try {
      const claims = this.getTokenClaims(token);
      if (!claims || !claims.exp) {
        return 0;
      }

      const remaining = claims.exp - Math.floor(Date.now() / 1000);
      return Math.max(0, remaining);
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new JWTService();