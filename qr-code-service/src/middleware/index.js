const authMiddleware = require('./authMiddleware');
const validationMiddleware = require('./validationMiddleware');
const securityMiddleware = require('./securityMiddleware');

module.exports = {
  ...authMiddleware,
  ...validationMiddleware,
  ...securityMiddleware
};