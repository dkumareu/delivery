import mongoose, { Document, Schema } from "mongoose";

export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete"
}

export interface IAuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface IAudit extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  action: AuditAction;
  collectionName: string;
  documentId: mongoose.Types.ObjectId;
  changes: IAuditChange[];
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

const auditChangeSchema = new Schema<IAuditChange>({
  field: {
    type: String,
    required: true
  },
  oldValue: {
    type: Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: Schema.Types.Mixed,
    default: null
  }
});

const auditSchema = new Schema<IAudit>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true
    },
    collectionName: {
      type: String,
      required: true
    },
    documentId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    changes: {
      type: [auditChangeSchema],
      default: []
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Index for better query performance
auditSchema.index({ collectionName: 1, documentId: 1 });
auditSchema.index({ userId: 1 });
auditSchema.index({ timestamp: -1 });

export const Audit = mongoose.model<IAudit>("Audit", auditSchema); 