const Redis = require('ioredis');
const { logger } = require('./logger');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  family: 4,
  keepAlive: 30000
};

// Create Redis instances
const redis = new Redis(redisConfig);
const subscriber = new Redis(redisConfig);
const publisher = new Redis(redisConfig);

// Redis event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error) => {
  logger.error('Redis client error:', error);
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

subscriber.on('connect', () => {
  logger.info('Redis subscriber connected');
});

subscriber.on('error', (error) => {
  logger.error('Redis subscriber error:', error);
});

publisher.on('connect', () => {
  logger.info('Redis publisher connected');
});

publisher.on('error', (error) => {
  logger.error('Redis publisher error:', error);
});

// Cache service wrapper
class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async incr(key, ttl = 3600) {
    try {
      const result = await this.redis.incr(key);
      if (result === 1 && ttl) {
        await this.redis.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  async hset(hash, key, value) {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.hset(hash, key, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache hset error for hash ${hash}, key ${key}:`, error);
      return false;
    }
  }

  async hget(hash, key) {
    try {
      const value = await this.redis.hget(hash, key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache hget error for hash ${hash}, key ${key}:`, error);
      return null;
    }
  }

  async hdel(hash, key) {
    try {
      await this.redis.hdel(hash, key);
      return true;
    } catch (error) {
      logger.error(`Cache hdel error for hash ${hash}, key ${key}:`, error);
      return false;
    }
  }

  async sadd(set, member) {
    try {
      await this.redis.sadd(set, member);
      return true;
    } catch (error) {
      logger.error(`Cache sadd error for set ${set}:`, error);
      return false;
    }
  }

  async srem(set, member) {
    try {
      await this.redis.srem(set, member);
      return true;
    } catch (error) {
      logger.error(`Cache srem error for set ${set}:`, error);
      return false;
    }
  }

  async smembers(set) {
    try {
      return await this.redis.smembers(set);
    } catch (error) {
      logger.error(`Cache smembers error for set ${set}:`, error);
      return [];
    }
  }

  async lpush(list, value) {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.lpush(list, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache lpush error for list ${list}:`, error);
      return false;
    }
  }

  async rpop(list) {
    try {
      const value = await this.redis.rpop(list);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache rpop error for list ${list}:`, error);
      return null;
    }
  }

  async llen(list) {
    try {
      return await this.redis.llen(list);
    } catch (error) {
      logger.error(`Cache llen error for list ${list}:`, error);
      return 0;
    }
  }
}

// Create cache service instance
const cache = new CacheService(redis);

// Specialized cache methods for notifications
const NotificationCache = {
  // User preferences caching
  async cacheUserPreferences(userId, preferences) {
    return cache.set(`prefs:${userId}`, preferences, 3600); // 1 hour
  },

  async getCachedPreferences(userId) {
    return cache.get(`prefs:${userId}`);
  },

  // Template caching
  async cacheTemplate(templateId, template) {
    return cache.set(`template:${templateId}`, template, 1800); // 30 minutes
  },

  async getCachedTemplate(templateId) {
    return cache.get(`template:${templateId}`);
  },

  // Device tokens caching
  async cacheDeviceTokens(userId, tokens) {
    return cache.set(`tokens:${userId}`, tokens, 900); // 15 minutes
  },

  async getCachedDeviceTokens(userId) {
    return cache.get(`tokens:${userId}`);
  },

  // Rate limiting
  async incrementRateLimit(key, limit, window) {
    const count = await cache.incr(key, window);
    return {
      count,
      remaining: Math.max(0, limit - count),
      resetTime: Date.now() + (window * 1000)
    };
  },

  // Notification deduplication
  async isDuplicateNotification(userId, templateId, hash) {
    const key = `dedup:${userId}:${templateId}:${hash}`;
    const exists = await cache.exists(key);
    if (!exists) {
      await cache.set(key, true, 300); // 5 minutes
    }
    return exists;
  },

  // Queue management
  async addToQueue(queue, notification) {
    return cache.lpush(`queue:${queue}`, notification);
  },

  async getFromQueue(queue) {
    return cache.rpop(`queue:${queue}`);
  },

  async getQueueLength(queue) {
    return cache.llen(`queue:${queue}`);
  }
};

// Test Redis connection
const testConnection = async () => {
  try {
    await redis.ping();
    logger.info('Redis connection test successful');
    return true;
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
};

// Close Redis connections
const closeConnections = async () => {
  try {
    await redis.quit();
    await subscriber.quit();
    await publisher.quit();
    logger.info('Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
};

module.exports = {
  redis,
  subscriber,
  publisher,
  cache,
  NotificationCache,
  testConnection,
  closeConnections
};