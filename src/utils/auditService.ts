import { Request } from "express";
import mongoose from "mongoose";
import { Audit, AuditAction, IAuditChange } from "../models/audit.model";

export interface AuditLogData {
  userId: mongoose.Types.ObjectId;
  userName: string;
  action: AuditAction;
  collectionName: string;
  documentId: mongoose.Types.ObjectId;
  changes: IAuditChange[];
  req?: Request;
}

export class AuditService {
  static async logChange(data: AuditLogData): Promise<void> {
    try {
      const auditData: any = {
        userId: data.userId,
        userName: data.userName,
        action: data.action,
        collectionName: data.collectionName,
        documentId: data.documentId,
        changes: data.changes,
        timestamp: new Date()
      };

      // Add request metadata if available
      if (data.req) {
        auditData.ipAddress = data.req.ip || data.req.connection?.remoteAddress;
        auditData.userAgent = data.req.get('User-Agent');
      }

      await Audit.create(auditData);
    } catch (error) {
      console.error('Error logging audit:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  static async getChanges(
    collectionName?: string,
    documentId?: string,
    userId?: string,
    action?: AuditAction,
    page: number = 1,
    limit: number = 20
  ) {
    const query: any = {};

    if (collectionName) query.collectionName = collectionName;
    if (documentId) query.documentId = new mongoose.Types.ObjectId(documentId);
    if (userId) query.userId = new mongoose.Types.ObjectId(userId);
    if (action) query.action = action;

    const skip = (page - 1) * limit;

    const [audits, total] = await Promise.all([
      Audit.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email')
        .lean(),
      Audit.countDocuments(query)
    ]);

    return {
      audits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getChangeById(auditId: string) {
    return await Audit.findById(auditId)
      .populate('userId', 'firstName lastName email')
      .lean();
  }

  static async revertChange(auditId: string, targetModel: mongoose.Model<any>) {
    const audit = await Audit.findById(auditId);
    if (!audit) {
      throw new Error('Audit record not found');
    }

    if (audit.action === AuditAction.CREATE) {
      // For create actions, we delete the document
      await targetModel.findByIdAndDelete(audit.documentId);
    } else if (audit.action === AuditAction.DELETE) {
      // For delete actions, we need to recreate the document
      // This would require storing the full document data in the audit
      throw new Error('Reverting delete operations is not supported yet');
    } else if (audit.action === AuditAction.UPDATE) {
      // For update actions, we revert the changes
      const updateData: any = {};
      audit.changes.forEach(change => {
        updateData[change.field] = change.oldValue;
      });

      await targetModel.findByIdAndUpdate(audit.documentId, updateData);
    }

    // Log the revert action
    await this.logChange({
      userId: audit.userId,
      userName: audit.userName,
      action: AuditAction.UPDATE,
      collectionName: audit.collectionName,
      documentId: audit.documentId,
      changes: audit.changes.map(change => ({
        field: change.field,
        oldValue: change.newValue,
        newValue: change.oldValue
      }))
    });

    return audit;
  }

  static compareObjects(oldObj: any, newObj: any): IAuditChange[] {
    const changes: IAuditChange[] = [];
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

    for (const key of allKeys) {
      const oldValue = oldObj?.[key];
      const newValue = newObj?.[key];

      // Skip if values are the same
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        continue;
      }

      // Skip internal MongoDB fields
      if (key.startsWith('_') || key === '__v') {
        continue;
      }

      changes.push({
        field: key,
        oldValue: oldValue,
        newValue: newValue
      });
    }

    return changes;
  }

  static createAuditLogData(
    userId: string,
    userName: string,
    action: AuditAction,
    collectionName: string,
    documentId: string | mongoose.Types.ObjectId,
    changes: IAuditChange[] = [],
    req?: Request
  ): AuditLogData {
    return {
      userId: new mongoose.Types.ObjectId(userId),
      userName,
      action,
      collectionName,
      documentId: typeof documentId === 'string' ? new mongoose.Types.ObjectId(documentId) : documentId,
      changes,
      req
    };
  }
} 