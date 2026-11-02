import mongoose, { Document, Schema } from 'mongoose';

/** Saved wording for one WhatsApp notification. Absent = the built-in default is used. */
export interface IWhatsappTemplate extends Document {
  key: string;
  title: string;
  message: string;
  details: string[];
  enabled: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappTemplateSchema = new Schema<IWhatsappTemplate>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    details: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const WhatsappTemplate = mongoose.model<IWhatsappTemplate>('WhatsappTemplate', whatsappTemplateSchema);
