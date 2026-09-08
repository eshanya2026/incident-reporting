import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  read: boolean;
  readAt?: Date;
  deliveryChannels: Array<'IN_APP' | 'EMAIL'>;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    deliveryChannels: [{ type: String, enum: ['IN_APP', 'EMAIL'], default: 'IN_APP' }],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
