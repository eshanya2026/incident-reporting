import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AiInsight } from './insight.model.js';
import {
  DEFAULT_INSIGHT_PERIOD,
  INSIGHT_PERIODS,
  InsightFacts,
  InsightPeriod,
  InsightScope,
  loadFacts,
  scopeKeyOf,
  scopeLabelOf,
} from './insightFacts.js';
import { writeNarrative } from './insightNarrative.js';
import { activeAi, aiEnabled, isQuotaError } from './aiClient.js';
import { AiChatLog, CHAT_DAILY_LIMIT, CHAT_MAX_CHARS, CHAT_MAX_TURNS, answerQuestion } from './insightChat.js';
import { chatCoverage, loadChatDataset } from './chatDataset.js';
import { Department } from '../departments/department.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';
import { hasPermission } from '../../common/helpers/incidentAccess.js';
import { JwtPayload } from '../auth/auth.utils.js';
import { logger } from '../../config/logger.js';

// AI Insights: insights.view_all sees the whole hospital (optionally one department);
// insights.view_department sees the user's own department. Each scope/period gets one automatic AI analysis per day (generated in the
// background the first time anyone opens it that day) and one manual "Regenerate" per day.

const HOSPITAL_TIME_ZONE = 'Asia/Kolkata';
const dayKeyOf = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: HOSPITAL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const querySchema = z.object({
  period: z.enum(Object.keys(INSIGHT_PERIODS) as [InsightPeriod, ...InsightPeriod[]]).default(DEFAULT_INSIGHT_PERIOD),
  departmentId: z.string().optional(),
});

const resolveScope = async (user: JwtPayload, departmentId?: string): Promise<InsightScope> => {
  const deptScope = async (id: string): Promise<InsightScope> => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid department');
    const dept = await Department.findById(id).select('name').lean();
    if (!dept) throw AppError.notFound('Department not found');
    return { kind: 'DEPARTMENT', departmentId: id, departmentName: (dept as any).name };
  };

  if (hasPermission(user, PERMISSIONS.INSIGHTS_VIEW_ALL)) {
    return departmentId ? deptScope(departmentId) : { kind: 'HOSPITAL' };
  }
  if (hasPermission(user, PERMISSIONS.INSIGHTS_VIEW_DEPARTMENT)) {
    // Department-level access only ever sees the user's own department, whatever is asked for
    if (!user.departmentId) throw AppError.badRequest('Your account has no department');
    return deptScope(user.departmentId);
  }
  throw AppError.forbidden('You do not have access to AI Insights');
};

// One generation at a time per scope/period, so a burst of page opens can't fire several AI calls
const inFlight = new Map<string, Promise<void>>();
const flightKey = (scopeKey: string, period: string) => `${scopeKey}|${period}`;

const generate = (
  scope: InsightScope,
  period: InsightPeriod,
  trigger: 'AUTO' | 'MANUAL',
  userId: string,
  preloaded?: { facts: InsightFacts; privateNamesById: Map<string, string[]> }
): Promise<void> => {
  const scopeKey = scopeKeyOf(scope);
  const key = flightKey(scopeKey, period);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const run = (async () => {
    const now = new Date();
    const base = { scopeKey, period, dayKey: dayKeyOf(now), trigger, aiModel: activeAi().model, generatedBy: userId, generatedAt: now };
    try {
      const { facts, privateNamesById } = preloaded ?? (await loadFacts(scope, period));
      const { narrative, model } = await writeNarrative(facts, privateNamesById);
      await AiInsight.create({ ...base, aiModel: model, status: 'READY', narrative, facts, generatedAt: new Date() });
    } catch (err: any) {
      logger.error({ err, scopeKey, period, trigger }, '❌ AI insight generation failed');
      await AiInsight.create({ ...base, status: 'FAILED', error: String(err?.message || 'Unknown error').slice(0, 500) });
    }
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, run);
  return run;
};

const aiState = async (scopeKey: string, period: InsightPeriod) => {
  const today = dayKeyOf(new Date());
  const [latestReady, latestFailed, readyToday, autoFailedToday, manualToday] = await Promise.all([
    AiInsight.findOne({ scopeKey, period, status: 'READY' }).sort({ generatedAt: -1 }).populate('generatedBy', 'name').lean(),
    AiInsight.findOne({ scopeKey, period, status: 'FAILED' }).sort({ generatedAt: -1 }).lean(),
    AiInsight.exists({ scopeKey, period, dayKey: today, status: 'READY' }),
    AiInsight.exists({ scopeKey, period, dayKey: today, status: 'FAILED', trigger: 'AUTO' }),
    AiInsight.exists({ scopeKey, period, dayKey: today, status: 'READY', trigger: 'MANUAL' }),
  ]);
  return { latestReady: latestReady as any, latestFailed: latestFailed as any, readyToday: Boolean(readyToday), autoFailedToday: Boolean(autoFailedToday), manualToday: Boolean(manualToday) };
};

const buildView = async (scope: InsightScope, period: InsightPeriod, facts: InsightFacts) => {
  const scopeKey = scopeKeyOf(scope);
  const state = await aiState(scopeKey, period);
  const generating = inFlight.has(flightKey(scopeKey, period));
  const enabled = aiEnabled();
  const failedIsNewest =
    state.latestFailed && (!state.latestReady || new Date(state.latestFailed.generatedAt) > new Date(state.latestReady.generatedAt));

  let regenerateBlockedReason: string | null = null;
  if (!enabled) regenerateBlockedReason = 'AI is not configured on this server';
  else if (generating) regenerateBlockedReason = 'An analysis is being generated right now';
  else if (state.manualToday) regenerateBlockedReason = 'Already regenerated today. You can regenerate again tomorrow.';

  return {
    scope,
    period,
    facts,
    ai: {
      enabled,
      model: enabled ? activeAi().model : null,
      generating,
      insight: state.latestReady
        ? {
            narrative: state.latestReady.narrative,
            generatedAt: state.latestReady.generatedAt,
            trigger: state.latestReady.trigger,
            generatedByName: state.latestReady.trigger === 'MANUAL' ? state.latestReady.generatedBy?.name : null,
            model: state.latestReady.aiModel,
          }
        : null,
      lastError: failedIsNewest ? { at: state.latestFailed.generatedAt, message: state.latestFailed.error } : null,
      canRegenerate: !regenerateBlockedReason,
      regenerateBlockedReason,
    },
  };
};

/** GET /insights?period=6m&departmentId= — live facts plus the latest AI analysis. */
export const getInsights = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = querySchema.parse(req.query);
    const scope = await resolveScope(req.user!, q.departmentId);
    const loaded = await loadFacts(scope, q.period);

    // Today's automatic analysis, started in the background the first time it's needed
    if (aiEnabled()) {
      const state = await aiState(scopeKeyOf(scope), q.period);
      if (!state.readyToday && !state.autoFailedToday) {
        void generate(scope, q.period, 'AUTO', req.user!.userId, loaded);
      }
    }

    const view = await buildView(scope, q.period, loaded.facts);
    sendSuccess(res, view, 'Insights retrieved');
  } catch (error) {
    next(error);
  }
};

/** Questions left today, or null when there is no daily limit. */
const chatRemainingToday = async (userId: string): Promise<number | null> =>
  CHAT_DAILY_LIMIT > 0
    ? Math.max(0, CHAT_DAILY_LIMIT - (await AiChatLog.countDocuments({ userId, dayKey: dayKeyOf(new Date()), ok: true })))
    : null;

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(CHAT_MAX_CHARS) }))
    .min(1)
    .max(CHAT_MAX_TURNS * 2)
    .refine((m) => m[m.length - 1].role === 'user', 'The last message must be a question'),
});

/**
 * GET /insights/chat — what Ask AI covers for this user and how many questions are left today.
 * Ask AI is independent of the Insights page: it always covers every incident since the start,
 * in the asker's full scope (whole hospital, or their own department), whatever the page shows.
 */
export const getChatStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const scope = await resolveScope(req.user!);
    sendSuccess(res, {
      enabled: aiEnabled(),
      scope: { kind: scope.kind, key: scopeKeyOf(scope), label: scopeLabelOf(scope) },
      coverage: await chatCoverage(scope),
      dailyLimit: CHAT_DAILY_LIMIT > 0 ? CHAT_DAILY_LIMIT : null,
      patientDetails: hasPermission(req.user, PERMISSIONS.INSIGHTS_PATIENT_DETAILS),
      remainingToday: await chatRemainingToday(req.user!.userId),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /insights/chat { messages } — answers a question about every incident in the asker's scope,
 * from the beginning. Does not use the Insights page's period, department filter or figures.
 */
export const chatWithInsights = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = chatSchema.parse(req.body ?? {});
    const scope = await resolveScope(req.user!);
    if (!aiEnabled()) throw AppError.badRequest('AI is not configured on this server');

    const userId = req.user!.userId;
    const remaining = await chatRemainingToday(userId);
    if (remaining !== null && remaining <= 0) {
      throw new AppError(`You've reached today's limit of ${CHAT_DAILY_LIMIT} questions. It resets tomorrow.`, 429, 'CHAT_LIMIT');
    }

    // Recent turns only, starting with a question
    let messages = body.messages.slice(-CHAT_MAX_TURNS);
    while (messages.length && messages[0].role !== 'user') messages = messages.slice(1);
    const question = messages[messages.length - 1].content;
    const log = { userId, scopeKey: scopeKeyOf(scope), dayKey: dayKeyOf(new Date()), question: question.slice(0, CHAT_MAX_CHARS) };

    // The previous question and answer let a short follow-up ("who closed it?") stay on the same incidents
    const followUp = messages.slice(-3, -1).map((m) => m.content).join('\n');
    const { dataset, idByNumber } = await loadChatDataset(scope, {
      identify: hasPermission(req.user, PERMISSIONS.INSIGHTS_PATIENT_DETAILS),
      question,
      followUp,
    });
    try {
      const result = await answerQuestion({ scope, dataset, idByNumber, messages });
      await AiChatLog.create({ ...log, ok: true, aiModel: result.model });
      sendSuccess(res, { ...result, remainingToday: remaining === null ? null : remaining - 1 }, 'Answered');
    } catch (err: any) {
      logger.error({ err, scopeKey: log.scopeKey }, '❌ AI chat failed');
      await AiChatLog.create({ ...log, ok: false, error: String(err?.message || 'Unknown error').slice(0, 500) });
      if (isQuotaError(err)) {
        throw new AppError(
          "The AI's usage limit with the provider has been reached for now, so it can't answer. Please try again later, or ask your administrator to raise the AI plan's limits.",
          503,
          'AI_QUOTA'
        );
      }
      const busy = /\b503\b|high demand|overloaded|busy|took too long/i.test(String(err?.message));
      throw new AppError(
        busy ? 'The AI service is busy right now. Please try again in a minute.' : `The AI couldn't answer right now. ${err?.message || ''}`.trim(),
        busy ? 503 : 502,
        'AI_UNAVAILABLE'
      );
    }
  } catch (error) {
    next(error);
  }
};

/** POST /insights/regenerate { period, departmentId } — one manual regeneration per scope/period per day. */
export const regenerateInsights = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = querySchema.parse(req.body ?? {});
    const scope = await resolveScope(req.user!, q.departmentId);
    if (!aiEnabled()) throw AppError.badRequest('AI is not configured on this server');

    const scopeKey = scopeKeyOf(scope);
    const state = await aiState(scopeKey, q.period);
    if (state.manualToday) {
      throw new AppError('Already regenerated today. You can regenerate again tomorrow.', 429, 'REGENERATE_LIMIT');
    }

    const loaded = await loadFacts(scope, q.period);
    await generate(scope, q.period, 'MANUAL', req.user!.userId, loaded);
    sendSuccess(res, await buildView(scope, q.period, loaded.facts), 'Insights regenerated');
  } catch (error) {
    next(error);
  }
};
