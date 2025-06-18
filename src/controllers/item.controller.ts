import { Request, Response } from "express";
import { Item, UnitOfMeasure } from "../models/item.model";

export const createItem = async (req: Request, res: Response) => {
  try {
    const { filterType, length, width, depth, unitOfMeasure } = req.body;

    const item = new Item({
      filterType,
      length,
      width,
      depth,
      unitOfMeasure,
    });

    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: "Error creating item" });
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
    res.status(400).json({ error: "Error fetching items" });
  }
};

export const getItemById = async (req: Request, res: Response) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: "Error fetching item" });
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
    return res.status(400).json({ error: "Invalid updates" });
  }

  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    updates.forEach((update) => {
      (item as any)[update] = req.body[update];
    });

    await item.save();
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: "Error updating item" });
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Instead of deleting, mark as inactive
    item.isActive = false;
    await item.save();
    res.json({ message: "Item marked as inactive" });
  } catch (error) {
    res.status(400).json({ error: "Error updating item status" });
  }
};
