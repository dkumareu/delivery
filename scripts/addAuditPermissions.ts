import mongoose from "mongoose";
import { User } from "../src/models/user.model";
import dotenv from "dotenv";

dotenv.config();

const addAuditPermissions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.DB_CONNECTION || "mongodb://localhost:27017/demo_app"
    );
    console.log("Connected to MongoDB");

    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    let updatedCount = 0;

    for (const user of users) {
      // Check if user already has audit permissions
      const hasAuditPermission = user.permissions.some(p => p.page === 'audit');
      
      if (!hasAuditPermission) {
        // Add audit permission based on user role
        const auditPermission = {
          page: 'audit',
          canView: true, // All users can view audit logs
          canAdd: false, // No one can add audit logs (they're auto-generated)
          canEdit: false, // No one can edit audit logs
          canDelete: false // No one can delete audit logs
        };

        user.permissions.push(auditPermission);
        await user.save();
        updatedCount++;
        console.log(`Added audit permissions to user: ${user.email}`);
      } else {
        console.log(`User ${user.email} already has audit permissions`);
      }
    }

    console.log(`Updated ${updatedCount} users with audit permissions`);
  } catch (error) {
    console.error("Error adding audit permissions:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

addAuditPermissions(); 