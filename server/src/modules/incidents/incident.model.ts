import mongoose, { Schema, Document } from 'mongoose';

export type IncidentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'TRIAGED'
  | 'HOD_REVIEW'
  | 'UNDER_INVESTIGATION'
  | 'RCA_REQUIRED'
  | 'CAPA_IN_PROGRESS'
  | 'EFFECTIVENESS_REVIEW'
  | 'READY_FOR_CLOSURE'
  | 'CLOSED'
  | 'REOPENED'
  | 'RETURNED_FOR_INFORMATION'
  | 'CANCELLED';

export interface IPatientDetails {
  uhid?: string;
  ipNumber?: string;
  name?: string;
  age?: number;
  gender?: string;
  ward?: string;
  bed?: string;
  consultant?: string;
  admissionDate?: Date;
  source?: 'MANUAL' | 'HIS';
}

export interface IIncident extends Document {
  incidentNumber: string;
  reportedBy: mongoose.Types.ObjectId;
  reportedAt: Date;
  incidentDateTime: Date;
  departmentId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  subcategoryCode?: string;
  patientInvolved: boolean;
  patient?: IPatientDetails;
  title: string;
  description: string;
  immediateAction?: string;
  severity: number; // 1 to 5
  severityLabel: string;
  status: IncidentStatus;
  assignedHod?: mongoose.Types.ObjectId;
  investigatorId?: mongoose.Types.ObjectId;
  requiresRca: boolean;
  requiresCapa: boolean;
  escalationLevel: number;
  escalatedAt?: Date;
  attachments: mongoose.Types.ObjectId[];
  closureRemarks?: string;
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema: Schema = new Schema({
  uhid: { type: String, trim: true },
  ipNumber: { type: String, trim: true },
  name: { type: String, trim: true },
  age: { type: Number },
  gender: { type: String, trim: true },
  ward: { type: String, trim: true },
  bed: { type: String, trim: true },
  consultant: { type: String, trim: true },
  admissionDate: { type: Date },
  source: { type: String, enum: ['MANUAL', 'HIS'], default: 'MANUAL' },
});

const IncidentSchema: Schema = new Schema(
  {
    incidentNumber: { type: String, required: true, unique: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedAt: { type: Date, default: Date.now, index: true },
    incidentDateTime: { type: Date, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'IncidentCategory', required: true, index: true },
    subcategoryCode: { type: String },
    patientInvolved: { type: Boolean, default: false },
    patient: PatientSchema,
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    immediateAction: { type: String, trim: true },
    severity: { type: Number, required: true, min: 1, max: 5, default: 1, index: true },
    severityLabel: { type: String, required: true, default: 'Near Miss' },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'TRIAGED',
        'HOD_REVIEW',
        'UNDER_INVESTIGATION',
        'RCA_REQUIRED',
        'CAPA_IN_PROGRESS',
        'EFFECTIVENESS_REVIEW',
        'READY_FOR_CLOSURE',
        'CLOSED',
        'REOPENED',
        'RETURNED_FOR_INFORMATION',
        'CANCELLED',
      ],
      default: 'SUBMITTED',
      index: true,
    },
    assignedHod: { type: Schema.Types.ObjectId, ref: 'User' },
    investigatorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    requiresRca: { type: Boolean, default: false },
    requiresCapa: { type: Boolean, default: false },
    escalationLevel: { type: Number, default: 0 },
    escalatedAt: { type: Date },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    closureRemarks: { type: String },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast dashboard & list queries
IncidentSchema.index({ departmentId: 1, status: 1 });
IncidentSchema.index({ status: 1, severity: 1 });
IncidentSchema.index({ reportedBy: 1, status: 1 });

export const Incident = mongoose.model<IIncident>('Incident', IncidentSchema);
