const sharp = require('sharp');
const { logger } = require('../config/logger');

class ImageProcessingService {
  constructor() {
    this.logger = logger;
  }

  // Process profile image
  async processProfileImage(imageBuffer) {
    try {
      const processedImage = await sharp(imageBuffer)
        .resize(400, 400, { 
          fit: 'cover', 
          position: 'center',
          withoutEnlargement: false 
        })
        .jpeg({ 
          quality: 85,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      this.logger.debug('Profile image processed successfully', {
        originalSize: imageBuffer.length,
        processedSize: processedImage.length,
        compressionRatio: ((imageBuffer.length - processedImage.length) / imageBuffer.length * 100).toFixed(2) + '%'
      });

      return processedImage;
    } catch (error) {
      this.logger.error('Error processing profile image', { error: error.message });
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  // Process verification document
  async processVerificationDocument(imageBuffer, options = {}) {
    try {
      const { maxWidth = 1200, quality = 90 } = options;

      const processedImage = await sharp(imageBuffer)
        .resize(maxWidth, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      this.logger.debug('Verification document processed successfully', {
        originalSize: imageBuffer.length,
        processedSize: processedImage.length,
        maxWidth
      });

      return processedImage;
    } catch (error) {
      this.logger.error('Error processing verification document', { error: error.message });
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  // Generate thumbnail
  async generateThumbnail(imageBuffer, width = 150, height = 150) {
    try {
      const thumbnail = await sharp(imageBuffer)
        .resize(width, height, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ 
          quality: 80,
          progressive: true
        })
        .toBuffer();

      this.logger.debug('Thumbnail generated successfully', {
        width,
        height,
        size: thumbnail.length
      });

      return thumbnail;
    } catch (error) {
      this.logger.error('Error generating thumbnail', { error: error.message });
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  // Generate multiple sizes
  async generateMultipleSizes(imageBuffer, sizes = []) {
    try {
      const defaultSizes = [
        { name: 'small', width: 150, height: 150 },
        { name: 'medium', width: 300, height: 300 },
        { name: 'large', width: 600, height: 600 }
      ];

      const sizesToGenerate = sizes.length > 0 ? sizes : defaultSizes;
      const results = {};

      for (const size of sizesToGenerate) {
        const processed = await sharp(imageBuffer)
          .resize(size.width, size.height, { 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ 
            quality: size.quality || 85,
            progressive: true
          })
          .toBuffer();

        results[size.name] = processed;
      }

      this.logger.debug('Multiple sizes generated successfully', {
        sizes: sizesToGenerate.map(s => s.name)
      });

      return results;
    } catch (error) {
      this.logger.error('Error generating multiple sizes', { error: error.message });
      throw new Error(`Multiple size generation failed: ${error.message}`);
    }
  }

  // Optimize image for web
  async optimizeForWeb(imageBuffer, options = {}) {
    try {
      const { 
        maxWidth = 1920, 
        maxHeight = 1080, 
        quality = 85,
        format = 'jpeg'
      } = options;

      let pipeline = sharp(imageBuffer)
        .resize(maxWidth, maxHeight, { 
          fit: 'inside',
          withoutEnlargement: true
        });

      if (format === 'webp') {
        pipeline = pipeline.webp({ 
          quality,
          effort: 6
        });
      } else {
        pipeline = pipeline.jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true
        });
      }

      const optimized = await pipeline.toBuffer();

      this.logger.debug('Image optimized for web', {
        originalSize: imageBuffer.length,
        optimizedSize: optimized.length,
        format,
        compressionRatio: ((imageBuffer.length - optimized.length) / imageBuffer.length * 100).toFixed(2) + '%'
      });

      return optimized;
    } catch (error) {
      this.logger.error('Error optimizing image for web', { error: error.message });
      throw new Error(`Web optimization failed: ${error.message}`);
    }
  }

  // Extract image metadata
  async extractMetadata(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      const result = {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        size: imageBuffer.length,
        colorspace: metadata.space
      };

      // Remove sensitive EXIF data for privacy
      if (metadata.exif) {
        result.hasExif = true;
        // Don't include actual EXIF data for privacy reasons
      }

      this.logger.debug('Image metadata extracted', result);

      return result;
    } catch (error) {
      this.logger.error('Error extracting image metadata', { error: error.message });
      throw new Error(`Metadata extraction failed: ${error.message}`);
    }
  }

  // Remove EXIF data for privacy
  async removeExifData(imageBuffer) {
    try {
      const cleaned = await sharp(imageBuffer)
        .rotate() // This removes EXIF orientation data
        .jpeg({ 
          quality: 95,
          progressive: true
        })
        .toBuffer();

      this.logger.debug('EXIF data removed successfully', {
        originalSize: imageBuffer.length,
        cleanedSize: cleaned.length
      });

      return cleaned;
    } catch (error) {
      this.logger.error('Error removing EXIF data', { error: error.message });
      throw new Error(`EXIF removal failed: ${error.message}`);
    }
  }

  // Validate image
  async validateImage(imageBuffer, options = {}) {
    try {
      const {
        maxSize = 10 * 1024 * 1024, // 10MB
        minWidth = 100,
        minHeight = 100,
        maxWidth = 4000,
        maxHeight = 4000,
        allowedFormats = ['jpeg', 'jpg', 'png', 'webp']
      } = options;

      // Check file size
      if (imageBuffer.length > maxSize) {
        throw new Error(`Image size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
      }

      // Get metadata
      const metadata = await this.extractMetadata(imageBuffer);

      // Check format
      if (!allowedFormats.includes(metadata.format.toLowerCase())) {
        throw new Error(`Image format ${metadata.format} is not allowed. Allowed formats: ${allowedFormats.join(', ')}`);
      }

      // Check dimensions
      if (metadata.width < minWidth || metadata.height < minHeight) {
        throw new Error(`Image dimensions too small. Minimum: ${minWidth}x${minHeight}`);
      }

      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        throw new Error(`Image dimensions too large. Maximum: ${maxWidth}x${maxHeight}`);
      }

      this.logger.debug('Image validation passed', metadata);

      return {
        valid: true,
        metadata
      };
    } catch (error) {
      this.logger.error('Image validation failed', { error: error.message });
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Create image variants for different use cases
  async createImageVariants(imageBuffer, type = 'profile') {
    try {
      const variants = {};

      switch (type) {
        case 'profile':
          variants.original = await this.processProfileImage(imageBuffer);
          variants.thumbnail = await this.generateThumbnail(imageBuffer, 100, 100);
          variants.small = await this.generateThumbnail(imageBuffer, 200, 200);
          break;

        case 'document':
          variants.original = await this.processVerificationDocument(imageBuffer);
          variants.thumbnail = await this.generateThumbnail(imageBuffer, 200, 150);
          break;

        case 'general':
          const sizes = await this.generateMultipleSizes(imageBuffer);
          variants = { ...sizes };
          break;

        default:
          variants.original = await this.optimizeForWeb(imageBuffer);
          variants.thumbnail = await this.generateThumbnail(imageBuffer);
      }

      this.logger.debug('Image variants created successfully', {
        type,
        variants: Object.keys(variants)
      });

      return variants;
    } catch (error) {
      this.logger.error('Error creating image variants', { error: error.message });
      throw new Error(`Image variant creation failed: ${error.message}`);
    }
  }

  // Convert image format
  async convertFormat(imageBuffer, targetFormat, options = {}) {
    try {
      const { quality = 85 } = options;
      let pipeline = sharp(imageBuffer);

      switch (targetFormat.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({ quality, progressive: true });
          break;
        case 'png':
          pipeline = pipeline.png({ quality, progressive: true });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality, effort: 6 });
          break;
        default:
          throw new Error(`Unsupported target format: ${targetFormat}`);
      }

      const converted = await pipeline.toBuffer();

      this.logger.debug('Image format converted successfully', {
        targetFormat,
        originalSize: imageBuffer.length,
        convertedSize: converted.length
      });

      return converted;
    } catch (error) {
      this.logger.error('Error converting image format', { error: error.message });
      throw new Error(`Format conversion failed: ${error.message}`);
    }
  }
}

module.exports = new ImageProcessingService();