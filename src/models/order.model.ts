import mongoose, { Document, Schema } from "mongoose";
import { ICustomer } from "./customer.model";
import { IItem } from "./item.model";
import { IDriver } from "./driver.model";

export enum PaymentMethod {
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  DIRECT_DEBIT = "direct_debit",
  DELIVERY_NOTE = "delivery_note",
}

export enum OrderStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

export enum Frequency {
  DAILY = "daily",
  WEEKDAYS = "weekdays",
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly",
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
