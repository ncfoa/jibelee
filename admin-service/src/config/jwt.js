const jwt = require('jsonwebtoken');
const logger = require('./logger');

class JWTService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.adminSecret = process.env.JWT_ADMIN_SECRET;
    this.adminTokenSecret = process.env.ADMIN_TOKEN_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    if (!this.jwtSecret || !this.adminSecret || !this.adminTokenSecret) {
      throw new Error('JWT secrets are not configured properly');
    }
  }

  /**
   * Generate admin access token
   */
  generateAdminToken(payload) {
    try {
      return jwt.sign(
        {
          ...payload,
          type: 'admin_access',
          iat: Math.floor(Date.now() / 1000)
        },
        this.adminSecret,
        { 
          expiresIn: this.expiresIn,
          issuer: 'admin-service',
          audience: 'admin-dashboard'
        }
      );
    } catch (error) {
      logger.error('Error generating admin token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate admin refresh token
   */
  generateAdminRefreshToken(payload) {
    try {
      return jwt.sign(
        {
          ...payload,
          type: 'admin_refresh',
          iat: Math.floor(Date.now() / 1000)
        },
        this.adminSecret,
        { 
          expiresIn: this.refreshExpiresIn,
          issuer: 'admin-service',
          audience: 'admin-dashboard'
        }
      );
    } catch (error) {
      logger.error('Error generating admin refresh token:', error);
      throw new Error('Refresh token generation failed');
    }
  }

  /**
   * Generate X-Admin-Token for API access
   */
  generateAdminApiToken(adminId, permissions = []) {
    try {
      return jwt.sign(
        {
          adminId,
          permissions,
          type: 'admin_api',
          iat: Math.floor(Date.now() / 1000)
        },
        this.adminTokenSecret,
        { 
          expiresIn: '24h',
          issuer: 'admin-service',
          audience: 'admin-api'
        }
      );
    } catch (error) {
      logger.error('Error generating admin API token:', error);
      throw new Error('API token generation failed');
    }
  }

  /**
   * Verify admin access token
   */
  verifyAdminToken(token) {
    try {
      const decoded = jwt.verify(token, this.adminSecret, {
        issuer: 'admin-service',
        audience: 'admin-dashboard'
      });

      if (decoded.type !== 'admin_access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Admin token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid admin token');
      }
      logger.error('Error verifying admin token:', error);
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify admin refresh token
   */
  verifyAdminRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.adminSecret, {
        issuer: 'admin-service',
        audience: 'admin-dashboard'
      });

      if (decoded.type !== 'admin_refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Admin refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid admin refresh token');
      }
      logger.error('Error verifying admin refresh token:', error);
      throw new Error('Refresh token verification failed');
    }
  }

  /**
   * Verify X-Admin-Token
   */
  verifyAdminApiToken(token) {
    try {
      const decoded = jwt.verify(token, this.adminTokenSecret, {
        issuer: 'admin-service',
        audience: 'admin-api'
      });

      if (decoded.type !== 'admin_api') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Admin API token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid admin API token');
      }
      logger.error('Error verifying admin API token:', error);
      throw new Error('API token verification failed');
    }
  }

  /**
   * Verify regular user token (from auth service)
   */
  verifyUserToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('User token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid user token');
      }
      logger.error('Error verifying user token:', error);
      throw new Error('User token verification failed');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded ? decoded.exp * 1000 : null; // Convert to milliseconds
    } catch (error) {
      logger.error('Error getting token expiration:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    const exp = this.getTokenExpiration(token);
    return exp ? Date.now() >= exp : true;
  }

  /**
   * Get time until token expires
   */
  getTimeUntilExpiration(token) {
    const exp = this.getTokenExpiration(token);
    return exp ? Math.max(0, exp - Date.now()) : 0;
  }
}

const jwtService = new JWTService();

module.exports = jwtService;