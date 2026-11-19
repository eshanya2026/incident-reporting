import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { logActivity } from '../audit/audit.service.js';

// Optional WhatsApp delivery via WATI (https://wati.io), a WhatsApp Business API provider.
// Off unless WHATSAPP_NOTIFICATIONS=true and WATI_API_ENDPOINT / WATI_ACCESS_TOKEN are set.
// Failures are logged and never block the workflow action that triggered them.

export const whatsappEnabled = (): boolean =>
  env.WHATSAPP_NOTIFICATIONS && Boolean(env.WATI_API_ENDPOINT) && Boolean(env.WATI_ACCESS_TOKEN);

/** WATI expects digits only, with country code and no leading "+" or spaces. */
const toWhatsappId = (rawNumber: string): string => rawNumber.replace(/\D/g, '');

interface SendResult {
  ok: boolean;
  error?: string;
}

const INCIDENT_REF = /(INC|CAPA)-\d{4}-\d{6}/;

/** Audit log entry for every WhatsApp message (who triggered it comes from the request context). */
const auditSend = async (to: string, kind: 'template' | 'session', text: string, result: SendResult, recipientName?: string) => {
  const ref = text.match(INCIDENT_REF)?.[0];
  const who = recipientName ? `${recipientName} (+${to})` : `+${to}`;
  await logActivity(
    result.ok ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
    result.ok ? `Sent WhatsApp${ref ? ` about ${ref}` : ''} to ${who}` : `WhatsApp to ${who} failed: ${result.error || 'unknown error'}`,
    { meta: { to: `+${to}`, recipientName, kind, incidentNumber: ref, preview: text.slice(0, 300), error: result.error } }
  );
};

const post = async (path: string, payload: Record<string, unknown>): Promise<SendResult> => {
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
    if (!res.ok || body?.result === false) {
      logger.error({ status: res.status, body: text }, '❌ WhatsApp notification failed');
      return { ok: false, error: String(body?.info || body?.message || `HTTP ${res.status}`).slice(0, 300) };
    }
    return { ok: true };
  } catch (error) {
    logger.error({ err: error }, '❌ WhatsApp notification failed');
    return { ok: false, error: (error as Error)?.message || 'Network error' };
  }
};

/**
 * Free-form text (WATI "session message"). Only deliverable while the recipient has an open 24h
 * WhatsApp session with the business number (e.g. they messaged it recently) — otherwise WATI
 * rejects it. Prefer sendWhatsappTemplate for the first message to someone (see docs/whatsapp-template.md).
 */
export const sendWhatsapp = async (rawNumber: string, message: string): Promise<void> => {
  if (!whatsappEnabled()) return;
  const to = toWhatsappId(rawNumber);
  if (!to) return;

  const result = await post(`/api/v1/sendSessionMessage/${to}`, { messageText: message });
  await auditSend(to, 'session', message, result);
};

/**
 * Sends a pre-approved WhatsApp template via WATI — the only way to reliably reach someone
 * outside the 24h session window (the normal case for a first-time transactional notification).
 * `templateName` is one of the per-notification WATI_TEMPLATE_* env vars (see
 * docs/whatsapp-template.md); `bodyParams` fill that template's {{1}}, {{2}}, ... in order.
 */
export const sendWhatsappTemplate = async (rawNumber: string, templateName: string, bodyParams: string[]): Promise<void> => {
  if (!whatsappEnabled() || !templateName) return;
  await sendWhatsappTemplateChecked(rawNumber, templateName, bodyParams);
};

/** Same as sendWhatsappTemplate, but reports whether WATI accepted it (used by "Send test"). */
export const sendWhatsappTemplateChecked = async (rawNumber: string, templateName: string, bodyParams: string[]): Promise<SendResult> => {
  if (!whatsappEnabled() || !templateName) return { ok: false, error: 'WhatsApp sending is not configured' };
  const to = toWhatsappId(rawNumber);
  if (!to) return { ok: false, error: 'No WhatsApp number' };

  const result = await post(`/api/v1/sendTemplateMessage?whatsappNumber=${to}`, {
    template_name: templateName,
    broadcast_name: templateName,
    parameters: bodyParams.map((value, i) => ({ name: String(i + 1), value })),
  });
  // The generic template's first parameter is the recipient's name (see docs/whatsapp-template.md)
  await auditSend(to, 'template', bodyParams.join(' | '), result, bodyParams[0]);
  return result;
};
