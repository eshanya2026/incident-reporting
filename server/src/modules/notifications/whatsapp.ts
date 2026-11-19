import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { logActivity } from '../audit/audit.service.js';
import { currentContext } from '../../common/context/requestContext.js';
import { WhatsappMessage } from './whatsappMessage.model.js';
import { User } from '../users/user.model.js';

// Optional WhatsApp delivery via WATI (https://wati.io), a WhatsApp Business API provider.
// Off unless WHATSAPP_NOTIFICATIONS=true and WATI_API_ENDPOINT / WATI_ACCESS_TOKEN are set.
// Failures are logged and never block the workflow action that triggered them.
// Every message is recorded (WhatsappMessage) so the delivery dashboard can follow it to
// delivered / read / failed through WATI's webhook (whatsappWebhook.controller.ts).

export const whatsappEnabled = (): boolean =>
  env.WHATSAPP_NOTIFICATIONS && Boolean(env.WATI_API_ENDPOINT) && Boolean(env.WATI_ACCESS_TOKEN);

/** WATI expects digits only, with country code and no leading "+" or spaces. */
const toWhatsappId = (rawNumber: string): string => rawNumber.replace(/\D/g, '');

export interface SendResult {
  ok: boolean;
  error?: string;
  /** The delivery-dashboard record of this message. */
  messageId?: string;
}

/** What a message is about and who it is for (stored on the delivery dashboard). */
export interface SendMeta {
  recipientUserId?: string | mongoose.Types.ObjectId;
  recipientName?: string;
  /** HOD_ASSIGNED, INTIMATED, ... or TEST */
  notificationKey?: string;
  incidentId?: string | mongoose.Types.ObjectId;
  incidentNumber?: string;
  resendOf?: string;
}

const INCIDENT_REF = /(INC|CAPA)-\d{4}-\d{6}/;
const oid = (v?: string | mongoose.Types.ObjectId) => (v && mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : undefined);

/** Recipient's name, roles and department as they are now (kept on the message). */
const recipientSnapshot = async (meta: SendMeta) => {
  const user: any = meta.recipientUserId
    ? await User.findById(meta.recipientUserId).select('name roles departmentId').populate('roles', 'code').populate('departmentId', 'name').lean()
    : null;
  return {
    recipientUserId: oid(meta.recipientUserId),
    recipientName: meta.recipientName ?? user?.name,
    recipientRoles: (user?.roles || []).map((r: any) => r.code).filter(Boolean),
    recipientDepartmentId: user?.departmentId?._id,
    recipientDepartment: user?.departmentId?.name,
  };
};

/** Records a notification that could not be sent at all (e.g. no WhatsApp number on the profile). */
export const recordSkippedWhatsapp = async (meta: SendMeta, reason: string): Promise<void> => {
  try {
    const now = new Date();
    await WhatsappMessage.create({
      ...(await recipientSnapshot(meta)),
      notificationKey: meta.notificationKey || 'OTHER',
      kind: 'template',
      params: [],
      incidentId: oid(meta.incidentId),
      incidentNumber: meta.incidentNumber,
      triggeredBy: oid(currentContext().userId),
      status: 'SKIPPED',
      failureReason: reason,
      history: [{ status: 'SKIPPED', at: now, detail: reason }],
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Could not record skipped WhatsApp message');
  }
};

/** Every id WATI may later use for this message in its webhook. */
const providerIdsOf = (body: any): string[] => {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) ids.add(v.trim());
  };
  if (!body || typeof body !== 'object') return [];
  add(body.localMessageId);
  add(body.id);
  add(body.whatsappMessageId);
  add(body.messageId);
  (body.receivers || []).forEach((r: any) => add(r?.localMessageId));
  (body.model?.ids || []).forEach(add);
  add(body.model?.id);
  add(body.message?.id);
  add(body.message?.whatsappMessageId);
  add(body.message?.localMessageId);
  return [...ids];
};

const post = async (path: string, payload: Record<string, unknown>): Promise<SendResult & { body?: any }> => {
  try {
    const base = env.WATI_API_ENDPOINT.replace(/\/+$/, '');
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WATI_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    // WATI can answer 200 with { result: false, info: "..." } when it refuses the message
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    const invalidNumber = body?.validWhatsAppNumber === false || body?.receivers?.[0]?.isValidWhatsAppNumber === false;
    if (!res.ok || body?.result === false || invalidNumber) {
      logger.error({ status: res.status, body: text }, '❌ WhatsApp notification failed');
      const reason = invalidNumber
        ? 'Not a WhatsApp number'
        : String(body?.info || body?.message || body?.receivers?.[0]?.errors?.[0]?.message || body?.receivers?.[0]?.errors?.[0] || `HTTP ${res.status}`);
      return { ok: false, error: reason.slice(0, 300), body };
    }
    return { ok: true, body };
  } catch (error) {
    logger.error({ err: error }, '❌ WhatsApp notification failed');
    return { ok: false, error: (error as Error)?.message || 'Network error' };
  }
};

/** Sends through WATI and records the message for the delivery dashboard and the audit log. */
const sendAndRecord = async (
  to: string,
  kind: 'template' | 'session',
  path: string,
  payload: Record<string, unknown>,
  info: { templateName?: string; params: string[]; preview: string },
  meta: SendMeta
): Promise<SendResult> => {
  const ref = meta.incidentNumber ?? info.preview.match(INCIDENT_REF)?.[0];
  const now = new Date();
  let record: any = null;
  try {
    record = await WhatsappMessage.create({
      ...(await recipientSnapshot({ ...meta, recipientName: meta.recipientName ?? (kind === 'template' ? info.params[0] : undefined) })),
      to,
      notificationKey: meta.notificationKey || 'OTHER',
      kind,
      templateName: info.templateName,
      params: info.params,
      preview: info.preview.slice(0, 1000),
      incidentId: oid(meta.incidentId),
      incidentNumber: ref,
      triggeredBy: oid(currentContext().userId),
      status: 'PENDING',
      history: [{ status: 'PENDING', at: now }],
      resendOf: oid(meta.resendOf),
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Could not record WhatsApp message');
  }

  const result = await post(path, payload);

  if (record) {
    const at = new Date();
    await WhatsappMessage.updateOne(
      { _id: record._id, status: 'PENDING' }, // a webhook may already have moved it on
      result.ok
        ? { $set: { status: 'SENT', sentAt: at }, $addToSet: { providerIds: { $each: providerIdsOf(result.body) } }, $push: { history: { status: 'SENT', at } } }
        : { $set: { status: 'FAILED', failedAt: at, failureReason: result.error }, $push: { history: { status: 'FAILED', at, detail: result.error } } }
    ).catch(() => undefined);
    if (result.ok) {
      await WhatsappMessage.updateOne({ _id: record._id }, { $addToSet: { providerIds: { $each: providerIdsOf(result.body) } } }).catch(() => undefined);
    }
  }

  const who = record?.recipientName ? `${record.recipientName} (+${to})` : `+${to}`;
  await logActivity(
    result.ok ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
    result.ok ? `Sent WhatsApp${ref ? ` about ${ref}` : ''} to ${who}` : `WhatsApp to ${who} failed: ${result.error || 'unknown error'}`,
    { meta: { to: `+${to}`, recipientName: record?.recipientName, kind, incidentNumber: ref, preview: info.preview.slice(0, 300), error: result.error, notificationKey: meta.notificationKey } }
  );
  return { ok: result.ok, error: result.error, messageId: record ? String(record._id) : undefined };
};

/**
 * Free-form text (WATI "session message"). Only deliverable while the recipient has an open 24h
 * WhatsApp session with the business number (e.g. they messaged it recently) — otherwise WATI
 * rejects it. Prefer sendWhatsappTemplate for the first message to someone (see docs/whatsapp-template.md).
 */
export const sendWhatsapp = async (rawNumber: string, message: string, meta: SendMeta = {}): Promise<void> => {
  if (!whatsappEnabled()) return;
  const to = toWhatsappId(rawNumber);
  if (!to) return;
  await sendAndRecord(to, 'session', `/api/v1/sendSessionMessage/${to}`, { messageText: message }, { params: [message], preview: message }, meta);
};

/**
 * Sends a pre-approved WhatsApp template via WATI — the only way to reliably reach someone
 * outside the 24h session window (the normal case for a first-time transactional notification).
 * `bodyParams` fill that template's {{1}}, {{2}}, ... in order (see docs/whatsapp-template.md).
 */
export const sendWhatsappTemplate = async (rawNumber: string, templateName: string, bodyParams: string[], meta: SendMeta = {}): Promise<void> => {
  if (!whatsappEnabled() || !templateName) return;
  await sendWhatsappTemplateChecked(rawNumber, templateName, bodyParams, meta);
};

/** Same as sendWhatsappTemplate, but reports whether WATI accepted it (used by "Send test" and resend). */
export const sendWhatsappTemplateChecked = async (
  rawNumber: string,
  templateName: string,
  bodyParams: string[],
  meta: SendMeta = {}
): Promise<SendResult> => {
  if (!whatsappEnabled() || !templateName) return { ok: false, error: 'WhatsApp sending is not configured' };
  const to = toWhatsappId(rawNumber);
  if (!to) return { ok: false, error: 'No WhatsApp number' };

  return sendAndRecord(
    to,
    'template',
    `/api/v1/sendTemplateMessage?whatsappNumber=${to}`,
    {
      template_name: templateName,
      broadcast_name: templateName,
      parameters: bodyParams.map((value, i) => ({ name: String(i + 1), value })),
    },
    { templateName, params: bodyParams, preview: bodyParams.join('\n') },
    meta
  );
};
