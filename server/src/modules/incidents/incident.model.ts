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
  'RCA_REQUESTED', // Quality requested RCA and assigned to Quality Members
  'CLOSED', // Quality accepted and completed (final; closed incidents are not reopened)
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

// Who the incident affected. INPATIENT/OUTPATIENT drive `patientInvolved`/`patient` below.
export const AFFECTED_PERSON_TYPES = ['INPATIENT', 'OUTPATIENT', 'VISITOR_FAMILY', 'EMPLOYEE', 'OTHER'] as const;
export type AffectedPersonType = (typeof AFFECTED_PERSON_TYPES)[number];
export const PATIENT_AFFECTED_TYPES: AffectedPersonType[] = ['INPATIENT', 'OUTPATIENT'];

// How urgently the HOD should act, set by Quality at assignment (separate from severity, which
// drives RCA/CAPA requirements).
export const INCIDENT_PRIORITIES = ['EXTREMELY_LOW', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];
export const PRIORITY_LABELS: Record<IncidentPriority, string> = {
  EXTREMELY_LOW: 'Extremely Low',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

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

/** Details for a VISITOR_FAMILY or EMPLOYEE affectedPersonType (patients use IPatientDetails instead). */
export interface IAffectedPersonDetail {
  name?: string;
  contactNumber?: string;
  /** VISITOR_FAMILY only: relation to the patient, e.g. "Son of patient in Ward 3". */
  relationship?: string;
  /** EMPLOYEE only. */
  employeeId?: string;
  designation?: string;
  departmentId?: mongoose.Types.ObjectId;
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
  priority?: IncidentPriority;
  remarks?: string;
  notifiedDepartmentIds?: mongoose.Types.ObjectId[];
  intimatedUserIds?: mongoose.Types.ObjectId[];
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
  /** Who was affected (inpatient, outpatient, visitor/family, employee, other). See AFFECTED_PERSON_TYPES. */
  affectedPersonType: AffectedPersonType;
  /** Free text when "Other" is selected as affectedPersonType. */
  affectedOtherDetail?: string;
  patientInvolved: boolean;
  patient?: IPatientDetails;
  /** Set when affectedPersonType is VISITOR_FAMILY or EMPLOYEE. */
  affectedPersonDetail?: IAffectedPersonDetail;
  title: string;
  description: string;
  /** Witness name(s) and, if known, how to reach them — free text. */
  witness?: string;
  immediateAction?: string;
  /** Anything else the reporter wants to add. */
  remarks?: string;
  /** Severity the reporter chose. */
  initialSeverity: number;
  /** Severity confirmed by Quality (drives RCA/CAPA requirements). */
  severity: number;
  severityLabel: string;
  status: IncidentStatus;
  assignedHod?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  /** How urgently the HOD should act, set by Quality at assignment. */
  priority?: IncidentPriority;
  /**
   * Other departments Quality notified at assignment for awareness (e.g. a second department
   * involved in the incident). They do not investigate — only departmentId's HOD does.
   */
  notifiedDepartmentIds: mongoose.Types.ObjectId[];
  /**
   * Specific hospital personnel / users intimated (CC'd) at assignment for awareness.
   */
  intimatedUserIds: mongoose.Types.ObjectId[];
  /** Every assignment, including earlier ones the HOD returned to Quality. */
  assignments: IAssignment[];
  requiresRca: boolean;
  requiresCapa: boolean;
  assignedQualityMemberId?: mongoose.Types.ObjectId;
  rcaRequestedAt?: Date;
  rcaRequestedBy?: mongoose.Types.ObjectId;
  rcaRequestRemarks?: string;
  rcaSubmittedAt?: Date;
  rcaSubmittedBy?: mongoose.Types.ObjectId;
  rcaSubmissionRemarks?: string;
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
  /** Computed automatically when Quality closes the incident (see computeQualityScore below). */
  qualityScore?: IQualityScore;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQualityScore {
  /** How quickly it was closed relative to a severity-based target. */
  timeliness: number;
  /** Whether the CAPA plan covered both a corrective and a preventive action, not just one. */
  capaQuality: number;
  /** Penalised for each time the report was sent back (HOD return, or Quality returned it at review). */
  rework: number;
  /** Average of the three above, 0–100. */
  overall: number;
}

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Near Miss',
  2: 'No Harm',
  3: 'Harm',
  4: 'Sentinel Event',
};

/** RCA is required for Sentinel Event (4) only. CAPA is required at every severity. */
export const severityRequirements = (severity: number) => ({
  severityLabel: SEVERITY_LABELS[severity] || SEVERITY_LABELS[1],
  requiresRca: severity >= 4,
  requiresCapa: true,
});

/** Days Quality targets for closing an incident, by severity — more severe, faster expected turnaround. */
const CLOSURE_TARGET_DAYS: Record<number, number> = { 1: 30, 2: 21, 3: 14, 4: 7 };

/**
 * Analytics score computed automatically when Quality closes an incident (see REVIEW_ACCEPT in
 * incidentWorkflow.service.ts). Nothing here is entered by hand — it reads facts already on the
 * incident, so the same inputs can be used to show a live preview in the review panel before
 * Quality confirms closing it.
 */
export const computeQualityScore = (params: {
  reportedAt: Date;
  closedAt: Date;
  severity: number;
  /** hodReturns.length + how many times Quality returned it at review (REVIEW_RETURN). */
  reworkCount: number;
  /** CAPA types recorded on the incident (CORRECTIVE / PREVENTIVE), after this closure's verdicts. */
  capaTypes: Array<'CORRECTIVE' | 'PREVENTIVE'>;
}): IQualityScore => {
  const targetDays = CLOSURE_TARGET_DAYS[params.severity] || CLOSURE_TARGET_DAYS[1];
  const daysToClose = Math.max(0, (params.closedAt.getTime() - params.reportedAt.getTime()) / (24 * 60 * 60 * 1000));
  const timeliness = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, daysToClose - targetDays) * 5)));

  const hasCorrective = params.capaTypes.includes('CORRECTIVE');
  const hasPreventive = params.capaTypes.includes('PREVENTIVE');
  const capaQuality = params.capaTypes.length === 0 ? 0 : (hasCorrective ? 50 : 0) + (hasPreventive ? 50 : 0);

  const rework = Math.max(0, 100 - params.reworkCount * 20);

  const overall = Math.round((timeliness + capaQuality + rework) / 3);

  return { timeliness, capaQuality, rework, overall };
};

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

const AffectedPersonDetailSchema: Schema = new Schema(
  {
    name: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    relationship: { type: String, trim: true },
    employeeId: { type: String, trim: true },
    designation: { type: String, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  },
  { _id: false }
);

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
  severity: { type: Number, required: true, min: 1, max: 4 },
  priority: { type: String, enum: INCIDENT_PRIORITIES },
  remarks: { type: String, trim: true },
  notifiedDepartmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
  intimatedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
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
    affectedPersonType: { type: String, enum: AFFECTED_PERSON_TYPES, required: true },
    affectedOtherDetail: { type: String, trim: true },
    patientInvolved: { type: Boolean, default: false },
    patient: PatientSchema,
    affectedPersonDetail: AffectedPersonDetailSchema,
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    witness: { type: String, trim: true },
    immediateAction: { type: String, trim: true },
    remarks: { type: String, trim: true },
    initialSeverity: { type: Number, required: true, min: 1, max: 4, default: 1 },
    severity: { type: Number, required: true, min: 1, max: 4, default: 1, index: true },
    severityLabel: { type: String, required: true, default: SEVERITY_LABELS[1] },
    status: { type: String, enum: INCIDENT_STATUSES, default: 'SUBMITTED', index: true },
    assignedHod: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },
    priority: { type: String, enum: INCIDENT_PRIORITIES },
    notifiedDepartmentIds: { type: [Schema.Types.ObjectId], ref: 'Department', default: [] },
    intimatedUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    assignments: [AssignmentSchema],
    requiresRca: { type: Boolean, default: false },
    requiresCapa: { type: Boolean, default: false },
    assignedQualityMemberId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    rcaRequestedAt: { type: Date },
    rcaRequestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rcaRequestRemarks: { type: String, trim: true },
    rcaSubmittedAt: { type: Date },
    rcaSubmittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rcaSubmissionRemarks: { type: String, trim: true },
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
    qualityScore: {
      type: new Schema(
        {
          timeliness: { type: Number, required: true, min: 0, max: 100 },
          capaQuality: { type: Number, required: true, min: 0, max: 100 },
          rework: { type: Number, required: true, min: 0, max: 100 },
          overall: { type: Number, required: true, min: 0, max: 100 },
        },
        { _id: false }
      ),
    },
  },
  {
    timestamps: true,
    // Two people acting on the same incident at once: the second save fails instead of overwriting
    optimisticConcurrency: true,
  }
);

// Compound Indexes for fast dashboard & list queries
IncidentSchema.index({ departmentId: 1, status: 1 });
IncidentSchema.index({ notifiedDepartmentIds: 1 });
IncidentSchema.index({ intimatedUserIds: 1 });
IncidentSchema.index({ status: 1, severity: 1 });
IncidentSchema.index({ reportedBy: 1, status: 1 });
IncidentSchema.index({ 'assignments.departmentId': 1 });
IncidentSchema.index({ 'assignments.notifiedDepartmentIds': 1 });
IncidentSchema.index({ 'assignments.intimatedUserIds': 1 });

export const Incident = mongoose.model<IIncident>('Incident', IncidentSchema);
