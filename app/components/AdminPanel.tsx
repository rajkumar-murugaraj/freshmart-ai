'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Product, CATEGORIES, Order, User } from '../types';
import { ProductCard } from './ProductCard';
import { Plus, X, Wand2, Package, LayoutGrid, Phone, Bell, BarChart3, Boxes } from 'lucide-react';
import { api } from '../lib/api';
import { Dashboard } from './Dashboard';
import { StockManagement } from './StockManagement';

interface AdminPanelProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  currentUser: User;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'stock'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; orderId: string | undefined; time: string; read: boolean }>>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; id?: string }>({ visible: false, message: '' });
  const seenOrderIds = useRef(new Set<string>());
  const initializedSeen = useRef(false);
  const lastNotifIds = useRef(new Set<string>());

  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const initialFormState = {
    name: '',
    price: 0,
    category: 'Vegetables',
    image: 'https://picsum.photos/400/300',
    description: '',
    unit: 'kg',
    stock: 50,
    min_stock: 10
  };

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;

    const checkForNew = async () => {
      try {
        const data = await api.getOrders('0', true);
        if (!mounted) return;
        setOrders(data);

        for (const o of data) {
          const oid = String(o.id);
          if (!seenOrderIds.current.has(oid)) {
            if (!initializedSeen.current) {
              seenOrderIds.current.add(oid);
            } else {
              seenOrderIds.current.add(oid);
              const msg = `New order #${o.id} placed by ${o.user_name || 'Guest'} — ₹${o.total}`;
              const notif = { id: `${Date.now()}-${oid}`, message: msg, orderId: oid, time: new Date().toISOString(), read: false };
              setNotifications(prev => [notif, ...prev].slice(0, 50));
              setToast({ visible: true, message: msg, id: notif.id });
              setTimeout(() => setToast(t => t.id === notif.id ? { visible: false, message: '', id: undefined } : t), 5000);
            }
          }
        }

        initializedSeen.current = true;
      } catch (e) {
        console.error('Failed to poll orders for notifications', e);
      }
    };

    checkForNew();
    const id = setInterval(checkForNew, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchServerNotifications = async () => {
      try {
        const rows = await api.getNotifications('0', true);
        if (!mounted) return;

        const mapped: Array<{ id: string; message: string; orderId: string | undefined; time: string; read: boolean }> = (rows || []).map((r: any) => {
          let orderId: string | undefined = undefined;
          try {
            const m = r.meta ? JSON.parse(r.meta) : null;
            if (m && m.orderId) orderId = String(m.orderId);
          } catch (e) { }
          return { id: String(r.id), message: String(r.message || ''), orderId, time: String(r.created_at || r.createdAt || new Date().toISOString()), read: !!r.read };
        });

        const newNotifs = mapped.filter((m) => !lastNotifIds.current.has(m.id));
        lastNotifIds.current = new Set(mapped.map((m) => m.id));

        setNotifications(prev => {
          const combined = mapped.concat(prev.filter(p => !mapped.some((m) => m.id === p.id)));
          return combined.slice(0, 50);
        });

        if (initializedSeen.current) {
          for (const n of newNotifs) {
            setToast({ visible: true, message: n.message, id: n.id });
            setTimeout(() => setToast(t => t.id === n.id ? { visible: false, message: '', id: undefined } : t), 5000);
          }
        }
      } catch (e) {
        console.error('Failed to fetch server notifications', e);
      }
    };

    fetchServerNotifications();
    const id = setInterval(fetchServerNotifications, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await api.getOrders('0', true);
      setOrders(data);
    } catch (e) {
      console.error("Failed to fetch orders");
    }
  };

  const handleEdit = (product: Product) => {
    setCurrentProduct(product);
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setCurrentProduct(initialFormState);
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentProduct.id) {
      onUpdateProduct(currentProduct as Product);
    } else {
      onAddProduct({ ...currentProduct } as Product);
    }
    setIsEditing(false);
  };

  const handleGenerateDescription = async () => {
    if (!currentProduct.name || !currentProduct.category) return;
    setIsGenerating(true);
    const desc = await api.generateProductDescription(currentProduct.name, currentProduct.category);
    setCurrentProduct(prev => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await api.updateOrderStatus(id, status);
    fetchOrders();
  };

  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm sm:text-base">Manage products and view orders</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-white p-1 rounded-lg border border-gray-200 overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <BarChart3 className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Stats</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'products' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'orders' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Package className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'stock' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Boxes className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Stock
          </button>
          <div className="relative flex items-center">
            <button onClick={() => setShowNotifDropdown(s => !s)} className="p-1.5 sm:p-2 rounded-md hover:bg-gray-50">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </button>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-bold leading-none text-white bg-red-600 rounded-full">{notifications.filter(n => !n.read).length}</span>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <Dashboard />
      )}

      {activeTab === 'stock' && (
        <StockManagement currentUser={currentUser} />
      )}

      {activeTab === 'products' && (
        <>
          <div className="flex justify-end mb-6">
            <button
              onClick={handleAddNew}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <Plus className="h-5 w-5" />
              <span>Add Product</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                isAdmin={true}
                onEdit={handleEdit}
                onDelete={onDeleteProduct}
              />
            ))}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Revenue</p>
              <p className="text-lg sm:text-3xl font-bold text-green-600">₹{totalSales}</p>
            </div>
            <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Orders</p>
              <p className="text-lg sm:text-3xl font-bold text-gray-900">{orders.length}</p>
            </div>
            <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Pending</p>
              <p className="text-lg sm:text-3xl font-bold text-orange-500">{orders.filter(o => o.status === 'pending').length}</p>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-900">#{order.id}</p>
                    <p className="text-xs text-gray-500">{order.user_name || 'Guest'}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-green-600">₹{order.total}</p>
                  <select
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    className="border-gray-300 rounded text-xs focus:ring-green-500 focus:border-green-500 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900">#{order.id}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.user_name || 'Guest'}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[150px]">{order.user_email}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="h-3 w-3 mr-1" /> {order.user_phone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-bold text-gray-900">₹{order.total}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className="border-gray-300 rounded-md text-sm focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showNotifDropdown && (
        <div className="fixed inset-x-3 sm:inset-x-auto sm:right-6 top-16 sm:top-20 sm:w-80 md:w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b flex justify-between items-center">
            <div className="font-medium text-sm sm:text-base">Notifications</div>
            <div className="text-xs sm:text-sm text-gray-500">{notifications.length} total</div>
          </div>
          <div className="max-h-60 sm:max-h-80 overflow-auto">
            {notifications.length === 0 && <div className="p-4 text-gray-500 text-sm">No notifications</div>}
            {notifications.map(n => (
              <div key={n.id} className={`px-3 sm:px-4 py-2 sm:py-3 border-b hover:bg-gray-50 flex justify-between items-start ${n.read ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-xs sm:text-sm text-gray-900">{n.message}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 mt-1">{new Date(n.time).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <button
                    onClick={async () => {
                      // Update local state immediately
                      setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: true } : p));
                      // Also update on server if it's a server notification (numeric id)
                      if (!isNaN(Number(n.id))) {
                        try {
                          await api.markNotificationRead(n.id);
                        } catch (e) {
                          console.error('Failed to mark notification as read on server', e);
                        }
                      }
                    }}
                    className="text-[10px] sm:text-xs text-green-600 mb-1 sm:mb-2"
                  >
                    Mark read
                  </button>
                  <button
                    onClick={async () => {
                      // Update local state immediately
                      setNotifications(prev => prev.filter(p => p.id !== n.id));
                      // Also delete on server if it's a server notification
                      if (!isNaN(Number(n.id))) {
                        try {
                          await api.deleteNotification(n.id);
                        } catch (e) {
                          console.error('Failed to delete notification on server', e);
                        }
                      }
                    }}
                    className="text-[10px] sm:text-xs text-gray-400"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t flex justify-between">
            <button
              onClick={async () => {
                // Delete all server notifications
                const serverNotifs = notifications.filter(n => !isNaN(Number(n.id)));
                for (const n of serverNotifs) {
                  try {
                    await api.deleteNotification(n.id);
                  } catch (e) {
                    console.error('Failed to delete notification', e);
                  }
                }
                setNotifications([]);
              }}
              className="text-xs sm:text-sm text-red-600"
            >
              Clear All
            </button>
            <button
              onClick={async () => {
                // Mark all as read on server
                const unreadServerNotifs = notifications.filter(n => !n.read && !isNaN(Number(n.id)));
                for (const n of unreadServerNotifs) {
                  try {
                    await api.markNotificationRead(n.id);
                  } catch (e) {
                    console.error('Failed to mark notification as read', e);
                  }
                }
                setNotifications(prev => prev.map(p => ({ ...p, read: true })));
                setShowNotifDropdown(false);
              }}
              className="text-xs sm:text-sm text-gray-600"
            >
              Mark all read
            </button>
          </div>
        </div>
      )}

      {toast.visible && (
        <div className="fixed right-6 bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 z-50">
          <div className="text-sm text-gray-900">{toast.message}</div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                {currentProduct.id ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={currentProduct.name || ''}
                  onChange={e => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={currentProduct.price || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit (e.g., kg, pc)</label>
                  <input
                    type="text"
                    required
                    value={currentProduct.unit || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={currentProduct.stock ?? 50}
                    onChange={e => setCurrentProduct({ ...currentProduct, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={currentProduct.min_stock ?? 10}
                    onChange={e => setCurrentProduct({ ...currentProduct, min_stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={currentProduct.category || CATEGORIES[1]}
                  onChange={e => setCurrentProduct({ ...currentProduct, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={currentProduct.image || ''}
                  onChange={e => setCurrentProduct({ ...currentProduct, image: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={!currentProduct.name || isGenerating}
                    className="text-xs flex items-center text-purple-600 hover:text-purple-700 disabled:opacity-50"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    {isGenerating ? 'Generating...' : 'Auto-Generate'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={currentProduct.description || ''}
                  onChange={e => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  {currentProduct.id ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
