const authMiddleware = require('./authMiddleware');
const rateLimitMiddleware = require('./rateLimitMiddleware');
const validationMiddleware = require('./validationMiddleware');
const securityMiddleware = require('./securityMiddleware');

module.exports = {
  auth: authMiddleware,
  rateLimit: rateLimitMiddleware,
  validation: validationMiddleware,
  security: securityMiddleware
};