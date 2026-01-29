import { User, Product, Order } from '../types';

// Token management
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Refresh tokens
async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      // Tokens are set via httpOnly cookies by the server
      // Dispatch event to notify app of token refresh
      window.dispatchEvent(new CustomEvent('tokenRefreshed', { detail: data }));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Wrapper for fetch that handles token refresh
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // First attempt
  let res = await fetch(url, {
    ...options,
    credentials: 'include'
  });

  // If unauthorized, try to refresh token
  if (res.status === 401) {
    const errorData = await res.clone().json().catch(() => ({}));

    // Check if it's a token expiry issue
    if (errorData.code === 'TOKEN_EXPIRED' || errorData.code === 'INVALID_REFRESH_TOKEN') {
      // Prevent multiple simultaneous refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshTokens();
      }

      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (refreshed) {
        // Retry the original request
        res = await fetch(url, {
          ...options,
          credentials: 'include'
        });
      } else {
        // Refresh failed, dispatch logout event
        window.dispatchEvent(new CustomEvent('authError', { detail: { message: 'Session expired' } }));
      }
    }
  }

  return res;
}

// Auth state management
export const authManager = {
  // Check if user is authenticated (has valid tokens)
  checkAuth: async (): Promise<{ authenticated: boolean; user?: any }> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'GET',
        credentials: 'include'
      });
      const data = await res.json();
      return {
        authenticated: data.hasAccessToken || data.hasRefreshToken
      };
    } catch {
      return { authenticated: false };
    }
  },

  // Attempt to refresh tokens
  refresh: refreshTokens,

  // Listen for auth events
  onTokenRefreshed: (callback: (data: any) => void) => {
    const handler = (e: CustomEvent) => callback(e.detail);
    window.addEventListener('tokenRefreshed', handler as EventListener);
    return () => window.removeEventListener('tokenRefreshed', handler as EventListener);
  },

  onAuthError: (callback: (data: any) => void) => {
    const handler = (e: CustomEvent) => callback(e.detail);
    window.addEventListener('authError', handler as EventListener);
    return () => window.removeEventListener('authError', handler as EventListener);
  }
};

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
    const res = await fetchWithAuth('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add product');
    }
    return data;
  },

  updateProduct: async (product: Product): Promise<void> => {
    const res = await fetchWithAuth(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update product');
    }
  },

  deleteProduct: async (id: string): Promise<void> => {
    await fetchWithAuth(`/api/products/${id}`, { method: 'DELETE' });
  },

  updateVariantGroup: async (data: {
    groupId: string;
    variantType: string;
    sharedFields: Record<string, any>;
    updates: Array<{ id: string; name: string; variant_value: string; price: number; cost_price: number; stock: number }>;
    creates: Array<{ name: string; price: number; cost_price: number; variant_value: string; stock: number }>;
    deletes: string[];
  }): Promise<void> => {
    const res = await fetchWithAuth('/api/products/variant-group', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update variant group');
    }
  },

  deleteVariantGroup: async (groupId: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/products/variant-group?groupId=${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete variant group');
    }
  },

  // Orders
  placeOrder: async (orderData: any): Promise<Order> => {
    const res = await fetchWithAuth('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    return await res.json();
  },

  getOrders: async (userId: string, isAdmin: boolean = false): Promise<Order[]> => {
    const res = await fetchWithAuth(`/api/orders?userId=${userId}&isAdmin=${isAdmin}`);
    const data = await res.json();
    // Handle both old (array) and new (paginated) response formats
    return data.orders || data;
  },

  // Paginated orders for admin panel
  getOrdersPaginated: async (options: {
    page?: number;
    limit?: number;
    status?: string;
    isAdmin?: boolean;
    userId?: string;
  } = {}): Promise<{
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> => {
    const params = new URLSearchParams();
    params.set('page', String(options.page || 1));
    params.set('limit', String(options.limit || 20));
    if (options.status) params.set('status', options.status);
    if (options.isAdmin) params.set('isAdmin', 'true');
    if (options.userId) params.set('userId', options.userId);

    const res = await fetchWithAuth(`/api/orders?${params.toString()}`);
    return await res.json();
  },

  updateOrderStatus: async (orderId: string, status: string): Promise<void> => {
    await fetchWithAuth(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  },

  // Notifications
  getNotifications: async (userId: string, isAdmin: boolean = false): Promise<any[]> => {
    const res = await fetchWithAuth(`/api/notifications?userId=${userId}&isAdmin=${isAdmin}`);
    if (!res.ok) return [];
    return await res.json();
  },

  markNotificationRead: async (id: string): Promise<void> => {
    await fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PUT' });
  },

  deleteNotification: async (id: string): Promise<void> => {
    await fetchWithAuth(`/api/notifications/${id}`, { method: 'DELETE' });
  },

  // User Profile
  updateUserAddresses: async (userId: string, addresses: any[]): Promise<void> => {
    await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses })
    });
  },

  getUser: async (userId: string): Promise<User> => {
    const res = await fetchWithAuth(`/api/users/${userId}`);
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
    const res = await fetchWithAuth(`/api/dashboard?period=${period}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return await res.json();
  },

  // Stock Management
  getStock: async (filter?: 'low' | 'out' | 'all'): Promise<any[]> => {
    const url = filter ? `/api/stock?filter=${filter}` : '/api/stock';
    const res = await fetchWithAuth(url);
    if (!res.ok) return [];
    const data = await res.json();
    // Handle both old (array) and new (paginated) response formats
    return data.products || data;
  },

  getStockPaginated: async (options: {
    page?: number;
    limit?: number;
    filter?: 'low' | 'out' | 'all';
  } = {}): Promise<{
    products: any[];
    stats: {
      total: number;
      outOfStock: number;
      lowStock: number;
      inStock: number;
    };
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> => {
    const params = new URLSearchParams();
    params.set('page', String(options.page || 1));
    params.set('limit', String(options.limit || 20));
    if (options.filter) params.set('filter', options.filter);

    const res = await fetchWithAuth(`/api/stock?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch stock');
    return await res.json();
  },

  getProductStock: async (productId: string, historyPage?: number, historyLimit?: number): Promise<any> => {
    const params = new URLSearchParams({ productId });
    if (historyPage) params.set('historyPage', String(historyPage));
    if (historyLimit) params.set('historyLimit', String(historyLimit));

    const res = await fetchWithAuth(`/api/stock?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch product stock');
    return await res.json();
  },

  updateStock: async (productId: string, type: 'add' | 'remove' | 'set' | 'sale', quantity: number, reason?: string, userId?: string): Promise<any> => {
    const res = await fetchWithAuth('/api/stock', {
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
    const res = await fetchWithAuth('/api/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, userId })
    });
    if (!res.ok) throw new Error('Failed to bulk update stock');
    return await res.json();
  },

  // Sales/POS
  createSale: async (items: Array<{ id: string; name: string; price: number; quantity: number }>, paymentMethod: string, customerId?: string, cashierName?: string): Promise<any> => {
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const res = await fetchWithAuth('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, total, paymentMethod, customerId, cashierName })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create sale');
    }
    return await res.json();
  },

  // Sales with pagination
  getSalesPaginated: async (options: {
    page?: number;
    limit?: number;
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{
    sales: any[];
    stats: {
      totalSales: number;
      totalRevenue: number;
      cashSales: number;
      cardSales: number;
      upiSales: number;
    };
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> => {
    const params = new URLSearchParams();
    params.set('page', String(options.page || 1));
    params.set('limit', String(options.limit || 20));
    if (options.period) params.set('period', options.period);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);

    const res = await fetchWithAuth(`/api/sales?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch sales');
    return await res.json();
  },

  // Bill Scanning for Stock Update
  scanBillImage: async (imageFile: File): Promise<any> => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const res = await fetchWithAuth('/api/stock/bill-scan', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to scan bill');
    }
    return await res.json();
  },

  applyBillStockUpdate: async (items: Array<{ productId: string; productName: string; quantity: number }>, userId?: string, billInfo?: any): Promise<any> => {
    const res = await fetchWithAuth('/api/stock/bill-scan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, userId, billInfo })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update stock from bill');
    }
    return await res.json();
  },

  // Image Upload
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload image');
    }
    const data = await res.json();
    return data.url;
  },

  // Order tracking
  getOrderStatusHistory: async (orderId: string): Promise<any> => {
    const res = await fetchWithAuth(`/api/orders/${orderId}/status`);
    if (!res.ok) throw new Error('Failed to fetch order status history');
    return await res.json();
  },

  // Reviews
  getReviews: async (productId: string): Promise<any> => {
    const res = await fetch(`/api/reviews?productId=${productId}`);
    if (!res.ok) return { reviews: [], stats: { total: 0, average: 0, breakdown: {} } };
    return await res.json();
  },

  submitReview: async (productId: string, userId: string, rating: number, comment?: string): Promise<any> => {
    const res = await fetchWithAuth('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, userId, rating, comment })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit review');
    }
    return await res.json();
  },

  deleteReview: async (reviewId: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/reviews?id=${reviewId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete review');
    }
  },

  // Wishlist (backend-synced)
  getWishlist: async (userId: string): Promise<any> => {
    const res = await fetchWithAuth(`/api/wishlist?userId=${userId}`);
    if (!res.ok) return { items: [], totalCount: 0, priceDropCount: 0 };
    return await res.json();
  },

  addToWishlistApi: async (userId: string, productId: string): Promise<any> => {
    const res = await fetchWithAuth('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, productId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add to wishlist');
    }
    return await res.json();
  },

  removeFromWishlistApi: async (userId: string, productId: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/wishlist?userId=${userId}&productId=${productId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to remove from wishlist');
  },

  // Token refresh
  refreshToken: async (): Promise<boolean> => {
    return await refreshTokens();
  },

  // Logout
  logout: async (): Promise<void> => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  }
};
