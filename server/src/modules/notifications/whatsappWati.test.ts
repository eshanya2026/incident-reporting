import { describe, expect, it } from 'vitest';
import { interpretWatiReply, providerIdsOf, toWhatsappId } from './whatsapp.js';

// Shape of WATI's real sendTemplateMessage reply for a contact it has just created (production
// log, 23 Nov 2026; number and ids replaced).
const newContactReply = {
  result: true,
  phone_number: '919000000001',
  template_name: 'incident_notification',
  contact: { id: '6b03c933f378c0138948640f', wAid: '919000000001', contactStatus: 'UNCONFIRMED', optedIn: false },
  model: { ids: ['6b03c933f378c0138948640f'] }, // the CONTACT's id
  validWhatsAppNumber: false,
  info: null,
  local_message_id: '418f43c3-dc4b-43c8-ac57-e5dacdfeeee6',
};

describe('reading WATI send replies', () => {
  it('an accepted message to a new contact is sent, not failed', () => {
    const v = interpretWatiReply(true, 200, newContactReply);
    expect(v.ok).toBe(true);
    expect(v.note).toMatch(/not confirmed/i);
  });

  it('keeps WATI\'s message id (local_message_id) and not the contact id', () => {
    const ids = providerIdsOf(newContactReply);
    expect(ids).toContain('418f43c3-dc4b-43c8-ac57-e5dacdfeeee6');
    expect(ids).not.toContain('6b03c933f378c0138948640f');
  });

  it('a refusal is still a failure, with WATI\'s reason', () => {
    expect(interpretWatiReply(true, 200, { result: false, info: 'Template not approved' })).toEqual({ ok: false, error: 'Template not approved' });
    expect(interpretWatiReply(true, 200, { result: false, validWhatsAppNumber: false })).toEqual({ ok: false, error: 'Not a WhatsApp number' });
    expect(interpretWatiReply(false, 401, null)).toEqual({ ok: false, error: 'HTTP 401' });
  });

  it('a normal accepted message has no note', () => {
    expect(interpretWatiReply(true, 200, { result: true, validWhatsAppNumber: true, local_message_id: 'x' })).toEqual({ ok: true, note: undefined });
  });
});

describe('numbers sent to WATI', () => {
  it('adds India\'s 91 to a 10-digit mobile and keeps full numbers as they are', () => {
    expect(toWhatsappId('95513 82296')).toBe('919551382296');
    expect(toWhatsappId('+91 95513 82296')).toBe('919551382296');
    expect(toWhatsappId('09551382296')).toBe('919551382296');
    expect(toWhatsappId('+971501234567')).toBe('971501234567');
  });
});
