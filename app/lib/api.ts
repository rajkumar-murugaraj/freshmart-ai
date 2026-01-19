import { User, Product, Order } from '../types';

export const api = {
  // Auth
  login: async (email: string, password: string, role?: string): Promise<User> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Login failed');
    }
    return await res.json();
  },

  register: async (name: string, email: string, password: string, phone: string): Promise<User> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Registration failed');
    }
    return await res.json();
  },

  // Products
  getProducts: async (): Promise<Product[]> => {
    const res = await fetch('/api/products');
    if (!res.ok) return [];
    return await res.json();
  },

  addProduct: async (product: Partial<Product>): Promise<Product> => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    return await res.json();
  },

  updateProduct: async (product: Product): Promise<void> => {
    await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
  },

  deleteProduct: async (id: string): Promise<void> => {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
  },

  // Orders
  placeOrder: async (orderData: any): Promise<Order> => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    return await res.json();
  },

  getOrders: async (userId: string, isAdmin: boolean = false): Promise<Order[]> => {
    const res = await fetch(`/api/orders?userId=${userId}&isAdmin=${isAdmin}`);
    return await res.json();
  },

  updateOrderStatus: async (orderId: string, status: string): Promise<void> => {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  },

  // Notifications
  getNotifications: async (userId: string, isAdmin: boolean = false): Promise<any[]> => {
    const res = await fetch(`/api/notifications?userId=${userId}&isAdmin=${isAdmin}`);
    if (!res.ok) return [];
    return await res.json();
  },

  markNotificationRead: async (id: string): Promise<void> => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
  },

  deleteNotification: async (id: string): Promise<void> => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
  },

  // User Profile
  updateUserAddresses: async (userId: string, addresses: any[]): Promise<void> => {
    await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses })
    });
  },

  getUser: async (userId: string): Promise<User> => {
    const res = await fetch(`/api/users/${userId}`);
    return await res.json();
  },

  // AI
  getRecipeSuggestion: async (ingredients: string[]): Promise<string> => {
    const res = await fetch('/api/ai/recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients })
    });
    const data = await res.json();
    return data.suggestion;
  },

  generateProductDescription: async (name: string, category: string): Promise<string> => {
    const res = await fetch('/api/ai/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category })
    });
    const data = await res.json();
    return data.description;
  },

  askAIChef: async (message: string, cartItems: string[] = []): Promise<string> => {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, cartItems })
    });
    const data = await res.json();
    return data.response;
  },

  // Dashboard & Analytics
  getDashboard: async (period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<any> => {
    const res = await fetch(`/api/dashboard?period=${period}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return await res.json();
  },

  // Stock Management
  getStock: async (filter?: 'low' | 'out' | 'all'): Promise<any[]> => {
    const url = filter ? `/api/stock?filter=${filter}` : '/api/stock';
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  },

  getProductStock: async (productId: string): Promise<any> => {
    const res = await fetch(`/api/stock?productId=${productId}`);
    if (!res.ok) throw new Error('Failed to fetch product stock');
    return await res.json();
  },

  updateStock: async (productId: string, type: 'add' | 'remove' | 'set' | 'sale', quantity: number, reason?: string, userId?: string): Promise<any> => {
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, type, quantity, reason, userId })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update stock');
    }
    return await res.json();
  },

  bulkUpdateStock: async (updates: Array<{ productId: string; quantity: number; reason?: string }>, userId?: string): Promise<any> => {
    const res = await fetch('/api/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, userId })
    });
    if (!res.ok) throw new Error('Failed to bulk update stock');
    return await res.json();
  },

  // Sales/POS
  createSale: async (items: Array<{ id: string; name: string; price: number; quantity: number }>, paymentMethod: string, customerId?: string): Promise<any> => {
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, total, paymentMethod, customerId })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create sale');
    }
    return await res.json();
  }
};
