import { Request } from 'express';
import mongoose from 'mongoose';
import { UserSession, SessionEndReason } from './session.model.js';
import { clientInfo } from '../../common/context/requestContext.js';

/** "Chrome on Windows", "Safari on iPhone"... from a browser user agent. */
export const deviceOf = (ua?: string): string => {
  if (!ua) return 'Unknown device';
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone/i.test(ua)
      ? 'iPhone'
      : /iPad/i.test(ua)
        ? 'iPad'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/i.test(ua)
            ? 'Mac'
            : /Linux/i.test(ua)
              ? 'Linux'
              : 'Unknown OS';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/i.test(ua)
      ? 'Opera'
      : /SamsungBrowser/i.test(ua)
        ? 'Samsung Internet'
        : /Chrome\//i.test(ua)
          ? 'Chrome'
          : /Firefox\//i.test(ua)
            ? 'Firefox'
            : /Safari\//i.test(ua)
              ? 'Safari'
              : /curl|node|axios|python/i.test(ua)
                ? 'Script'
                : 'Browser';
  return `${browser} on ${os}`;
};

export const startSession = async (req: Request, userId: mongoose.Types.ObjectId | string): Promise<string> => {
  const { ipAddress, userAgent } = clientInfo(req);
  const session = await UserSession.create({
    userId,
    startedAt: new Date(),
    lastSeenAt: new Date(),
    ipAddress,
    userAgent,
    device: deviceOf(userAgent),
  });
  return session._id.toString();
};

export const endSession = async (sessionId: string | undefined, reason: SessionEndReason, by?: string): Promise<void> => {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) return;
  await UserSession.updateOne(
    { _id: sessionId, endedAt: { $exists: false } },
    {
      $set: {
        endedAt: new Date(),
        endReason: reason,
        ...(reason === 'forced' ? { revoked: true, revokedBy: by } : {}),
      },
    }
  );
  revokedCache.delete(sessionId);
};

/** Ends every open session of a user (password change, profile completion). */
export const endUserSessions = async (userId: string, reason: SessionEndReason): Promise<void> => {
  await UserSession.updateMany({ userId, endedAt: { $exists: false } }, { $set: { endedAt: new Date(), endReason: reason } });
};

// Forced sign-outs must take effect at once, so every request checks its session. A short cache
// keeps that to one lookup per session every few seconds.
const REVOKED_CACHE_MS = 5000;
const revokedCache = new Map<string, { revoked: boolean; at: number }>();

export const isSessionRevoked = async (sessionId?: string): Promise<boolean> => {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) return false;
  const hit = revokedCache.get(sessionId);
  if (hit && Date.now() - hit.at < REVOKED_CACHE_MS) return hit.revoked;
  const s = await UserSession.findById(sessionId).select('revoked').lean();
  const revoked = Boolean(s?.revoked);
  revokedCache.set(sessionId, { revoked, at: Date.now() });
  if (revokedCache.size > 5000) revokedCache.clear();
  return revoked;
};
