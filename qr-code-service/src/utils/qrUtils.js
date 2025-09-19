const QRCode = require('qrcode');
const sharp = require('sharp');
const crypto = require('crypto');
const logger = require('../config/logger');

class QRUtils {
  constructor() {
    this.defaultOptions = {
      width: parseInt(process.env.QR_CODE_DEFAULT_SIZE) || 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: process.env.QR_CODE_ERROR_CORRECTION || 'H'
    };
    
    this.sizeConfigs = {
      small: { width: 200, margin: 2 },
      medium: { width: 400, margin: 4 },
      large: { width: 800, margin: 6 },
      xlarge: { width: 1200, margin: 8 }
    };
  }

  /**
   * Generate QR code image buffer
   */
  async generateQRImage(data, options = {}) {
    try {
      const startTime = Date.now();
      
      // Merge options with defaults
      const config = this.buildConfig(options);
      
      // Generate QR code buffer
      const qrBuffer = await QRCode.toBuffer(data, config);
      
      // Apply additional styling if needed
      let finalBuffer = qrBuffer;
      if (options.style && options.style !== 'standard') {
        finalBuffer = await this.applyStyle(qrBuffer, options.style, config);
      }
      
      // Apply branding if requested
      if (options.branding) {
        finalBuffer = await this.applyBranding(finalBuffer, options.branding, config);
      }
      
      // Optimize image
      if (options.optimize !== false) {
        finalBuffer = await this.optimizeImage(finalBuffer, options.format || 'png');
      }
      
      const duration = Date.now() - startTime;
      logger.debug(`QR code generated in ${duration}ms`);
      
      return finalBuffer;
    } catch (error) {
      logger.error('QR code generation failed:', error);
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate QR code as base64 data URL
   */
  async generateQRDataURL(data, options = {}) {
    try {
      const format = options.format || 'png';
      const buffer = await this.generateQRImage(data, options);
      const base64 = buffer.toString('base64');
      return `data:image/${format};base64,${base64}`;
    } catch (error) {
      throw new Error(`QR data URL generation failed: ${error.message}`);
    }
  }

  /**
   * Generate QR code as SVG string
   */
  async generateQRSVG(data, options = {}) {
    try {
      const config = this.buildConfig(options);
      const svgString = await QRCode.toString(data, {
        ...config,
        type: 'svg'
      });
      
      return svgString;
    } catch (error) {
      throw new Error(`QR SVG generation failed: ${error.message}`);
    }
  }

  /**
   * Build QR code configuration
   */
  buildConfig(options) {
    const { size = 'medium', style = 'standard', format = 'png' } = options;
    
    // Get size configuration
    const sizeConfig = this.sizeConfigs[size] || this.sizeConfigs.medium;
    
    // Build configuration
    const config = {
      ...this.defaultOptions,
      ...sizeConfig,
      ...options,
      type: format === 'svg' ? 'svg' : 'png'
    };
    
    // Ensure maximum size limits
    const maxSize = parseInt(process.env.QR_CODE_MAX_SIZE) || 1200;
    if (config.width > maxSize) {
      config.width = maxSize;
    }
    
    return config;
  }

  /**
   * Apply styling to QR code
   */
  async applyStyle(buffer, style, config) {
    try {
      let styledBuffer = buffer;
      
      switch (style) {
        case 'rounded':
          styledBuffer = await this.applyRoundedCorners(buffer);
          break;
          
        case 'gradient':
          styledBuffer = await this.applyGradient(buffer, config);
          break;
          
        case 'shadow':
          styledBuffer = await this.applyShadow(buffer);
          break;
          
        case 'branded':
          // Branded style will be handled by applyBranding
          break;
          
        default:
          // No styling applied
          break;
      }
      
      return styledBuffer;
    } catch (error) {
      logger.warn(`Failed to apply style ${style}:`, error);
      return buffer; // Return original if styling fails
    }
  }

  /**
   * Apply branding to QR code
   */
  async applyBranding(buffer, branding, config) {
    try {
      const image = sharp(buffer);
      const { width } = await image.metadata();
      
      // Add logo in center if provided
      if (branding.logo) {
        const logoSize = Math.floor(width * 0.2); // 20% of QR code size
        const logoBuffer = await this.resizeLogo(branding.logo, logoSize);
        
        image.composite([{
          input: logoBuffer,
          top: Math.floor((width - logoSize) / 2),
          left: Math.floor((width - logoSize) / 2)
        }]);
      }
      
      // Add border if specified
      if (branding.border) {
        const borderWidth = branding.border.width || 10;
        const borderColor = branding.border.color || '#000000';
        
        image.extend({
          top: borderWidth,
          bottom: borderWidth,
          left: borderWidth,
          right: borderWidth,
          background: borderColor
        });
      }
      
      return await image.png().toBuffer();
    } catch (error) {
      logger.warn('Failed to apply branding:', error);
      return buffer; // Return original if branding fails
    }
  }

  /**
   * Resize logo for QR code branding
   */
  async resizeLogo(logoBuffer, size) {
    try {
      return await sharp(logoBuffer)
        .resize(size, size, { fit: 'inside' })
        .png()
        .toBuffer();
    } catch (error) {
      throw new Error(`Logo resize failed: ${error.message}`);
    }
  }

  /**
   * Apply rounded corners to QR code
   */
  async applyRoundedCorners(buffer, radius = 20) {
    try {
      const image = sharp(buffer);
      const { width, height } = await image.metadata();
      
      // Create rounded corner mask
      const roundedCorners = Buffer.from(
        `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></svg>`
      );
      
      return await image
        .composite([{ input: roundedCorners, blend: 'dest-in' }])
        .png()
        .toBuffer();
    } catch (error) {
      logger.warn('Failed to apply rounded corners:', error);
      return buffer;
    }
  }

  /**
   * Apply gradient effect to QR code
   */
  async applyGradient(buffer, config) {
    try {
      // This would implement gradient effects
      // For now, return original buffer
      return buffer;
    } catch (error) {
      logger.warn('Failed to apply gradient:', error);
      return buffer;
    }
  }

  /**
   * Apply shadow effect to QR code
   */
  async applyShadow(buffer) {
    try {
      const image = sharp(buffer);
      const { width, height } = await image.metadata();
      
      // Create shadow
      const shadowOffset = 10;
      const shadowBlur = 5;
      
      const shadow = await sharp({
        create: {
          width: width + shadowOffset,
          height: height + shadowOffset,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0.3 }
        }
      })
      .blur(shadowBlur)
      .png()
      .toBuffer();
      
      // Composite original image over shadow
      return await sharp({
        create: {
          width: width + shadowOffset,
          height: height + shadowOffset,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
      })
      .composite([
        { input: shadow, top: shadowOffset, left: shadowOffset },
        { input: buffer, top: 0, left: 0 }
      ])
      .png()
      .toBuffer();
    } catch (error) {
      logger.warn('Failed to apply shadow:', error);
      return buffer;
    }
  }

  /**
   * Optimize image for size and quality
   */
  async optimizeImage(buffer, format = 'png') {
    try {
      const image = sharp(buffer);
      
      switch (format.toLowerCase()) {
        case 'png':
          return await image
            .png({ quality: 90, compressionLevel: 9 })
            .toBuffer();
            
        case 'jpeg':
        case 'jpg':
          return await image
            .jpeg({ quality: 90, progressive: true })
            .toBuffer();
            
        case 'webp':
          return await image
            .webp({ quality: 90 })
            .toBuffer();
            
        default:
          return buffer;
      }
    } catch (error) {
      logger.warn('Image optimization failed:', error);
      return buffer;
    }
  }

  /**
   * Validate QR code data size
   */
  validateDataSize(data, errorCorrectionLevel = 'H') {
    const maxSizes = {
      L: 2953, // Low error correction
      M: 2331, // Medium error correction  
      Q: 1663, // Quartile error correction
      H: 1273  // High error correction
    };
    
    const maxSize = maxSizes[errorCorrectionLevel] || maxSizes.H;
    const dataSize = Buffer.byteLength(data, 'utf8');
    
    if (dataSize > maxSize) {
      throw new Error(`QR code data too large: ${dataSize} bytes (max: ${maxSize} bytes)`);
    }
    
    return { size: dataSize, maxSize, valid: true };
  }

  /**
   * Generate QR code with error handling and retry
   */
  async generateWithRetry(data, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateQRImage(data, options);
      } catch (error) {
        lastError = error;
        logger.warn(`QR generation attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Reduce quality for retry
          options.width = Math.floor((options.width || 400) * 0.8);
          await this.sleep(100 * attempt); // Progressive backoff
        }
      }
    }
    
    throw new Error(`QR generation failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Batch generate multiple QR codes
   */
  async generateBatch(qrDataArray, options = {}) {
    const results = [];
    const concurrency = options.concurrency || 5;
    
    // Process in batches to avoid memory issues
    for (let i = 0; i < qrDataArray.length; i += concurrency) {
      const batch = qrDataArray.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (qrData, index) => {
        try {
          const buffer = await this.generateQRImage(qrData.data, {
            ...options,
            ...qrData.options
          });
          
          return {
            id: qrData.id || `qr_${i + index}`,
            success: true,
            buffer,
            size: buffer.length
          };
        } catch (error) {
          return {
            id: qrData.id || `qr_${i + index}`,
            success: false,
            error: error.message
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get QR code information without generating image
   */
  getQRInfo(data, options = {}) {
    const config = this.buildConfig(options);
    const validation = this.validateDataSize(data, config.errorCorrectionLevel);
    
    return {
      dataSize: validation.size,
      maxDataSize: validation.maxSize,
      errorCorrectionLevel: config.errorCorrectionLevel,
      estimatedImageSize: this.estimateImageSize(config),
      config
    };
  }

  /**
   * Estimate image file size
   */
  estimateImageSize(config) {
    const { width, format = 'png' } = config;
    const pixels = width * width;
    
    // Rough estimates based on format
    const bytesPerPixel = {
      png: 4,    // RGBA
      jpeg: 3,   // RGB
      webp: 2.5  // Compressed
    };
    
    const multiplier = bytesPerPixel[format] || bytesPerPixel.png;
    return Math.floor(pixels * multiplier * 0.1); // QR codes compress well
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate QR code hash for caching
   */
  generateQRHash(data, options = {}) {
    const hashInput = JSON.stringify({ data, options });
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * Validate QR code generation options
   */
  validateOptions(options) {
    const errors = [];
    
    if (options.width && (options.width < 100 || options.width > 2000)) {
      errors.push('Width must be between 100 and 2000 pixels');
    }
    
    if (options.margin && (options.margin < 0 || options.margin > 10)) {
      errors.push('Margin must be between 0 and 10');
    }
    
    if (options.errorCorrectionLevel && !['L', 'M', 'Q', 'H'].includes(options.errorCorrectionLevel)) {
      errors.push('Error correction level must be L, M, Q, or H');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new QRUtils();