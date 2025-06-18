import { Request, Response } from "express";
import { Customer, CustomerStatus } from "../models/customer.model";
import { Order } from "../models/order.model";

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
    } = req.body;

    const existingCustomer = await Customer.findOne({ customerNumber });
    if (existingCustomer) {
      return res.status(400).json({ error: "Customer number already exists" });
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
    });

    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Error creating customer",
      details: error,
    });
  }
};

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { customerNumber: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { postalCode: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const customers = await Customer.find(query).sort({ name: 1 });
    res.json(customers);
  } catch (error) {
    res.status(400).json({ error: "Error fetching customers" });
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: "Error fetching customer" });
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
  ];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).json({ error: "Invalid updates" });
  }

  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    updates.forEach((update) => {
      (customer as any)[update] = req.body[update];
    });

    await customer.save();
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: "Error updating customer" });
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await customer.deleteOne();
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: "Error deleting customer" });
  }
};

export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;

    // Check if customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Get all orders for the customer
    const orders = await Order.find({ customer: customerId })
      .select(
        "orderNumber status startDate endDate totalNetAmount totalGrossAmount"
      )
      .sort({ startDate: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    res.status(500).json({ error: "Error fetching customer orders" });
  }
};
