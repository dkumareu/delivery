import { Response } from "express";

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  keyValue?: any;
  errors?: any;
}

export const handleError = (
  error: any,
  res: Response,
  defaultMessage: string = "An error occurred"
) => {
  console.error("API Error:", error);

  // Mongoose validation errors
  if (error.name === "ValidationError") {
    const validationErrors = Object.values(error.errors).map(
      (err: any) => err.message
    );
    return res.status(400).json({
      error: "Validation failed",
      details: validationErrors,
      message: validationErrors.join(", "),
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return res.status(400).json({
      error: "Duplicate field error",
      details: `${field} '${value}' already exists`,
      message: `${field} '${value}' already exists`,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (error.name === "CastError") {
    return res.status(400).json({
      error: "Invalid ID format",
      details: `Invalid ${error.path}: ${error.value}`,
      message: `Invalid ${error.path}: ${error.value}`,
    });
  }

  // Custom error with message
  if (error.message) {
    return res.status(error.statusCode || 400).json({
      error: error.message,
      details: error.details || error.message,
      message: error.message,
    });
  }

  // Generic error
  return res.status(500).json({
    error: "Internal server error",
    details: error.toString(),
    message: defaultMessage,
  });
};
