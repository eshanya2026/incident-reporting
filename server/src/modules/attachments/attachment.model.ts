import mongoose, { Schema, Document } from 'mongoose';

export type EntityType = 'INCIDENT' | 'INVESTIGATION' | 'RCA' | 'CAPA';

export interface IAttachment extends Document {
  entityType: EntityType;
  entityId?: mongoose.Types.ObjectId;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  checksum?: string;
}

const AttachmentSchema: Schema = new Schema(
  {
    entityType: {
      type: String,
      enum: ['INCIDENT', 'INVESTIGATION', 'RCA', 'CAPA'],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    checksum: { type: String },
  },
  {
    timestamps: true,
  }
);

export const Attachment = mongoose.model<IAttachment>('Attachment', AttachmentSchema);
