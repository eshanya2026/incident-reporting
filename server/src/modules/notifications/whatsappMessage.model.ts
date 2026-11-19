import mongoose, { Schema, Document } from 'mongoose';

/**
 * Lifecycle of a WhatsApp message. WATI tells us about every step after "sent" through its
 * webhook (see whatsappWebhook.controller.ts):
 *   SKIPPED  — never sent (no WhatsApp number on the person's profile)
 *   PENDING  — handed to WATI, no answer yet
 *   SENT     — WATI accepted it
 *   DELIVERED / READ / REPLIED — reported back by WhatsApp through WATI
 *   FAILED   — WATI refused it, or WhatsApp could not deliver it (failedCode / failureReason say why)
 */
export const WHATSAPP_STATUSES = ['SKIPPED', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED'] as const;
export type WhatsappStatus = (typeof WHATSAPP_STATUSES)[number];

/** Later statuses never move a message back (a late "delivered" after "read" is ignored). */
export const STATUS_RANK: Record<WhatsappStatus, number> = {
  SKIPPED: 0,
  PENDING: 1,
  SENT: 2,
  FAILED: 3,
  DELIVERED: 4,
  READ: 5,
  REPLIED: 6,
};

export interface IWhatsappMessage extends Document {
  /** Who it was for, as they were when it was sent (role / department can change later). */
  recipientUserId?: mongoose.Types.ObjectId;
  recipientName?: string;
  recipientRoles: string[];
  recipientDepartmentId?: mongoose.Types.ObjectId;
  recipientDepartment?: string;
  /** Digits with country code; empty for SKIPPED. */
  to?: string;
  /** Which notification: HOD_ASSIGNED, INTIMATED, ... or TEST for a test send from the templates screen. */
  notificationKey: string;
  kind: 'template' | 'session';
  templateName?: string;
  /** Template parameters, kept so a failed message can be sent again unchanged. */
  params: string[];
  preview?: string;
  incidentId?: mongoose.Types.ObjectId;
  incidentNumber?: string;
  /** Who caused it (the person whose action triggered the notification); empty for system jobs. */
  triggeredBy?: mongoose.Types.ObjectId;
  status: WhatsappStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  repliedAt?: Date;
  failedAt?: Date;
  failedCode?: string;
  failureReason?: string;
  /** Ids WATI uses for this message (localMessageId, id, whatsappMessageId) to match webhook updates. */
  providerIds: string[];
  history: Array<{ status: WhatsappStatus; at: Date; detail?: string }>;
  /** Set on a message sent again from the dashboard. */
  resendOf?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsappMessageSchema = new Schema<IWhatsappMessage>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    recipientName: { type: String },
    recipientRoles: [{ type: String }],
    recipientDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    recipientDepartment: { type: String },
    to: { type: String, index: true },
    notificationKey: { type: String, required: true, index: true },
    kind: { type: String, enum: ['template', 'session'], default: 'template' },
    templateName: { type: String },
    params: [{ type: String }],
    preview: { type: String },
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', index: true },
    incidentNumber: { type: String },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: WHATSAPP_STATUSES, required: true, index: true },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    repliedAt: { type: Date },
    failedAt: { type: Date },
    failedCode: { type: String },
    failureReason: { type: String },
    providerIds: { type: [String], index: true, default: [] },
    history: [
      {
        _id: false,
        status: { type: String, enum: WHATSAPP_STATUSES },
        at: { type: Date },
        detail: { type: String },
      },
    ],
    resendOf: { type: Schema.Types.ObjectId, ref: 'WhatsappMessage' },
  },
  { timestamps: true }
);
WhatsappMessageSchema.index({ createdAt: -1 });

export const WhatsappMessage = mongoose.model<IWhatsappMessage>('WhatsappMessage', WhatsappMessageSchema);
