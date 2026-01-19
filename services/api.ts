import { User, Product, Order } from '../types';

// Use relative path to allow the proxy in package.json to forward requests to the backend
const API_URL = '/api';

export const api = {
    // Auth
    login: async (email: string, password: string, role?: string): Promise<User> => {
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role })
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Login failed');
            }
            const user = await res.json();
            // Parse addresses if stored as string
            if (typeof user.address === 'string') {
                try {
                    user.addresses = JSON.parse(user.address);
                } catch (e) {
                    user.addresses = [];
                }
            } else {
                user.addresses = [];
            }
            user.orders = []; // Will fetch separately
            return user;
        } catch (error) {
            console.error("Login API Error:", error);
            throw error;
        }
    },

    register: async (name: string, email: string, password: string, phone: string): Promise<User> => {
        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, phone })
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Registration failed');
            }
            return await res.json();
        } catch (error) {
            console.error("Register API Error:", error);
            throw error;
        }
    },

    // Products
    getProducts: async (): Promise<Product[]> => {
        try {
            const res = await fetch(`${API_URL}/products`);
            if (!res.ok) throw new Error("Failed to fetch products");
            return await res.json();
        } catch (error) {
            console.error("Get Products Error:", error);
            return []; // Return empty array on failure to prevent app crash
        }
    },

    addProduct: async (product: Product): Promise<Product> => {
        const res = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        return await res.json();
    },

    updateProduct: async (product: Product): Promise<void> => {
        await fetch(`${API_URL}/products/${product.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
    },

    deleteProduct: async (id: string): Promise<void> => {
        await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    },

    // Orders
    placeOrder: async (orderData: any): Promise<Order> => {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        return await res.json();
    },

    getOrders: async (userId: string, isAdmin: boolean = false): Promise<Order[]> => {
        const res = await fetch(`${API_URL}/orders?userId=${userId}&isAdmin=${isAdmin}`);
        const orders = await res.json();
        return orders;
    },

    updateOrderStatus: async (orderId: string, status: string): Promise<void> => {
        await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    },

    // Notifications
    getNotifications: async (userId: string, isAdmin: boolean = false): Promise<any[]> => {
        const res = await fetch(`${API_URL}/notifications?userId=${userId}&isAdmin=${isAdmin}`);
        if (!res.ok) return [];
        return await res.json();
    },

    markNotificationRead: async (id: string): Promise<void> => {
        await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT' });
    },

    deleteNotification: async (id: string): Promise<void> => {
        await fetch(`${API_URL}/notifications/${id}`, { method: 'DELETE' });
    },

    // User Profile
    updateUserAddresses: async (userId: string, addresses: any[]): Promise<void> => {
        await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses })
        });
    }
};