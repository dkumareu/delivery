import { Request, Response } from "express";
import {
  Order,
  OrderStatus,
  PaymentMethod,
  Frequency,
  IOrderItem,
  IOrder,
} from "../models/order.model";
import { Customer, CustomerStatus } from "../models/customer.model";
import { Item } from "../models/item.model";
import { Driver } from "../models/driver.model";
import { handleError } from "../utils/errorHandler";
import { AuditService } from "../utils/auditService";
import { AuditAction } from "../models/audit.model";
import { User } from "../models/user.model";
import { S3Service } from "../utils/s3Service";
import { generateUniqueOrderNumbers, generateSingleOrderNumber } from "../utils/orderNumberUtils";

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
      case "every_2nd_week":
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case "every_3rd_week":
        currentDate.setDate(currentDate.getDate() + 21); // 3 weeks = 21 days
        break;
      case "every_5th_week":
        currentDate.setDate(currentDate.getDate() + 35); // 5 weeks = 35 days
        break;
      case "6_weeks":
        currentDate.setDate(currentDate.getDate() + 42); // 6 weeks = 42 days
        break;
      case "8_weeks":
        currentDate.setDate(currentDate.getDate() + 56); // 8 weeks = 56 days
        break;
      case "twice_in_a_week":
        currentDate.setDate(currentDate.getDate() + 3.5); // Twice a week = every 3.5 days
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
      case "one_time":
        // For one-time orders, only create the initial order and don't continue
        return dates;
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
      articleNumber,
      startDate,
      endDate,
      frequency,
      totalNetAmount,
      totalGrossAmount,
      status = OrderStatus.PENDING,
    } = req.body;

    console.log('=== CREATE ORDER DEBUG ===');
    console.log('Received status:', status);
    console.log('Default status:', OrderStatus.PENDING);
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    // Validate customer is present in request
    if (!customer) {
      return res.status(400).json({ 
        error: "Customer is required",
        message: "Customer must be provided in the request" 
      });
    }

    // Check if customer exists and is active
    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (customerDoc.status !== CustomerStatus.ACTIVE) {
      return res.status(400).json({ error: "Customer is not active" });
    }

    // For draft orders, only validate customer and create a single draft order
    if (status === OrderStatus.DRAFT) {
      console.log('Creating DRAFT order');
      const orderNumber = await generateSingleOrderNumber(new Date().getFullYear());
      const order = new Order({
        orderNumber,
        customer: customerDoc._id,
        items: items || [], // Allow empty items for draft
        paymentMethod: paymentMethod || PaymentMethod.CASH_PAYMENT,
        driverNote,
        articleNumber,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(),
        frequency,
        totalNetAmount: totalNetAmount || 0,
        totalGrossAmount: totalGrossAmount || 0,
        status: OrderStatus.DRAFT,
        mainOrder: true,
      });

      console.log('Draft order status:', order.status);
      await order.save();

      // Get current user details for audit
      const currentUser = await User.findById(req.user?.userId);
      
      // Log audit trail
      if (req.user?.userId) {
        await AuditService.logChange(
          AuditService.createAuditLogData(
            req.user.userId as string,
            currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
            AuditAction.CREATE,
            'orders',
            (order._id as any).toString(),
            [],
            req
          )
        );
      }

      // Populate the response with customer details
      const populatedOrder = await Order.findById(order._id)
        .populate(
          "customer",
          "customerNumber name street houseNumber postalCode city latitude longitude visitTimeRange"
        )
        .populate("items.item", "filterType length width depth unitOfMeasure");

      res.status(201).json([populatedOrder]);
      return;
    }

    // For non-draft orders, validate all mandatory fields with individual messages
    const fieldValidations = [
      { field: 'items', value: items, message: 'Items are required for non-draft orders' },
      { field: 'startDate', value: startDate, message: 'Start date is required for non-draft orders' },
      { field: 'endDate', value: endDate, message: 'End date is required for non-draft orders' },
      { field: 'frequency', value: frequency, message: 'Frequency is required for non-draft orders' },
      { field: 'totalNetAmount', value: totalNetAmount, message: 'Total net amount is required for non-draft orders' },
      { field: 'totalGrossAmount', value: totalGrossAmount, message: 'Total gross amount is required for non-draft orders' }
    ];

    const missingFields = fieldValidations
      .filter(validation => !validation.value)
      .map(validation => ({ field: validation.field, message: validation.message }));

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing mandatory fields for non-draft orders",
        message: missingFields[0].message, // Return the first missing field message
        missingFields: missingFields
      });
    }

    // Validate items array is not empty
    if (!items || items.length === 0) {
      return res.status(400).json({ 
        error: "Items are required for non-draft orders",
        message: "At least one item must be provided for non-draft orders" 
      });
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

    // Generate all order numbers at once for better performance
    const orderNumbers = await generateUniqueOrderNumbers(new Date().getFullYear(), deliveryDates.length);
    
    console.log('Creating non-draft orders with status:', status);
    
    for (let i = 0; i < deliveryDates.length; i++) {
      const order = new Order({
        orderNumber: orderNumbers[i],
        customer: customerDoc._id,
        items: processedItems,
        paymentMethod,
        driverNote,
        articleNumber,
        startDate: deliveryDates[i],
        endDate: i === 0 ? new Date(endDate) : deliveryDates[i], // For recurring orders, start and end date are the same
        frequency,
        totalNetAmount,
        totalGrossAmount,
        status: OrderStatus.PENDING,
        mainOrder: i === 0, // First order is the main order
        originalOrderNumber: i === 0 ? null : orderNumbers[0], // Reference to main order
      });

      console.log(`Order ${i + 1} status:`, order.status);
      await order.save();
      createdOrders.push(order);
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail for each created order
    if (req.user?.userId) {
      for (const order of createdOrders) {
        await AuditService.logChange(
          AuditService.createAuditLogData(
            req.user.userId as string,
            currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
            AuditAction.CREATE,
            'orders',
            (order._id as any).toString(),
            [],
            req
          )
        );
      }
    }

    // Populate the response with customer and item details
    const populatedOrders = await Order.find({
      _id: { $in: createdOrders.map((o) => o._id) },
    })
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city latitude longitude visitTimeRange"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure");

    res.status(201).json(populatedOrders);
  } catch (error: any) {
    handleError(error, res, "Error creating order");
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      date,
      startDate,
      endDate,
      customer,
      allOrders,
      driver,
      year,
      month,
    } = req.query;

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

    if (driver) {
      query.assignedDriver = driver;
    }

    // Filter by year and month if provided
    if (year && month) {
      const startOfMonth = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const endOfMonth = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59, 999);
      query.startDate = {
        $gte: startOfMonth,
        $lte: endOfMonth,
      };
    }

    // If allOrders is false or not provided, only show main orders
    if (allOrders !== "true") {
      query.mainOrder = true;
    }

    // Determine sort order - if filtering by driver and date, sort by delivery sequence
    let sortOrder: any = { createdAt: -1 };
    if (driver && date) {
      sortOrder = { deliverySequence: 1, createdAt: -1 };
    }

    const orders = await Order.find(query)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude visitTimeRange"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure")
      .populate(
        "assignedDriver",
        "name street houseNumber postalCode city driverNumber email mobileNumber"
      )
      .sort(sortOrder);
    console.log("query", query);
    res.json(orders);
  } catch (error) {
    handleError(error, res, "Error fetching orders");
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude visitTimeRange"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure")
      .populate(
        "assignedDriver",
        "name street houseNumber postalCode city driverNumber email mobileNumber"
      );

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
        message: "Order not found",
      });
    }

    res.json(order);
  } catch (error) {
    handleError(error, res, "Error fetching order");
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    "customer",
    "items",
    "paymentMethod",
    "driverNote",
    "articleNumber",
    "startDate",
    "endDate",
    "frequency",
    "assignedDriver",
    "status",
    "totalNetAmount",
    "totalGrossAmount",
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
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Store old values for audit
    const oldValues = {
      customer: order.customer,
      items: order.items,
      paymentMethod: order.paymentMethod,
      driverNote: order.driverNote,
      articleNumber: order.articleNumber,
      startDate: order.startDate,
      endDate: order.endDate,
      frequency: order.frequency,
      assignedDriver: order.assignedDriver,
      status: order.status,
      totalNetAmount: order.totalNetAmount,
      totalGrossAmount: order.totalGrossAmount,
    };

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

    // For non-draft orders, validate mandatory fields when they are being updated
    if (order.status !== OrderStatus.DRAFT) {
      const fieldValidations = [
        { 
          field: 'items', 
          value: updates.includes("items") ? req.body.items : order.items, 
          message: 'Items are required for non-draft orders' 
        },
        { 
          field: 'startDate', 
          value: updates.includes("startDate") ? req.body.startDate : order.startDate, 
          message: 'Start date is required for non-draft orders' 
        },
        { 
          field: 'endDate', 
          value: updates.includes("endDate") ? req.body.endDate : order.endDate, 
          message: 'End date is required for non-draft orders' 
        },
        { 
          field: 'frequency', 
          value: updates.includes("frequency") ? req.body.frequency : order.frequency, 
          message: 'Frequency is required for non-draft orders' 
        },
        { 
          field: 'totalNetAmount', 
          value: updates.includes("totalNetAmount") ? req.body.totalNetAmount : order.totalNetAmount, 
          message: 'Total net amount is required for non-draft orders' 
        },
        { 
          field: 'totalGrossAmount', 
          value: updates.includes("totalGrossAmount") ? req.body.totalGrossAmount : order.totalGrossAmount, 
          message: 'Total gross amount is required for non-draft orders' 
        }
      ];

      const missingFields = fieldValidations
        .filter(validation => !validation.value)
        .map(validation => ({ field: validation.field, message: validation.message }));

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: "Missing mandatory fields for non-draft orders",
          message: missingFields[0].message, // Return the first missing field message
          missingFields: missingFields
        });
      }
    }

    // If items are being updated, process them
    if (updates.includes("items")) {
      // For draft orders, allow empty items
      if (order.status === OrderStatus.DRAFT && (!req.body.items || req.body.items.length === 0)) {
        req.body.items = [];
      } else {
        // For non-draft orders, validate items
        if (!req.body.items || req.body.items.length === 0) {
          return res.status(400).json({ 
            error: "Items are required for non-draft orders",
            message: "At least one item must be provided for non-draft orders" 
          });
        }

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
    }

    // Handle recurring order updates (skip for draft orders)
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
        
        // Generate all order numbers at once for the new recurring orders
        const newRecurringOrderCount = deliveryDates.length - 1; // Exclude the first date (main order)
        const orderNumbers = await generateUniqueOrderNumbers(new Date().getFullYear(), newRecurringOrderCount);
        
        for (let i = 0; i < deliveryDates.length; i++) {
          if (i === 0) continue; // Skip first date as it's the main order

          const orderNumber = orderNumbers[i - 1]; // Use the pre-generated order number

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
            articleNumber: updates.includes("articleNumber")
              ? req.body.articleNumber
              : order.articleNumber,
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
    } else if (isRecurringUpdate && !order.mainOrder && order.status !== OrderStatus.DRAFT) {
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

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects(oldValues, order.toObject());
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'orders',
          (order._id as any).toString(),
          changes,
          req
        )
      );
    }

    // Populate the response with customer and item details
    const updatedOrder = await Order.findById(order._id)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city latitude longitude visitTimeRange"
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

    // Allow deletion of pending and draft orders
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.DRAFT) {
      return res.status(400).json({ 
        error: "Can only delete pending or draft orders",
        message: "Only orders with 'pending' or 'draft' status can be deleted"
      });
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);

    let ordersToDelete = [order];
    let deletedCount = 1;

    // If this is a main order, also delete all its recurring orders
    if (order.mainOrder) {
      const recurringOrders = await Order.find({
        originalOrderNumber: order.orderNumber,
        mainOrder: false
      });
      
      if (recurringOrders.length > 0) {
        ordersToDelete = [...ordersToDelete, ...recurringOrders];
        deletedCount += recurringOrders.length;
        console.log(`Deleting main order ${order.orderNumber} and ${recurringOrders.length} recurring orders`);
      }
    }
    // If this is a recurring order, also delete the main order and all other recurring orders
    else if (order.originalOrderNumber) {
      const mainOrder = await Order.findOne({
        orderNumber: order.originalOrderNumber,
        mainOrder: true
      });
      
      if (mainOrder) {
        const allRecurringOrders = await Order.find({
          originalOrderNumber: order.originalOrderNumber,
          mainOrder: false
        });
        
        ordersToDelete = [mainOrder, ...allRecurringOrders];
        deletedCount = 1 + allRecurringOrders.length;
        console.log(`Deleting main order ${mainOrder.orderNumber} and ${allRecurringOrders.length} recurring orders`);
      }
    }

    // Delete all orders
    const orderIds = ordersToDelete.map(o => o._id);
    await Order.deleteMany({ _id: { $in: orderIds } });

    // Log audit trail for each deleted order
    if (req.user?.userId) {
      for (const deletedOrder of ordersToDelete) {
        await AuditService.logChange(
          AuditService.createAuditLogData(
            req.user.userId as string,
            currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
            AuditAction.DELETE,
            'orders',
            (deletedOrder._id as any).toString(),
            [],
            req
          )
        );
      }
    }

    res.json({ 
      message: `Order${deletedCount > 1 ? 's' : ''} deleted successfully`,
      deletedCount: deletedCount
    });
  } catch (error) {
    res.status(400).json({ error: "Error deleting order" });
  }
};

export const getMainOrdersByCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    
    const query: any = { 
      customer: customerId,
      mainOrder: true 
    };

    const orders = await Order.find(query)
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude visitTimeRange"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure")
      .populate(
        "assignedDriver",
        "name street houseNumber postalCode city driverNumber email mobileNumber"
      )
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    handleError(error, res, "Error fetching main orders");
  }
};

export const getUnassignedOrders = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query: any = { assignedDriver: null };

    // Add date range filter if provided
    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const orders = await Order.find(query)
      .populate(
        "customer",
        "name customerNumber street houseNumber postalCode city email mobileNumber latitude longitude"
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

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({
        error: "Invalid status provided",
        message: "Status must be one of the valid order statuses",
      });
    }

    // Find the order first to get old values for audit
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        error: "Order not found",
        message: "Order not found",
      });
    }

    // Store old value for audit
    const oldStatus = order.status;

    // Find and update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { 
        status,
        lastUpdated: new Date()
      },
      { new: true }
    ).populate(
      "customer",
      "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude"
    ).populate("items.item", "filterType length width depth unitOfMeasure");

    if (!updatedOrder) {
      return res.status(404).json({
        error: "Order not found",
        message: "Order not found",
      });
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects({ status: oldStatus }, { status: updatedOrder.status });
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'orders',
          (updatedOrder._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    handleError(error, res, "Error updating order status");
  }
};

export const updateDeliverySequence = async (req: Request, res: Response) => {
  try {
    const { orderIds, driverId, deliveryDate } = req.body;

    // Validate required fields
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        error: "Invalid orderIds. Must be a non-empty array.",
      });
    }

    if (!driverId) {
      return res.status(400).json({
        error: "Driver ID is required.",
      });
    }

    if (!deliveryDate) {
      return res.status(400).json({
        error: "Delivery date is required.",
      });
    }

    // Validate driver exists
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Validate all orders exist and belong to the specified driver
    const orders = await Order.find({
      _id: { $in: orderIds },
      assignedDriver: driverId,
    });

    console.log("Validation debug:", {
      requestedOrderIds: orderIds,
      requestedDriverId: driverId,
      foundOrdersCount: orders.length,
      requestedCount: orderIds.length,
    });

    if (orders.length !== orderIds.length) {
      return res.status(400).json({
        error: "Some orders not found or do not match the specified driver.",
        orderIds: orderIds,
        driverId: driverId,
        foundOrdersCount: orders.length,
        requestedCount: orderIds.length,
      });
    }

    // Update delivery sequence for each order
    const updatePromises = orderIds.map((orderId: string, index: number) => {
      return Order.findByIdAndUpdate(
        orderId,
        {
          $set: {
            deliverySequence: index + 1,
            lastUpdated: new Date(),
          },
        },
        { new: true }
      );
    });

    const updatedOrders = await Promise.all(updatePromises);

    // Populate the response with customer and item details
    const populatedOrders = await Order.find({
      _id: { $in: orderIds },
    })
      .populate(
        "customer",
        "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude visitTimeRange"
      )
      .populate("items.item", "filterType length width depth unitOfMeasure")
      .populate(
        "assignedDriver",
        "name street houseNumber postalCode city driverNumber email mobileNumber"
      )
      .sort({ deliverySequence: 1 });

    res.json({
      message: "Delivery sequence updated successfully",
      orders: populatedOrders,
      updatedCount: updatedOrders.length,
    });
  } catch (error) {
    handleError(error, res, "Error updating delivery sequence");
  }
};

// Image upload endpoints
export const generateImageUploadUrl = async (req: Request, res: Response) => {
  try {
    const { orderId, imageType, fileName, contentType } = req.body;

    // Validate required fields
    if (!orderId || !imageType || !fileName || !contentType) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "orderId, imageType, fileName, and contentType are required",
      });
    }

    // Validate image type
    if (!['before', 'after'].includes(imageType)) {
      return res.status(400).json({
        error: "Invalid image type",
        message: "imageType must be 'before' or 'after'",
      });
    }

    // Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if we've reached the limit for this image type
    const currentImages = imageType === 'before' ? order.beforeImages : order.afterImages;
    if (currentImages && currentImages.length >= 10) {
      return res.status(400).json({
        error: "Image limit reached",
        message: `Cannot upload more than 10 ${imageType} images`,
      });
    }

    // Generate unique filename
    const uniqueFileName = S3Service.generateFileName(orderId, imageType, fileName);

    // Generate pre-signed URL
    const presignedUrl = await S3Service.generatePresignedUrl(uniqueFileName, contentType);

    res.json({
      presignedUrl,
      fileName: uniqueFileName,
      message: "Upload URL generated successfully",
    });
  } catch (error) {
    handleError(error, res, "Error generating upload URL");
  }
};

export const updateOrderArticleNumber = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { articleNumber } = req.body;

    // Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Store old value for audit
    const oldArticleNumber = order.articleNumber;

    // Update the article number
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { 
        articleNumber: articleNumber?.trim() || null,
        lastUpdated: new Date()
      },
      { new: true }
    ).populate(
      "customer",
      "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude"
    ).populate("items.item", "filterType length width depth unitOfMeasure");

    if (!updatedOrder) {
      return res.status(404).json({
        error: "Order not found",
        message: "Order not found",
      });
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects(
        { articleNumber: oldArticleNumber }, 
        { articleNumber: updatedOrder.articleNumber }
      );
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'orders',
          (updatedOrder._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json({
      message: "Order article number updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    handleError(error, res, "Error updating order article number");
  }
};

export const updateOrderAssignedDriver = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { assignedDriver } = req.body;

    // Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate driver exists if provided
    if (assignedDriver) {
      const driver = await Driver.findById(assignedDriver);
      if (!driver) {
        return res.status(404).json({ error: "Driver not found" });
      }
    }

    // Store old value for audit
    const oldAssignedDriver = order.assignedDriver;

    // Update the assigned driver
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { 
        assignedDriver: assignedDriver || null,
        lastUpdated: new Date()
      },
      { new: true }
    ).populate(
      "customer",
      "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude visitTimeRange"
    ).populate("items.item", "filterType length width depth unitOfMeasure")
    .populate(
      "assignedDriver",
      "name street houseNumber postalCode city driverNumber email mobileNumber"
    );

    if (!updatedOrder) {
      return res.status(404).json({
        error: "Order not found",
        message: "Order not found",
      });
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects(
        { assignedDriver: oldAssignedDriver }, 
        { assignedDriver: updatedOrder.assignedDriver }
      );
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'orders',
          (updatedOrder._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json({
      message: "Order assigned driver updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    handleError(error, res, "Error updating order assigned driver");
  }
};

export const updateOrderImages = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { beforeImages, afterImages, action, imageType, fileName } = req.body;
    


    // Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Store old values for audit
    const oldValues = {
      beforeImages: order.beforeImages,
      afterImages: order.afterImages,
    };

    let updates: any = {};

    // Handle different actions
    if (action === 'add' && imageType && fileName && (imageType === 'before' || imageType === 'after')) {
      // Add a single image
      const fieldName = imageType === 'before' ? 'beforeImages' : 'afterImages';
      const currentImages = order[fieldName] || [];
      
      if (currentImages.length >= 10) {
        return res.status(400).json({
          error: "Image limit reached",
          message: `Cannot upload more than 10 ${imageType} images`,
        });
      }

      updates = {
        $push: { [fieldName]: fileName }
      };
    } else if (action === 'remove' && imageType && fileName && (imageType === 'before' || imageType === 'after')) {
      // Remove a single image
      const fieldName = imageType === 'before' ? 'beforeImages' : 'afterImages';
      updates = {
        $pull: { [fieldName]: fileName }
      };
    } else if (beforeImages !== undefined || afterImages !== undefined) {
      // Replace entire arrays (for backward compatibility or bulk updates)
      if (beforeImages !== undefined) {
        if (beforeImages.length > 10) {
          return res.status(400).json({
            error: "Too many before images",
            message: "Cannot have more than 10 before images",
          });
        }
        updates.beforeImages = beforeImages;
      }
      
      if (afterImages !== undefined) {
        if (afterImages.length > 10) {
          return res.status(400).json({
            error: "Too many after images",
            message: "Cannot have more than 10 after images",
          });
        }
        updates.afterImages = afterImages;
      }
    } else {
      return res.status(400).json({
        error: "Invalid request",
        message: "Must provide either action+imageType+fileName or beforeImages/afterImages arrays",
      });
    }

    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      updates,
      { new: true }
    ).populate(
      "customer",
      "customerNumber name street houseNumber postalCode city email mobileNumber latitude longitude visitTimeRange"
    ).populate("items.item", "filterType length width depth unitOfMeasure");

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects(oldValues, updatedOrder?.toObject() || {});
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'orders',
          (updatedOrder?._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json({
      message: "Order images updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    handleError(error, res, "Error updating order images");
  }
};