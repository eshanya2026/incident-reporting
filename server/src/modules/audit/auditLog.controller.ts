import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AuditLog, AUDIT_CATEGORIES, AuditCategory } from './audit.model.js';
import { UserSession, ONLINE_WINDOW_MS, SESSION_STALE_MS } from './session.model.js';
import { endSession } from './session.service.js';
import { categoryOf, logActivity } from './audit.service.js';
import { User } from '../users/user.model.js';
import { Incident } from '../incidents/incident.model.js';
import { Department } from '../departments/department.model.js';
import { AiChatLog } from '../insights/insightChat.js';
import { TRANSITIONS } from '../incidents/incidentWorkflow.rules.js';
import { verifyAccessToken } from '../auth/auth.utils.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { clientInfo, runWithContext } from '../../common/context/requestContext.js';

// Super Admin audit log: who did what, when, from where, and how long they were active.
// Everything here is read-only except forcing a session to sign out.

const oid = (v?: string) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : undefined);
const DAY = 24 * 60 * 60 * 1000;

// ---------- Filters ----------

const filterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  sessionId: z.string().optional(),
  /** Comma-separated categories; empty = all except presence. */
  categories: z.string().optional(),
  /** Include tab switches, idle and window-closed events. */
  presence: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(100).optional(),
});
type Filters = z.infer<typeof filterSchema> & { from: Date; to: Date };

const parseFilters = (req: Request): Filters => {
  const f = filterSchema.parse(req.query);
  const to = f.to ?? new Date();
  const from = f.from ?? new Date(to.getTime() - 7 * DAY);
  if (from > to) throw AppError.badRequest('"From" must be before "To"');
  return { ...f, from, to };
};

/** Users in a department (for the department filter). */
const usersOfDepartment = async (departmentId?: string) =>
  departmentId ? (await User.find({ departmentId: oid(departmentId) }).select('_id').lean()).map((u) => u._id) : undefined;

const eventMatch = async (f: Filters, opts: { includePresence?: boolean } = {}) => {
  const match: Record<string, any> = { timestamp: { $gte: f.from, $lte: f.to } };
  if (f.userId) match.userId = oid(f.userId);
  const deptUsers = await usersOfDepartment(f.departmentId);
  if (deptUsers) match.userId = f.userId ? oid(f.userId) : { $in: deptUsers };
  if (f.sessionId) match.sessionId = oid(f.sessionId);
  const chosen = (f.categories || '')
    .split(',')
    .map((c) => c.trim())
    .filter((c): c is AuditCategory => (AUDIT_CATEGORIES as readonly string[]).includes(c));
  const withPresence = opts.includePresence ?? f.presence === 'true';
  const categories = chosen.length ? chosen : AUDIT_CATEGORIES.filter((c) => c !== 'presence');
  const finalCats = withPresence ? [...new Set([...categories, 'presence'])] : categories.filter((c) => c !== 'presence');
  // Older entries were written before categories existed: include them under their derived category
  match.$or = [{ category: { $in: finalCats } }, { category: { $exists: false } }];
  if (f.search) {
    const re = { $regex: f.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    match.$and = [{ $or: [{ summary: re }, { action: re }, { 'meta.incidentNumber': re }] }];
  }
  return match;
};

const sessionMatch = async (f: Filters) => {
  const match: Record<string, any> = { startedAt: { $lte: f.to }, lastSeenAt: { $gte: f.from } };
  if (f.userId) match.userId = oid(f.userId);
  const deptUsers = await usersOfDepartment(f.departmentId);
  if (deptUsers && !f.userId) match.userId = { $in: deptUsers };
  if (f.sessionId) match._id = oid(f.sessionId);
  return match;
};

// ---------- Describing entries ----------

const humanize = (action: string) =>
  action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

type LookupMaps = {
  incidents: Map<string, { number: string; title: string; uhid?: string }>;
  departments: Map<string, string>;
  users: Map<string, string>;
};

const buildLookups = async (logs: any[]): Promise<LookupMaps> => {
  const incidentIds = new Set<string>();
  const deptIds = new Set<string>();
  const userIds = new Set<string>();
  for (const l of logs) {
    if (l.entityType === 'INCIDENT' && l.entityId) incidentIds.add(String(l.entityId));
    if (l.entityType === 'DEPARTMENT' && l.entityId) deptIds.add(String(l.entityId));
    if (l.newValue?.departmentId) deptIds.add(String(l.newValue.departmentId));
    if (l.newValue?.hodUserId) userIds.add(String(l.newValue.hodUserId));
  }
  const [incidents, departments, users] = await Promise.all([
    Incident.find({ _id: { $in: [...incidentIds].map(oid) } }).select('incidentNumber title patient.uhid').lean(),
    Department.find({ _id: { $in: [...deptIds].map(oid) } }).select('name').lean(),
    User.find({ _id: { $in: [...userIds].map(oid) } }).select('name').lean(),
  ]);
  return {
    incidents: new Map(incidents.map((i: any) => [String(i._id), { number: i.incidentNumber, title: i.title, uhid: i.patient?.uhid }])),
    departments: new Map(departments.map((d: any) => [String(d._id), d.name])),
    users: new Map(users.map((u: any) => [String(u._id), u.name])),
  };
};

const describe = (l: any, maps: LookupMaps): string => {
  if (l.summary) return l.summary;
  const inc = l.entityType === 'INCIDENT' ? maps.incidents.get(String(l.entityId)) : undefined;
  const ref = inc ? `${inc.number}${inc.title ? ` "${inc.title}"` : ''}` : '';
  const action: string = l.action;
  if (action === 'INCIDENT_SUBMITTED') return `Reported ${ref || 'an incident'}`;
  if (action.startsWith('INCIDENT_')) {
    const step = action.replace(/^INCIDENT_/, '');
    const rule = (TRANSITIONS as any)[step];
    if (step === 'ASSIGN') {
      const dept = maps.departments.get(String(l.newValue?.departmentId));
      return `Assigned ${ref}${dept ? ` to ${dept}` : ''}${l.newValue?.severity ? ` (severity ${l.newValue.severity})` : ''}`;
    }
    return `${rule?.label ?? humanize(step)}${ref ? ` · ${ref}` : ''}`;
  }
  if (action === 'DEPARTMENT_HOD_CHANGED' || action === 'DEPARTMENT_HOD_REMOVED') {
    const dept = maps.departments.get(String(l.entityId)) || 'a department';
    const who = maps.users.get(String(l.newValue?.hodUserId));
    return action === 'DEPARTMENT_HOD_REMOVED' ? `Removed the HOD of ${dept}` : `Made ${who || 'a user'} HOD of ${dept}`;
  }
  return `${humanize(action)}${ref ? ` · ${ref}` : ''}`;
};

const userShape = (u: any) =>
  u
    ? {
        _id: String(u._id),
        name: u.name,
        username: u.username,
        employeeId: u.employeeId,
        designation: u.designation,
        roles: (u.roles || []).map((r: any) => r.name || r.code).filter(Boolean),
        department: u.departmentId?.name,
        departmentId: u.departmentId?._id ? String(u.departmentId._id) : undefined,
      }
    : null;

const populateUser = (q: any) =>
  q.populate({ path: 'userId', select: 'name username employeeId designation roles departmentId', populate: [{ path: 'roles', select: 'name code' }, { path: 'departmentId', select: 'name' }] });

const shapeEvent = (l: any, maps: LookupMaps) => {
  const inc = l.entityType === 'INCIDENT' ? maps.incidents.get(String(l.entityId)) : undefined;
  return {
    _id: String(l._id),
    at: l.timestamp,
    action: l.action,
    category: l.category ?? categoryOf(l.action),
    description: describe(l, maps),
    user: userShape(l.userId),
    sessionId: l.sessionId ? String(l.sessionId) : undefined,
    ipAddress: l.ipAddress,
    userAgent: l.userAgent,
    incidentNumber: inc?.number ?? l.meta?.incidentNumber,
    incidentId: inc ? String(l.entityId) : undefined,
    uhid: inc?.uhid,
    screen: l.meta?.screen,
    durationMs: l.meta?.durationMs,
    details: { meta: l.meta, previousValue: l.previousValue, newValue: l.newValue, entityType: l.entityType, entityId: l.entityId },
  };
};

// ---------- Endpoints ----------

/** GET /audit/summary — the metric tiles for the selected window. */
export const getAuditSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const f = parseFilters(req);
    if (req.query.opened === '1') {
      await logActivity('AUDIT_LOG_OPENED', 'Opened the audit log', { req });
    }
    const base = await eventMatch({ ...f, categories: undefined, sessionId: undefined }, { includePresence: true });
    delete base.$or;
    const sMatch = await sessionMatch(f);

    const [counts, distinctEventUsers, sessionAgg, onlineNow] = await Promise.all([
      AuditLog.aggregate([{ $match: base }, { $group: { _id: '$action', n: { $sum: 1 }, pdf: { $sum: { $cond: [{ $eq: ['$meta.pdf', true] }, 1, 0] } } } }]),
      AuditLog.distinct('userId', { ...base, action: { $nin: ['LOGIN_FAILED'] } }),
      UserSession.aggregate([
        { $match: sMatch },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            users: { $addToSet: '$userId' },
            activeMs: { $sum: '$activeMs' },
            idleMs: { $sum: '$idleMs' },
            awayMs: { $sum: '$awayMs' },
          },
        },
      ]),
      UserSession.countDocuments({
        ...(sMatch.userId ? { userId: sMatch.userId } : {}),
        endedAt: { $exists: false },
        lastSeenAt: { $gte: new Date(Date.now() - ONLINE_WINDOW_MS) },
      }),
    ]);
    const n = (action: string) => counts.find((c) => c._id === action)?.n ?? 0;
    const s = sessionAgg[0] ?? { sessions: 0, users: [], activeMs: 0, idleMs: 0, awayMs: 0 };
    const people = new Set([...distinctEventUsers.filter(Boolean).map(String), ...s.users.map(String)]);
    const incidentActions = counts.filter((c) => categoryOf(c._id) === 'incident').reduce((a, c) => a + c.n, 0);
    const downloads = counts.filter((c) => categoryOf(c._id) === 'export').reduce((a, c) => a + c.n, 0);

    sendSuccess(res, {
      from: f.from,
      to: f.to,
      peopleActive: people.size,
      sessions: s.sessions,
      onlineNow,
      activeMs: s.activeMs,
      idleMs: s.idleMs,
      awayMs: s.awayMs,
      incidentActions,
      whatsappSent: n('WHATSAPP_SENT') + n('WHATSAPP_TEMPLATE_TEST_SENT'),
      whatsappFailed: n('WHATSAPP_FAILED'),
      pdfsOpened: n('INCIDENT_REPORT_PDF_DOWNLOADED') + (counts.find((c) => c._id === 'ATTACHMENT_OPENED')?.pdf ?? 0),
      downloads,
      aiQuestions: n('AI_QUESTION') + n('AI_QUESTION_FAILED'),
      failedSignIns: n('LOGIN_FAILED'),
    });
  } catch (error) {
    next(error);
  }
};

/** GET /audit/events — the timeline, newest first, 100 at a time (cursor = `before` id). */
export const getAuditEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const f = parseFilters(req);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const match = await eventMatch(f);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    if (before) {
      const cursor = await AuditLog.findById(oid(before)).select('timestamp').lean();
      if (cursor) {
        match.$and = [
          ...(match.$and || []),
          { $or: [{ timestamp: { $lt: cursor.timestamp } }, { timestamp: cursor.timestamp, _id: { $lt: cursor._id } }] },
        ];
      }
    }
    const logs = await populateUser(AuditLog.find(match).sort({ timestamp: -1, _id: -1 }).limit(limit + 1)).lean();
    const page = logs.slice(0, limit);
    const maps = await buildLookups(page);
    sendSuccess(res, {
      items: page.map((l: any) => shapeEvent(l, maps)),
      nextCursor: logs.length > limit ? String(page[page.length - 1]._id) : null,
    });
  } catch (error) {
    next(error);
  }
};

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /audit/events/export — the filtered timeline as CSV (up to 20,000 rows). */
export const exportAuditEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const f = parseFilters(req);
    const logs = await populateUser(AuditLog.find(await eventMatch(f)).sort({ timestamp: -1 }).limit(20000)).lean();
    const maps = await buildLookups(logs);
    const ist = (d: Date) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    const header = ['Time (IST)', 'Category', 'Action', 'Description', 'Name', 'Username', 'Employee ID', 'Department', 'Incident', 'IP address', 'Device', 'Session'];
    const lines = [header.join(',')];
    for (const l of logs) {
      const e = shapeEvent(l, maps);
      lines.push(
        [ist(e.at), e.category, e.action, e.description, e.user?.name, e.user?.username, e.user?.employeeId, e.user?.department, e.incidentNumber, e.ipAddress, e.userAgent, e.sessionId]
          .map(csvCell)
          .join(',')
      );
    }
    await logActivity('AUDIT_EXPORTED', `Exported the audit log (CSV, ${logs.length} rows)`, { req, meta: { rows: logs.length, format: 'CSV', from: f.from, to: f.to } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + lines.join('\n'));
  } catch (error) {
    next(error);
  }
};

/** Per-person totals for the window (People tab; Departments tab sums these). */
const peopleRows = async (f: Filters) => {
  const eMatch = await eventMatch({ ...f, categories: undefined, sessionId: undefined }, { includePresence: false });
  delete eMatch.$or;
  eMatch.category = { $ne: 'presence' };
  eMatch.userId = eMatch.userId ?? { $exists: true, $ne: null };
  const [eventAgg, sessionAgg] = await Promise.all([
    AuditLog.aggregate([
      { $match: eMatch },
      {
        $group: {
          _id: '$userId',
          actions: { $sum: { $cond: [{ $in: ['$action', ['LOGIN_FAILED', 'SCREEN_OPENED']] }, 0, 1] } },
          screens: { $sum: { $cond: [{ $eq: ['$action', 'SCREEN_OPENED'] }, 1, 0] } },
          incidentActions: { $sum: { $cond: [{ $eq: ['$category', 'incident'] }, 1, 0] } },
          whatsappSent: { $sum: { $cond: [{ $in: ['$action', ['WHATSAPP_SENT', 'WHATSAPP_TEMPLATE_TEST_SENT']] }, 1, 0] } },
          whatsappFailed: { $sum: { $cond: [{ $eq: ['$action', 'WHATSAPP_FAILED'] }, 1, 0] } },
          pdfs: {
            $sum: {
              $cond: [{ $or: [{ $eq: ['$action', 'INCIDENT_REPORT_PDF_DOWNLOADED'] }, { $and: [{ $eq: ['$action', 'ATTACHMENT_OPENED'] }, { $eq: ['$meta.pdf', true] }] }] }, 1, 0],
            },
          },
          downloads: { $sum: { $cond: [{ $eq: ['$category', 'export'] }, 1, 0] } },
          aiQuestions: { $sum: { $cond: [{ $in: ['$action', ['AI_QUESTION', 'AI_QUESTION_FAILED']] }, 1, 0] } },
          failedSignIns: { $sum: { $cond: [{ $eq: ['$action', 'LOGIN_FAILED'] }, 1, 0] } },
          lastEventAt: { $max: '$timestamp' },
        },
      },
    ]),
    UserSession.aggregate([
      { $match: await sessionMatch({ ...f, sessionId: undefined }) },
      {
        $group: {
          _id: '$userId',
          sessions: { $sum: 1 },
          firstSignIn: { $min: '$startedAt' },
          lastSeen: { $max: '$lastSeenAt' },
          activeMs: { $sum: '$activeMs' },
          idleMs: { $sum: '$idleMs' },
          awayMs: { $sum: '$awayMs' },
          online: {
            $sum: { $cond: [{ $and: [{ $not: ['$endedAt'] }, { $gte: ['$lastSeenAt', new Date(Date.now() - ONLINE_WINDOW_MS)] }] }, 1, 0] },
          },
        },
      },
    ]),
  ]);
  const ids = [...new Set([...eventAgg.map((e) => String(e._id)), ...sessionAgg.map((s) => String(s._id))])];
  const users = await User.find({ _id: { $in: ids.map(oid) } })
    .select('name username employeeId designation roles departmentId')
    .populate('roles', 'name code')
    .populate('departmentId', 'name')
    .lean();
  const byUser = new Map(users.map((u: any) => [String(u._id), u]));
  return ids
    .map((id) => {
      const e: any = eventAgg.find((x) => String(x._id) === id) ?? {};
      const s: any = sessionAgg.find((x) => String(x._id) === id) ?? {};
      return {
        user: (userShape(byUser.get(id)) ?? { _id: id, name: 'Unknown user' }) as any,
        sessions: s.sessions ?? 0,
        online: (s.online ?? 0) > 0,
        firstSignIn: s.firstSignIn,
        lastSeen: [s.lastSeen, e.lastEventAt].filter(Boolean).sort((a: Date, b: Date) => +new Date(b) - +new Date(a))[0],
        activeMs: s.activeMs ?? 0,
        idleMs: s.idleMs ?? 0,
        awayMs: s.awayMs ?? 0,
        actions: e.actions ?? 0,
        screens: e.screens ?? 0,
        incidentActions: e.incidentActions ?? 0,
        whatsappSent: e.whatsappSent ?? 0,
        whatsappFailed: e.whatsappFailed ?? 0,
        pdfs: e.pdfs ?? 0,
        downloads: e.downloads ?? 0,
        aiQuestions: e.aiQuestions ?? 0,
        failedSignIns: e.failedSignIns ?? 0,
      };
    })
    .sort((a, b) => +new Date(b.lastSeen || 0) - +new Date(a.lastSeen || 0));
};

/** GET /audit/people — activity per person. */
export const getAuditPeople = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    sendSuccess(res, await peopleRows(parseFilters(req)));
  } catch (error) {
    next(error);
  }
};

/** GET /audit/departments — activity per department (sum of its people). */
export const getAuditDepartments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rows = await peopleRows({ ...parseFilters(req), userId: undefined });
    const byDept = new Map<string, any>();
    for (const r of rows) {
      const key = r.user.departmentId ?? 'none';
      const d =
        byDept.get(key) ??
        byDept
          .set(key, {
            departmentId: r.user.departmentId ?? null,
            department: r.user.department ?? 'No department',
            people: 0,
            sessions: 0,
            activeMs: 0,
            idleMs: 0,
            awayMs: 0,
            actions: 0,
            incidentActions: 0,
            whatsappSent: 0,
            whatsappFailed: 0,
            pdfs: 0,
            downloads: 0,
            aiQuestions: 0,
            failedSignIns: 0,
          })
          .get(key);
      d.people += 1;
      for (const k of ['sessions', 'activeMs', 'idleMs', 'awayMs', 'actions', 'incidentActions', 'whatsappSent', 'whatsappFailed', 'pdfs', 'downloads', 'aiQuestions', 'failedSignIns']) {
        d[k] += (r as any)[k] || 0;
      }
    }
    sendSuccess(res, [...byDept.values()].sort((a, b) => b.actions - a.actions || b.activeMs - a.activeMs));
  } catch (error) {
    next(error);
  }
};

const sessionStatus = (s: any) => {
  if (s.endedAt) return { status: 'ended', endedAt: s.endedAt, endReason: s.endReason };
  if (Date.now() - new Date(s.lastSeenAt).getTime() < ONLINE_WINDOW_MS) return { status: 'online' };
  if (Date.now() - new Date(s.lastSeenAt).getTime() > SESSION_STALE_MS) return { status: 'ended', endedAt: s.lastSeenAt, endReason: 'expired' };
  return { status: 'inactive' };
};

/** GET /audit/sessions — every sign-in in the window, newest first. */
export const getAuditSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const f = parseFilters(req);
    const sessions = await populateUser(UserSession.find(await sessionMatch(f)).sort({ startedAt: -1 }).limit(500)).lean();
    sendSuccess(
      res,
      sessions.map((s: any) => {
        const st = sessionStatus(s);
        const end = st.status === 'ended' ? new Date(st.endedAt) : new Date(s.lastSeenAt);
        return {
          _id: String(s._id),
          user: userShape(s.userId),
          startedAt: s.startedAt,
          lastSeenAt: s.lastSeenAt,
          ...st,
          lengthMs: Math.max(0, end.getTime() - new Date(s.startedAt).getTime()),
          activeMs: s.activeMs,
          idleMs: s.idleMs,
          awayMs: s.awayMs,
          state: s.state,
          device: s.device,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          current: String(s._id) === req.user?.sid,
        };
      })
    );
  } catch (error) {
    next(error);
  }
};

/** POST /audit/sessions/:id/end — force a session to sign out (its tokens stop working at once). */
export const forceEndSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await UserSession.findById(oid(req.params.id as string)).populate('userId', 'name employeeId');
    if (!session) throw AppError.notFound('Session not found');
    if (String(session._id) === req.user?.sid) throw AppError.badRequest('This is your own current session. Use Sign out instead.');
    if (session.endedAt) throw AppError.badRequest('This session has already ended');
    await endSession(String(session._id), 'forced', req.user!.userId);
    const target: any = session.userId;
    await logActivity('FORCE_SIGN_OUT', `Forced ${target?.name ?? 'a user'} to sign out`, {
      req,
      entityType: 'USER',
      entityId: String(target?._id),
      meta: { targetUserId: String(target?._id), endedSessionId: String(session._id) },
    });
    sendSuccess(res, null, 'Session ended');
  } catch (error) {
    next(error);
  }
};

/** GET /audit/ai-chats — Ask AI conversations, grouped by chat, with the verbatim dialogue. */
export const getAuditAiChats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const f = parseFilters(req);
    const match: Record<string, any> = { askedAt: { $gte: f.from, $lte: f.to } };
    if (f.userId) match.userId = oid(f.userId);
    const deptUsers = await usersOfDepartment(f.departmentId);
    if (deptUsers && !f.userId) match.userId = { $in: deptUsers };
    const logs = await populateUser(AiChatLog.find(match).sort({ askedAt: 1 }).limit(3000)).lean();

    const threads = new Map<string, any>();
    for (const l of logs as any[]) {
      // Questions asked before chats were tracked have no thread: each is its own conversation
      const key = l.threadId ? `${l.threadId}:${l.userId?._id}` : `single:${l._id}`;
      const t =
        threads.get(key) ??
        threads
          .set(key, { threadId: l.threadId ?? null, user: userShape(l.userId), startedAt: l.askedAt, lastAt: l.askedAt, turns: [] as any[] })
          .get(key);
      t.lastAt = l.askedAt;
      t.turns.push({
        question: l.question,
        answer: l.answer,
        at: l.askedAt,
        ok: l.ok,
        error: l.error,
        model: l.aiModel,
        usedFallback: l.usedFallback,
        lookups: l.lookups || [],
      });
    }
    const list = [...threads.values()]
      .map((t) => ({ ...t, openingQuestion: t.turns[0]?.question, turnCount: t.turns.length }))
      .sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt))
      .slice(0, 200);
    sendSuccess(res, list);
  } catch (error) {
    next(error);
  }
};

// ---------- Activity sent by the app (screens and presence) ----------

/** Actions the browser may report, and their category. Anything else is ignored. */
const CLIENT_ACTIONS: Record<string, AuditCategory> = {
  SCREEN_OPENED: 'screen',
  INCIDENT_OPENED: 'report',
  AI_CHAT_OPENED: 'ai',
  AI_CHAT_CLOSED: 'ai',
  PRESENCE_TAB_HIDDEN: 'presence',
  PRESENCE_TAB_VISIBLE: 'presence',
  PRESENCE_IDLE: 'presence',
  PRESENCE_ACTIVE: 'presence',
  PRESENCE_WINDOW_CLOSED: 'presence',
};
const HEARTBEAT_CAP_MS = 2.5 * 60 * 1000; // never credit more than this per heartbeat

const activitySchema = z.object({
  events: z
    .array(
      z.object({
        action: z.string().max(40),
        summary: z.string().trim().max(300),
        at: z.coerce.date().optional(),
        meta: z.record(z.any()).optional(),
      })
    )
    .max(50)
    .optional()
    .default([]),
  presence: z
    .object({
      activeMs: z.number().min(0).max(HEARTBEAT_CAP_MS),
      idleMs: z.number().min(0).max(HEARTBEAT_CAP_MS),
      awayMs: z.number().min(0).max(HEARTBEAT_CAP_MS),
      state: z.enum(['active', 'idle', 'away']),
    })
    .optional(),
});

/** Browser-sent details: simple values only, 20 fields at most, strings cut to 300 characters. */
const cleanMeta = (meta?: Record<string, any>): Record<string, any> | undefined => {
  if (!meta) return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta).slice(0, 20)) {
    if (typeof v === 'string') out[k.slice(0, 40)] = v.slice(0, 300);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k.slice(0, 40)] = v;
  }
  return out;
};

const recordClientActivity = async (req: Request, user: { userId: string; sid?: string }, body: z.infer<typeof activitySchema>) => {
  const now = Date.now();
  const docs = body.events
    .filter((e) => CLIENT_ACTIONS[e.action])
    .map((e) => {
      const at = e.at && Math.abs(now - e.at.getTime()) < 10 * 60 * 1000 ? e.at : new Date();
      const meta = cleanMeta(e.meta);
      return {
        userId: oid(user.userId),
        sessionId: oid(user.sid),
        action: e.action,
        category: CLIENT_ACTIONS[e.action],
        summary: e.summary,
        meta,
        entityType: meta?.incidentId && oid(meta.incidentId) ? 'INCIDENT' : undefined,
        entityId: meta?.incidentId ? oid(meta.incidentId) : undefined,
        ...clientInfo(req),
        timestamp: at,
      };
    });
  if (docs.length) await AuditLog.insertMany(docs, { ordered: false }).catch(() => undefined);

  if (body.presence && user.sid) {
    const total = body.presence.activeMs + body.presence.idleMs + body.presence.awayMs;
    const scale = total > HEARTBEAT_CAP_MS ? HEARTBEAT_CAP_MS / total : 1;
    await UserSession.updateOne(
      { _id: oid(user.sid), userId: oid(user.userId), revoked: { $ne: true }, endReason: { $nin: ['logout', 'forced', 'password_changed', 'profile_completed'] } },
      {
        $inc: {
          activeMs: Math.round(body.presence.activeMs * scale),
          idleMs: Math.round(body.presence.idleMs * scale),
          awayMs: Math.round(body.presence.awayMs * scale),
        },
        $set: { lastSeenAt: new Date(), state: body.presence.state },
        $unset: { endedAt: 1, endReason: 1 },
      }
    );
  }
};

/** POST /audit/activity — screens opened and the minute-by-minute presence heartbeat (any signed-in user). */
export const postActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await recordClientActivity(req, req.user!, activitySchema.parse(req.body ?? {}));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /audit/activity/beacon — the last heartbeat when the window closes (navigator.sendBeacon
 * cannot send headers, so the access token comes in the body).
 */
export const postActivityBeacon = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = verifyAccessToken(String(raw?.token || ''));
    await runWithContext({ userId: payload.userId, sessionId: payload.sid }, () =>
      recordClientActivity(req, payload, activitySchema.parse(raw ?? {}))
    );
  } catch {
    /* expired token or bad body: nothing to record */
  }
  res.status(204).end();
};
