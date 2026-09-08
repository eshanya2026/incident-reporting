import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export const connectDatabase = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      autoIndex: env.NODE_ENV === 'development',
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    logger.error({ err: error }, '❌ MongoDB Connection Error');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB Connection Lost');
});

mongoose.connection.on('error', (err) => {
  logger.error('❌ MongoDB Error Event:', err);
});
