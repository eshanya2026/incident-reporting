import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import { getRedisClient } from './config/redis.js';
import { syncSystemRoles } from './seeders/systemRoles.js';
import { runMigrations } from './migrations/index.js';
import { startCapaOverdueScheduler } from './modules/capa/capaOverdue.job.js';

const startServer = async () => {
  // Connect MongoDB
  await connectDatabase();

  // Convert data from earlier versions (recorded in the migrations collection, runs once)
  await runMigrations();

  // Keep system role permissions in the database in line with the code (e.g. only HODs report incidents)
  await syncSystemRoles();
  logger.info('✅ System role permissions synced (Staff / Quality / HOD / Admin)');

  // Initialize Redis client
  getRedisClient();

  // Remind HODs and Quality about CAPA past its target date (hourly)
  startCapaOverdueScheduler();

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
