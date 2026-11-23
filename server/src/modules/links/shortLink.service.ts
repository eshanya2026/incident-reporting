import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Request } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ShortLink, LinkEvent, ILinkEvent } from './shortLink.model.js';
import { WhatsappMessage } from '../notifications/whatsappMessage.model.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no 0/O/1/l/I
export const SHORT_CODE = /^[A-Za-z0-9]{6,16}$/;

const newCode = (length = 8): string => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

export const appBase = (): string => env.APP_URL.replace(/\/+$/, '');
export const shortUrl = (code: string): string => `${appBase()}/l/${code}`;

/** A new tracked short link to a path inside the app. Falls back to the full link if it can't be stored. */
export const createShortLink = async (params: {
  target: string;
  recipientUserId?: string | mongoose.Types.ObjectId;
  incidentId?: string | mongoose.Types.ObjectId;
}): Promise<{ code?: string; url: string }> => {
  const target = params.target.startsWith('/') ? params.target : `/${params.target}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const code = newCode();
      await ShortLink.create({ code, target, recipientUserId: params.recipientUserId, incidentId: params.incidentId });
      return { code, url: shortUrl(code) };
    } catch (error: any) {
      if (error?.code !== 11000) {
        logger.error({ err: error }, '❌ Could not create a short link');
        break;
      }
    }
  }
  return { url: `${appBase()}${target}` };
};

/** Ties a short link to the WhatsApp message it was sent in. */
export const attachLinkToMessage = async (code: string | undefined, messageId: string | undefined): Promise<void> => {
  if (!code || !messageId || !mongoose.isValidObjectId(messageId)) return;
  await Promise.all([
    ShortLink.updateOne({ code }, { $set: { messageId } }),
    WhatsappMessage.updateOne({ _id: messageId }, { $set: { linkCode: code } }),
  ]).catch((error) => logger.error({ err: error }, '❌ Could not link short link to message'));
};

/** The short-link code inside a message's link parameter, if it is one of ours. */
export const codeInUrl = (url?: string): string | undefined => {
  const m = url?.match(/\/l\/([A-Za-z0-9]{6,16})(?:[/?#]|$)/);
  return m?.[1];
};

// ---------- What a tap tells us ----------

/** Link-preview fetchers (WhatsApp, Facebook, Telegram...) and crawlers: not a person tapping. */
const PREVIEW_AGENT = /WhatsApp|facebookexternalhit|Facebot|TelegramBot|Twitterbot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|Googlebot|bingbot|bot\b|crawler|spider|preview|curl|wget|python-requests|HeadlessChrome/i;

const hint = (req: Request, name: string): string | undefined => {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.replace(/^"|"$/g, '').trim() || undefined : undefined;
};

/** Phone type, OS, browser and model from the user agent and Chrome's client hints. */
export const describeDevice = (req: Request): ILinkEvent['device'] => {
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || PREVIEW_AGENT.test(ua)) return { formFactor: 'bot', browser: ua.slice(0, 60) || undefined };

  let os: string | undefined;
  let osVersion: string | undefined;
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/Android\s([\d.]+)/))) [os, osVersion] = ['Android', m[1]];
  else if ((m = ua.match(/(?:iPhone|CPU) OS (\d+[_\d]*)/))) [os, osVersion] = [/iPad/.test(ua) ? 'iPadOS' : 'iOS', m[1].replace(/_/g, '.')];
  else if ((m = ua.match(/Windows NT ([\d.]+)/))) [os, osVersion] = ['Windows', m[1] === '10.0' ? '10/11' : m[1]];
  else if ((m = ua.match(/Mac OS X ([\d_]+)/))) [os, osVersion] = ['macOS', m[1].replace(/_/g, '.')];
  else if (/Linux/.test(ua)) os = 'Linux';
  // Chrome reports the real Android version in a client hint
  const platformVersion = hint(req, 'sec-ch-ua-platform-version');
  if (os === 'Android' && platformVersion) osVersion = platformVersion.split('.')[0];

  const browsers: Array<[RegExp, string]> = [
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/EdgA?\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)|FxiOS\/([\d.]+)/, 'Firefox'],
    [/CriOS\/([\d.]+)/, 'Chrome'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ];
  let browser: string | undefined;
  let browserVersion: string | undefined;
  for (const [re, name] of browsers) {
    const b = ua.match(re);
    if (b) {
      browser = name;
      browserVersion = (b[1] || b[2] || '').split('.')[0] || undefined;
      break;
    }
  }

  // Model: Chrome's client hint; older Android user agents still carry it ("; SM-S918B Build/")
  let model = hint(req, 'sec-ch-ua-model');
  if (!model && (m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build\/|\))/)) && m[1] !== 'K') model = m[1].trim();
  if (!model && /iPhone/.test(ua)) model = 'iPhone';
  if (!model && /iPad/.test(ua)) model = 'iPad';

  const mobileHint = hint(req, 'sec-ch-ua-mobile');
  const formFactor = /iPad|Tablet/.test(ua) || (os === 'Android' && !/Mobile/.test(ua)) ? 'tablet' : mobileHint === '?1' || /Mobi|iPhone|Android/.test(ua) ? 'mobile' : 'desktop';
  // Opened inside an app's own browser rather than Chrome/Safari
  const inApp = /; wv\)|WhatsApp|FBAN|FBAV|Instagram|Line\//.test(ua);

  return { formFactor, os, osVersion, browser, browserVersion, model: model || undefined, inApp };
};

/** "Android 14 · Chrome 131 · SM-S918B" */
export const deviceLabel = (d: ILinkEvent['device']): string =>
  [d.os && `${d.os}${d.osVersion ? ` ${d.osVersion}` : ''}`, d.browser && `${d.browser}${d.browserVersion ? ` ${d.browserVersion}` : ''}`, d.model, d.inApp ? 'in-app browser' : undefined]
    .filter(Boolean)
    .join(' · ');

const clientIp = (req: Request): string | undefined => (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '') || undefined;
const firstLanguage = (req: Request) => String(req.headers['accept-language'] || '').split(',')[0]?.trim() || undefined;

/**
 * Records a tap (or a preview fetch) on a short link and returns where to send the browser.
 * Chrome repeats the request once to add the phone model (Critical-CH); that repeat updates the
 * tap it follows instead of counting twice.
 */
export const recordTap = async (code: string, req: Request): Promise<string | null> => {
  const link = await ShortLink.findOne({ code });
  if (!link) return null;
  const device = describeDevice(req);
  const kind = device.formFactor === 'bot' ? 'PREVIEW' : 'TAP';
  const ip = clientIp(req);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 400) || undefined;
  const now = new Date();

  try {
    const repeat =
      kind === 'TAP'
        ? await LinkEvent.findOne({ linkId: link._id, kind: 'TAP', ip, userAgent, at: { $gte: new Date(now.getTime() - 15000) } }).sort({ at: -1 })
        : null;
    if (repeat) {
      await LinkEvent.updateOne({ _id: repeat._id }, { $set: { device } });
    } else {
      await LinkEvent.create({ linkId: link._id, code, messageId: link.messageId, kind, at: now, ip, userAgent, device, language: firstLanguage(req) });
      if (kind === 'TAP') {
        await ShortLink.updateOne({ _id: link._id }, { $inc: { taps: 1 }, $set: { lastTapAt: now }, $min: { firstTapAt: now } });
      }
    }
    if (kind === 'TAP' && link.messageId) {
      await WhatsappMessage.updateOne(
        { _id: link.messageId },
        { ...(repeat ? {} : { $inc: { linkTaps: 1 } }), $set: { linkLastTapAt: now, linkLastDevice: deviceLabel(device) }, $min: { linkFirstTapAt: now } }
      );
    }
  } catch (error) {
    logger.error({ err: error }, '❌ Could not record a link tap');
  }
  return `${appBase()}${link.target}${link.target.includes('?') ? '&' : '?'}via=${code}`;
};

/** The incident page opened from a link in a signed-in session: who, and what their screen says. */
export const recordOpened = async (
  code: string,
  userId: string,
  req: Request,
  extra: { screen?: { width?: number; height?: number; pixelRatio?: number }; timezone?: string; installedApp?: boolean }
): Promise<boolean> => {
  const link = await ShortLink.findOne({ code });
  if (!link) return false;
  const isRecipient = link.recipientUserId ? String(link.recipientUserId) === userId : undefined;
  const now = new Date();
  await LinkEvent.create({
    linkId: link._id,
    code,
    messageId: link.messageId,
    kind: 'OPENED',
    at: now,
    ip: clientIp(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 400) || undefined,
    device: describeDevice(req),
    language: firstLanguage(req),
    userId,
    isRecipient,
    ...extra,
  });
  if (link.messageId) {
    // The first open is kept; a later open by the recipient themselves replaces an open by someone else
    const msg = await WhatsappMessage.findById(link.messageId).select('linkOpenedAt linkOpenedByRecipient');
    if (msg && (!msg.linkOpenedAt || (isRecipient && !msg.linkOpenedByRecipient))) {
      await WhatsappMessage.updateOne({ _id: link.messageId }, { $set: { linkOpenedAt: now, linkOpenedBy: userId, linkOpenedByRecipient: isRecipient } });
    }
  }
  return true;
};
