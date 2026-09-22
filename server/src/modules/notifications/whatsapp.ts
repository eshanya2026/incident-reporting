import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Optional WhatsApp delivery via WATI (https://wati.io), a WhatsApp Business API provider.
// Off unless WHATSAPP_NOTIFICATIONS=true and WATI_API_ENDPOINT / WATI_ACCESS_TOKEN are set.
// Failures are logged and never block the workflow action that triggered them.

export const whatsappEnabled = (): boolean =>
  env.WHATSAPP_NOTIFICATIONS && Boolean(env.WATI_API_ENDPOINT) && Boolean(env.WATI_ACCESS_TOKEN);

/** WATI expects digits only, with country code and no leading "+" or spaces. */
const toWhatsappId = (rawNumber: string): string => rawNumber.replace(/\D/g, '');

const post = async (path: string, payload: Record<string, unknown>): Promise<void> => {
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
    if (!res.ok) {
      logger.error({ status: res.status, body: await res.text() }, '❌ WhatsApp notification failed');
    }
  } catch (error) {
    logger.error({ err: error }, '❌ WhatsApp notification failed');
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

  await post(`/api/v1/sendSessionMessage/${to}`, { messageText: message });
};

/**
 * Sends a pre-approved WhatsApp template via WATI — the only way to reach someone outside the 24h
 * session window. `bodyParams` fill the template's {{1}}, {{2}}, ... placeholders in order.
 */
export const sendWhatsappTemplate = async (rawNumber: string, bodyParams: string[]): Promise<void> => {
  if (!whatsappEnabled() || !env.WATI_TEMPLATE_NAME) return;
  const to = toWhatsappId(rawNumber);
  if (!to) return;

  await post(`/api/v1/sendTemplateMessage?whatsappNumber=${to}`, {
    template_name: env.WATI_TEMPLATE_NAME,
    broadcast_name: env.WATI_TEMPLATE_NAME,
    parameters: bodyParams.map((value, i) => ({ name: String(i + 1), value })),
  });
};
