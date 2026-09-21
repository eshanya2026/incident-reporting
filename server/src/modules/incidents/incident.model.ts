import mongoose, { Schema, Document } from 'mongoose';

// Incident workflow (see docs/FLOW_REWORK_PLAN.md):
// Staff reports → SUBMITTED → Quality assigns → ASSIGNED → HOD investigates → UNDER_INVESTIGATION
// → CAPA_IN_PROGRESS → HOD submits → PENDING_QUALITY_REVIEW → Quality completes → CLOSED
export const INCIDENT_STATUSES = [
  'SUBMITTED', // waiting in Quality's triage inbox
  'INFO_REQUESTED', // Quality asked the reporter for more information
  'REJECTED', // Quality rejected the report (duplicate, not an incident)
  'ASSIGNED', // Quality assigned it to the responsible department's HOD
  'UNDER_INVESTIGATION', // HOD is investigating (and writing the RCA if required)
  'CAPA_IN_PROGRESS', // HOD is writing and carrying out CAPA
  'PENDING_QUALITY_REVIEW', // HOD submitted for closure; Quality reviews
  'CLOSED', // Quality accepted and completed (final; closed incidents are not reopened)
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

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

export interface IActorNote {
  by: mongoose.Types.ObjectId;
  at: Date;
}

export interface IInfoRequest {
  question: string;
  askedBy: mongoose.Types.ObjectId;
  askedAt: Date;
  response?: string;
  respondedBy?: mongoose.Types.ObjectId;
  respondedAt?: Date;
}

export interface IAssignment extends IActorNote {
  departmentId: mongoose.Types.ObjectId;
  hodUserId: mongoose.Types.ObjectId;
  severity: number;
  remarks?: string;
}

export interface IReasonNote extends IActorNote {
  reason: string;
}

export interface IClosureSubmission extends IActorNote {
  summary: string;
}

export interface IQualityReview extends IActorNote {
  decision: 'ACCEPTED' | 'RETURNED';
  remarks: string;
}

export interface IIncident extends Document {
  incidentNumber: string;
  reportedBy: mongoose.Types.ObjectId;
  reportedAt: Date;
  incidentDateTime: Date;
  /** Reporter's own department, set automatically. */
  reportingDepartmentId?: mongoose.Types.ObjectId;
  /** Department where the incident occurred, entered by staff. */
  occurredInDepartmentId?: mongoose.Types.ObjectId;
  /** Responsible department, set only by Quality at assignment. */
  departmentId?: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  floor?: string;
  zone?: string;
  categoryId: mongoose.Types.ObjectId;
  subcategoryCode?: string;
  patientInvolved: boolean;
  patient?: IPatientDetails;
  title: string;
  description: string;
  immediateAction?: string;
  /** Severity the reporter chose. */
  initialSeverity: number;
  /** Severity confirmed by Quality (drives RCA/CAPA requirements). */
  severity: number;
  severityLabel: string;
  status: IncidentStatus;
  assignedHod?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  /** Every assignment, including earlier ones the HOD returned to Quality. */
  assignments: IAssignment[];
  requiresRca: boolean;
  requiresCapa: boolean;
  infoRequests: IInfoRequest[];
  rejection?: IReasonNote;
  hodReturns: IReasonNote[];
  closureSubmission?: IClosureSubmission;
  qualityReviews: IQualityReview[];
  escalationLevel: number;
  escalatedAt?: Date;
  attachments: mongoose.Types.ObjectId[];
  closureRemarks?: string;
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Near Miss',
  2: 'Minor Harm',
  3: 'Moderate Harm',
  4: 'Major Harm',
  5: 'Critical / Sentinel Event',
};

/** RCA is required from severity 4, CAPA from severity 3. */
export const severityRequirements = (severity: number) => ({
  severityLabel: SEVERITY_LABELS[severity] || SEVERITY_LABELS[1],
  requiresRca: severity >= 4,
  requiresCapa: severity >= 3,
});

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

const actor = {
  by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true, default: Date.now },
};

const InfoRequestSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    askedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    askedAt: { type: Date, required: true, default: Date.now },
    response: { type: String, trim: true },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: { type: Date },
  },
  { _id: true }
);

const AssignmentSchema = new Schema({
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  hodUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  severity: { type: Number, required: true, min: 1, max: 5 },
  remarks: { type: String, trim: true },
  ...actor,
});

const ReasonSchema = new Schema({ reason: { type: String, required: true, trim: true }, ...actor });

const ClosureSubmissionSchema = new Schema({ summary: { type: String, required: true, trim: true }, ...actor }, { _id: false });

const QualityReviewSchema = new Schema({
  decision: { type: String, enum: ['ACCEPTED', 'RETURNED'], required: true },
  remarks: { type: String, required: true, trim: true },
  ...actor,
});

const IncidentSchema: Schema = new Schema(
  {
    incidentNumber: { type: String, required: true, unique: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedAt: { type: Date, default: Date.now, index: true },
    incidentDateTime: { type: Date, required: true },
    reportingDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    occurredInDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    floor: { type: String, trim: true, index: true },
    zone: { type: String, trim: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'IncidentCategory', required: true, index: true },
    subcategoryCode: { type: String },
    patientInvolved: { type: Boolean, default: false },
    patient: PatientSchema,
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    immediateAction: { type: String, trim: true },
    initialSeverity: { type: Number, required: true, min: 1, max: 5, default: 1 },
    severity: { type: Number, required: true, min: 1, max: 5, default: 1, index: true },
    severityLabel: { type: String, required: true, default: SEVERITY_LABELS[1] },
    status: { type: String, enum: INCIDENT_STATUSES, default: 'SUBMITTED', index: true },
    assignedHod: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },
    assignments: [AssignmentSchema],
    requiresRca: { type: Boolean, default: false },
    requiresCapa: { type: Boolean, default: false },
    infoRequests: [InfoRequestSchema],
    rejection: { type: new Schema({ reason: { type: String, required: true, trim: true }, ...actor }, { _id: false }) },
    hodReturns: [ReasonSchema],
    closureSubmission: { type: ClosureSubmissionSchema },
    qualityReviews: [QualityReviewSchema],
    escalationLevel: { type: Number, default: 0 },
    escalatedAt: { type: Date },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    closureRemarks: { type: String },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    // Two people acting on the same incident at once: the second save fails instead of overwriting
    optimisticConcurrency: true,
  }
);

// Compound Indexes for fast dashboard & list queries
IncidentSchema.index({ departmentId: 1, status: 1 });
IncidentSchema.index({ status: 1, severity: 1 });
IncidentSchema.index({ reportedBy: 1, status: 1 });
IncidentSchema.index({ 'assignments.departmentId': 1 });

export const Incident = mongoose.model<IIncident>('Incident', IncidentSchema);
