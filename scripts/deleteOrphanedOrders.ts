import mongoose from 'mongoose';
import { Order } from '../src/models/order.model';
import dotenv from 'dotenv';

dotenv.config();

const deleteOrphanedOrders = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.DB_CONNECTION || "mongodb://localhost:27017/demo_app"
    );
    console.log("Connected to MongoDB");

    console.log('=== Starting Orphaned Orders Cleanup ===');
    
    // Find all orders that have an originalOrderNumber (recurring orders)
    const recurringOrders = await Order.find({
      originalOrderNumber: { $exists: true, $ne: null }
    });
    
    console.log(`Found ${recurringOrders.length} recurring orders`);
    
    if (recurringOrders.length === 0) {
      console.log('No recurring orders found. Nothing to clean up.');
      return;
    }
    
    // Get all unique original order numbers
    const originalOrderNumbers = [...new Set(recurringOrders.map(order => order.originalOrderNumber))];
    console.log(`Found ${originalOrderNumbers.length} unique original order numbers`);
    
    // Check which original orders still exist
    const existingMainOrders = await Order.find({
      orderNumber: { $in: originalOrderNumbers },
      mainOrder: true
    });
    
    const existingMainOrderNumbers = existingMainOrders.map(order => order.orderNumber);
    console.log(`Found ${existingMainOrderNumbers.length} existing main orders`);
    
    // Find orphaned orders (recurring orders whose main order doesn't exist)
    const orphanedOrders = recurringOrders.filter(order => 
      !existingMainOrderNumbers.includes(order.originalOrderNumber!)
    );
    
    console.log(`Found ${orphanedOrders.length} orphaned orders`);
    
    if (orphanedOrders.length === 0) {
      console.log('No orphaned orders found. Nothing to delete.');
      return;
    }
    
    // Display orphaned orders before deletion
    console.log('\n=== Orphaned Orders to be Deleted ===');
    orphanedOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order: ${order.orderNumber} | Original: ${order.originalOrderNumber} | Status: ${order.status} | Customer: ${order.customer}`);
    });
    
    // Check for force flag
    const shouldProceed = process.argv.includes('--force') || process.argv.includes('-f');
    
    if (!shouldProceed) {
      console.log('\nDeletion cancelled. Use --force or -f flag to proceed without confirmation.');
      console.log('Example: npm run delete-orphaned-orders -- --force');
      return;
    }
    
    // Delete orphaned orders
    const deleteResult = await Order.deleteMany({
      _id: { $in: orphanedOrders.map(order => order._id) }
    });
    
    console.log(`\n=== Cleanup Complete ===`);
    console.log(`Successfully deleted ${deleteResult.deletedCount} orphaned orders`);
    
    // Show summary of remaining recurring orders
    const remainingRecurringOrders = await Order.find({
      originalOrderNumber: { $exists: true, $ne: null }
    });
    
    console.log(`\nRemaining recurring orders: ${remainingRecurringOrders.length}`);
    
    // Show summary by original order number
    const remainingByOriginal = remainingRecurringOrders.reduce((acc, order) => {
      const original = order.originalOrderNumber!;
      acc[original] = (acc[original] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n=== Remaining Recurring Orders by Main Order ===');
    Object.entries(remainingByOriginal).forEach(([original, count]) => {
      console.log(`${original}: ${count} recurring orders`);
    });

  } catch (error) {
    console.error("Error during orphaned orders cleanup:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

deleteOrphanedOrders();