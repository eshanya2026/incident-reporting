import mongoose, { Schema, Document } from 'mongoose';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface IUser extends Document {
  employeeId: string;
  name: string;
  /** Optional: many staff have no email. Unique when present. */
  email?: string;
  username: string;
  phone?: string;
  whatsappNumber?: string;
  passwordHash: string;
  departmentId?: mongoose.Types.ObjectId;
  designation?: string;
  roles: mongoose.Types.ObjectId[];
  status: UserStatus;
  failedLoginAttempts: number;
  lockUntil?: Date;
  lastLoginAt?: Date;
  /** Set for imported staff: they must confirm their details and set their own password on first login. */
  mustCompleteProfile: boolean;
  profileCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    // Blank emails are stored as absent, so the unique index (below) only applies to real addresses
    email: { type: String, lowercase: true, trim: true, set: (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined) },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
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
    mustCompleteProfile: { type: Boolean, default: false },
    profileCompletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

export const User = mongoose.model<IUser>('User', UserSchema);

/**
 * Email used to be required with a plain unique index, which allows only one account without an
 * email. Replaces it with the partial unique index above (migration 2026-11-02-optional-email).
 */
export const makeEmailOptional = async (): Promise<string> => {
  const indexes = await User.collection.indexes().catch(() => [] as any[]);
  const old = indexes.find((i: any) => i.name === 'email_1' && !i.partialFilterExpression);
  if (old) await User.collection.dropIndex('email_1');
  const cleared = await User.collection.updateMany({ email: { $in: ['', null] } }, { $unset: { email: '' } });
  await User.createIndexes();
  return `${old ? 'replaced' : 'kept'} email index; cleared ${cleared.modifiedCount} blank emails`;
};
