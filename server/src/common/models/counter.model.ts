import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  name: string;
  seq: number;
}

const CounterSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

export const getNextSequence = async (name: string): Promise<number> => {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};
