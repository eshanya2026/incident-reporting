import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { WhatsappMessage, WhatsappStatus, STATUS_RANK, WHATSAPP_STATUSES } from './whatsappMessage.model.js';
import { sendWhatsappTemplateChecked, whatsappEnabled } from './whatsapp.js';
import { codeInUrl, createShortLink, deviceLabel } from '../links/shortLink.service.js';
import { ShortLink, LinkEvent } from '../links/shortLink.model.js';
import { User } from '../users/user.model.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { logActivity } from '../audit/audit.service.js';
import { istText, sendCsv } from '../../common/helpers/csv.js';

// WhatsApp delivery dashboard (Super Admin) and the WATI webhook that reports delivered / read /
// failed for each message we send.

const oid = (v?: string) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : undefined);
const DAY = 24 * 60 * 60 * 1000;
const appState = () => mongoose.connection.collection<{ _id: string; [k: string]: any }>('app_state');

/** Plain-language explanation of WhatsApp's common failure codes (shown next to WATI's own text). */
export const FAILURE_HINTS: Record<string, string> = {
  '131026': 'Not delivered: the number is not on WhatsApp, has an old WhatsApp version, or has not accepted messages from businesses.',
  '131047': 'More than 24 hours since the person last messaged us, so only an approved template can be sent.',
  '131049': 'WhatsApp chose not to deliver it (to keep engagement healthy); try again later.',
  '131048': 'Sending was limited because too many people reported or blocked messages.',
  '131056': 'Too many messages to this number in a short time.',
  '131000': 'Something went wrong on WhatsApp\'s side.',
  '131009': 'A value in the message is not valid.',
  '131021': 'The recipient is the same as the sending number.',
  '130472': 'The person is part of a WhatsApp experiment that blocks business messages.',
  '132000': 'The number of values does not match the template.',
  '132001': 'The template does not exist or is not approved for this language.',
  '132015': 'The template is paused because of low quality.',
  '132016': 'The template is disabled.',
};

// ---------- Webhook ----------

const EVENT_STATUS: Array<[RegExp, WhatsappStatus]> = [
  [/^templateMessageFailed|failed/i, 'FAILED'],
  [/REPLIED/i, 'REPLIED'],
  [/READ/i, 'READ'],
  [/DELIVERED/i, 'DELIVERED'],
  [/^templateMessageSent|^sessionMessageSent|SENT/i, 'SENT'],
];
const STATUS_TIME_FIELD: Partial<Record<WhatsappStatus, string>> = {
  SENT: 'sentAt',
  DELIVERED: 'deliveredAt',
  READ: 'readAt',
  REPLIED: 'repliedAt',
  FAILED: 'failedAt',
};

const statusOf = (e: any): WhatsappStatus | null => {
  const s = String(e?.statusString || '').toLowerCase();
  if (s === 'failed') return 'FAILED';
  if (s === 'replied') return 'REPLIED';
  if (s === 'read') return 'READ';
  if (s === 'delivered') return 'DELIVERED';
  if (s === 'sent') return 'SENT';
  const type = String(e?.eventType || '');
  return EVENT_STATUS.find(([re]) => re.test(type))?.[1] ?? null;
};

const eventTime = (e: any): Date => {
  const ts = Number(e?.timestamp);
  if (Number.isFinite(ts) && ts > 1_000_000_000) return new Date(ts > 1e12 ? ts : ts * 1000);
  const created = e?.created ? new Date(e.created) : null;
  return created && !Number.isNaN(created.getTime()) ? created : new Date();
};

/** The number as stored and as WATI sends it (with or without India's 91). */
const numberVariants = (waId: string): string[] => {
  const v = new Set([waId]);
  if (waId.length === 12 && waId.startsWith('91')) v.add(waId.slice(2));
  if (waId.length === 10) v.add(`91${waId}`);
  return [...v];
};

const applyEvent = async (e: any): Promise<boolean> => {
  const type = String(e?.eventType || '');
  // A reply from the person: mark the message they replied to
  if (type === 'message' && e?.replyContextId) {
    e = { ...e, whatsappMessageId: e.replyContextId, statusString: 'Replied', localMessageId: undefined, id: undefined };
  } else if (type === 'message') {
    return false;
  }
  const status = statusOf(e);
  if (!status) return false;

  const ids = [e.localMessageId, e.id, e.whatsappMessageId].filter((v) => typeof v === 'string' && v.trim());
  let msg = ids.length ? await WhatsappMessage.findOne({ providerIds: { $in: ids } }) : null;
  const waId = String(e?.waId || '').replace(/\D/g, '');
  // The first "sent" event may arrive before we stored WATI's ids: match on the number instead
  if (!msg && waId && status === 'SENT') {
    msg = await WhatsappMessage.findOne({
      to: { $in: numberVariants(waId) },
      status: { $in: ['PENDING', 'SENT'] },
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
    }).sort({ createdAt: -1 });
  }
  // Later updates (delivered, read, replied) are matched by id only: the WATI number is shared with
  // other systems, so an unknown id is usually someone else's message, not ours.
  if (!msg) return false;

  const at = eventTime(e);
  const update: Record<string, any> = { $addToSet: { providerIds: { $each: ids } } };
  const set: Record<string, any> = {};
  const field = STATUS_TIME_FIELD[status];
  if (field && !(msg as any)[field]) set[field] = at;
  if (STATUS_RANK[status] > STATUS_RANK[msg.status]) set.status = status;
  if (status === 'FAILED') {
    set.failedCode = e.failedCode ? String(e.failedCode) : msg.failedCode;
    set.failureReason = String(e.failedDetail || e.failedReason || msg.failureReason || 'Failed').slice(0, 300);
  }
  // Marked failed at send time but WhatsApp then delivered it: the failure no longer applies
  if (msg.status === 'FAILED' && STATUS_RANK[status] > STATUS_RANK.FAILED) {
    update.$unset = { failureReason: '', failedCode: '', failedAt: '' };
  }
  if (Object.keys(set).length) update.$set = set;
  if (!msg.history.some((h) => h.status === status)) {
    update.$push = { history: { status, at, detail: status === 'FAILED' ? set.failureReason : undefined } };
  }
  await WhatsappMessage.updateOne({ _id: msg._id }, update);
  return true;
};

/**
 * POST /whatsapp/webhook/:secret — WATI calls this for every status change (sent, delivered, read,
 * replied, failed). WATI does not sign webhooks, so the URL carries a secret (WATI_WEBHOOK_SECRET).
 * Always answers 200 so WATI does not retry endlessly.
 */
export const receiveWatiWebhook = async (req: Request, res: Response): Promise<void> => {
  if (!env.WATI_WEBHOOK_SECRET || req.params.secret !== env.WATI_WEBHOOK_SECRET) {
    res.status(404).end();
    return;
  }
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    let matched = 0;
    const inc: Record<string, number> = { count: events.length };
    const recent: any[] = [];
    for (const e of events.slice(0, 100)) {
      const ok = await applyEvent(e);
      if (ok) matched += 1;
      // Per event type: how many arrived and how many matched one of our messages (for diagnosis)
      const key = String(e?.eventType || 'unknown').replace(/[^\w-]/g, '_').slice(0, 60) || 'unknown';
      inc[`types.${key}.total`] = (inc[`types.${key}.total`] || 0) + 1;
      if (ok) inc[`types.${key}.matched`] = (inc[`types.${key}.matched`] || 0) + 1;
      recent.push({
        at: new Date(),
        eventType: e?.eventType,
        statusString: e?.statusString,
        id: e?.id,
        localMessageId: e?.localMessageId,
        whatsappMessageId: e?.whatsappMessageId,
        waId: e?.waId,
        matched: ok,
      });
    }
    await appState().updateOne(
      { _id: 'wati_webhook' },
      {
        $set: { lastAt: new Date(), lastEvent: String(events[0]?.eventType || ''), lastMatched: matched > 0 },
        $inc: inc,
        $push: { recent: { $each: recent, $slice: -100 } } as any,
      },
      { upsert: true }
    );
  } catch (error) {
    logger.error({ err: error }, '❌ WATI webhook handling failed');
  }
  res.status(200).json({ ok: true });
};

// ---------- Dashboard ----------

const filterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.string().optional(),
  notificationKey: z.string().optional(),
  role: z.string().optional(),
  departmentId: z.string().optional(),
  search: z.string().trim().max(100).optional(),
});

const buildMatch = (req: Request, opts: { withStatus?: boolean } = {}) => {
  const f = filterSchema.parse(req.query);
  const to = f.to ?? new Date();
  const from = f.from ?? new Date(to.getTime() - 30 * DAY);
  const match: Record<string, any> = { createdAt: { $gte: from, $lte: to } };
  const statuses = (f.status || '').split(',').filter((s) => (WHATSAPP_STATUSES as readonly string[]).includes(s));
  if (statuses.length && opts.withStatus !== false) match.status = { $in: statuses };
  if (f.notificationKey) match.notificationKey = f.notificationKey;
  if (f.role) match.recipientRoles = f.role;
  if (f.departmentId === 'none') match.recipientDepartmentId = { $exists: false };
  else if (f.departmentId) match.recipientDepartmentId = oid(f.departmentId);
  if (f.search) {
    const re = { $regex: f.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    match.$or = [{ recipientName: re }, { to: re }, { incidentNumber: re }, { failureReason: re }];
  }
  return { match, from, to, statuses };
};

const countBy = (field: string) => [
  {
    $group: {
      _id: field,
      total: { $sum: 1 },
      skipped: { $sum: { $cond: [{ $eq: ['$status', 'SKIPPED'] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
      // "Sent" = WATI accepted it (whatever happened next)
      sent: { $sum: { $cond: [{ $in: ['$status', ['SENT', 'DELIVERED', 'READ', 'REPLIED']] }, 1, 0] } },
      delivered: { $sum: { $cond: [{ $in: ['$status', ['DELIVERED', 'READ', 'REPLIED']] }, 1, 0] } },
      read: { $sum: { $cond: [{ $in: ['$status', ['READ', 'REPLIED']] }, 1, 0] } },
      replied: { $sum: { $cond: [{ $eq: ['$status', 'REPLIED'] }, 1, 0] } },
      pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
      // Short link in the message tapped at least once / incident opened from it signed in
      withLink: { $sum: { $cond: [{ $ifNull: ['$linkCode', false] }, 1, 0] } },
      tapped: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$linkTaps', 0] }, 0] }, 1, 0] } },
      opened: { $sum: { $cond: [{ $ifNull: ['$linkOpenedAt', false] }, 1, 0] } },
    },
  },
];

/** GET /whatsapp-delivery/summary — totals, rates, daily trend and breakdowns. */
export const getDeliverySummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { match, from, to } = buildMatch(req);
    const [totals, daily, byType, byRole, byDept, reasons, avgTimes, state] = await Promise.all([
      WhatsappMessage.aggregate([{ $match: match }, ...countBy('all')]),
      // Per day in IST
      WhatsappMessage.aggregate([
        { $match: match },
        { $group: { ...(countBy('x')[0] as any).$group, _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } } } },
      ]),
      WhatsappMessage.aggregate([{ $match: match }, ...countBy('$notificationKey'), { $sort: { total: -1 } }]),
      WhatsappMessage.aggregate([
        { $match: match },
        { $unwind: { path: '$recipientRoles', preserveNullAndEmptyArrays: true } },
        ...countBy({ $ifNull: ['$recipientRoles', 'NONE'] } as any),
        { $sort: { total: -1 } },
      ]),
      WhatsappMessage.aggregate([
        { $match: match },
        ...countBy({ id: '$recipientDepartmentId', name: '$recipientDepartment' } as any),
        { $sort: { total: -1 } },
        { $limit: 100 },
      ]),
      WhatsappMessage.aggregate([
        { $match: { ...match, status: { $in: ['FAILED', 'SKIPPED'] } } },
        { $group: { _id: { reason: '$failureReason', code: '$failedCode', status: '$status' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      WhatsappMessage.aggregate([
        { $match: { ...match, sentAt: { $exists: true } } },
        {
          $group: {
            _id: null,
            toDelivered: { $avg: { $cond: [{ $ifNull: ['$deliveredAt', false] }, { $subtract: ['$deliveredAt', '$sentAt'] }, null] } },
            toRead: { $avg: { $cond: [{ $ifNull: ['$readAt', false] }, { $subtract: ['$readAt', '$sentAt'] }, null] } },
          },
        },
      ]),
      appState().findOne({ _id: 'wati_webhook' }),
    ]);

    const t = totals[0] ?? { total: 0, skipped: 0, failed: 0, sent: 0, delivered: 0, read: 0, replied: 0, pending: 0 };
    const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const strip = (r: any) => ({ ...r, _id: undefined });
    sendSuccess(res, {
      from,
      to,
      totals: {
        ...strip(t),
        deliveryRate: rate(t.delivered, t.sent),
        readRate: rate(t.read, t.delivered),
        failureRate: rate(t.failed, t.sent + t.failed),
        tapRate: rate(t.tapped, t.withLink),
      },
      daily: daily.map((d: any) => ({ day: d._id, ...strip(d) })).sort((a: any, b: any) => a.day.localeCompare(b.day)),
      byType: byType.map((r: any) => ({ key: r._id, ...strip(r) })),
      byRole: byRole.map((r: any) => ({ role: r._id, ...strip(r) })),
      byDepartment: byDept.map((r: any) => ({ departmentId: r._id?.id ?? null, department: r._id?.name ?? 'No department', ...strip(r) })),
      failureReasons: reasons.map((r: any) => ({
        reason: r._id.reason || (r._id.status === 'SKIPPED' ? 'Not sent' : 'Unknown'),
        code: r._id.code,
        hint: r._id.code ? FAILURE_HINTS[String(r._id.code)] : undefined,
        status: r._id.status,
        count: r.count,
      })),
      avgTimeToDeliverMs: avgTimes[0]?.toDelivered ?? null,
      avgTimeToReadMs: avgTimes[0]?.toRead ?? null,
      setup: {
        sendingEnabled: whatsappEnabled(),
        templateConfigured: Boolean(env.WATI_TEMPLATE_NAME),
        webhookSecretConfigured: Boolean(env.WATI_WEBHOOK_SECRET),
        webhookUrl: env.WATI_WEBHOOK_SECRET ? `${env.APP_URL.replace(/\/+$/, '')}/api/v1/whatsapp/webhook/${env.WATI_WEBHOOK_SECRET}` : null,
        lastWebhookAt: (state as any)?.lastAt ?? null,
        webhookEvents: (state as any)?.count ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

const shapeMessage = (m: any) => ({
  _id: String(m._id),
  createdAt: m.createdAt,
  recipient: { _id: m.recipientUserId ? String(m.recipientUserId) : null, name: m.recipientName, roles: m.recipientRoles, department: m.recipientDepartment },
  to: m.to,
  notificationKey: m.notificationKey,
  incidentId: m.incidentId ? String(m.incidentId) : null,
  incidentNumber: m.incidentNumber,
  status: m.status,
  sentAt: m.sentAt,
  deliveredAt: m.deliveredAt,
  readAt: m.readAt,
  repliedAt: m.repliedAt,
  failedAt: m.failedAt,
  failedCode: m.failedCode,
  failureReason: m.failureReason,
  failureHint: m.failedCode ? FAILURE_HINTS[String(m.failedCode)] : undefined,
  triggeredBy: m.triggeredBy ? { _id: String(m.triggeredBy._id), name: m.triggeredBy.name } : null,
  preview: m.preview,
  history: m.history,
  canResend: ['FAILED'].includes(m.status) && m.kind === 'template' && (m.params || []).length > 0,
  resendOf: m.resendOf ? String(m.resendOf) : null,
  link: m.linkCode
    ? {
        code: m.linkCode,
        taps: m.linkTaps || 0,
        firstTapAt: m.linkFirstTapAt ?? null,
        lastTapAt: m.linkLastTapAt ?? null,
        lastDevice: m.linkLastDevice ?? null,
        openedAt: m.linkOpenedAt ?? null,
        openedBy: m.linkOpenedBy?.name ? { _id: String(m.linkOpenedBy._id), name: m.linkOpenedBy.name } : null,
        openedByRecipient: m.linkOpenedByRecipient ?? null,
      }
    : null,
});

/** How good an outcome is, for picking the best of several attempts (sent beats failed). */
const OUTCOME_RANK: Record<string, number> = { SKIPPED: 0, FAILED: 1, PENDING: 2, SENT: 3, DELIVERED: 4, READ: 5, REPLIED: 6 };

/**
 * GET /whatsapp-delivery/messages — newest first, paged.
 * Grouped by default: one row per person + notification + incident, so a resend or repeated test
 * sends show as one line with their best outcome and every attempt underneath. `view=all` lists
 * every message on its own. In grouped view the status filter applies to the row's best outcome.
 */
export const getDeliveryMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    if (req.query.view === 'all') {
      const { match } = buildMatch(req);
      const [total, rows] = await Promise.all([
        WhatsappMessage.countDocuments(match),
        WhatsappMessage.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('triggeredBy', 'name').populate('linkOpenedBy', 'name').lean(),
      ]);
      sendSuccess(res, rows.map(shapeMessage), 'Messages', 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
      return;
    }

    const { match, statuses } = buildMatch(req, { withStatus: false });
    const rankExpr = {
      $switch: { branches: Object.entries(OUTCOME_RANK).map(([st, r]) => ({ case: { $eq: ['$status', st] }, then: r })), default: 0 },
    };
    const [result] = await WhatsappMessage.aggregate([
      { $match: match },
      {
        $addFields: {
          // Same person whether the number was stored with or without the country code
          phone10: { $substrCP: [{ $ifNull: ['$to', ''] }, { $max: [{ $subtract: [{ $strLenCP: { $ifNull: ['$to', ''] } }, 10] }, 0] }, 10] },
          outcomeRank: rankExpr,
        },
      },
      { $sort: { outcomeRank: -1, createdAt: -1 } },
      {
        $group: {
          _id: { person: { $ifNull: [{ $toString: '$recipientUserId' }, '$phone10'] }, key: '$notificationKey', incident: { $ifNull: ['$incidentNumber', null] } },
          bestStatus: { $first: '$status' },
          latestAt: { $max: '$createdAt' },
          attempts: { $sum: 1 },
          ids: { $push: '$_id' },
        },
      },
      ...(statuses.length ? [{ $match: { bestStatus: { $in: statuses } } }] : []),
      { $sort: { latestAt: -1 } },
      { $facet: { total: [{ $count: 'n' }], rows: [{ $skip: (page - 1) * limit }, { $limit: limit }] } },
    ]);
    const groups: any[] = result?.rows || [];
    const total = result?.total?.[0]?.n || 0;

    const docs = await WhatsappMessage.find({ _id: { $in: groups.flatMap((g) => g.ids.slice(0, 20)) } })
      .populate('triggeredBy', 'name').populate('linkOpenedBy', 'name')
      .lean();
    const byId = new Map(docs.map((d: any) => [String(d._id), d]));
    const rows = groups.map((g) => {
      // ids are in best-first order; attempts are listed newest first
      const attempts = g.ids.map((id: any) => byId.get(String(id))).filter(Boolean);
      const best = attempts[0];
      const latest = [...attempts].sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
      const shaped = attempts.map(shapeMessage);
      const links = shaped.map((a: any) => a.link).filter(Boolean);
      const firstOf = (k: string) => links.map((l: any) => l[k]).filter(Boolean).sort()[0] ?? null;
      const lastOf = (k: string) => links.map((l: any) => l[k]).filter(Boolean).sort().pop() ?? null;
      const latestTap = links.filter((l: any) => l.lastTapAt).sort((a: any, b: any) => +new Date(b.lastTapAt) - +new Date(a.lastTapAt))[0];
      const opener = links.find((l: any) => l.openedByRecipient) ?? links.find((l: any) => l.openedAt);
      return {
        ...shapeMessage(best),
        link: links.length
          ? {
              taps: links.reduce((n: number, l: any) => n + l.taps, 0),
              firstTapAt: firstOf('firstTapAt'),
              lastTapAt: lastOf('lastTapAt'),
              lastDevice: latestTap?.lastDevice ?? null,
              openedAt: opener?.openedAt ?? null,
              openedBy: opener?.openedBy ?? null,
              openedByRecipient: opener?.openedByRecipient ?? null,
            }
          : null,
        latestAt: g.latestAt,
        attemptCount: g.attempts,
        // Send again only when nothing got through; it resends the latest failed attempt
        canResend: g.bestStatus === 'FAILED' && shapeMessage(latest).canResend,
        resendId: String(latest._id),
        attempts: [...attempts].sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt)).map(shapeMessage),
      };
    });
    sendSuccess(res, rows, 'Messages', 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

/** GET /whatsapp-delivery/messages/export — filtered list as CSV. */
export const exportDeliveryMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { match } = buildMatch(req);
    const rows = await WhatsappMessage.find(match).sort({ createdAt: -1 }).limit(20000).populate('triggeredBy', 'name').populate('linkOpenedBy', 'name').lean();
    const header = ['Created (IST)', 'Recipient', 'Roles', 'Department', 'Number', 'Notification', 'Incident', 'Status', 'Sent', 'Delivered', 'Read', 'Failed', 'Failure code', 'Reason', 'Triggered by', 'Link taps', 'First tap', 'Last tap device', 'Opened (signed in)', 'Opened by'];
    const ist = istText;
    const lines = (rows as any[]).map((m) => [ist(m.createdAt), m.recipientName, (m.recipientRoles || []).join(' '), m.recipientDepartment, m.to ? `+${m.to}` : '', m.notificationKey, m.incidentNumber, m.status, ist(m.sentAt), ist(m.deliveredAt), ist(m.readAt), ist(m.failedAt), m.failedCode, m.failureReason, m.triggeredBy?.name, m.linkCode ? m.linkTaps || 0 : '', ist(m.linkFirstTapAt), m.linkLastDevice, ist(m.linkOpenedAt), m.linkOpenedBy?.name]);
    await logActivity('EXPORT_WHATSAPP_DELIVERY_CSV', `Downloaded the WhatsApp delivery report (CSV, ${rows.length} rows)`, { req, meta: { rows: rows.length, format: 'CSV' } });
    sendCsv(res, `whatsapp_delivery_${new Date().toISOString().slice(0, 10)}.csv`, header, lines);
  } catch (error) {
    next(error);
  }
};

/** POST /whatsapp-delivery/messages/:id/resend — sends a failed message again, to the person's current number. */
export const resendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const msg = await WhatsappMessage.findById(oid(req.params.id as string));
    if (!msg) throw AppError.notFound('Message not found');
    if (msg.status !== 'FAILED' || msg.kind !== 'template' || !msg.params.length || !msg.templateName) {
      throw AppError.badRequest('Only failed template messages can be sent again');
    }
    if (!whatsappEnabled()) throw AppError.badRequest('WhatsApp sending is switched off on this server');
    const user = msg.recipientUserId ? await User.findById(msg.recipientUserId).select('whatsappNumber status name') : null;
    const number = user?.whatsappNumber || msg.to;
    if (!number) throw AppError.badRequest('This person has no WhatsApp number on their profile');
    // A fresh tracked link for the resend (to the same page), so its taps are counted on it
    const params = [...msg.params];
    let linkCode: string | undefined;
    const oldCode = codeInUrl(params[2]);
    const oldLink = oldCode ? await ShortLink.findOne({ code: oldCode }).select('target') : null;
    const target = oldLink?.target ?? (msg.incidentId ? `/incidents/${msg.incidentId}` : undefined);
    if (params.length >= 3 && target) {
      const short = await createShortLink({ target, recipientUserId: msg.recipientUserId, incidentId: msg.incidentId });
      params[2] = short.url;
      linkCode = short.code;
    }
    const result = await sendWhatsappTemplateChecked(number, msg.templateName, params, {
      linkCode,
      recipientUserId: msg.recipientUserId,
      recipientName: msg.recipientName,
      notificationKey: msg.notificationKey,
      incidentId: msg.incidentId,
      incidentNumber: msg.incidentNumber,
      resendOf: String(msg._id),
    });
    if (!result.ok) throw AppError.badRequest(`WATI did not accept the message: ${result.error}`);
    sendSuccess(res, { messageId: result.messageId }, `Sent again to ${msg.recipientName || `+${number}`}`);
  } catch (error) {
    next(error);
  }
};

/** GET /whatsapp-delivery/messages/:id/link-events — every tap / open of the link in a message. */
export const getMessageLinkEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = oid(req.params.id as string);
    if (!id) throw AppError.badRequest('Invalid message');
    const events = await LinkEvent.find({ messageId: id }).sort({ at: -1 }).limit(200).populate('userId', 'name employeeId').lean();
    sendSuccess(
      res,
      events.map((e: any) => ({
        _id: String(e._id),
        kind: e.kind,
        at: e.at,
        ip: e.ip,
        device: e.device,
        deviceLabel: deviceLabel(e.device || {}),
        language: e.language,
        user: e.userId ? { _id: String(e.userId._id), name: e.userId.name, employeeId: e.userId.employeeId } : null,
        isRecipient: e.isRecipient ?? null,
        screen: e.screen,
        timezone: e.timezone,
        installedApp: e.installedApp,
        userAgent: e.userAgent,
      }))
    );
  } catch (error) {
    next(error);
  }
};
