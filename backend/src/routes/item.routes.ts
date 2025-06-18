import { Router } from "express";
import { auth, checkRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";
import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
} from "../controllers/item.controller";

const router = Router();

// All routes require authentication
router.use(auth);

// Routes accessible by Admin and Back Office
router.post("/", checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]), createItem);
router.get("/", getItems); // All authenticated users can view items
router.get("/:id", getItemById); // All authenticated users can view item details
router.patch(
  "/:id",
  checkRole([UserRole.ADMIN, UserRole.BACK_OFFICE]),
  updateItem
);
router.delete("/:id", checkRole([UserRole.ADMIN]), deleteItem);

export const itemRoutes = router;
