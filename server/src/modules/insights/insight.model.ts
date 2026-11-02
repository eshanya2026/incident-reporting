import mongoose, { Schema, Document } from 'mongoose';

// One AI-written analysis of a scope (whole hospital, or one department) over a period. Kept so
// the AI Insights page loads instantly and so each generation (and its cost) is accounted for:
// one automatic generation per scope/period per day, plus one manual "Regenerate" per day.
export type InsightTrigger = 'AUTO' | 'MANUAL';
export type InsightStatus = 'READY' | 'FAILED';

export interface IAiInsight extends Document {
  /** 'HOSPITAL' or 'DEPT:<departmentId>'. */
  scopeKey: string;
  period: string;
  /** Calendar day (hospital time zone) the generation belongs to, e.g. 2026-11-02. */
  dayKey: string;
  trigger: InsightTrigger;
  status: InsightStatus;
  narrative?: unknown;
  /** The computed figures the narrative was written from, as they were at generation time. */
  facts?: unknown;
  error?: string;
  aiModel?: string;
  generatedBy?: mongoose.Types.ObjectId;
  generatedAt: Date;
}

const AiInsightSchema = new Schema<IAiInsight>(
  {
    scopeKey: { type: String, required: true },
    period: { type: String, required: true },
    dayKey: { type: String, required: true },
    trigger: { type: String, enum: ['AUTO', 'MANUAL'], required: true },
    status: { type: String, enum: ['READY', 'FAILED'], required: true },
    narrative: { type: Schema.Types.Mixed },
    facts: { type: Schema.Types.Mixed },
    error: { type: String },
    aiModel: { type: String },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

AiInsightSchema.index({ scopeKey: 1, period: 1, generatedAt: -1 });
AiInsightSchema.index({ scopeKey: 1, period: 1, dayKey: 1, trigger: 1 });

export const AiInsight = mongoose.model<IAiInsight>('AiInsight', AiInsightSchema);
