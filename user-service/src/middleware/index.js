const authMiddleware = require('./authMiddleware');
const fileUploadMiddleware = require('./fileUploadMiddleware');
const validationMiddleware = require('./validationMiddleware');
const securityMiddleware = require('./securityMiddleware');

module.exports = {
  auth: authMiddleware,
  fileUpload: fileUploadMiddleware,
  validation: validationMiddleware,
  security: securityMiddleware
};