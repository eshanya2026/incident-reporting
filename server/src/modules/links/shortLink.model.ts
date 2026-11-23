import mongoose, { Schema, Document } from 'mongoose';

// Tracked short links sent in WhatsApp messages (https://<app>/l/<code>). Each tap is recorded with
// what the browser itself tells any website: time, IP, phone type, OS, browser, phone model (Android
// Chrome) and language. Nothing else can be read from a link tap (no phone number, IMEI or location).

export interface IShortLink extends Document {
  code: string;
  /** Path inside the app to open, e.g. /incidents/<id>. */
  target: string;
  messageId?: mongoose.Types.ObjectId;
  recipientUserId?: mongoose.Types.ObjectId;
  incidentId?: mongoose.Types.ObjectId;
  taps: number;
  firstTapAt?: Date;
  lastTapAt?: Date;
  createdAt: Date;
}

const ShortLinkSchema = new Schema<IShortLink>(
  {
    code: { type: String, required: true, unique: true },
    target: { type: String, required: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'WhatsappMessage', index: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident' },
    taps: { type: Number, default: 0 },
    firstTapAt: { type: Date },
    lastTapAt: { type: Date },
  },
  { timestamps: true }
);

export const ShortLink = mongoose.model<IShortLink>('ShortLink', ShortLinkSchema);

export const LINK_EVENT_KINDS = ['TAP', 'PREVIEW', 'OPENED'] as const;
export type LinkEventKind = (typeof LINK_EVENT_KINDS)[number];

export interface ILinkEvent extends Document {
  linkId: mongoose.Types.ObjectId;
  code: string;
  messageId?: mongoose.Types.ObjectId;
  /** TAP = someone tapped the link; PREVIEW = WhatsApp/another app fetching a preview (not a person); OPENED = the incident page loaded in a signed-in session. */
  kind: LinkEventKind;
  at: Date;
  ip?: string;
  userAgent?: string;
  device: {
    formFactor?: 'mobile' | 'tablet' | 'desktop' | 'bot';
    os?: string;
    osVersion?: string;
    browser?: string;
    browserVersion?: string;
    model?: string;
    inApp?: boolean;
  };
  language?: string;
  /** OPENED only: who was signed in, and what their screen reported. */
  userId?: mongoose.Types.ObjectId;
  isRecipient?: boolean;
  screen?: { width?: number; height?: number; pixelRatio?: number };
  timezone?: string;
  installedApp?: boolean;
}

const LinkEventSchema = new Schema<ILinkEvent>(
  {
    linkId: { type: Schema.Types.ObjectId, ref: 'ShortLink', required: true, index: true },
    code: { type: String, required: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'WhatsappMessage', index: true },
    kind: { type: String, enum: LINK_EVENT_KINDS, required: true },
    at: { type: Date, default: Date.now, index: true },
    ip: { type: String },
    userAgent: { type: String },
    device: {
      formFactor: { type: String },
      os: { type: String },
      osVersion: { type: String },
      browser: { type: String },
      browserVersion: { type: String },
      model: { type: String },
      inApp: { type: Boolean },
    },
    language: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    isRecipient: { type: Boolean },
    screen: { width: Number, height: Number, pixelRatio: Number },
    timezone: { type: String },
    installedApp: { type: Boolean },
  },
  { timestamps: false }
);

export const LinkEvent = mongoose.model<ILinkEvent>('LinkEvent', LinkEventSchema);
