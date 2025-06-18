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

const generateOrderNumber = async (year: number) => {
  const lastOrder = await Order.findOne({
    orderNumber: new RegExp(`A-${year}-`),
  }).sort({ orderNumber: -1 });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split("-")[2]);
    sequence = lastSequence + 1;
  }

  return `A-${year}-${sequence.toString().padStart(4, "0")}`;
};

const generateRecurringDates = (
  startDate: Date,
  endDate: Date,
  frequency: Frequency
) => {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));

    switch (frequency) {
      case "daily":
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case "weekdays":
        currentDate.setDate(currentDate.getDate() + 1);
        // Skip weekends
        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
        break;
      case "weekly":
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case "biweekly":
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case "monthly":
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case "quarterly":
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case "semi_annually":
        currentDate.setMonth(currentDate.getMonth() + 6);
        break;
      case "annually":
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
    }
  }

  return dates;
};

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

    // Generate recurring dates
    const deliveryDates = generateRecurringDates(
      new Date(startDate),
      new Date(endDate),
      frequency
    );

    // Create orders for each delivery date
    const createdOrders = [];

    const orderNumber = await generateOrderNumber(new Date().getFullYear());
    for (let i = 0; i < deliveryDates.length; i++) {
      const order = new Order({
        orderNumber,
        customer: customerDoc._id,
        items: processedItems,
        paymentMethod,
        driverNote,
        startDate: deliveryDates[i],
        endDate: deliveryDates[i], // For recurring orders, start and end date are the same
        frequency,
        totalNetAmount,
        totalGrossAmount,
        status: OrderStatus.PENDING,
        mainOrder: i === 0, // First order is the main order
        originalOrderNumber: i === 0 ? null : orderNumber, // Reference to main order
      });

      await order.save();
      createdOrders.push(order);
    }

    // Populate the response with customer and item details
    const populatedOrders = await Order.find({
      _id: { $in: createdOrders.map((o) => o._id) },
    })
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure");

    res.status(201).json(populatedOrders);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Error creating order" });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const { search, status, date, startDate, endDate, customer, allOrders } =
      req.query;

    const query: any = {};

    if (search) {
      query.$or = [{ orderNumber: { $regex: search, $options: "i" } }];
    }

    if (status) {
      query.status = status;
    }

    if (date) {
      query.startDate = {
        $gte: new Date(date as string),
        $lte: new Date(date as string),
      };
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

    // If allOrders is false or not provided, only show main orders
    if (allOrders !== "true") {
      query.mainOrder = true;
    }

    const orders = await Order.find(query)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure")
      .populate(
        "assignedDriver",
        "name street houseNumber postalCode city driverNumber email mobileNumber"
      )
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

    // Handle recurring order updates
    const isRecurringUpdate = updates.some((update) =>
      ["frequency", "startDate", "endDate"].includes(update)
    );

    if (isRecurringUpdate && order.mainOrder) {
      // Delete all existing recurring orders that are in pending state
      await Order.deleteMany({
        originalOrderNumber: order.orderNumber,
        mainOrder: false,
        status: OrderStatus.PENDING,
      });

      // Generate new recurring orders
      const newStartDate = updates.includes("startDate")
        ? new Date(req.body.startDate)
        : order.startDate;
      const newEndDate = updates.includes("endDate")
        ? new Date(req.body.endDate)
        : order.endDate;
      const newFrequency = updates.includes("frequency")
        ? req.body.frequency
        : order.frequency;

      if (newStartDate && newEndDate && newFrequency) {
        // Update main order's dates and frequency
        order.startDate = newStartDate;
        order.endDate = newEndDate;
        order.frequency = newFrequency;

        const deliveryDates = generateRecurringDates(
          newStartDate,
          newEndDate,
          newFrequency
        );

        // Create new recurring orders
        const createdOrders = [];
        for (let i = 0; i < deliveryDates.length; i++) {
          if (i === 0) continue; // Skip first date as it's the main order

          const orderNumber = await generateOrderNumber(
            new Date().getFullYear()
          );

          const recurringOrder = new Order({
            orderNumber,
            customer: order.customer,
            items: updates.includes("items") ? req.body.items : order.items,
            paymentMethod: updates.includes("paymentMethod")
              ? req.body.paymentMethod
              : order.paymentMethod,
            driverNote: updates.includes("driverNote")
              ? req.body.driverNote
              : order.driverNote,
            startDate: deliveryDates[i],
            endDate: deliveryDates[i],
            frequency: newFrequency,
            totalNetAmount: updates.includes("totalNetAmount")
              ? req.body.totalNetAmount
              : order.totalNetAmount,
            totalGrossAmount: updates.includes("totalGrossAmount")
              ? req.body.totalGrossAmount
              : order.totalGrossAmount,
            status: OrderStatus.PENDING,
            mainOrder: false,
            originalOrderNumber: order.orderNumber,
          });

          await recurringOrder.save();
          createdOrders.push(recurringOrder);
        }
      }
    } else if (isRecurringUpdate && !order.mainOrder) {
      // If updating a recurring order, update the main order instead
      const mainOrder = await Order.findOne({
        orderNumber: order.originalOrderNumber,
        mainOrder: true,
      });

      if (mainOrder) {
        return res.status(400).json({
          error:
            "Cannot update recurring order directly. Please update the main order instead.",
        });
      }
    }

    // Update the main order
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
      .populate(
        "customer",
        "name customerNumber street houseNumber postalCode city email mobileNumber"
      )
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
