import { Request } from 'express';
import { AuditLog } from './audit.model.js';
import { logger } from '../../config/logger.js';

export interface CreateAuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: any;
  newValue?: any;
  req?: Request;
}

export const recordAuditLog = async (params: CreateAuditLogParams): Promise<void> => {
  try {
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (params.req) {
      ipAddress = (params.req.headers['x-forwarded-for'] as string) || params.req.socket.remoteAddress;
      userAgent = params.req.headers['user-agent'];
    }

    await AuditLog.create({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousValue: params.previousValue,
      newValue: params.newValue,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Audit Log Recording Failed');
  }
};
