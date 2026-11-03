import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// AI client for the Insights page. AI_PROVIDER picks Gemini (Google's API directly) or OpenRouter
// (OpenAI-compatible, any model). Only the server ever holds the key. Each request tries the main
// model first, then each fallback model in order, so one model's quota running out or an outage
// doesn't take the feature down.

/** Main model first, then fallbacks (comma-separated), without duplicates. */
export const modelChain = (primary: string, fallbacks: string): string[] =>
  [...new Set([primary, ...fallbacks.split(',')].map((m) => m.trim()).filter(Boolean))];

export const activeAi = (): { provider: 'gemini' | 'openrouter'; key: string; model: string; models: string[] } =>
  env.AI_PROVIDER === 'openrouter'
    ? {
        provider: 'openrouter',
        key: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        models: modelChain(env.OPENROUTER_MODEL, env.OPENROUTER_FALLBACK_MODELS),
      }
    : { provider: 'gemini', key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, models: modelChain(env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODELS) };

export const aiEnabled = (): boolean => Boolean(activeAi().key);

/** Pulls the JSON object out of a reply even if a model wrapped it in a ```json fence or prose. */
export const extractJson = (text: string): unknown => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('The AI reply did not contain JSON');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
};

/**
 * Gemini's responseSchema is an OpenAPI subset: uppercase type names, and no
 * additionalProperties. Converts the standard JSON Schema used for OpenRouter.
 */
export const toGeminiSchema = (schema: any): any => {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue;
    if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v as any).map(([pk, pv]) => [pk, toGeminiSchema(pv)]));
    else if (k === 'items') out.items = toGeminiSchema(v);
    else out[k] = v;
  }
  return out;
};

export class AiHttpError extends Error {
  constructor(
    public readonly status: number,
    detail?: string,
    /** Quota details from the provider, when it says which limit was hit and when to retry. */
    public readonly quota?: { perDay: boolean; retryAfterMs?: number }
  ) {
    super(`AI service returned ${status}: ${detail || 'unknown error'}`);
  }
}

/** Reads Gemini's 429 details: was it the daily allowance, and how long until a retry may work. */
export const quotaInfoFromGemini = (error: any): { perDay: boolean; retryAfterMs?: number } | undefined => {
  const details: any[] = Array.isArray(error?.details) ? error.details : [];
  const quotaIds = details.flatMap((d) => (d?.violations || []).map((v: any) => String(v?.quotaId || '')));
  const retry = details.find((d) => d?.retryDelay)?.retryDelay; // e.g. "34s"
  if (!quotaIds.length && !retry) return undefined;
  return {
    perDay: quotaIds.some((q) => /PerDay/i.test(q)),
    retryAfterMs: retry ? Math.ceil(parseFloat(String(retry)) * 1000) : undefined,
  };
};

// ---- Models that are out of allowance are skipped instead of being asked again every time ----

const cooldownUntil = new Map<string, number>();

/** Milliseconds until the provider's daily quotas reset (midnight Pacific time). */
export const msUntilPacificMidnight = (now = new Date()): number => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const secondsSinceMidnight = (get('hour') % 24) * 3600 + get('minute') * 60 + get('second'); // some runtimes print midnight as 24
  return (86_400 - secondsSinceMidnight) * 1000;
};

/**
 * After a failure, skip the model for a while so later questions don't wait on it again:
 * daily quota used up or model not available (404) -> until the daily reset; per-minute limit ->
 * the retry delay (at least a minute); busy / timed out -> two minutes.
 */
export const coolDown = (model: string, err: unknown, now = Date.now()): void => {
  let wait: number | undefined;
  if (err instanceof AiHttpError) {
    if (err.status === 429) wait = err.quota?.perDay ? msUntilPacificMidnight(new Date(now)) : Math.max(err.quota?.retryAfterMs ?? 0, 60_000);
    else if (err.status === 404) wait = msUntilPacificMidnight(new Date(now));
    else if (err.status >= 500) wait = 120_000;
  } else if (/took too long/i.test(String((err as any)?.message))) {
    wait = 120_000;
  }
  if (wait) cooldownUntil.set(model, now + wait);
};
export const isCoolingDown = (model: string, now = Date.now()): boolean => (cooldownUntil.get(model) ?? 0) > now;
/** For tests. */
export const resetCooldowns = (): void => cooldownUntil.clear();

// Overloaded / momentary server errors are worth another try after a short wait. 429 (quota or rate
// limit) is not: on a free tier every retry is itself counted, so retrying only burns the allowance.
const isRetryable = (err: unknown): boolean => err instanceof AiHttpError && [500, 502, 503, 504].includes(err.status);

/** True when the AI provider refused the request because a usage quota / rate limit was reached. */
export const isQuotaError = (err: unknown): boolean =>
  err instanceof AiHttpError && (err.status === 429 || /quota|rate limit/i.test(err.message));
const RETRY_DELAYS_MS = [3_000, 8_000, 15_000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface AiRequest {
  system: string;
  messages: ChatTurn[];
  temperature: number;
  /** Standard JSON Schema to force a structured reply (converted for Gemini automatically). */
  schema?: { name: string; schema: Record<string, unknown> };
  /** Ask a thinking model to think less, for faster conversational replies. */
  lightThinking?: boolean;
}

const noContent = (reason?: string) => new Error(`AI service returned no content${reason ? ` (${reason})` : ''}`);

const callGemini = async (req: AiRequest, key: string, model: string, signal: AbortSignal): Promise<string> => {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: {
        temperature: req.temperature,
        // Gemini 3 models take a thinking level; older ones would reject the field
        ...(req.lightThinking && /^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
        ...(req.schema ? { responseMimeType: 'application/json', responseSchema: toGeminiSchema(req.schema.schema) } : {}),
      },
    }),
    signal,
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) throw new AiHttpError(res.status, body?.error?.message, quotaInfoFromGemini(body?.error));
  const usage = body?.usageMetadata;
  if (usage) {
    // Token use per request, to keep an eye on the provider's tokens-per-minute limit
    logger.info({ model, promptTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount, thinkingTokens: usage.thoughtsTokenCount }, 'AI tokens');
  }
  const candidate = body?.candidates?.[0];
  // Thinking models can return their reasoning as extra parts flagged `thought`; only the answer counts
  const text = (candidate?.content?.parts || [])
    .filter((p: any) => !p.thought)
    .map((p: any) => p.text || '')
    .join('');
  if (!text) throw noContent(candidate?.finishReason || body?.promptFeedback?.blockReason);
  return text;
};

const callOpenRouter = async (req: AiRequest, key: string, model: string, signal: AbortSignal): Promise<string> => {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      // Optional OpenRouter attribution headers
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Adhiparasakthi Incident Reporting',
    },
    body: JSON.stringify({
      model,
      temperature: req.temperature,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      ...(req.schema ? { response_format: { type: 'json_schema', json_schema: { name: req.schema.name, strict: true, schema: req.schema.schema } } } : {}),
    }),
    signal,
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) throw new AiHttpError(res.status, body?.error?.message);
  const text: string | undefined = body?.choices?.[0]?.message?.content;
  if (!text) throw noContent(body?.choices?.[0]?.finish_reason);
  return text;
};

/**
 * Sends the request to each model in the chain until one gives a usable reply (`accept` throws on
 * one that isn't, e.g. malformed JSON). A brief overload is retried on the same model first — more
 * patiently on the last model, since there's nothing left to fall back to. Any failure from a model
 * (quota, model unavailable, overload, timeout, blocked or unusable reply) moves on to the next one;
 * the last model's error is what surfaces if all of them fail.
 */
const complete = async <T>(req: AiRequest, accept: (text: string) => T, timeoutMs = 90_000): Promise<{ value: T; model: string }> => {
  const { provider, key, models } = activeAi();
  const call = provider === 'openrouter' ? callOpenRouter : callGemini;

  const tryModel = async (model: string, maxRetries: number): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return accept(await call(req, key, model, controller.signal));
      } catch (err: any) {
        if (err?.name === 'AbortError') throw new Error('The AI service is busy and took too long to respond. Please try again in a minute.');
        if (!isRetryable(err) || attempt >= maxRetries) throw err;
        await sleep(RETRY_DELAYS_MS[attempt]);
      } finally {
        clearTimeout(timer);
      }
    }
  };

  // Skip models known to be out of allowance; if every model is, try them all anyway (limits may have reset)
  const available = models.filter((m) => !isCoolingDown(m));
  const order = available.length ? available : models;

  let lastError: unknown;
  for (const [i, model] of order.entries()) {
    const isLast = i === order.length - 1;
    try {
      // Only the last option is retried; earlier ones hand over at once so a busy model costs one attempt
      return { value: await tryModel(model, isLast ? RETRY_DELAYS_MS.length : 0), model };
    } catch (err: any) {
      lastError = err;
      coolDown(model, err);
      if (!isLast) logger.warn({ model, next: order[i + 1], reason: String(err?.message).slice(0, 200) }, '⚠️ AI model failed, falling back');
    }
  }
  throw lastError;
};

/** One structured (JSON-schema) reply to a single prompt, and the model that produced it. */
export const generateJson = async (opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ value: unknown; model: string }> =>
  complete(
    { system: opts.system, messages: [{ role: 'user', content: opts.user }], temperature: 0.3, schema: { name: opts.schemaName, schema: opts.schema } },
    extractJson,
    opts.timeoutMs
  );

/** A plain-text reply that continues a conversation, and the model that produced it. */
export const generateReply = async (opts: { system: string; messages: ChatTurn[]; timeoutMs?: number }): Promise<{ value: string; model: string }> =>
  complete(
    { system: opts.system, messages: opts.messages, temperature: 0.2, lightThinking: true },
    (text) => {
      if (!text.trim()) throw new Error('AI service returned an empty reply');
      return text.trim();
    },
    opts.timeoutMs ?? 120_000
  );
