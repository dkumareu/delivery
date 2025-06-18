import { Router } from "express";
import { auth, checkRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomerOrders,
} from "../controllers/customer.controller";

const router = Router();

// All routes require authentication
router.use(auth);

// Routes accessible by Admin and Back Office
router.post(
  "/",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  createCustomer
);
router.get(
  "/",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  getCustomers
);
router.get(
  "/:id",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  getCustomerById
);
router.get(
  "/:id/orders",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  getCustomerOrders
);
router.patch(
  "/:id",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateCustomer
);
router.delete("/:id", checkRole([UserRole.ADMIN]), deleteCustomer);

export const customerRoutes = router;
