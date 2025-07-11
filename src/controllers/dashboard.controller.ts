import { Request, Response } from "express";
import { Customer } from "../models/customer.model";
import { Order } from "../models/order.model";
import { Item } from "../models/item.model";
import { Driver } from "../models/driver.model";
import { handleError } from "../utils/errorHandler";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Get current date and calculate date ranges
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total customers (excluding deleted ones)
    const totalCustomers = await Customer.countDocuments({
      status: { $ne: "deleted" }
    });

    // Get total orders for today
    const totalOrdersToday = await Order.countDocuments({
      startDate: {
        $gte: startOfToday,
        $lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    // Get total orders for current month
    const totalOrdersMonth = await Order.countDocuments({
      startDate: {
        $gte: startOfMonth,
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      }
    });

    // Get total items (active only)
    const totalItems = await Item.countDocuments({
      isActive: true
    });

    // Get total drivers (excluding inactive ones)
    const totalDrivers = await Driver.countDocuments({
      status: { $ne: "inactive" }
    });

    const stats = {
      totalCustomers,
      totalOrdersToday,
      totalOrdersMonth,
      totalItems,
      totalDrivers
    };

    res.json(stats);
  } catch (error) {
    handleError(error, res, "Error fetching dashboard statistics");
  }
}; 