const redis = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/redis.log' })
  ]
});

// Redis configuration
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: false,
  lazyConnect: true
};

// Create Redis client
const client = redis.createClient(redisConfig);

// Error handling
client.on('error', (err) => {
  logger.error('Redis client error:', err);
});

client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('end', () => {
  logger.info('Redis client disconnected');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await client.connect();
    logger.info('Redis connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    return false;
  }
};

// Redis utility functions
const redisUtils = {
  // Set key with expiration
  setex: async (key, seconds, value) => {
    try {
      return await client.setEx(key, seconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis SETEX error:', error);
      throw error;
    }
  },

  // Get key
  get: async (key) => {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      throw error;
    }
  },

  // Delete key
  del: async (key) => {
    try {
      return await client.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', error);
      throw error;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      return await client.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      throw error;
    }
  },

  // Set key if not exists with expiration
  setnx: async (key, value, seconds) => {
    try {
      const result = await client.set(key, JSON.stringify(value), {
        NX: true,
        EX: seconds
      });
      return result === 'OK';
    } catch (error) {
      logger.error('Redis SETNX error:', error);
      throw error;
    }
  },

  // Increment counter with expiration
  incr: async (key, seconds = 3600) => {
    try {
      const pipeline = client.multi();
      pipeline.incr(key);
      pipeline.expire(key, seconds);
      const results = await pipeline.exec();
      return results[0];
    } catch (error) {
      logger.error('Redis INCR error:', error);
      throw error;
    }
  }
};

module.exports = {
  client,
  connectRedis,
  redisUtils
};