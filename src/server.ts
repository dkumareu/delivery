import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { userRoutes } from "./routes/user.routes";
import { customerRoutes } from "./routes/customer.routes";
import { itemRoutes } from "./routes/item.routes";
import orderRoutes from "./routes/order.routes";
import { driverRoutes } from "./routes/driver.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware

const allowedOrigins = ['https://dev-env.co'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // if you're sending cookies or authorization headers
}));
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/dashboard", dashboardRoutes);

// MongoDB Connection
mongoose
  .connect(process.env?.DB_CONNECTION || "")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });
