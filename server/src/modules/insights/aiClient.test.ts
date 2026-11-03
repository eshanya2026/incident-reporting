import { describe, expect, it } from 'vitest';
import { extractJson, toGeminiSchema } from './aiClient.js';

describe('toGeminiSchema', () => {
  it('uppercases types and drops additionalProperties at every level', () => {
    const out = toGeminiSchema({
      type: 'object',
      additionalProperties: false,
      required: ['list'],
      properties: {
        list: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { p: { type: 'string', enum: ['HIGH', 'LOW'] } } } },
      },
    });
    expect(out).toEqual({
      type: 'OBJECT',
      required: ['list'],
      properties: { list: { type: 'ARRAY', items: { type: 'OBJECT', properties: { p: { type: 'STRING', enum: ['HIGH', 'LOW'] } } } } },
    });
  });
});

describe('extractJson', () => {
  it('reads plain JSON and JSON wrapped in a code fence', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('fails clearly when there is no JSON', () => {
    expect(() => extractJson('sorry, I cannot help')).toThrow('did not contain JSON');
  });
});

import { afterEach, vi } from 'vitest';
import { activeAi, generateJson, generateReply, isQuotaError, modelChain, quotaInfoFromGemini, msUntilPacificMidnight, resetCooldowns } from './aiClient.js';

describe('modelChain', () => {
  it('puts the main model first and drops blanks and duplicates', () => {
    expect(modelChain('a', ' b, ,a,c ')).toEqual(['a', 'b', 'c']);
    expect(modelChain('a', '')).toEqual(['a']);
  });
});

describe('model fallback', () => {
  // A fake Gemini endpoint: each model either answers with `text` or fails with an HTTP status
  const fakeGemini = (byModel: Record<string, { status?: number; text?: string; error?: any }>) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const model = decodeURIComponent(url.split('/models/')[1].split(':')[0]);
      calls.push(model);
      const r = byModel[model] ?? { status: 404 };
      return r.status
        ? { ok: false, status: r.status, json: async () => ({ error: { message: `fake ${r.status}`, ...r.error } }) }
        : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: r.text }] } }] }) };
    });
    return calls;
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    resetCooldowns();
  });
  const [first, second, third] = activeAi().models;

  it('falls back to the next model when the main one is out of quota', async () => {
    const calls = fakeGemini({ [first]: { status: 429 }, [second]: { text: 'answer from fallback' } });
    const res = await generateReply({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(res).toEqual({ value: 'answer from fallback', model: second });
    expect(calls).toEqual([first, second]); // no retry of a quota error
  });

  it('falls back when a model returns unusable JSON', async () => {
    fakeGemini({ [first]: { text: 'not json at all' }, [second]: { text: '{"ok":true}' } });
    const res = await generateJson({ system: 's', user: 'u', schemaName: 'x', schema: { type: 'object' } });
    expect(res).toEqual({ value: { ok: true }, model: second });
  });

  it('reports the last model\'s error when every model fails', async () => {
    const models = activeAi().models;
    const calls = fakeGemini(Object.fromEntries(models.map((m, i) => [m, { status: i === 1 ? 404 : 429 }])));
    const err = await generateReply({ system: 's', messages: [{ role: 'user', content: 'q' }] }).catch((e) => e);
    expect(isQuotaError(err)).toBe(true);
    expect(calls).toEqual(models);
  });

  const dailyQuota = { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { retryDelay: '30s' }] };

  it('skips a model that has used up its daily allowance on later questions', async () => {
    let calls = fakeGemini({ [first]: { status: 429, error: dailyQuota }, [second]: { text: 'ok' } });
    await generateReply({ system: 's', messages: [{ role: 'user', content: 'q1' }] });
    expect(calls).toEqual([first, second]);
    calls = fakeGemini({ [first]: { text: 'should not be asked' }, [second]: { text: 'ok again' } });
    const res = await generateReply({ system: 's', messages: [{ role: 'user', content: 'q2' }] });
    expect(res.model).toBe(second);
    expect(calls).toEqual([second]);
  });

  it('still tries every model when all of them are cooling down', async () => {
    const models = activeAi().models;
    fakeGemini(Object.fromEntries(models.map((m) => [m, { status: 429, error: dailyQuota }])));
    await generateReply({ system: 's', messages: [{ role: 'user', content: 'q' }] }).catch(() => undefined);
    const calls = fakeGemini({ [third ?? second]: { text: 'quota reset' } });
    const res = await generateReply({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(res.value).toBe('quota reset');
    expect(calls[0]).toBe(first);
  });
});

describe('quota details', () => {
  it('tells a daily limit from a per-minute one, with the retry delay', () => {
    expect(
      quotaInfoFromGemini({ details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { retryDelay: '34.5s' }] })
    ).toEqual({ perDay: true, retryAfterMs: 34500 });
    expect(quotaInfoFromGemini({ details: [{ violations: [{ quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier' }] }] })).toEqual({
      perDay: false,
      retryAfterMs: undefined,
    });
    expect(quotaInfoFromGemini({ message: 'other' })).toBeUndefined();
  });

  it('counts down to midnight Pacific time', () => {
    // 2026-11-03 23:00 Pacific (PST, UTC-8) = 2026-11-04 07:00 UTC: one hour to go
    expect(msUntilPacificMidnight(new Date('2026-11-04T07:00:00Z'))).toBe(3_600_000);
  });
});

