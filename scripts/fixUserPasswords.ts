import mongoose from "mongoose";
import { User } from "../src/models/user.model";
import dotenv from "dotenv";

dotenv.config();

const fixUserPasswords = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.DB_CONNECTION || "mongodb://localhost:27017/demo_app"
    );
    console.log("Connected to MongoDB");

    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users in database`);

    let fixedCount = 0;
    let deletedCount = 0;

    for (const user of users) {
      console.log(`Checking user: ${user.email}`);
      console.log(`Password type: ${typeof user.password}`);
      console.log(`Password value:`, user.password);

      // Check if password is invalid
      if (!user.password || typeof user.password !== 'string') {
        console.log(`Fixing invalid password for user: ${user.email}`);
        
        // If it's the admin user, reset to default password
        if (user.email === 'admin@example.com') {
          user.password = 'deepak123';
          await user.save();
          console.log(`Reset admin password for: ${user.email}`);
          fixedCount++;
        } else {
          // For other users, delete them if they have invalid passwords
          console.log(`Deleting user with invalid password: ${user.email}`);
          //await User.findByIdAndDelete(user._id);
          deletedCount++;
        }
      } else {
        console.log(`User ${user.email} has valid password`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Fixed passwords: ${fixedCount}`);
    console.log(`- Deleted invalid users: ${deletedCount}`);
    console.log(`- Total users remaining: ${await User.countDocuments()}`);

  } catch (error) {
    console.error("Error fixing user passwords:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

fixUserPasswords(); 