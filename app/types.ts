export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price?: number;
  category: string;
  image: string;
  description: string;
  unit: string;
  stock?: number;
  min_stock?: number;
  variant_group?: string;
  variant_type?: string;
  variant_value?: string;
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

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled';

export interface OrderStatusHistory {
  id: string;
  status: OrderStatus;
  note?: string;
  created_at: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  date: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  shippingAddress: Address;
  statusHistory?: OrderStatusHistory[];
  user_name?: string;
  user_email?: string;
  user_phone?: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name?: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  product_id: string;
  added_price: number;
  current_price?: number;
  price_dropped?: boolean;
  product?: Product;
  created_at: string;
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

export type ViewState = 'shop' | 'admin' | 'checkout' | 'success' | 'profile' | 'product-detail' | 'order-tracking';

export enum PaymentMethod {
  COD = 'cod',
  UPI = 'upi'
}

export const CATEGORIES = ['All', 'Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Beverages', 'Snacks'];

export interface ProductGroup {
  groupKey: string;
  isVariantGroup: boolean;
  variantType: string | null;
  displayProduct: Product;
  variants: Product[];
}
