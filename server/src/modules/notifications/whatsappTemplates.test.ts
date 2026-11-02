import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  WHATSAPP_TEMPLATES,
  fullMessageText,
  renderMessage,
  sampleValues,
  sessionMessageText,
  templateDefinition,
  validateContent,
} from './whatsappTemplates.js';

const hod = templateDefinition('HOD_ASSIGNED')!;
const values = {
  incident: 'INC-2026-000023 "Patient fall"',
  severity: 'Minor Harm (Level 2)',
  remarks: 'Check CCTV',
};

describe('WhatsApp message rendering', () => {
  it('builds the {{2}} block as before: bold title, message, then detail lines, on one line', () => {
    const r = renderMessage(hod.defaults, values);
    expect(r.content).toBe(
      '*New Incident Assigned* | A new incident has been assigned to your department by Quality. Please review promptly. | Incident: INC-2026-000023 "Patient fall" | Severity: Minor Harm (Level 2) | Quality\'s remarks: Check CCTV'
    );
    expect(r.content).not.toMatch(/[\r\n\t]/);
  });

  it('leaves out a detail line whose value is missing instead of sending it half-empty', () => {
    const r = renderMessage(hod.defaults, { ...values, remarks: '' });
    expect(r.details).toEqual(['Incident: INC-2026-000023 "Patient fall"', 'Severity: Minor Harm (Level 2)']);
    expect(r.content).not.toContain('remarks');
  });

  it('flattens line breaks in free text, which WATI would otherwise reject', () => {
    const r = renderMessage(hod.defaults, { ...values, remarks: 'Line one\n\nLine   two\tend' });
    expect(r.content).toContain("Quality's remarks: Line one Line two end");
  });

  it('cuts very long content short and says so', () => {
    const r = renderMessage({ title: 'T', message: 'x'.repeat(390), details: ['Incident: {incident}'] }, values);
    expect(r.truncated).toBe(true);
    expect(r.content.length).toBe(LIMITS.content);
    expect(r.content.endsWith('…')).toBe(true);
  });

  it('puts name, content and link into the approved template wrapper', () => {
    const text = fullMessageText('Dr. Ramesh', '*Hi* | there', 'https://x/incidents/1');
    expect(text.startsWith('Hello Dr. Ramesh,\n\n*Hi* | there\n\n')).toBe(true);
    expect(text).toContain('https://x/incidents/1');
  });

  it('builds a readable multi-line session fallback', () => {
    const r = renderMessage(hod.defaults, values);
    expect(sessionMessageText(r, 'L')).toBe(`*New Incident Assigned*\n${r.message}\n${r.details.join('\n')}\n\nOpen: L`);
  });
});

describe('WhatsApp message validation', () => {
  it('accepts every default wording', () => {
    for (const def of WHATSAPP_TEMPLATES) expect(validateContent(def, def.defaults)).toEqual([]);
  });

  it('rejects placeholders that message does not have', () => {
    const problems = validateContent(hod, { ...hod.defaults, message: 'Meeting at {meetingTime}' });
    expect(problems.join(' ')).toContain('{meetingTime}');
  });

  it('rejects an empty title or message and overlong text', () => {
    expect(validateContent(hod, { title: ' ', message: '', details: [] })).toHaveLength(2);
    expect(validateContent(hod, { ...hod.defaults, details: ['x'.repeat(LIMITS.detailLine + 1)] })).toHaveLength(1);
  });

  it('has a sample for every placeholder, so previews never show a gap', () => {
    for (const def of WHATSAPP_TEMPLATES) {
      const r = renderMessage(def.defaults, sampleValues(def));
      expect(r.details.length).toBe(def.defaults.details.length);
      expect(r.content).not.toMatch(/\{\w+\}/);
    }
  });
});
