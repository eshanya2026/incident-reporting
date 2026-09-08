import mongoose, { Schema, Document } from 'mongoose';

export type LocationType = 'WARD' | 'ROOM' | 'OT' | 'ICU' | 'LAB' | 'OPD' | 'OTHER';

export interface ILocation extends Document {
  code: string;
  name: string;
  type: LocationType;
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
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    parentLocationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Location = mongoose.model<ILocation>('Location', LocationSchema);
