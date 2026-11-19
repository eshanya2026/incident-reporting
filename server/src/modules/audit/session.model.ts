import mongoose, { Schema, Document } from 'mongoose';

/** How a session ended. Sessions with no end are online while heartbeats keep arriving. */
export const SESSION_END_REASONS = ['logout', 'forced', 'expired', 'password_changed', 'profile_completed'] as const;
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];

/**
 * One sign-in, from login to sign-out. The app sends a heartbeat every minute with how long the
 * person was active (mouse / keyboard), idle (5+ minutes without input) or away (tab hidden).
 */
export interface IUserSession extends Document {
  userId: mongoose.Types.ObjectId;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt?: Date;
  endReason?: SessionEndReason;
  /** Set when a Super Admin forces the sign-out; the session's tokens stop working at once. */
  revoked: boolean;
  revokedBy?: mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  /** e.g. "Chrome on Windows" */
  device?: string;
  activeMs: number;
  idleMs: number;
  awayMs: number;
  /** Presence at the last heartbeat. */
  state: 'active' | 'idle' | 'away';
}

const UserSessionSchema = new Schema<IUserSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date, required: true, default: Date.now, index: true },
  lastSeenAt: { type: Date, required: true, default: Date.now, index: true },
  endedAt: { type: Date },
  endReason: { type: String, enum: SESSION_END_REASONS },
  revoked: { type: Boolean, default: false },
  revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String },
  userAgent: { type: String },
  device: { type: String },
  activeMs: { type: Number, default: 0 },
  idleMs: { type: Number, default: 0 },
  awayMs: { type: Number, default: 0 },
  state: { type: String, enum: ['active', 'idle', 'away'], default: 'active' },
});
UserSessionSchema.index({ userId: 1, startedAt: -1 });

export const UserSession = mongoose.model<IUserSession>('UserSession', UserSessionSchema);

/** A session counts as online when its last heartbeat is this recent (heartbeats come every minute). */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
/** After this long without a heartbeat an open session is shown as ended ("expired"). */
export const SESSION_STALE_MS = 15 * 60 * 1000;
