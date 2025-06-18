import { Router } from "express";
import { auth, checkRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
} from "../controllers/driver.controller";

const router = Router();

// All routes require authentication
router.use(auth);

// Routes accessible by Admin and Back Office
router.post(
  "/",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  createDriver
);
router.get("/", checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]), getDrivers);
router.get(
  "/:id",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  getDriverById
);
router.patch(
  "/:id",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateDriver
);
router.delete("/:id", checkRole([UserRole.ADMIN]), deleteDriver);

export const driverRoutes = router;
