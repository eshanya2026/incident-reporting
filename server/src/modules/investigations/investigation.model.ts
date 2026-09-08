import mongoose, { Schema, Document } from 'mongoose';

export type InvestigationStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export interface IInvestigation extends Document {
  incidentId: mongoose.Types.ObjectId;
  investigatorId: mongoose.Types.ObjectId;
  startedAt: Date;
  dueDate: Date;
  completedAt?: Date;
  facts: string;
  chronology: string;
  peopleInterviewed: Array<{ name: string; designation: string; statement?: string }>;
  contributingFactors: string[]; // e.g. HUMAN_FACTOR, PROCESS, EQUIPMENT, ENVIRONMENT, COMMUNICATION
  immediateCorrections?: string;
  evidence: mongoose.Types.ObjectId[];
  findings: string;
  recommendation?: string;
  status: InvestigationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PeopleInterviewedSchema: Schema = new Schema({
  name: { type: String, required: true },
  designation: { type: String, required: true },
  statement: { type: String },
});

const InvestigationSchema: Schema = new Schema(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, unique: true, index: true },
    investigatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    completedAt: { type: Date },
    facts: { type: String, default: '' },
    chronology: { type: String, default: '' },
    peopleInterviewed: [PeopleInterviewedSchema],
    contributingFactors: [{ type: String }],
    immediateCorrections: { type: String },
    evidence: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    findings: { type: String, default: '' },
    recommendation: { type: String },
    status: {
      type: String,
      enum: ['DRAFT', 'IN_PROGRESS', 'COMPLETED'],
      default: 'IN_PROGRESS',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Investigation = mongoose.model<IInvestigation>('Investigation', InvestigationSchema);
