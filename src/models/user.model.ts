import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export enum UserRole {
  ADMIN = "admin",
  BACK_OFFICE = "back_office",
  FIELD_SERVICE = "field_service",
  WAREHOUSE = "warehouse",
}

export interface IPermission {
  page: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  permissions: IPermission[];
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const permissionSchema = new Schema<IPermission>({
  page: {
    type: String,
    required: true,
    enum: ['dashboard', 'customers', 'orders', 'items', 'drivers', 'delivery-routes', 'planning-board', 'assign-driver', 'reports', 'employees', 'audit']
  },
  canView: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false }
});

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.FIELD_SERVICE,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    permissions: {
      type: [permissionSchema],
      default: []
    }
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
