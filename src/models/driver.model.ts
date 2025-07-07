import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export enum DriverStatus {
  ACTIVE = "active",
  ON_VACATION = "on_vacation",
  INACTIVE = "inactive",
}

export interface IDriver extends Document {
  driverNumber: string;
  name: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  mobileNumber?: string;
  email?: string;
  password: string;
  status: DriverStatus;
  vacationStartDate?: Date;
  vacationEndDate?: Date;
  latitude?: number;
  longitude?: number;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const driverSchema = new Schema<IDriver>(
  {
    driverNumber: {
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
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    status: {
      type: String,
      enum: Object.values(DriverStatus),
      default: DriverStatus.ACTIVE,
    },
    vacationStartDate: {
      type: Date,
    },
    vacationEndDate: {
      type: Date,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
driverSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
driverSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for efficient searching
driverSchema.index({ driverNumber: 1, name: 1, city: 1, postalCode: 1 });

export const Driver = mongoose.model<IDriver>("Driver", driverSchema);
