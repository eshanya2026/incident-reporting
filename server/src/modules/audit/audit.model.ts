import mongoose, { Schema, Document } from 'mongoose';

/**
 * Categories shown in the Super Admin audit log. Workflow / admin entries get theirs from the action
 * name (see categoryOf in activity.ts); browser activity (screens, presence) is sent by the app.
 */
export const AUDIT_CATEGORIES = [
  'auth', // sign-in, failed attempts, sign-out, password changes
  'screen', // screens opened
  'incident', // reporting and every workflow step
  'report', // incidents opened, reports register viewed, attachments opened
  'whatsapp', // WhatsApp messages sent / failed, test sends
  'export', // PDF and CSV downloads
  'ai', // Ask AI questions and answers, AI insights
  'settings', // departments, wards, categories, roles & access, WhatsApp templates
  'users', // user accounts: create, update, password resets, forced sign-outs
  'audit', // audit log opened and exported
  'presence', // tab hidden / shown, idle, window closed
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export interface IAuditLog extends Document {
  /** Who did it; empty for system events (scheduled jobs, failed sign-ins of unknown usernames). */
  userId?: mongoose.Types.ObjectId;
  action: string;
  category?: AuditCategory;
  /** Sign-in session the action happened in (see session.model.ts). */
  sessionId?: mongoose.Types.ObjectId;
  /** Ready-made description for activity events; workflow entries are described when read. */
  summary?: string;
  /** Small structured details: incident number, screen, recipient, durations... */
  meta?: Record<string, any>;
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    category: { type: String, enum: AUDIT_CATEGORIES, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'UserSession', index: true },
    summary: { type: String },
    meta: { type: Schema.Types.Mixed },
    entityType: { type: String, index: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);
AuditLogSchema.index({ timestamp: -1, category: 1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
