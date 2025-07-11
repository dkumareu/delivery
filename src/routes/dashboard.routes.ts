import { Router } from "express";
import { auth, checkRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";
import { getDashboardStats } from "../controllers/dashboard.controller";

const router = Router();

// All routes require authentication
router.use(auth);

// Dashboard stats route accessible by Admin and Back Office
router.get(
  "/stats",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  getDashboardStats
);

export const dashboardRoutes = router; 