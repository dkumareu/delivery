import mongoose from 'mongoose';
import { Order } from '../src/models/order.model';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const migrateOrderImages = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/filter');
    console.log('Connected to MongoDB');

    // Find all orders with old image structure
    const orders = await Order.find({
      $or: [
        { beforeImage: { $exists: true, $ne: null } },
        { afterImage: { $exists: true, $ne: null } }
      ]
    });

    console.log(`Found ${orders.length} orders with old image structure`);

    let updatedCount = 0;

    for (const order of orders) {
      const updates: any = {};

      // Migrate beforeImage to beforeImages array
      if (order.beforeImage) {
        updates.beforeImages = [order.beforeImage];
        updates.beforeImage = undefined; // Remove old field
      }

      // Migrate afterImage to afterImages array
      if (order.afterImage) {
        updates.afterImages = [order.afterImage];
        updates.afterImage = undefined; // Remove old field
      }

      if (Object.keys(updates).length > 0) {
        await Order.findByIdAndUpdate(order._id, {
          $set: updates,
          $unset: {
            beforeImage: 1,
            afterImage: 1
          }
        });
        updatedCount++;
        console.log(`Updated order ${order.orderNumber}`);
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} orders.`);

    // Verify migration
    const remainingOldStructure = await Order.find({
      $or: [
        { beforeImage: { $exists: true } },
        { afterImage: { $exists: true } }
      ]
    });

    if (remainingOldStructure.length === 0) {
      console.log('✅ Migration verification successful - no orders with old structure found');
    } else {
      console.log(`⚠️  Warning: ${remainingOldStructure.length} orders still have old structure`);
    }

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run migration if called directly
if (require.main === module) {
  migrateOrderImages();
}

export default migrateOrderImages; 