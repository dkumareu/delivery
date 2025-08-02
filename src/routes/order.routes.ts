import express from "express";
import { auth, checkRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getUnassignedOrders,
  getMainOrdersByCustomer,
  assignOrdersToDriver,
  updateDeliverySequence,
  updateOrderStatus,
  generateImageUploadUrl,
  updateOrderImages,
  updateOrderArticleNumber,
  updateOrderAssignedDriver,
} from "../controllers/order.controller";

const router = express.Router();

// All routes require authentication
router.use(auth);

// Routes accessible by Admin and Back Office
router.post(
  "/",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  createOrder
);

// Get unassigned orders - must be before /:id route
router.get(
  "/unassigned",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  getUnassignedOrders
);

// Get main orders by customer
router.get(
  "/customer/:customerId/main",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  getMainOrdersByCustomer
);

// Assign orders to driver
router.post(
  "/assign-driver",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  assignOrdersToDriver
);

// Update delivery sequence
router.post(
  "/update-sequence",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateDeliverySequence
);

// Update order status
router.patch(
  "/:orderId/status",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateOrderStatus
);

// Update order article number
router.patch(
  "/:orderId/article-number",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateOrderArticleNumber
);

// Update order assigned driver
router.patch(
  "/:orderId/assigned-driver",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateOrderAssignedDriver
);

// General routes
router.get("/", getOrders); // All authenticated users can view orders
router.get("/:id", getOrderById); // All authenticated users can view order details
router.patch(
  "/:id",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateOrder
);
router.delete("/:id", checkRole([UserRole.ADMIN]), deleteOrder);

// Image upload routes
router.post(
  "/generate-upload-url",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  generateImageUploadUrl
);

router.patch(
  "/:orderId/images",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateOrderImages
);

export default router;
