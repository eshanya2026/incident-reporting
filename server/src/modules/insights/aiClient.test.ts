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
import { activeAi, generateJson, generateReply, isQuotaError, modelChain } from './aiClient.js';

describe('modelChain', () => {
  it('puts the main model first and drops blanks and duplicates', () => {
    expect(modelChain('a', ' b, ,a,c ')).toEqual(['a', 'b', 'c']);
    expect(modelChain('a', '')).toEqual(['a']);
  });
});

describe('model fallback', () => {
  // A fake Gemini endpoint: each model either answers with `text` or fails with an HTTP status
  const fakeGemini = (byModel: Record<string, { status?: number; text?: string }>) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const model = decodeURIComponent(url.split('/models/')[1].split(':')[0]);
      calls.push(model);
      const r = byModel[model] ?? { status: 404 };
      return r.status
        ? { ok: false, status: r.status, json: async () => ({ error: { message: `fake ${r.status}` } }) }
        : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: r.text }] } }] }) };
    });
    return calls;
  };
  afterEach(() => vi.unstubAllGlobals());
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
    const calls = fakeGemini({ [first]: { status: 429 }, [second]: { status: 404 }, ...(third ? { [third]: { status: 429 } } : {}) });
    const err = await generateReply({ system: 's', messages: [{ role: 'user', content: 'q' }] }).catch((e) => e);
    expect(isQuotaError(err)).toBe(true);
    expect(calls).toEqual(activeAi().models);
  });
});
