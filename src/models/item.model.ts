import mongoose, { Document, Schema } from "mongoose";

export enum UnitOfMeasure {
  MM = "mm",
  CM = "cm",
  M = "m",
}

export interface IItem extends Document {
  filterType: string;
  length: number;
  width: number;
  depth: number;
  unitOfMeasure: UnitOfMeasure;
  isActive: boolean;
}

const itemSchema = new Schema<IItem>(
  {
    filterType: {
      type: String,
      required: true,
      trim: true,
    },
    length: {
      type: Number,
      required: true,
      min: 0,
    },
    width: {
      type: Number,
      required: true,
      min: 0,
    },
    depth: {
      type: Number,
      required: true,
      min: 0,
    },
    unitOfMeasure: {
      type: String,
      enum: Object.values(UnitOfMeasure),
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient searching
itemSchema.index({ filterType: 1 });

export const Item = mongoose.model<IItem>("Item", itemSchema);
