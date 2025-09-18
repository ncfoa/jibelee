const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT configuration
const jwtConfig = {
  accessTokenSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '30m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  issuer: 'p2p-delivery-platform',
  audience: 'p2p-delivery-users'
};

// Validate JWT configuration
const validateJwtConfig = () => {
  if (!jwtConfig.accessTokenSecret || jwtConfig.accessTokenSecret === 'your-super-secret-jwt-key') {
    throw new Error('JWT_SECRET must be set in production');
  }
  
  if (!jwtConfig.refreshTokenSecret || jwtConfig.refreshTokenSecret === 'your-super-secret-refresh-key') {
    throw new Error('JWT_REFRESH_SECRET must be set in production');
  }
};

// Generate access token
const generateAccessToken = (payload) => {
  const tokenPayload = {
    ...payload,
    type: 'access'
  };

  return jwt.sign(tokenPayload, jwtConfig.accessTokenSecret, {
    expiresIn: jwtConfig.accessTokenExpiry,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithm: 'HS256'
  });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  const tokenPayload = {
    ...payload,
    type: 'refresh',
    jti: crypto.randomUUID() // JWT ID for token rotation
  };

  return jwt.sign(tokenPayload, jwtConfig.refreshTokenSecret, {
    expiresIn: jwtConfig.refreshTokenExpiry,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithm: 'HS256'
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.accessTokenSecret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: ['HS256']
    });
  } catch (error) {
    throw new Error(`Invalid access token: ${error.message}`);
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.refreshTokenSecret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: ['HS256']
    });
  } catch (error) {
    throw new Error(`Invalid refresh token: ${error.message}`);
  }
};

// Decode token without verification (for debugging)
const decodeToken = (token) => {
  return jwt.decode(token, { complete: true });
};

// Get token expiration time in seconds
const getTokenExpiry = (tokenType = 'access') => {
  const expiry = tokenType === 'access' ? jwtConfig.accessTokenExpiry : jwtConfig.refreshTokenExpiry;
  
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
};

// Generate token pair
const generateTokenPair = (payload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const accessTokenExpiry = getTokenExpiry('access');
  
  return {
    accessToken,
    refreshToken,
    expiresIn: accessTokenExpiry,
    tokenType: 'Bearer'
  };
};

module.exports = {
  jwtConfig,
  validateJwtConfig,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  getTokenExpiry,
  generateTokenPair
};