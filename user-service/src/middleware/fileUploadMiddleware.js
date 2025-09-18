const multer = require('multer');
const { logger, securityLogger } = require('../config/logger');
const imageProcessingService = require('../services/imageProcessingService');

class FileUploadMiddleware {
  constructor() {
    this.logger = logger;
    this.securityLogger = securityLogger;
  }

  // Profile picture upload configuration
  profilePictureUpload() {
    const storage = multer.memoryStorage();
    
    const upload = multer({
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Only one file
      },
      fileFilter: this.profilePictureFilter.bind(this)
    });

    return upload.single('profilePicture');
  }

  // Verification document upload configuration
  verificationDocumentUpload() {
    const storage = multer.memoryStorage();
    
    const upload = multer({
      storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        files: 3 // Max 3 files (front, back, selfie)
      },
      fileFilter: this.verificationDocumentFilter.bind(this)
    });

    return upload.fields([
      { name: 'frontImage', maxCount: 1 },
      { name: 'backImage', maxCount: 1 },
      { name: 'selfieImage', maxCount: 1 }
    ]);
  }

  // General image upload configuration
  imageUpload(options = {}) {
    const {
      maxFiles = 1,
      maxSize = 5 * 1024 * 1024, // 5MB default
      fieldName = 'image'
    } = options;

    const storage = multer.memoryStorage();
    
    const upload = multer({
      storage,
      limits: {
        fileSize: maxSize,
        files: maxFiles
      },
      fileFilter: this.imageFilter.bind(this)
    });

    return maxFiles === 1 ? upload.single(fieldName) : upload.array(fieldName, maxFiles);
  }

  // Profile picture file filter
  profilePictureFilter(req, file, cb) {
    try {
      // Check file type
      if (!file.mimetype.startsWith('image/')) {
        this.securityLogger.warn('Invalid file type for profile picture', {
          userId: req.user?.id,
          mimetype: file.mimetype,
          originalname: file.originalname,
          ip: req.ip
        });
        
        return cb(new Error('Only image files are allowed for profile pictures'), false);
      }

      // Check specific image formats
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Unsupported image format. Allowed: ${allowedTypes.join(', ')}`), false);
      }

      // Check filename for suspicious content
      if (this.hasSuspiciousFilename(file.originalname)) {
        this.securityLogger.warn('Suspicious filename detected', {
          userId: req.user?.id,
          originalname: file.originalname,
          ip: req.ip
        });
        
        return cb(new Error('Invalid filename'), false);
      }

      this.logger.debug('Profile picture file validation passed', {
        userId: req.user?.id,
        mimetype: file.mimetype,
        originalname: file.originalname
      });

      cb(null, true);
    } catch (error) {
      this.logger.error('Error in profile picture filter', { error: error.message });
      cb(new Error('File validation error'), false);
    }
  }

  // Verification document file filter
  verificationDocumentFilter(req, file, cb) {
    try {
      // Check file type
      if (!file.mimetype.startsWith('image/')) {
        this.securityLogger.warn('Invalid file type for verification document', {
          userId: req.user?.id,
          fieldname: file.fieldname,
          mimetype: file.mimetype,
          originalname: file.originalname,
          ip: req.ip
        });
        
        return cb(new Error('Only image files are allowed for verification documents'), false);
      }

      // Check specific image formats (more restrictive for documents)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Unsupported image format for documents. Allowed: ${allowedTypes.join(', ')}`), false);
      }

      // Validate field names
      const allowedFields = ['frontImage', 'backImage', 'selfieImage'];
      if (!allowedFields.includes(file.fieldname)) {
        this.securityLogger.warn('Invalid field name for verification document', {
          userId: req.user?.id,
          fieldname: file.fieldname,
          ip: req.ip
        });
        
        return cb(new Error('Invalid document field'), false);
      }

      // Check filename for suspicious content
      if (this.hasSuspiciousFilename(file.originalname)) {
        this.securityLogger.warn('Suspicious filename detected in verification', {
          userId: req.user?.id,
          fieldname: file.fieldname,
          originalname: file.originalname,
          ip: req.ip
        });
        
        return cb(new Error('Invalid filename'), false);
      }

      this.logger.debug('Verification document file validation passed', {
        userId: req.user?.id,
        fieldname: file.fieldname,
        mimetype: file.mimetype,
        originalname: file.originalname
      });

      cb(null, true);
    } catch (error) {
      this.logger.error('Error in verification document filter', { error: error.message });
      cb(new Error('File validation error'), false);
    }
  }

  // General image file filter
  imageFilter(req, file, cb) {
    try {
      // Check file type
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'), false);
      }

      // Check specific image formats
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Unsupported image format. Allowed: ${allowedTypes.join(', ')}`), false);
      }

      // Check filename for suspicious content
      if (this.hasSuspiciousFilename(file.originalname)) {
        this.securityLogger.warn('Suspicious filename detected', {
          userId: req.user?.id,
          originalname: file.originalname,
          ip: req.ip
        });
        
        return cb(new Error('Invalid filename'), false);
      }

      cb(null, true);
    } catch (error) {
      this.logger.error('Error in image filter', { error: error.message });
      cb(new Error('File validation error'), false);
    }
  }

  // Virus scanning middleware (placeholder)
  virusScanMiddleware() {
    return async (req, res, next) => {
      try {
        // Skip if no files
        if (!req.file && !req.files) {
          return next();
        }

        const filesToScan = [];
        
        if (req.file) {
          filesToScan.push(req.file);
        }
        
        if (req.files) {
          if (Array.isArray(req.files)) {
            filesToScan.push(...req.files);
          } else {
            // Handle multer fields format
            Object.values(req.files).forEach(fileArray => {
              filesToScan.push(...fileArray);
            });
          }
        }

        // TODO: Implement actual virus scanning
        // For now, just perform basic validation
        for (const file of filesToScan) {
          await this.performBasicFileValidation(file, req);
        }

        this.logger.debug('File virus scan completed', {
          userId: req.user?.id,
          fileCount: filesToScan.length
        });

        next();
      } catch (error) {
        this.securityLogger.error('Virus scan failed', {
          userId: req.user?.id,
          error: error.message,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          message: 'File security check failed',
          errors: [error.message]
        });
      }
    };
  }

  // Image validation middleware
  imageValidationMiddleware(options = {}) {
    return async (req, res, next) => {
      try {
        // Skip if no files
        if (!req.file && !req.files) {
          return next();
        }

        const filesToValidate = [];
        
        if (req.file) {
          filesToValidate.push(req.file);
        }
        
        if (req.files) {
          if (Array.isArray(req.files)) {
            filesToValidate.push(...req.files);
          } else {
            // Handle multer fields format
            Object.values(req.files).forEach(fileArray => {
              filesToValidate.push(...fileArray);
            });
          }
        }

        // Validate each file
        for (const file of filesToValidate) {
          const validation = await imageProcessingService.validateImage(file.buffer, options);
          
          if (!validation.valid) {
            this.securityLogger.warn('Image validation failed', {
              userId: req.user?.id,
              filename: file.originalname,
              error: validation.error,
              ip: req.ip
            });

            return res.status(400).json({
              success: false,
              message: 'Image validation failed',
              errors: [validation.error]
            });
          }

          // Add metadata to file object
          file.metadata = validation.metadata;
        }

        this.logger.debug('Image validation completed', {
          userId: req.user?.id,
          fileCount: filesToValidate.length
        });

        next();
      } catch (error) {
        this.logger.error('Image validation middleware error', {
          userId: req.user?.id,
          error: error.message
        });

        res.status(500).json({
          success: false,
          message: 'Image validation error',
          errors: ['Internal validation error']
        });
      }
    };
  }

  // Handle multer errors
  handleMulterError() {
    return (error, req, res, next) => {
      if (error instanceof multer.MulterError) {
        this.logger.warn('Multer error', {
          userId: req.user?.id,
          error: error.message,
          code: error.code,
          field: error.field
        });

        let message = 'File upload error';
        let errors = [error.message];

        switch (error.code) {
          case 'LIMIT_FILE_SIZE':
            message = 'File too large';
            errors = ['File size exceeds maximum allowed limit'];
            break;
          case 'LIMIT_FILE_COUNT':
            message = 'Too many files';
            errors = ['Maximum number of files exceeded'];
            break;
          case 'LIMIT_UNEXPECTED_FILE':
            message = 'Unexpected file field';
            errors = [`Unexpected file field: ${error.field}`];
            break;
          case 'LIMIT_FIELD_KEY':
            message = 'Field name too long';
            errors = ['Field name exceeds maximum length'];
            break;
          case 'LIMIT_FIELD_VALUE':
            message = 'Field value too long';
            errors = ['Field value exceeds maximum length'];
            break;
          case 'LIMIT_FIELD_COUNT':
            message = 'Too many fields';
            errors = ['Maximum number of fields exceeded'];
            break;
        }

        return res.status(400).json({
          success: false,
          message,
          errors
        });
      }

      // Handle custom file filter errors
      if (error.message && error.message.includes('Only image files')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type',
          errors: [error.message]
        });
      }

      next(error);
    };
  }

  // Helper methods
  hasSuspiciousFilename(filename) {
    if (!filename) return true;

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /[<>:"|?*]/,  // Invalid filename characters
      /^\./, // Hidden files
      /\.(exe|bat|cmd|scr|pif|com|vbs|js|jar|app|deb|pkg|dmg)$/i, // Executable files
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i // Reserved Windows names
    ];

    return suspiciousPatterns.some(pattern => pattern.test(filename));
  }

  async performBasicFileValidation(file, req) {
    // Check file size (additional check)
    if (file.size > 10 * 1024 * 1024) { // 10MB absolute limit
      throw new Error('File size exceeds maximum limit');
    }

    // Check for null bytes (potential attack)
    if (file.buffer.includes(0x00)) {
      this.securityLogger.warn('File contains null bytes', {
        userId: req.user?.id,
        filename: file.originalname,
        ip: req.ip
      });
      throw new Error('File contains invalid content');
    }

    // Basic magic number check for images
    if (file.mimetype.startsWith('image/')) {
      const isValidImage = await this.validateImageMagicNumber(file.buffer, file.mimetype);
      if (!isValidImage) {
        this.securityLogger.warn('Image magic number validation failed', {
          userId: req.user?.id,
          filename: file.originalname,
          mimetype: file.mimetype,
          ip: req.ip
        });
        throw new Error('Invalid image file');
      }
    }

    return true;
  }

  async validateImageMagicNumber(buffer, mimetype) {
    if (buffer.length < 4) return false;

    const magicNumbers = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF (WebP container)
    };

    const expectedMagic = magicNumbers[mimetype];
    if (!expectedMagic) return true; // Allow unknown types for now

    for (let i = 0; i < expectedMagic.length; i++) {
      if (buffer[i] !== expectedMagic[i]) {
        return false;
      }
    }

    return true;
  }
}

module.exports = new FileUploadMiddleware();