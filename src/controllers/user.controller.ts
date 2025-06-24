import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, UserRole, IUser } from "../models/user.model";
import { handleError } from "../utils/errorHandler";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: "Email already registered",
        message: `Email '${email}' is already registered`,
      });
    }

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role: role || UserRole.FIELD_SERVICE,
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret_key_here",
      { expiresIn: "24h" }
    );

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    handleError(error, res, "Error creating user");
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret_key_here",
      { expiresIn: "24h" }
    );

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    handleError(error, res, "Error logging in");
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user?.userId).select("-password");
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    handleError(error, res, "Error fetching profile");
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["firstName", "lastName", "email", "password"];
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
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User not found",
      });
    }

    updates.forEach((update) => {
      (user as any)[update] = req.body[update];
    });

    await user.save();
    res.json(user);
  } catch (error) {
    handleError(error, res, "Error updating profile");
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    handleError(error, res, "Error fetching users");
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User not found",
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json(user);
  } catch (error) {
    handleError(error, res, "Error updating user status");
  }
};
