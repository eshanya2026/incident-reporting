import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: string;
  code: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    permissions: [{ type: String, required: true }],
    isSystemRole: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const Role = mongoose.model<IRole>('Role', RoleSchema);
