import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyAccessToken } from '../modules/auth/auth.utils.js';

/**
 * Whom a request counts against: the signed-in user when the request carries a valid access token,
 * otherwise the client IP. Most staff reach the server from the hospital's one public IP, so
 * counting per IP would make everyone share a single allowance and lock the whole hospital out.
 */
const userOrIp = (req: Request): string => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      return `user:${verifyAccessToken(header.slice(7)).userId}`;
    } catch {
      /* expired / invalid token: fall back to the IP */
    }
  }
  return `ip:${req.ip}`;
};

/** Background activity for the audit log (screens, presence heartbeats); limited separately below. */
const isActivityPing = (req: Request) =>
  req.originalUrl.startsWith('/api/v1/audit/activity') ||
  // WATI's delivery webhook (many updates per message, all from WATI's servers)
  req.originalUrl.startsWith('/api/v1/whatsapp/webhook/');

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Per signed-in user: ~100 requests a minute, far above normal use (a page load is a handful of
  // calls). Requests without a sign-in (the login page) are counted per IP.
  limit: (req: Request) => (userOrIp(req).startsWith('user:') ? 1500 : 600),
  keyGenerator: userOrIp,
  skip: isActivityPing,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests in a short time. Please wait a few minutes and try again.',
    },
  },
});

/** Audit-log activity pings: about one a minute per open app, plus screen changes. */
export const activityLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  keyGenerator: userOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  // Never shown to anyone: the app drops failed activity pings silently
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many activity updates' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Failed login attempts per IP (successful logins are not counted, so staff sharing one hospital IP are not locked out)
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Too many authentication attempts, please try again after 15 minutes.',
    },
  },
});
