import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuditService } from "../utils/auditService";
import { handleError } from "../utils/errorHandler";
import { User } from "../models/user.model";
import { Customer } from "../models/customer.model";
import { Order } from "../models/order.model";
import { Driver } from "../models/driver.model";
import { Item } from "../models/item.model";

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const {
      collectionName,
      documentId,
      userId,
      action,
      page = 1,
      limit = 20
    } = req.query;

    const result = await AuditService.getChanges(
      collectionName as string,
      documentId as string,
      userId as string,
      action as any,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json(result);
  } catch (error) {
    handleError(error, res, "Error fetching audit logs");
  }
};

export const getAuditLogById = async (req: Request, res: Response) => {
  try {
    const { auditId } = req.params;
    const audit = await AuditService.getChangeById(auditId);

    if (!audit) {
      return res.status(404).json({
        error: "Audit log not found",
        message: "Audit log not found"
      });
    }

    res.json(audit);
  } catch (error) {
    handleError(error, res, "Error fetching audit log");
  }
};

export const revertChange = async (req: Request, res: Response) => {
  try {
    const { auditId } = req.params;
    const audit = await AuditService.getChangeById(auditId);

    if (!audit) {
      return res.status(404).json({
        error: "Audit log not found",
        message: "Audit log not found"
      });
    }

    // Get the appropriate model based on collection name
    let targetModel: mongoose.Model<any>;
    switch (audit.collectionName) {
      case 'users':
        targetModel = User;
        break;
      case 'customers':
        targetModel = Customer;
        break;
      case 'orders':
        targetModel = Order;
        break;
      case 'drivers':
        targetModel = Driver;
        break;
      case 'items':
        targetModel = Item;
        break;
      default:
        return res.status(400).json({
          error: "Unsupported collection",
          message: `Cannot revert changes for collection: ${audit.collectionName}`
        });
    }

    const revertedAudit = await AuditService.revertChange(auditId, targetModel);

    res.json({
      message: "Change reverted successfully",
      audit: revertedAudit
    });
  } catch (error) {
    handleError(error, res, "Error reverting change");
  }
};

export const getAuditStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query: any = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const [totalChanges, changesByAction, changesByCollection, changesByUser] = await Promise.all([
      mongoose.model('Audit').countDocuments(query),
      mongoose.model('Audit').aggregate([
        { $match: query },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]),
      mongoose.model('Audit').aggregate([
        { $match: query },
        { $group: { _id: '$collectionName', count: { $sum: 1 } } }
      ]),
      mongoose.model('Audit').aggregate([
        { $match: query },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { 
          userId: '$_id', 
          userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          count: 1 
        } }
      ])
    ]);

    res.json({
      totalChanges,
      changesByAction,
      changesByCollection,
      changesByUser
    });
  } catch (error) {
    handleError(error, res, "Error fetching audit statistics");
  }
}; 