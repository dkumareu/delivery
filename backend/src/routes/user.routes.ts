import { Router } from "express";
import { auth, checkRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";
import {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  updateUserStatus,
} from "../controllers/user.controller";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/profile", auth, getProfile);
router.patch("/profile", auth, updateProfile);

// Admin only routes
router.get("/all", auth, checkRole([UserRole.ADMIN]), getAllUsers);
router.patch(
  "/:userId/status",
  auth,
  checkRole([UserRole.ADMIN]),
  updateUserStatus
);

export const userRoutes = router;
