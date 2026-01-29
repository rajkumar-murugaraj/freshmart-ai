import { z } from 'zod';

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (Indian format)
const phoneRegex = /^[6-9]\d{9}$/;

// Password validation (min 6 chars, at least one number)
const passwordRegex = /^(?=.*\d).{6,}$/;

// User Registration Schema
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z
    .string()
    .email('Invalid email address')
    .regex(emailRegex, 'Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .regex(passwordRegex, 'Password must contain at least one number'),
  phone: z
    .string()
    .regex(phoneRegex, 'Please enter a valid 10-digit Indian mobile number'),
});

// User Login Schema
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .regex(emailRegex, 'Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
  role: z.enum(['user', 'admin']).optional(),
});

// Address Schema
export const addressSchema = z.object({
  label: z
    .string()
    .min(1, 'Address label is required')
    .max(20, 'Label must be less than 20 characters'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  street: z
    .string()
    .min(5, 'Street address must be at least 5 characters')
    .max(100, 'Street address must be less than 100 characters'),
  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(50, 'City must be less than 50 characters'),
  zip: z
    .string()
    .regex(/^\d{6}$/, 'Please enter a valid 6-digit PIN code'),
  phone: z
    .string()
    .regex(phoneRegex, 'Please enter a valid 10-digit mobile number'),
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
});

// Product Schema
export const productSchema = z.object({
  name: z
    .string()
    .min(2, 'Product name must be at least 2 characters')
    .max(100, 'Product name must be less than 100 characters'),
  price: z
    .number()
    .positive('Price must be a positive number')
    .max(100000, 'Price must be less than ₹100,000'),
  category: z
    .string()
    .min(1, 'Category is required'),
  image: z
    .string()
    .url('Please enter a valid image URL')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  unit: z
    .string()
    .min(1, 'Unit is required')
    .max(20, 'Unit must be less than 20 characters'),
  stock: z
    .number()
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative')
    .optional(),
  min_stock: z
    .number()
    .int('Min stock must be a whole number')
    .min(0, 'Min stock cannot be negative')
    .optional(),
});

// Order Schema
export const orderSchema = z.object({
  user_id: z.string().min(1, 'User must be logged in to place an order'),
  total: z.number().positive('Order total must be positive'),
  items: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
        quantity: z.number().positive(),
      })
    )
    .min(1, 'Order must have at least one item'),
  paymentMethod: z.enum(['cod', 'upi'], {
    errorMap: () => ({ message: 'Please select a valid payment method' }),
  }),
  shippingAddress: addressSchema,
});

// Sale Schema (POS transaction)
export const saleSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1, 'Item ID is required'),
        name: z.string().min(1, 'Item name is required'),
        price: z.number().positive('Price must be positive'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
      })
    )
    .min(1, 'Sale must have at least one item'),
  total: z.number().positive('Total must be positive').optional(),
  paymentMethod: z.enum(['cash', 'card', 'upi'], {
    errorMap: () => ({ message: 'Payment method must be cash, card, or upi' }),
  }),
  customerId: z.string().optional(),
  cashierId: z.string().optional(),
  cashierName: z.string().max(100).optional(),
});

// Stock Update Schema
export const stockUpdateSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  type: z.enum(['add', 'remove', 'set', 'sale'], {
    errorMap: () => ({ message: 'Type must be add, remove, set, or sale' }),
  }),
  quantity: z.number().int('Quantity must be a whole number').min(0, 'Quantity cannot be negative'),
  reason: z.string().max(200).optional(),
  userId: z.string().optional(),
});

// Bulk Stock Update Schema
export const bulkStockUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int('Quantity must be a whole number').min(0, 'Quantity cannot be negative'),
        reason: z.string().max(200).optional(),
      })
    )
    .min(1, 'At least one update is required'),
  userId: z.string().optional(),
});

// Type inference helpers
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
export type BulkStockUpdateInput = z.infer<typeof bulkStockUpdateSchema>;

// Helper function to validate and return errors
export function validateData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as z.infer<T> };
  }
  const errors = result.error.errors.map((err: { message: string }) => err.message);
  return { success: false, errors };
}

// Client-side validation helpers
export const validationRules = {
  email: {
    pattern: emailRegex,
    message: 'Please enter a valid email address',
  },
  phone: {
    pattern: phoneRegex,
    message: 'Please enter a valid 10-digit mobile number',
  },
  password: {
    pattern: passwordRegex,
    message: 'Password must be at least 6 characters with at least one number',
  },
  zip: {
    pattern: /^\d{6}$/,
    message: 'Please enter a valid 6-digit PIN code',
  },
  name: {
    pattern: /^[a-zA-Z\s]{2,50}$/,
    message: 'Name must be 2-50 characters and contain only letters',
  },
};
