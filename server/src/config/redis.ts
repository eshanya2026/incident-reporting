import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (!redisClient) {
    try {
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
          if (times > 3) {
            logger.warn('⚠️ Redis connection retry limit reached. Operating in offline/degraded queue mode.');
            return null;
          }
          return Math.min(times * 500, 2000);
        },
      });

      redisClient.on('connect', () => {
        logger.info('✅ Redis Connected');
      });

      redisClient.on('error', (err) => {
        logger.error({ err }, '❌ Redis Error');
      });
    } catch (err) {
      logger.warn({ err }, '⚠️ Redis initialization skipped or failed');
    }
  }

  return redisClient;
};
