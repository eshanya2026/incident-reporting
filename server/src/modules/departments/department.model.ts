import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  code: string;
  name: string;
  hodUserId?: mongoose.Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    hodUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Department = mongoose.model<IDepartment>('Department', DepartmentSchema);
