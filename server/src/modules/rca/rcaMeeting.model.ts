import mongoose, { Schema, Document } from 'mongoose';

// When Quality isn't satisfied at review, they request an RCA: an RCA Head is assigned who
// schedules a meeting with the involved HODs and Quality, then uploads the meeting's report —
// there is no 5-Why form here (that one stays for the HOD's investigation-stage RCA, see rca.model.ts).
export type RcaMeetingStatus = 'SCHEDULED' | 'COMPLETED';

export interface IRcaMeeting extends Document {
  incidentId: mongoose.Types.ObjectId;
  scheduledBy: mongoose.Types.ObjectId;
  scheduledAt: Date;
  /** The meeting's own date/time. */
  meetingAt: Date;
  location: string;
  notes?: string;
  attendeeIds: mongoose.Types.ObjectId[];
  status: RcaMeetingStatus;
  reportSummary?: string;
  reportUploadedAt?: Date;
  reportUploadedBy?: mongoose.Types.ObjectId;
  evidence: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const RcaMeetingSchema: Schema = new Schema(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, unique: true, index: true },
    scheduledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledAt: { type: Date, required: true, default: Date.now },
    meetingAt: { type: Date, required: true },
    location: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    attendeeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['SCHEDULED', 'COMPLETED'], default: 'SCHEDULED', index: true },
    reportSummary: { type: String, trim: true },
    reportUploadedAt: { type: Date },
    reportUploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    evidence: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
  },
  {
    timestamps: true,
  }
);

export const RcaMeeting = mongoose.model<IRcaMeeting>('RcaMeeting', RcaMeetingSchema);
