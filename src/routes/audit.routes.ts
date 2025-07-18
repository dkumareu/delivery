import express from "express";
import { auth } from "../middleware/auth.middleware";
import {
  getAuditLogs,
  getAuditLogById,
  revertChange,
  getAuditStats
} from "../controllers/audit.controller";

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get audit logs with filtering and pagination
router.get("/", getAuditLogs);

// Get specific audit log by ID
router.get("/:auditId", getAuditLogById);

// Get audit statistics
router.get("/stats/overview", getAuditStats);

// Revert a specific change
router.post("/:auditId/revert", revertChange);

export default router; 