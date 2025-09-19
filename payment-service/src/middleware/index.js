const authMiddleware = require('./authMiddleware');
const validationMiddleware = require('./validationMiddleware');
const securityMiddleware = require('./securityMiddleware');

module.exports = {
  // Authentication & Authorization
  ...authMiddleware,
  
  // Validation
  ...validationMiddleware,
  
  // Security
  ...securityMiddleware
};