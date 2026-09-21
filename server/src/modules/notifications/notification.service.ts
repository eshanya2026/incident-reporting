import mongoose from 'mongoose';
import { Notification } from './notification.model.js';
import { User } from '../users/user.model.js';
import { Role } from '../roles/role.model.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { ROLE_CODES } from '../../common/enums/permissions.js';
import { emailEnabled, sendEmail } from './mailer.js';

type Id = mongoose.Types.ObjectId | string;

export interface NotifyParams {
  userIds: Id[];
  type: string;
  title: string;
  message: string;
  entityType?: 'INCIDENT' | 'CAPA';
  entityId?: Id;
  /** Link opened from an email (defaults to the incident page for INCIDENT entities). */
  link?: string;
  /** Never notify this user (the person who performed the action). */
  exceptUserId?: Id;
}

/** Active users holding a role (e.g. every Quality user). */
export const activeUserIdsWithRole = async (roleCode: string): Promise<mongoose.Types.ObjectId[]> => {
  const role = await Role.findOne({ code: roleCode }).select('_id');
  if (!role) return [];
  const users = await User.find({ roles: role._id, status: 'ACTIVE' }).select('_id');
  return users.map((u) => u._id as mongoose.Types.ObjectId);
};

export const qualityUserIds = () => activeUserIdsWithRole(ROLE_CODES.QUALITY);

/**
 * Creates an in-app notification for each (active, distinct) recipient and, when enabled,
 * emails them. Never throws: a notification failure must not undo the action that caused it.
 */
export const notifyUsers = async (params: NotifyParams): Promise<number> => {
  try {
    const except = params.exceptUserId?.toString();
    const ids = [...new Set(params.userIds.filter(Boolean).map(String))].filter((id) => id !== except);
    if (ids.length === 0) return 0;

    const recipients = await User.find({ _id: { $in: ids }, status: 'ACTIVE' }).select('email');
    if (recipients.length === 0) return 0;

    const withEmail = emailEnabled();
    await Notification.insertMany(
      recipients.map((u) => ({
        userId: u._id,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        read: false,
        deliveryChannels: withEmail ? ['IN_APP', 'EMAIL'] : ['IN_APP'],
      }))
    );

    if (withEmail) {
      const link = params.link ?? (params.entityType === 'INCIDENT' && params.entityId ? `${env.APP_URL}/incidents/${params.entityId}` : env.APP_URL);
      void sendEmail(
        recipients.map((u) => u.email).filter(Boolean),
        params.title,
        `${params.message}\n\nOpen: ${link}\n\n— Adhiparasakthi Hospitals Incident Reporting`
      );
    }
    return recipients.length;
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to create notifications');
    return 0;
  }
};

/** Single-recipient helper kept for existing callers. */
export const createNotification = async (params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: 'INCIDENT' | 'CAPA';
  entityId?: string;
}): Promise<void> => {
  await notifyUsers({ ...params, userIds: [params.userId] });
};
