import mongoose, { Document, Schema } from "mongoose";
import { ICustomer } from "./customer.model";
import { IItem } from "./item.model";
import { IDriver } from "./driver.model";

export enum PaymentMethod {
  CASH_PAYMENT = "cash_payment",
  BANK_TRANSFER = "bank_transfer",
  MONTHLY_TRANSFER = "monthly_transfer",
}

export enum OrderStatus {
  DRAFT = "draft",
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  OUT_FOR_DELIVERY = "out_for_delivery",
  DELIVERED = "delivered",
  DENIED_BY_CUSTOMER = "denied_by_customer",
  CUSTOMER_NOT_AVAILABLE = "customer_not_available",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

export enum Frequency {
  DAILY = "daily",
  WEEKDAYS = "weekdays",
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly",
  EVERY_3RD_WEEK = "every_3rd_week",
  EVERY_5TH_WEEK = "every_5th_week",
  SIX_WEEKS = "6_weeks",
  EIGHT_WEEKS = "8_weeks",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUALLY = "semi_annually",
  ANNUALLY = "annually",
}

export interface IOrderItem {
  item: IItem["_id"];
  quantity: number;
  unitPrice: number;
  vatRate: number;
  netAmount: number;
  grossAmount: number;
}

export interface IOrder extends Document {
  orderNumber: string;
  customer: ICustomer["_id"];
  items: IOrderItem[];
  paymentMethod: PaymentMethod;
  driverNote?: string;
  startDate: Date;
  endDate?: Date;
  frequency?: Frequency;
  assignedDriver?: IDriver["_id"];
  status: OrderStatus;
  totalNetAmount: number;
  totalGrossAmount: number;
  mainOrder: boolean;
  originalOrderNumber?: string;
  deliverySequence?: number;
  lastUpdated?: Date;
  beforeImages?: string[];
  afterImages?: string[];
}

const orderItemSchema = new Schema<IOrderItem>({
  item: {
    type: Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  vatRate: {
    type: Number,
    required: true,
    min: 0,
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  grossAmount: {
    type: Number,
    required: true,
    min: 0,
  },
});

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    items: [orderItemSchema],
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    driverNote: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    frequency: {
      type: String,
      enum: Object.values(Frequency),
    },
    assignedDriver: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    totalNetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalGrossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    mainOrder: {
      type: Boolean,
      default: false,
    },
    originalOrderNumber: {
      type: String,
      trim: true,
    },
    deliverySequence: {
      type: Number,
      min: 1,
    },
    lastUpdated: {
      type: Date,
    },
    beforeImages: {
      type: [String],
      default: [],
      validate: {
        validator: function(v: string[]) {
          return v.length <= 10;
        },
        message: 'Cannot have more than 10 before images'
      }
    },
    afterImages: {
      type: [String],
      default: [],
      validate: {
        validator: function(v: string[]) {
          return v.length <= 10;
        },
        message: 'Cannot have more than 10 after images'
      }
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
orderSchema.index({ customer: 1 });
orderSchema.index({ startDate: 1 });
orderSchema.index({ assignedDriver: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ mainOrder: 1 });
orderSchema.index({ originalOrderNumber: 1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);
