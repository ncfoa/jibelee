const Redis = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'payment:',
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000
};

// Create Redis client
const createRedisClient = () => {
  const client = Redis.createClient({
    socket: {
      host: redisConfig.host,
      port: redisConfig.port,
      connectTimeout: redisConfig.connectTimeout,
      commandTimeout: redisConfig.commandTimeout
    },
    password: redisConfig.password,
    database: redisConfig.db,
    retryDelayOnFailover: redisConfig.retryDelayOnFailover,
    enableOfflineQueue: redisConfig.enableOfflineQueue,
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    lazyConnect: redisConfig.lazyConnect
  });

  client.on('connect', () => {
    logger.info('Payment Service: Redis client connected');
  });

  client.on('ready', () => {
    logger.info('Payment Service: Redis client ready');
  });

  client.on('error', (err) => {
    logger.error('Payment Service: Redis client error:', err);
  });

  client.on('end', () => {
    logger.info('Payment Service: Redis client disconnected');
  });

  return client;
};

// Cache utilities
const cacheUtils = {
  // Cache keys
  keys: {
    pricingData: (routeHash) => `${redisConfig.keyPrefix}pricing:${routeHash}`,
    exchangeRates: () => `${redisConfig.keyPrefix}exchange_rates`,
    marketData: (routeHash) => `${redisConfig.keyPrefix}market:${routeHash}`,
    fraudScore: (userId) => `${redisConfig.keyPrefix}fraud:${userId}`,
    rateLimiting: (userId, endpoint) => `${redisConfig.keyPrefix}rate_limit:${userId}:${endpoint}`,
    paymentIntent: (id) => `${redisConfig.keyPrefix}payment_intent:${id}`,
    escrowAccount: (id) => `${redisConfig.keyPrefix}escrow:${id}`,
    payoutAccount: (userId) => `${redisConfig.keyPrefix}payout_account:${userId}`
  },
  
  // Cache TTL (in seconds)
  ttl: {
    pricingData: 300, // 5 minutes
    exchangeRates: 3600, // 1 hour
    marketData: 600, // 10 minutes
    fraudScore: 1800, // 30 minutes
    rateLimiting: 3600, // 1 hour
    paymentIntent: 3600, // 1 hour
    escrowAccount: 1800, // 30 minutes
    payoutAccount: 3600 // 1 hour
  }
};

module.exports = {
  redisConfig,
  createRedisClient,
  cacheUtils
};