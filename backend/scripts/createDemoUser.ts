import mongoose from "mongoose";
import { User, UserRole } from "../src/models/user.model";
import dotenv from "dotenv";

dotenv.config();

const createDemoUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.DB_CONNECTION || "mongodb://localhost:27017/demo_app"
    );
    console.log("Connected to MongoDB");

    // Check if demo user already exists
    const existingUser = await User.findOne({ email: "demo@example.com" });
    if (existingUser) {
      console.log("Demo user already exists");
      return;
    }

    // Create demo user
    const demoUser = new User({
      email: "demo@example.com",
      password: "demo123",
      firstName: "Demo",
      lastName: "User",
      role: UserRole.ADMIN,
      isActive: true,
    });

    await demoUser.save();
    console.log("Demo user created successfully");
    console.log("Email: demo@example.com");
    console.log("Password: demo123");
  } catch (error) {
    console.error("Error creating demo user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

createDemoUser();
