import mongoose, { Document, Schema } from "mongoose";

export enum CustomerStatus {
  ACTIVE = "active",
  ON_VACATION = "on_vacation",
  INACTIVE = "inactive",
}

export interface ICustomer extends Document {
  customerNumber: string;
  name: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  mobileNumber?: string;
  email?: string;
  status: CustomerStatus;
  vacationStartDate?: Date;
  vacationEndDate?: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    customerNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    houseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{5}$/,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: Object.values(CustomerStatus),
      default: CustomerStatus.ACTIVE,
    },
    vacationStartDate: {
      type: Date,
    },
    vacationEndDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient searching
customerSchema.index({ customerNumber: 1, name: 1, city: 1, postalCode: 1 });

export const Customer = mongoose.model<ICustomer>("Customer", customerSchema);
