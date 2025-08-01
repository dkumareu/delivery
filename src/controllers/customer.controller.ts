import { Request, Response } from "express";
import { Customer, CustomerStatus } from "../models/customer.model";
import { Order } from "../models/order.model";
import { handleError } from "../utils/errorHandler";
import { AuditService } from "../utils/auditService";
import { AuditAction } from "../models/audit.model";
import { User } from "../models/user.model";

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const {
      customerNumber,
      name,
      street,
      houseNumber,
      postalCode,
      city,
      mobileNumber,
      email,
      status,
      vacationStartDate,
      vacationEndDate,
      visitTimeRange,
      latitude,
      longitude,
    } = req.body;

    const existingCustomer = await Customer.findOne({ customerNumber });
    if (existingCustomer) {
      return res.status(400).json({
        error: "Customer number already exists",
        message: `Customer number '${customerNumber}' already exists`,
      });
    }

    const customer = new Customer({
      customerNumber,
      name,
      street,
      houseNumber,
      postalCode,
      city,
      mobileNumber,
      email,
      status: status || CustomerStatus.ACTIVE,
      vacationStartDate,
      vacationEndDate,
      visitTimeRange,
      latitude,
      longitude,
    });

    await customer.save();

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.CREATE,
          'customers',
          (customer._id as any).toString(),
          [],
          req
        )
      );
    }

    res.status(201).json(customer);
  } catch (error) {
    handleError(error, res, "Error creating customer");
  }
};

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const query: any = {};

    // Always exclude deleted customers unless specifically requested
    if (status === "deleted") {
      query.status = "deleted";
    } else {
      query.status = { $ne: "deleted" };
    }

    if (search) {
      query.$or = [
        { customerNumber: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { postalCode: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "deleted") {
      query.status = status;
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    handleError(error, res, "Error fetching customers");
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        error: "Customer not found",
        message: "Customer not found",
      });
    }
    
    // Check if customer is deleted
    if (customer.status === CustomerStatus.DELETED) {
      return res.status(404).json({
        error: "Customer not found",
        message: "Customer not found",
      });
    }
    
    res.json(customer);
  } catch (error) {
    handleError(error, res, "Error fetching customer");
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    "customerNumber",
    "name",
    "street",
    "houseNumber",
    "postalCode",
    "city",
    "mobileNumber",
    "email",
    "status",
    "vacationStartDate",
    "vacationEndDate",
    "visitTimeRange",
    "latitude",
    "longitude",
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
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        error: "Customer not found",
        message: "Customer not found",
      });
    }

    // Store old values for audit
    const oldValues = {
      customerNumber: customer.customerNumber,
      name: customer.name,
      street: customer.street,
      houseNumber: customer.houseNumber,
      postalCode: customer.postalCode,
      city: customer.city,
      mobileNumber: customer.mobileNumber,
      email: customer.email,
      status: customer.status,
      vacationStartDate: customer.vacationStartDate,
      vacationEndDate: customer.vacationEndDate,
      visitTimeRange: customer.visitTimeRange,
      latitude: customer.latitude,
      longitude: customer.longitude,
    };

    updates.forEach((update) => {
      (customer as any)[update] = req.body[update];
    });

    await customer.save();

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects(oldValues, customer.toObject());
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'customers',
          (customer._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json(customer);
  } catch (error) {
    handleError(error, res, "Error updating customer");
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        error: "Customer not found",
        message: "Customer not found",
      });
    }

    // Check if customer is already deleted
    if (customer.status === CustomerStatus.DELETED) {
      return res.status(400).json({
        error: "Customer already deleted",
        message: "Customer is already deleted",
      });
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);

    // Soft delete - change status to deleted instead of removing from database
    customer.status = CustomerStatus.DELETED;
    await customer.save();
    
    // Log audit trail
    if (req.user?.userId) {
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.DELETE,
          'customers',
          (customer._id as any).toString(),
          [],
          req
        )
      );
    }
    
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    handleError(error, res, "Error deleting customer");
  }
};

export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;

    // Check if customer exists and is not deleted
    const customer = await Customer.findById(customerId);
    if (!customer || customer.status === CustomerStatus.DELETED) {
      return res.status(404).json({
        error: "Customer not found",
        message: "Customer not found",
      });
    }

    // Get all orders for the customer
    const orders = await Order.find({ customer: customerId })
      .select(
        "orderNumber status startDate endDate totalNetAmount totalGrossAmount"
      )
      .sort({ startDate: -1 });

    res.json(orders);
  } catch (error) {
    handleError(error, res, "Error fetching customer orders");
  }
};
