import { AsyncLocalStorage } from 'node:async_hooks';
import { Request } from 'express';

/**
 * Who is making the current request, available anywhere down the call chain (e.g. the WhatsApp
 * sender or the audit logger) without passing `req` through every function. Set by `authenticate`.
 */
export interface RequestContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(ctx: RequestContext, fn: () => T): T => storage.run(ctx, fn);

export const currentContext = (): RequestContext => storage.getStore() ?? {};

/** Client IP (honours TRUST_PROXY via req.ip) and browser user agent of a request. */
export const clientInfo = (req?: Request): { ipAddress?: string; userAgent?: string } => {
  if (!req) return {};
  const forwarded = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return {
    ipAddress: (req.ip || forwarded || req.socket?.remoteAddress || '').replace(/^::ffff:/, '') || undefined,
    userAgent: (req.headers['user-agent'] as string | undefined)?.slice(0, 400),
  };
};
