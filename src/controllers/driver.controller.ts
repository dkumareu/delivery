import { Request, Response } from "express";
import { Driver, DriverStatus } from "../models/driver.model";
import { handleError } from "../utils/errorHandler";

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
      latitude,
      longitude,
    } = req.body;

    const existingDriver = await Driver.findOne({ driverNumber });
    if (existingDriver) {
      return res.status(400).json({
        error: "Driver number already exists",
        message: `Driver number '${driverNumber}' already exists`,
      });
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
      latitude,
      longitude,
    });

    await driver.save();
    res.status(201).json(driver);
  } catch (error) {
    handleError(error, res, "Error creating driver");
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
    handleError(error, res, "Error fetching drivers");
  }
};

export const getDriverById = async (req: Request, res: Response) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-password");
    if (!driver) {
      return res.status(404).json({
        error: "Driver not found",
        message: "Driver not found",
      });
    }
    res.json(driver);
  } catch (error) {
    handleError(error, res, "Error fetching driver");
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

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        error: "Driver not found",
        message: "Driver not found",
      });
    }

    // Check if driverNumber is being updated and if it already exists
    if (updates.includes("driverNumber")) {
      const existingDriver = await Driver.findOne({
        driverNumber: req.body.driverNumber,
        _id: { $ne: req.params.id }, // Exclude current driver
      });
      if (existingDriver) {
        return res.status(400).json({
          error: "Driver number already exists",
          message: `Driver number '${req.body.driverNumber}' already exists`,
        });
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
      return res.status(404).json({
        error: "Error fetching updated driver",
        message: "Error fetching updated driver",
      });
    }

    res.json(updatedDriver);
  } catch (error) {
    handleError(error, res, "Error updating driver");
  }
};

export const deleteDriver = async (req: Request, res: Response) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        error: "Driver not found",
        message: "Driver not found",
      });
    }

    await driver.deleteOne();
    res.json({ message: "Driver deleted successfully" });
  } catch (error) {
    handleError(error, res, "Error deleting driver");
  }
};
