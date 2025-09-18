require('dotenv').config();
const Redis = require('ioredis');
const { logger } = require('./logger');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryDelayOnClusterDown: 300,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  keyPrefix: 'trip-service:'
};

// Create Redis client
const client = new Redis(redisConfig);

// Redis event handlers
client.on('connect', () => {
  logger.info('Redis connection established');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('error', (error) => {
  logger.error('Redis connection error:', {
    error: error.message,
    code: error.code,
    errno: error.errno
  });
});

client.on('close', () => {
  logger.warn('Redis connection closed');
});

client.on('reconnecting', (time) => {
  logger.info(`Redis reconnecting in ${time}ms`);
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await client.connect();
    logger.info('Redis connected successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    return false;
  }
};

// Cache utilities
class CacheService {
  constructor(redisClient) {
    this.client = redisClient;
  }

  // Set cache with TTL
  async set(key, value, ttl = 300) {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error: error.message });
      return false;
    }
  }

  // Get cache
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', { key, error: error.message });
      return null;
    }
  }

  // Delete cache
  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', { key, error: error.message });
      return false;
    }
  }

  // Delete multiple keys
  async delPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error:', { pattern, error: error.message });
      return 0;
    }
  }

  // Check if key exists
  async exists(key) {
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error: error.message });
      return false;
    }
  }

  // Increment counter
  async incr(key, ttl = 3600) {
    try {
      const value = await this.client.incr(key);
      if (value === 1 && ttl > 0) {
        await this.client.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error('Cache increment error:', { key, error: error.message });
      return 0;
    }
  }

  // Add to set
  async sadd(key, ...members) {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      logger.error('Cache set add error:', { key, error: error.message });
      return 0;
    }
  }

  // Get set members
  async smembers(key) {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error('Cache set members error:', { key, error: error.message });
      return [];
    }
  }

  // Remove from set
  async srem(key, ...members) {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      logger.error('Cache set remove error:', { key, error: error.message });
      return 0;
    }
  }

  // Add to sorted set
  async zadd(key, score, member) {
    try {
      return await this.client.zadd(key, score, member);
    } catch (error) {
      logger.error('Cache sorted set add error:', { key, error: error.message });
      return 0;
    }
  }

  // Get sorted set range
  async zrange(key, start = 0, stop = -1, withScores = false) {
    try {
      if (withScores) {
        return await this.client.zrange(key, start, stop, 'WITHSCORES');
      }
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      logger.error('Cache sorted set range error:', { key, error: error.message });
      return [];
    }
  }

  // Set hash field
  async hset(key, field, value) {
    try {
      const serializedValue = JSON.stringify(value);
      return await this.client.hset(key, field, serializedValue);
    } catch (error) {
      logger.error('Cache hash set error:', { key, field, error: error.message });
      return 0;
    }
  }

  // Get hash field
  async hget(key, field) {
    try {
      const value = await this.client.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache hash get error:', { key, field, error: error.message });
      return null;
    }
  }

  // Get all hash fields
  async hgetall(key) {
    try {
      const hash = await this.client.hgetall(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      return result;
    } catch (error) {
      logger.error('Cache hash get all error:', { key, error: error.message });
      return {};
    }
  }

  // Delete hash field
  async hdel(key, ...fields) {
    try {
      return await this.client.hdel(key, ...fields);
    } catch (error) {
      logger.error('Cache hash delete error:', { key, fields, error: error.message });
      return 0;
    }
  }

  // Set expiration
  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Cache expire error:', { key, seconds, error: error.message });
      return false;
    }
  }

  // Get TTL
  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Cache TTL error:', { key, error: error.message });
      return -1;
    }
  }

  // Flush all cache
  async flushall() {
    try {
      await this.client.flushall();
      return true;
    } catch (error) {
      logger.error('Cache flush all error:', error);
      return false;
    }
  }
}

// Create cache service instance
const cache = new CacheService(client);

// Cache key generators
const generateCacheKey = {
  trip: (tripId) => `trip:${tripId}`,
  trips: (userId, filters = {}) => {
    const filterStr = Object.keys(filters).length > 0 
      ? `:${Buffer.from(JSON.stringify(filters)).toString('base64')}`
      : '';
    return `trips:${userId}${filterStr}`;
  },
  tripSearch: (searchParams) => {
    const paramsStr = Buffer.from(JSON.stringify(searchParams)).toString('base64');
    return `trip-search:${paramsStr}`;
  },
  tripWeather: (tripId) => `trip-weather:${tripId}`,
  tripAnalytics: (userId, period) => `trip-analytics:${userId}:${period}`,
  routeOptimization: (origin, destination) => {
    const routeHash = Buffer.from(`${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`).toString('base64');
    return `route:${routeHash}`;
  },
  popularRoutes: (period) => `popular-routes:${period}`,
  userStats: (userId) => `user-stats:${userId}`,
  rateLimit: (userId, endpoint) => `rate-limit:${userId}:${endpoint}`,
  session: (sessionId) => `session:${sessionId}`,
  weatherAlert: (tripId) => `weather-alert:${tripId}`,
  capacityReservation: (tripId, reservationId) => `capacity:${tripId}:${reservationId}`
};

// Health check for Redis
const healthCheck = async () => {
  try {
    const start = Date.now();
    await client.ping();
    const responseTime = Date.now() - start;
    
    const info = await client.info('memory');
    const memoryInfo = {};
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        memoryInfo[key] = value;
      }
    });

    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      connected: client.status === 'ready',
      memory: {
        used: memoryInfo.used_memory_human,
        peak: memoryInfo.used_memory_peak_human,
        fragmentation_ratio: memoryInfo.mem_fragmentation_ratio
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    if (client.status === 'ready') {
      await client.quit();
      logger.info('Redis connection closed gracefully');
    }
  } catch (error) {
    logger.error('Error during Redis graceful shutdown:', error);
  }
};

module.exports = {
  client,
  cache,
  generateCacheKey,
  connectRedis,
  healthCheck,
  gracefulShutdown
};