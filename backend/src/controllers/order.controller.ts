import { Request, Response } from "express";
import {
  Order,
  OrderStatus,
  PaymentMethod,
  Frequency,
  IOrderItem,
} from "../models/order.model";
import { Customer, CustomerStatus } from "../models/customer.model";
import { Item } from "../models/item.model";
import { Driver } from "../models/driver.model";

export const createOrder = async (req: Request, res: Response) => {
  try {
    const {
      customer,
      items,
      paymentMethod,
      driverNote,
      startDate,
      endDate,
      frequency,
      totalNetAmount,
      totalGrossAmount,
    } = req.body;

    // Check if customer exists and is active
    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (customerDoc.status !== CustomerStatus.ACTIVE) {
      return res.status(400).json({ error: "Customer is not active" });
    }

    // Validate items and calculate totals
    const processedItems = await Promise.all(
      items.map(async (item: any) => {
        // Validate item exists and is active
        const itemDoc = await Item.findById(item.item._id);
        if (!itemDoc) {
          throw new Error(`Item ${item.item._id} not found`);
        }
        if (!itemDoc.isActive) {
          throw new Error(`Item ${item.item._id} is not active`);
        }

        return {
          item: item.item._id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          netAmount: item.netAmount,
          grossAmount: item.grossAmount,
        };
      })
    );

    // Generate order number (A-YYYY-XXXX)
    const year = new Date().getFullYear();
    const lastOrder = await Order.findOne({
      orderNumber: new RegExp(`A-${year}-`),
    }).sort({ orderNumber: -1 });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.split("-")[2]);
      sequence = lastSequence + 1;
    }

    const orderNumber = `A-${year}-${sequence.toString().padStart(4, "0")}`;

    // Create the order
    const order = new Order({
      orderNumber,
      customer: customerDoc._id,
      items: processedItems,
      paymentMethod,
      driverNote,
      startDate,
      endDate,
      frequency,
      totalNetAmount,
      totalGrossAmount,
      status: OrderStatus.PENDING,
    });

    await order.save();

    // Populate the response with customer and item details
    const populatedOrder = await Order.findById(order._id)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure");

    res.status(201).json(populatedOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Error creating order" });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const { search, status, startDate, endDate, customer, assignedDriver } =
      req.query;

    const query: any = {};

    if (search) {
      query.$or = [{ orderNumber: { $regex: search, $options: "i" } }];
    }

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    if (customer) {
      query.customer = customer;
    }

    if (assignedDriver) {
      query.assignedDriver = assignedDriver;
    }

    const orders = await Order.find(query)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure")
      .populate("assignedDriver", "firstName lastName")
      .sort({ startDate: -1 });

    res.json(orders);
  } catch (error) {
    res.status(400).json({ error: "Error fetching orders", details: error });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure")
      .populate("assignedDriver", "firstName lastName");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ error: "Error fetching order", details: error });
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    "customer",
    "items",
    "paymentMethod",
    "driverNote",
    "startDate",
    "endDate",
    "frequency",
    "assignedDriver",
    "totalNetAmount",
    "totalGrossAmount",
  ];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).json({ error: "Invalid updates" });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // If customer is being updated, validate it
    if (updates.includes("customer")) {
      const customerDoc = await Customer.findById(req.body.customer);
      if (!customerDoc) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (customerDoc.status !== CustomerStatus.ACTIVE) {
        return res.status(400).json({ error: "Customer is not active" });
      }
    }

    // If items are being updated, process them
    if (updates.includes("items")) {
      const processedItems = await Promise.all(
        req.body.items.map(async (item: any) => {
          // Validate item exists and is active
          const itemDoc = await Item.findById(item.item._id);
          if (!itemDoc) {
            throw new Error(`Item ${item.item._id} not found`);
          }
          if (!itemDoc.isActive) {
            throw new Error(`Item ${item.item._id} is not active`);
          }

          return {
            item: item.item._id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            netAmount: item.netAmount,
            grossAmount: item.grossAmount,
          };
        })
      );

      req.body.items = processedItems;
    }

    updates.forEach((update) => {
      (order as any)[update] = req.body[update];
    });

    await order.save();

    // Populate the response with customer and item details
    const updatedOrder = await Order.findById(order._id)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure");

    res.json(updatedOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Error updating order" });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Only allow deletion of pending orders
    if (order.status !== OrderStatus.PENDING) {
      return res.status(400).json({ error: "Can only delete pending orders" });
    }

    await order.deleteOne();
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: "Error deleting order" });
  }
};

export const getUnassignedOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ assignedDriver: null })
      .populate("customer", "name customerNumber")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(400).json({ error: "Error fetching unassigned orders" });
  }
};

export const assignOrdersToDriver = async (req: Request, res: Response) => {
  try {
    const { driverId, orderIds } = req.body;

    // Validate driver exists
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Update all orders with the driver ID
    const result = await Order.updateMany(
      { _id: { $in: orderIds } },
      { $set: { assignedDriver: driverId } }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: "No orders were updated" });
    }

    res.json({
      message: "Orders assigned successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(400).json({
      error: "Error assigning orders",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
