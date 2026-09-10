import mongoose, { Schema, Document } from 'mongoose';

export interface ISubcategory {
  code: string;
  name: string;
  active: boolean;
}

export interface IIncidentCategory extends Document {
  code: string;
  name: string;
  order?: number;
  active: boolean;
  subcategories: ISubcategory[];
  createdAt: Date;
  updatedAt: Date;
}

const SubcategorySchema: Schema = new Schema({
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
});

const IncidentCategorySchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 99 },
    active: { type: Boolean, default: true },
    subcategories: [SubcategorySchema],
  },
  {
    timestamps: true,
  }
);

export const IncidentCategory = mongoose.model<IIncidentCategory>(
  'IncidentCategory',
  IncidentCategorySchema
);
