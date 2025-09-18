require('dotenv').config();
const AWS = require('aws-sdk');
const { logger } = require('./logger');

// AWS S3 Configuration
const s3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET_NAME,
  secureBucket: process.env.S3_SECURE_BUCKET_NAME,
  cdnDomain: process.env.CDN_DOMAIN
};

// Initialize S3 client
const s3 = new AWS.S3({
  accessKeyId: s3Config.accessKeyId,
  secretAccessKey: s3Config.secretAccessKey,
  region: s3Config.region,
  signatureVersion: 'v4'
});

// Test S3 connection
const testS3Connection = async () => {
  try {
    await s3.headBucket({ Bucket: s3Config.bucket }).promise();
    logger.info('S3 connection established successfully', {
      bucket: s3Config.bucket,
      region: s3Config.region
    });
    return true;
  } catch (error) {
    logger.error('S3 connection failed:', {
      error: error.message,
      bucket: s3Config.bucket,
      region: s3Config.region
    });
    return false;
  }
};

// File upload service
class FileUploadService {
  constructor() {
    this.s3 = s3;
    this.bucket = s3Config.bucket;
    this.secureBucket = s3Config.secureBucket;
    this.cdnDomain = s3Config.cdnDomain;
  }

  // Generate unique filename
  generateFileName(originalName, folder = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const extension = originalName.split('.').pop().toLowerCase();
    const fileName = `${timestamp}-${random}.${extension}`;
    return folder ? `${folder}/${fileName}` : fileName;
  }

  // Upload public image (profile pictures, etc.)
  async uploadImage(imageBuffer, folder = 'images', originalName = 'image.jpg') {
    try {
      const fileName = this.generateFileName(originalName, folder);
      
      const uploadParams = {
        Bucket: this.bucket,
        Key: fileName,
        Body: imageBuffer,
        ContentType: this.getContentType(originalName),
        ACL: 'public-read',
        CacheControl: 'max-age=31536000', // 1 year
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'service': 'user-management'
        }
      };

      const result = await this.s3.upload(uploadParams).promise();
      
      // Return CDN URL if available, otherwise S3 URL
      const url = this.cdnDomain 
        ? `https://${this.cdnDomain}/${fileName}`
        : result.Location;

      logger.info('Image uploaded successfully', {
        fileName,
        url,
        size: imageBuffer.length
      });

      return {
        url,
        key: fileName,
        bucket: this.bucket,
        size: imageBuffer.length
      };
    } catch (error) {
      logger.error('Image upload failed:', {
        error: error.message,
        folder,
        originalName
      });
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  // Upload secure document (verification documents)
  async uploadSecureDocument(documentBuffer, path, originalName = 'document.jpg') {
    try {
      const fileName = this.generateFileName(originalName, `secure/${path}`);
      
      const uploadParams = {
        Bucket: this.secureBucket || this.bucket,
        Key: fileName,
        Body: documentBuffer,
        ContentType: this.getContentType(originalName),
        ServerSideEncryption: 'AES256',
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'service': 'user-management',
          'document-type': 'verification'
        }
      };

      const result = await this.s3.upload(uploadParams).promise();

      logger.info('Secure document uploaded successfully', {
        fileName,
        size: documentBuffer.length,
        encrypted: true
      });

      return {
        url: result.Location,
        key: fileName,
        bucket: this.secureBucket || this.bucket,
        size: documentBuffer.length,
        encrypted: true
      };
    } catch (error) {
      logger.error('Secure document upload failed:', {
        error: error.message,
        path,
        originalName
      });
      throw new Error(`Secure document upload failed: ${error.message}`);
    }
  }

  // Delete file
  async deleteFile(key, secure = false) {
    try {
      const bucket = secure ? (this.secureBucket || this.bucket) : this.bucket;
      
      await this.s3.deleteObject({
        Bucket: bucket,
        Key: key
      }).promise();

      logger.info('File deleted successfully', { key, bucket });
      return true;
    } catch (error) {
      logger.error('File deletion failed:', {
        error: error.message,
        key,
        secure
      });
      return false;
    }
  }

  // Generate presigned URL for secure access
  async generatePresignedUrl(key, expiresIn = 3600, secure = false) {
    try {
      const bucket = secure ? (this.secureBucket || this.bucket) : this.bucket;
      
      const url = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: expiresIn
      });

      return url;
    } catch (error) {
      logger.error('Presigned URL generation failed:', {
        error: error.message,
        key,
        secure
      });
      throw new Error(`Presigned URL generation failed: ${error.message}`);
    }
  }

  // Get content type from filename
  getContentType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Get file info
  async getFileInfo(key, secure = false) {
    try {
      const bucket = secure ? (this.secureBucket || this.bucket) : this.bucket;
      
      const result = await this.s3.headObject({
        Bucket: bucket,
        Key: key
      }).promise();

      return {
        size: result.ContentLength,
        lastModified: result.LastModified,
        contentType: result.ContentType,
        encrypted: !!result.ServerSideEncryption,
        metadata: result.Metadata
      };
    } catch (error) {
      logger.error('Get file info failed:', {
        error: error.message,
        key,
        secure
      });
      return null;
    }
  }
}

const fileUploadService = new FileUploadService();

module.exports = {
  s3,
  s3Config,
  testS3Connection,
  fileUploadService,
  FileUploadService
};