import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import { getRedisClient } from './config/redis.js';

const startServer = async () => {
  // Connect MongoDB
  await connectDatabase();

  // Initialize Redis client
  getRedisClient();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`🔗 Healthcheck available at ${env.API_URL}/health`);
  });

  const gracefulShutdown = (signal: string) => {
    logger.info(`⚠️ Received ${signal}. Shutting down server gracefully...`);
    server.close(() => {
      logger.info('🛑 HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();
