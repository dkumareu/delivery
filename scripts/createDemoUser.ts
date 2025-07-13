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
    const existingUser = await User.findOne({ email: "admin@example.com" });
    if (existingUser) {
      console.log("Demo user already exists");
      return;
    }

    // Default permissions for admin user
    const adminPermissions = [
      { page: 'dashboard', canView: true, canAdd: false, canEdit: false, canDelete: false },
      { page: 'customers', canView: true, canAdd: true, canEdit: true, canDelete: true },
      { page: 'orders', canView: true, canAdd: true, canEdit: true, canDelete: true },
      { page: 'items', canView: true, canAdd: true, canEdit: true, canDelete: true },
      { page: 'drivers', canView: true, canAdd: true, canEdit: true, canDelete: true },
      { page: 'delivery-routes', canView: true, canAdd: false, canEdit: true, canDelete: false },
      { page: 'planning-board', canView: true, canAdd: false, canEdit: true, canDelete: false },
      { page: 'assign-driver', canView: true, canAdd: false, canEdit: true, canDelete: false },
      { page: 'reports', canView: true, canAdd: false, canEdit: false, canDelete: false },
      { page: 'employees', canView: true, canAdd: true, canEdit: true, canDelete: true }
    ];

    // Create demo user
    const demoUser = new User({
      email: "admin@example.com",
      password: "deepak123",
      firstName: "Admin",
      lastName: "Admin",
      role: UserRole.ADMIN,
      isActive: true,
      permissions: adminPermissions
    });

    await demoUser.save();
    console.log("Admin user created successfully");
    console.log("Email: admin@example.com");
    console.log("Password: admin123");
    console.log("Role: ADMIN with full permissions");
  } catch (error) {
    console.error("Error creating demo user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

createDemoUser();
