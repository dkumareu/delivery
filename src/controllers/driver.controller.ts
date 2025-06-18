import { Request, Response } from "express";
import { Driver, DriverStatus } from "../models/driver.model";

export const createDriver = async (req: Request, res: Response) => {
  try {
    const {
      driverNumber,
      name,
      street,
      houseNumber,
      postalCode,
      city,
      mobileNumber,
      email,
      password,
      status,
      vacationStartDate,
      vacationEndDate,
    } = req.body;

    const existingDriver = await Driver.findOne({ driverNumber });
    if (existingDriver) {
      return res.status(400).json({ error: "Driver number already exists" });
    }

    const driver = new Driver({
      driverNumber,
      name,
      street,
      houseNumber,
      postalCode,
      city,
      mobileNumber,
      email,
      password,
      status: status || DriverStatus.ACTIVE,
      vacationStartDate,
      vacationEndDate,
    });

    await driver.save();
    res.status(201).json(driver);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Error creating driver",
      details: error,
    });
  }
};

export const getDrivers = async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { driverNumber: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { postalCode: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const drivers = await Driver.find(query)
      .select("-password") // Exclude password from response
      .sort({ name: 1 });
    res.json(drivers);
  } catch (error) {
    res.status(400).json({ error: "Error fetching drivers" });
  }
};

export const getDriverById = async (req: Request, res: Response) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-password");
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.json(driver);
  } catch (error) {
    res.status(400).json({ error: "Error fetching driver" });
  }
};

export const updateDriver = async (req: Request, res: Response) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "driverNumber",
      "name",
      "street",
      "houseNumber",
      "postalCode",
      "city",
      "mobileNumber",
      "email",
      "password",
      "status",
      "vacationStartDate",
      "vacationEndDate",
    ];
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({
        error: "Invalid updates",
        details: "One or more fields in the update are not allowed",
      });
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Check if driverNumber is being updated and if it already exists
    if (updates.includes("driverNumber")) {
      const existingDriver = await Driver.findOne({
        driverNumber: req.body.driverNumber,
        _id: { $ne: req.params.id }, // Exclude current driver
      });
      if (existingDriver) {
        return res.status(400).json({ error: "Driver number already exists" });
      }
    }

    // Update fields
    updates.forEach((update) => {
      if (update === "password" && req.body.password) {
        // Only update password if it's provided and not empty
        driver.password = req.body.password;
      } else if (update !== "password") {
        // Update all other fields
        (driver as any)[update] = req.body[update];
      }
    });

    await driver.save();

    // Fetch updated driver without password
    const updatedDriver = await Driver.findById(req.params.id).select(
      "-password"
    );
    if (!updatedDriver) {
      return res.status(404).json({ error: "Error fetching updated driver" });
    }

    res.json(updatedDriver);
  } catch (error) {
    console.error("Error updating driver:", error);
    res.status(400).json({
      error: "Error updating driver",
      details:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

export const deleteDriver = async (req: Request, res: Response) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    await driver.deleteOne();
    res.json({ message: "Driver deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: "Error deleting driver" });
  }
};
