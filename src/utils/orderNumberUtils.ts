import { Order } from "../models/order.model";

/**
 * Generate multiple unique order numbers efficiently
 * @param year - The year for the order number
 * @param count - Number of order numbers to generate
 * @returns Array of unique order numbers
 */
export const generateUniqueOrderNumbers = async (year: number, count: number): Promise<string[]> => {
  const orderNumbers: string[] = [];
  let attempts = 0;
  const maxAttempts = 10;
  
  while (orderNumbers.length < count && attempts < maxAttempts) {
    // Get the highest existing order number for this year
    const lastOrder = await Order.findOne({
      orderNumber: new RegExp(`A-${year}-`),
    }).sort({ orderNumber: -1 });

    let startSequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.split("-")[2]);
      startSequence = lastSequence + 1;
    }

    // Generate a batch of order numbers
    const batchNumbers: string[] = [];
    for (let i = 0; i < count; i++) {
      const sequence = startSequence + i;
      batchNumbers.push(`A-${year}-${sequence.toString().padStart(4, "0")}`);
    }

    // Check if any of these order numbers already exist
    const existingOrders = await Order.find({
      orderNumber: { $in: batchNumbers }
    });

    if (existingOrders.length === 0) {
      // All numbers are unique, return them
      return batchNumbers;
    } else {
      // Some numbers exist, try again with a higher starting sequence
      startSequence = Math.max(...existingOrders.map(order => 
        parseInt(order.orderNumber.split("-")[2])
      )) + 1;
      attempts++;
    }
  }
  
  throw new Error("Unable to generate unique order numbers after multiple attempts");
};

/**
 * Generate a single unique order number
 * @param year - The year for the order number
 * @returns A unique order number
 */
export const generateSingleOrderNumber = async (year: number): Promise<string> => {
  const orderNumbers = await generateUniqueOrderNumbers(year, 1);
  return orderNumbers[0];
};

/**
 * Validate if an order number is in the correct format
 * @param orderNumber - The order number to validate
 * @returns True if valid, false otherwise
 */
export const isValidOrderNumberFormat = (orderNumber: string): boolean => {
  const pattern = /^A-\d{4}-\d{4}$/;
  return pattern.test(orderNumber);
};

/**
 * Extract year and sequence from an order number
 * @param orderNumber - The order number to parse
 * @returns Object with year and sequence, or null if invalid
 */
export const parseOrderNumber = (orderNumber: string): { year: number; sequence: number } | null => {
  if (!isValidOrderNumberFormat(orderNumber)) {
    return null;
  }
  
  const parts = orderNumber.split("-");
  return {
    year: parseInt(parts[1]),
    sequence: parseInt(parts[2])
  };
};