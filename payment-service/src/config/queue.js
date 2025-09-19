const Queue = require('bull');
const { createRedisClient } = require('./redis');
const { logger } = require('./logger');

// Create Redis connection for Bull
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_QUEUE_DB, 10) || 1
};

// Queue configurations
const queueConfig = {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  settings: {
    stalledInterval: 30 * 1000,
    maxStalledCount: 1,
  }
};

// Create queues
const createQueues = () => {
  const queues = {};
  
  // Escrow release queue
  queues.escrowRelease = new Queue('escrow release', {
    redis: redisConnection,
    defaultJobOptions: queueConfig.defaultJobOptions,
    settings: queueConfig.settings
  });
  
  // Payout processing queue
  queues.payoutProcessing = new Queue('payout processing', {
    redis: redisConnection,
    defaultJobOptions: queueConfig.defaultJobOptions,
    settings: queueConfig.settings
  });
  
  // Fraud detection queue
  queues.fraudDetection = new Queue('fraud detection', {
    redis: redisConnection,
    defaultJobOptions: {
      ...queueConfig.defaultJobOptions,
      priority: 'high'
    },
    settings: queueConfig.settings
  });
  
  // Pricing update queue
  queues.pricingUpdate = new Queue('pricing update', {
    redis: redisConnection,
    defaultJobOptions: {
      ...queueConfig.defaultJobOptions,
      repeat: { cron: '*/10 * * * *' } // Every 10 minutes
    },
    settings: queueConfig.settings
  });
  
  // Compliance reporting queue
  queues.complianceReporting = new Queue('compliance reporting', {
    redis: redisConnection,
    defaultJobOptions: {
      ...queueConfig.defaultJobOptions,
      repeat: { cron: '0 2 * * *' } // Daily at 2 AM
    },
    settings: queueConfig.settings
  });
  
  // Notification queue
  queues.notification = new Queue('payment notifications', {
    redis: redisConnection,
    defaultJobOptions: queueConfig.defaultJobOptions,
    settings: queueConfig.settings
  });
  
  // Setup global error handling
  Object.values(queues).forEach(queue => {
    queue.on('error', (error) => {
      logger.error(`Queue ${queue.name} error:`, error);
    });
    
    queue.on('waiting', (jobId) => {
      logger.debug(`Job ${jobId} is waiting in queue ${queue.name}`);
    });
    
    queue.on('active', (job, jobPromise) => {
      logger.debug(`Job ${job.id} started in queue ${job.queue.name}`);
    });
    
    queue.on('completed', (job, result) => {
      logger.debug(`Job ${job.id} completed in queue ${job.queue.name}`);
    });
    
    queue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed in queue ${job.queue.name}:`, err);
    });
    
    queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled in queue ${job.queue.name}`);
    });
  });
  
  return queues;
};

// Queue utilities
const queueUtils = {
  // Add job with priority
  addJobWithPriority: async (queue, jobName, data, priority = 'normal') => {
    const priorityMap = {
      low: 1,
      normal: 5,
      high: 10,
      critical: 15
    };
    
    return queue.add(jobName, data, {
      priority: priorityMap[priority] || 5
    });
  },
  
  // Add delayed job
  addDelayedJob: async (queue, jobName, data, delay) => {
    return queue.add(jobName, data, {
      delay
    });
  },
  
  // Add scheduled job
  addScheduledJob: async (queue, jobName, data, cron) => {
    return queue.add(jobName, data, {
      repeat: { cron }
    });
  },
  
  // Get queue stats
  getQueueStats: async (queue) => {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);
    
    return {
      name: queue.name,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
  },
  
  // Clean old jobs
  cleanOldJobs: async (queue, maxAge = 24 * 60 * 60 * 1000) => { // 24 hours
    await queue.clean(maxAge, 'completed');
    await queue.clean(maxAge, 'failed');
  }
};

module.exports = {
  createQueues,
  queueConfig,
  queueUtils
};