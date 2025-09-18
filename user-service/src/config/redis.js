require('dotenv').config();
const { createClient } = require('redis');
const { logger } = require('./logger');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  retryDelayOnClusterDown: 300,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4, // 4 (IPv4) or 6 (IPv6)
  connectTimeout: 10000,
  commandTimeout: 5000
};

// Create Redis client
const client = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
    connectTimeout: redisConfig.connectTimeout,
    keepAlive: redisConfig.keepAlive,
    family: redisConfig.family
  },
  password: redisConfig.password,
  database: redisConfig.db,
  retry_unfulfilled_commands: true,
  retry_delay: redisConfig.retryDelayOnFailover
});

// Redis event handlers
client.on('connect', () => {
  logger.info('Redis client connected', {
    host: redisConfig.host,
    port: redisConfig.port,
    db: redisConfig.db
  });
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('error', (error) => {
  logger.error('Redis client error:', {
    error: error.message,
    host: redisConfig.host,
    port: redisConfig.port
  });
});

client.on('end', () => {
  logger.info('Redis client connection ended');
});

client.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    if (!client.isReady) {
      await client.connect();
    }
    logger.info('Redis connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis:', {
      error: error.message,
      host: redisConfig.host,
      port: redisConfig.port
    });
    return false;
  }
};

// Cache service wrapper
class CacheService {
  constructor() {
    this.client = client;
    this.defaultTTL = 300; // 5 minutes
  }

  async get(key) {
    try {
      if (!client.isReady) return null;
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!client.isReady) return false;
      await client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      if (!client.isReady) return false;
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', { key, error: error.message });
      return false;
    }
  }

  async invalidatePattern(pattern) {
    try {
      if (!client.isReady) return false;
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error('Cache pattern invalidation error:', { pattern, error: error.message });
      return false;
    }
  }

  async getUserProfile(userId) {
    return this.get(`user:profile:${userId}`);
  }

  async setUserProfile(userId, profile, ttl = 300) {
    return this.set(`user:profile:${userId}`, profile, ttl);
  }

  async invalidateUserCache(userId) {
    return this.invalidatePattern(`user:*:${userId}`);
  }
}

const cacheService = new CacheService();

module.exports = {
  client,
  connectRedis,
  cacheService,
  redisConfig
};