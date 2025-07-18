import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, UserRole, IUser, IPermission } from "../models/user.model";
import { handleError } from "../utils/errorHandler";
import { AuditService } from "../utils/auditService";
import { AuditAction } from "../models/audit.model";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, permissions } = req.body;

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
      permissions: permissions || []
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
        permissions: user.permissions
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

    console.log("user>>>>>>>",user);
    
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
        permissions: user.permissions
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

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, permissions, isActive } = req.body;

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
      permissions: permissions || [],
      isActive: isActive !== undefined ? isActive : true
    });

    await user.save();

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.CREATE,
          'users',
          (user._id as any).toString(),
          [],
          req
        )
      );
    }

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive
      }
    });
  } catch (error) {
    handleError(error, res, "Error creating user");
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { email, firstName, lastName, role, permissions, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User not found",
      });
    }

    // Store old values for audit
    const oldValues = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive
    };

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          error: "Email already registered",
          message: `Email '${email}' is already registered`,
        });
      }
    }

    // Update fields
    if (email) user.email = email;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects(oldValues, user.toObject());
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'users',
          (user._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive
      }
    });
  } catch (error) {
    handleError(error, res, "Error updating user");
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User not found",
      });
    }

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);

    await User.findByIdAndDelete(userId);

    // Log audit trail
    if (req.user?.userId) {
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.DELETE,
          'users',
          (user._id as any).toString(),
          [],
          req
        )
      );
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    handleError(error, res, "Error deleting user");
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

    // Store old value for audit
    const oldIsActive = user.isActive;

    user.isActive = isActive;
    await user.save();

    // Get current user details for audit
    const currentUser = await User.findById(req.user?.userId);
    
    // Log audit trail
    if (req.user?.userId) {
      const changes = AuditService.compareObjects({ isActive: oldIsActive }, { isActive: user.isActive });
      await AuditService.logChange(
        AuditService.createAuditLogData(
          req.user.userId as string,
          currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User',
          AuditAction.UPDATE,
          'users',
          (user._id as any).toString(),
          changes,
          req
        )
      );
    }

    res.json(user);
  } catch (error) {
    handleError(error, res, "Error updating user status");
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    handleError(error, res, "Error fetching user");
  }
};
