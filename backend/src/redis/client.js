/**
 * Redis Client Configuration
 * =========================
 * Shared ioredis connection used by:
 *   - Lua scripts (scripts.js) for atomic inventory operations
 *   - BullMQ queue (orderQueue.js) for background job processing
 *   - BullMQ worker (worker.js) for job consumption
 *
 * IMPORTANT: maxRetriesPerRequest is set to null for BullMQ compatibility.
 * BullMQ requires this setting to prevent automatic retry failures.
 *
 * Connection defaults match the docker-compose.yml Redis service.
 * Override via .env file for different environments.
 */
const Redis = require('ioredis');
require('dotenv').config();

const redisOptions = { maxRetriesPerRequest: null, family: 6 };
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, redisOptions)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6380,
      ...redisOptions,
    });

redis.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis at', `${redis.options.host}:${redis.options.port}`);
});

module.exports = redis;
