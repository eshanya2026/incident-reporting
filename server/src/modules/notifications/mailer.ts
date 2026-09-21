import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Optional email delivery for notifications. Off unless EMAIL_NOTIFICATIONS=true;
// uses the SMTP_* settings. Failures are logged and never block the in-app notification.

let transporter: Transporter | null = null;

export const emailEnabled = (): boolean => env.EMAIL_NOTIFICATIONS && Boolean(env.SMTP_HOST);

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
};

export const sendEmail = async (to: string[], subject: string, text: string): Promise<void> => {
  if (!emailEnabled() || to.length === 0) return;
  try {
    // One message per recipient so addresses are not shared between staff
    await Promise.all(to.map((address) => getTransporter().sendMail({ from: env.SMTP_FROM, to: address, subject, text })));
  } catch (error) {
    logger.error({ err: error }, '❌ Notification email failed');
  }
};
