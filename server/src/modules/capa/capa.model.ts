import mongoose, { Schema, Document } from 'mongoose';

export type CapaType = 'CORRECTIVE' | 'PREVENTIVE';
export type CapaPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
// OPEN → DONE (HOD marks it carried out) → EFFECTIVE (Quality accepts at review).
// A CAPA Quality finds not effective goes back to OPEN, with the review remarks in `verification`.
export const CAPA_STATUSES = ['OPEN', 'DONE', 'EFFECTIVE'] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export interface ICapaVerification {
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  effective?: boolean;
  remarks?: string;
}

export interface ICapa extends Document {
  capaNumber: string;
  incidentId: mongoose.Types.ObjectId;
  rcaId?: mongoose.Types.ObjectId;
  type: CapaType;
  action: string;
  ownerUserId: mongoose.Types.ObjectId;
  ownerDepartmentId: mongoose.Types.ObjectId;
  priority: CapaPriority;
  assignedDate: Date;
  targetDate: Date;
  status: CapaStatus;
  completionRemarks?: string;
  completedAt?: Date;
  evidence: mongoose.Types.ObjectId[];
  verification?: ICapaVerification;
  /** When the HOD and Quality were told this CAPA is overdue (cleared if the target date changes). */
  overdueNotifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CapaVerificationSchema: Schema = new Schema({
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  effective: { type: Boolean, default: true },
  remarks: { type: String },
});

const CapaSchema: Schema = new Schema(
  {
    capaNumber: { type: String, required: true, unique: true, index: true },
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    rcaId: { type: Schema.Types.ObjectId, ref: 'RootCauseAnalysis' },
    type: { type: String, enum: ['CORRECTIVE', 'PREVENTIVE'], required: true },
    action: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    assignedDate: { type: Date, default: Date.now },
    targetDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: CAPA_STATUSES,
      default: 'OPEN',
      index: true,
    },
    completionRemarks: { type: String },
    completedAt: { type: Date },
    evidence: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    verification: CapaVerificationSchema,
    overdueNotifiedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for CAPA tracking
CapaSchema.index({ ownerUserId: 1, status: 1 });
CapaSchema.index({ targetDate: 1, status: 1 });

export const Capa = mongoose.model<ICapa>('Capa', CapaSchema);
