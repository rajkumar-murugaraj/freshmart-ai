export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
  unit: string;
  stock?: number;
  min_stock?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  email?: string;
  phone: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  paymentMethod: PaymentMethod;
  shippingAddress: Address;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'sales';
  phone: string;
  password?: string;
  addresses: Address[];
  orders: Order[];
}

export type ViewState = 'shop' | 'admin' | 'checkout' | 'success' | 'profile' | 'sales';

export enum PaymentMethod {
  COD = 'cod',
  UPI = 'upi'
}

export const CATEGORIES = ['All', 'Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Beverages', 'Snacks'];
