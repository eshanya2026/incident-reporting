import mongoose, { Schema, Document } from 'mongoose';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface IUser extends Document {
  employeeId: string;
  name: string;
  email: string;
  username: string;
  phone?: string;
  passwordHash: string;
  departmentId?: mongoose.Types.ObjectId;
  designation?: string;
  roles: mongoose.Types.ObjectId[];
  status: UserStatus;
  failedLoginAttempts: number;
  lockUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    designation: { type: String, trim: true },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'LOCKED'],
      default: 'ACTIVE',
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
