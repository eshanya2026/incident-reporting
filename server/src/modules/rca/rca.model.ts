import mongoose, { Schema, Document } from 'mongoose';

export type RcaMethod = 'FIVE_WHY' | 'FISHBONE' | 'BOTH';
// Written by the HOD; Quality reviews it as part of the final incident review (no separate approval).
export type RcaStatus = 'DRAFT' | 'COMPLETED';

export interface IFiveWhy {
  sequence: number;
  question: string;
  answer: string;
}

export interface IFishbone {
  people: string[];
  process: string[];
  equipment: string[];
  environment: string[];
  communication: string[];
  policy: string[];
  training: string[];
  technology: string[];
}

export interface IRootCauseAnalysis extends Document {
  incidentId: mongoose.Types.ObjectId;
  investigationId?: mongoose.Types.ObjectId;
  method: RcaMethod;
  fiveWhy: IFiveWhy[];
  fishbone: IFishbone;
  rootCauseSummary: string;
  status: RcaStatus;
  createdAt: Date;
  updatedAt: Date;
}

const FiveWhySchema: Schema = new Schema({
  sequence: { type: Number, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
});

const FishboneSchema: Schema = new Schema({
  people: [{ type: String }],
  process: [{ type: String }],
  equipment: [{ type: String }],
  environment: [{ type: String }],
  communication: [{ type: String }],
  policy: [{ type: String }],
  training: [{ type: String }],
  technology: [{ type: String }],
});

const RootCauseAnalysisSchema: Schema = new Schema(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, unique: true, index: true },
    investigationId: { type: Schema.Types.ObjectId, ref: 'Investigation' },
    method: { type: String, enum: ['FIVE_WHY', 'FISHBONE', 'BOTH'], default: 'FIVE_WHY' },
    fiveWhy: [FiveWhySchema],
    fishbone: { type: FishboneSchema, default: {} },
    rootCauseSummary: { type: String, required: true, trim: true },
    status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT', index: true },
  },
  {
    timestamps: true,
  }
);

export const RootCauseAnalysis = mongoose.model<IRootCauseAnalysis>(
  'RootCauseAnalysis',
  RootCauseAnalysisSchema
);
