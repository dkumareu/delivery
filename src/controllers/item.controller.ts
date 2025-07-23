import { Request, Response } from "express";
import { Item, UnitOfMeasure } from "../models/item.model";
import { handleError } from "../utils/errorHandler";
import { AuditService } from "../utils/auditService";
import { AuditAction } from "../models/audit.model";
import { User } from "../models/user.model";

export const createItem = async (req: Request, res: Response) => {
  try {
    const { filterType, length, width, depth, unitOfMeasure } = req.body;

    // Check if an item with the same combination already exists
    const existingItem = await Item.findOne({
      filterType,
      length,
      width,
      depth,
      unitOfMeasure,
    });

    if (existingItem) {
      return res.status(409).json({
        error: "Duplicate item",
        message: "An item with this exact combination of filter type, dimensions, and unit of measure already exists.",
        existingItem: {
          _id: existingItem._id,
          filterType: existingItem.filterType,
          length: existingItem.length,
          width: existingItem.width,
          depth: existingItem.depth,
          unitOfMeasure: existingItem.unitOfMeasure,
        }
      });
    }

    const item = new Item({
      filterType,
      length,
      width,
      depth,
      unitOfMeasure,
    });

    await item.save();

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.CREATE,
          'items',
          (item._id as any).toString(),
          [],
          req
        )
      );
    }

    res.status(201).json(item);
  } catch (error) {
    handleError(error, res, "Error creating item");
  }
};

export const getItems = async (req: Request, res: Response) => {
  try {
    const { search, isActive } = req.query;
    const query: any = {};

    if (search) {
      query.filterType = { $regex: search, $options: "i" };
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const items = await Item.find(query).sort({ filterType: 1 });
    res.json(items);
  } catch (error) {
    handleError(error, res, "Error fetching items");
  }
};

export const getItemById = async (req: Request, res: Response) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        error: "Item not found",
        message: "Item not found",
      });
    }
    res.json(item);
  } catch (error) {
    handleError(error, res, "Error fetching item");
  }
};

export const updateItem = async (req: Request, res: Response) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    "filterType",
    "length",
    "width",
    "depth",
    "unitOfMeasure",
    "isActive",
  ];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).json({
      error: "Invalid updates",
      message: "Invalid field(s) provided for update",
    });
  }

  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        error: "Item not found",
        message: "Item not found",
      });
    }

    // Store old values for audit
    const oldValues = {
      filterType: item.filterType,
      length: item.length,
      width: item.width,
      depth: item.depth,
      unitOfMeasure: item.unitOfMeasure,
      isActive: item.isActive,
    };

    // Check for duplicate combination when updating dimensions or filter type
    if (updates.some(update => ['filterType', 'length', 'width', 'depth', 'unitOfMeasure'].includes(update))) {
      const newValues = { ...item.toObject(), ...req.body };
      const existingItem = await Item.findOne({
        _id: { $ne: req.params.id }, // Exclude current item
        filterType: newValues.filterType,
        length: newValues.length,
        width: newValues.width,
        depth: newValues.depth,
        unitOfMeasure: newValues.unitOfMeasure,
      });

      if (existingItem) {
        return res.status(409).json({
          error: "Duplicate item",
          message: "An item with this exact combination of filter type, dimensions, and unit of measure already exists.",
          existingItem: {
            _id: existingItem._id,
            filterType: existingItem.filterType,
            length: existingItem.length,
            width: existingItem.width,
            depth: existingItem.depth,
            unitOfMeasure: existingItem.unitOfMeasure,
          }
        });
      }
    }

    updates.forEach((update) => {
      (item as any)[update] = req.body[update];
    });

    await item.save();

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects(oldValues, item.toObject());
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'items',
          (item._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json(item);
  } catch (error) {
    handleError(error, res, "Error updating item");
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        error: "Item not found",
        message: "Item not found",
      });
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);

    await item.deleteOne();

    // Log audit trail
    if (req.user?.userId) {
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.DELETE,
          'items',
          (item._id as any).toString(),
          [],
          req
        )
      );
    }

    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    handleError(error, res, "Error deleting item");
  }
};
