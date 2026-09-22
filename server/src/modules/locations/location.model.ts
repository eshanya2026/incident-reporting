import mongoose, { Schema, Document } from 'mongoose';

export type LocationType = 'WARD' | 'ROOM' | 'OT' | 'ICU' | 'LAB' | 'OPD' | 'OTHER';

export const VALID_FLOORS = ['Ground Floor', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5'] as const;
export type HospitalFloor = typeof VALID_FLOORS[number];

export const VALID_ZONES = ['Zone-1', 'Zone-B', 'Zone-C'] as const;
export type HospitalZone = typeof VALID_ZONES[number];

export interface ILocation extends Document {
  code: string;
  name: string;
  type: LocationType;
  floor?: string;
  zone?: string;
  departmentId?: mongoose.Types.ObjectId;
  parentLocationId?: mongoose.Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['WARD', 'ROOM', 'OT', 'ICU', 'LAB', 'OPD', 'OTHER'],
      required: true,
    },
    floor: {
      type: String,
      trim: true,
    },
    zone: {
      type: String,
      trim: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    parentLocationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

LocationSchema.index({ floor: 1, zone: 1 });

export const Location = mongoose.model<ILocation>('Location', LocationSchema);
