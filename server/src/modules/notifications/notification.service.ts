import { Notification } from './notification.model.js';
import { logger } from '../../config/logger.js';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  email?: boolean;
}

export const createNotification = async (params: CreateNotificationParams): Promise<void> => {
  try {
    const channels: Array<'IN_APP' | 'EMAIL'> = ['IN_APP'];
    if (params.email) {
      channels.push('EMAIL');
    }

    await Notification.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
      read: false,
      deliveryChannels: channels,
    });

    logger.info(`🔔 Notification created for user ${params.userId}: [${params.type}] ${params.title}`);
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to create notification');
  }
};
