import { Request } from 'express';
import mongoose from 'mongoose';
import { AuditLog, AuditCategory } from './audit.model.js';
import { logger } from '../../config/logger.js';
import { clientInfo, currentContext } from '../../common/context/requestContext.js';

export interface CreateAuditLogParams {
  /** Defaults to the signed-in user of the current request. */
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  previousValue?: any;
  newValue?: any;
  req?: Request;
  /** Defaults from the action name (categoryOf). */
  category?: AuditCategory;
  summary?: string;
  meta?: Record<string, any>;
  sessionId?: string;
}

/** Category of an action, for entries written without one. */
export const categoryOf = (action: string): AuditCategory => {
  if (/^(LOGIN|LOGOUT|PASSWORD_|PROFILE_|ACCOUNT_LOCKED|SESSION_)/.test(action)) return 'auth';
  if (/^SCREEN_/.test(action)) return 'screen';
  if (/^PRESENCE_/.test(action)) return 'presence';
  if (/^EXPORT_|_DOWNLOADED$/.test(action)) return 'export';
  if (/^(INCIDENT_|INVESTIGATION_|CAPA_|RCA_|SEED_INCIDENT|SUBMIT_RCA)/.test(action) && !/_OPENED$/.test(action)) return 'incident';
  if (/^WHATSAPP_TEMPLATE_(UPDATED|RESET)$/.test(action)) return 'settings';
  if (/^WHATSAPP_/.test(action)) return 'whatsapp';
  if (/^AI_/.test(action)) return 'ai';
  if (/^USER_|^USERS_|^FORCE_SIGN_OUT/.test(action)) return 'users';
  if (/^AUDIT_/.test(action)) return 'audit';
  if (/^REPORT_|_OPENED$|_VIEWED$/.test(action)) return 'report';
  return 'settings'; // DEPARTMENT_*, ROLE_*, LOCATION_*, CATEGORY_*...
};

const asObjectId = (id?: string) => (id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined);

/** Writes an audit entry. Never throws: auditing must not break the action being audited. */
export const recordAuditLog = async (params: CreateAuditLogParams): Promise<void> => {
  try {
    const ctx = currentContext();
    const info = params.req ? clientInfo(params.req) : {};
    await AuditLog.create({
      userId: asObjectId(params.userId ?? ctx.userId),
      action: params.action,
      category: params.category ?? categoryOf(params.action),
      sessionId: asObjectId(params.sessionId ?? ctx.sessionId),
      summary: params.summary,
      meta: params.meta,
      entityType: params.entityType,
      entityId: asObjectId(params.entityId),
      previousValue: params.previousValue,
      newValue: params.newValue,
      ipAddress: info.ipAddress ?? ctx.ipAddress,
      userAgent: info.userAgent ?? ctx.userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Audit Log Recording Failed');
  }
};

/** Shorthand for activity events (sign-in, downloads, WhatsApp, AI...): a description plus details. */
export const logActivity = (
  action: string,
  summary: string,
  extra: Omit<CreateAuditLogParams, 'action' | 'summary'> = {}
): Promise<void> => recordAuditLog({ action, summary, ...extra });
