import React, { useState, useEffect, useRef } from 'react';
import { Product, CATEGORIES, Order } from '../types';
import { ProductCard } from './ProductCard';
import { Plus, X, Wand2, Package, LayoutGrid, Search, Phone, Mail, Bell } from 'lucide-react';
import { generateProductDescription } from '../services/geminiService';
import { api } from '../services/api';
import { io as socketIOClient } from 'socket.io-client';

interface AdminPanelProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Array<{id: string; message: string; orderId?: string; time: string; read?: boolean}>>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [toast, setToast] = useState<{visible: boolean; message: string; id?: string}>({ visible: false, message: '' });
  const seenOrderIds = useRef(new Set<string>());
  const initializedSeen = useRef(false);
  const lastNotifIds = useRef(new Set<string>());
  
  // Product Form State
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const initialFormState = {
    name: '',
    price: 0,
    category: 'Vegetables',
    image: 'https://picsum.photos/400/300',
    description: '',
    unit: 'kg'
  };

  useEffect(() => {
    if (activeTab === 'orders') {
        fetchOrders();
    }
  }, [activeTab]);

  // Poll for new orders and create notifications
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
            // If we have not initialized, mark as seen without notifying
            if (!initializedSeen.current) {
              seenOrderIds.current.add(oid);
            } else {
              seenOrderIds.current.add(oid);
              const msg = `New order #${o.id} placed by ${o.user_name || 'Guest'} — ₹${o.total}`;
              const notif = { id: `${Date.now()}-${oid}`, message: msg, orderId: oid, time: new Date().toISOString(), read: false };
              setNotifications(prev => [notif, ...prev].slice(0, 50));
              // show a transient toast
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

    // initial check - seed seen ids without popups
    checkForNew();
    const id = setInterval(checkForNew, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Poll server-side notifications for admins and merge them into local notifications
  useEffect(() => {
    let mounted = true;

    const fetchServerNotifications = async () => {
      try {
        const rows = await api.getNotifications('0', true); // isAdmin=true
        if (!mounted) return;

        // Map server rows into local notification shape
        type NotifType = {id: string; message: string; orderId?: string; time: string; read?: boolean};
        const mapped: NotifType[] = (rows || []).map((r: any) => {
          let orderId: string | undefined = undefined;
          try {
            const m = r.meta ? JSON.parse(r.meta) : null;
            if (m && m.orderId) orderId = String(m.orderId);
          } catch (e) {}
          return { id: String(r.id), message: String(r.message || ''), orderId, time: String(r.created_at || r.createdAt || new Date().toISOString()), read: !!r.read };
        });

        // Determine which ones are new since last poll
        const newNotifs = mapped.filter((m) => !lastNotifIds.current.has(m.id));

        // Update last seen ids
        lastNotifIds.current = new Set(mapped.map((m) => m.id));

        // Merge server notifications on top of existing local ones (avoid duplicates)
        setNotifications(prev => {
          const combined = mapped.concat(prev.filter(p => !mapped.some((m) => m.id === p.id)));
          return combined.slice(0, 50);
        });

        // Show transient toasts for newly arrived server notifications (skip initial seed)
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

    // initial fetch
    fetchServerNotifications();
    const id = setInterval(fetchServerNotifications, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Real-time socket listener for server-emitted notifications
  useEffect(() => {
    let mounted = true;
    const socket = socketIOClient();

    socket.on('notification', (n: any) => {
      if (!mounted) return;
      // Only care about admin notifications here
      if (n && Number(n.is_admin) === 1) {
        const orderId = n.meta ? (() => { try { const m = JSON.parse(n.meta); return m && m.orderId ? String(m.orderId) : undefined; } catch(e){ return undefined; } })() : undefined;
        const notif = { id: String(n.id), message: n.message, orderId, time: n.created_at || new Date().toISOString(), read: !!n.read };
        // prepend if not duplicate
        setNotifications(prev => prev.some(p => p.id === notif.id) ? prev : [notif, ...prev].slice(0,50));
        // show toast
        setToast({ visible: true, message: notif.message, id: notif.id });
        setTimeout(() => setToast(t => t.id === notif.id ? { visible: false, message: '', id: undefined } : t), 5000);
      }
    });

    return () => { mounted = false; socket.disconnect(); };
  }, []);

  const fetchOrders = async () => {
      try {
          const data = await api.getOrders('0', true); // isAdmin=true
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
      onAddProduct({ ...currentProduct } as Product); // ID handled by DB
    }
    setIsEditing(false);
  };

  const handleGenerateDescription = async () => {
    if (!currentProduct.name || !currentProduct.category) return;
    setIsGenerating(true);
    const desc = await generateProductDescription(currentProduct.name, currentProduct.category);
    setCurrentProduct(prev => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const updateOrderStatus = async (id: string, status: string) => {
      await api.updateOrderStatus(id, status);
      fetchOrders();
  };

  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500">Manage products and view orders</p>
        </div>
        
        <div className="flex space-x-4 bg-white p-1 rounded-lg border border-gray-200">
            <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <LayoutGrid className="inline h-4 w-4 mr-2" />
                Products
            </button>
            <button
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <Package className="inline h-4 w-4 mr-2" />
                Orders
            </button>
            {/* Notification Bell */}
            <div className="relative flex items-center">
              <button onClick={() => setShowNotifDropdown(s => !s)} className="p-2 rounded-md hover:bg-gray-50">
                <Bell className="h-5 w-5 text-gray-600" />
              </button>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">{notifications.filter(n => !n.read).length}</span>
              )}
            </div>
        </div>
      </div>

      {activeTab === 'products' ? (
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
      ) : (
          <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-gray-500 text-sm font-medium">Total Revenue</p>
                      <p className="text-3xl font-bold text-green-600">₹{totalSales}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-gray-500 text-sm font-medium">Total Orders</p>
                      <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-gray-500 text-sm font-medium">Pending Orders</p>
                      <p className="text-3xl font-bold text-orange-500">{orders.filter(o => o.status === 'pending').length}</p>
                  </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {orders.map((order) => (
                              <tr key={order.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{order.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{order.user_name || 'Guest'}</div>
                                      <div className="text-sm text-gray-500">{order.user_email}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center text-sm text-gray-500">
                                          <Phone className="h-3 w-3 mr-1" /> {order.user_phone || 'N/A'}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">₹{order.total}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                          order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                          {order.status}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
      )}

      {/* Notification Dropdown */}
      {showNotifDropdown && (
        <div className="fixed right-6 top-20 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="px-4 py-3 border-b flex justify-between items-center">
            <div className="font-medium">Notifications</div>
            <div className="text-sm text-gray-500">{notifications.length} total</div>
          </div>
          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 && <div className="p-4 text-gray-500">No notifications</div>}
            {notifications.map(n => (
              <div key={n.id} className={`px-4 py-3 border-b hover:bg-gray-50 flex justify-between items-start ${n.read ? 'opacity-60' : ''}`}>
                <div>
                  <div className="text-sm text-gray-900">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(n.time).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-end ml-3">
                  <button onClick={() => setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: true } : p))} className="text-xs text-green-600 mb-2">Mark read</button>
                  <button onClick={() => setNotifications(prev => prev.filter(p => p.id !== n.id))} className="text-xs text-gray-400">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t flex justify-between">
            <button onClick={() => setNotifications([])} className="text-sm text-red-600">Clear All</button>
            <button onClick={() => { setNotifications(prev => prev.map(p => ({ ...p, read: true }))); setShowNotifDropdown(false); }} className="text-sm text-gray-600">Mark all read</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed right-6 bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 z-50">
          <div className="text-sm text-gray-900">{toast.message}</div>
        </div>
      )}

      {/* Modal Form */}
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
                  onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})}
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
                    onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit (e.g., kg, pc)</label>
                  <input 
                    type="text" 
                    required
                    value={currentProduct.unit || ''}
                    onChange={e => setCurrentProduct({...currentProduct, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select 
                  value={currentProduct.category || CATEGORIES[1]}
                  onChange={e => setCurrentProduct({...currentProduct, category: e.target.value})}
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
                  onChange={e => setCurrentProduct({...currentProduct, image: e.target.value})}
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
                  onChange={e => setCurrentProduct({...currentProduct, description: e.target.value})}
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