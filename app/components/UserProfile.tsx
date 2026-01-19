'use client';

import React, { useState, useEffect } from 'react';
import { User, Address, Order, CartItem } from '../types';
import { User as UserIcon, MapPin, Package, Trash2, Plus, Clock, CheckCircle, XCircle, Bell, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';

interface UserProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onReorder?: (items: CartItem[]) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser, onReorder }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'notifications'>('profile');
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; read: number; created_at: string }>>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({ label: 'Home' });

  const fetchOrders = async () => {
    try {
      const data = await api.getOrders(user.id, false);
      setOrders(data);
    } catch (e) {
      console.error('Failed to fetch orders', e);
    }
  };

  const loadNotifications = async (showLoading = false) => {
    if (showLoading) setNotifLoading(true);
    try {
      const data = await api.getNotifications(user.id, false);
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
    if (showLoading) setNotifLoading(false);
  };

  // Reset all state when user changes (new user logs in)
  useEffect(() => {
    setActiveTab('profile');
    setNotifications([]);
    setOrders([]);
    setShowAddressForm(false);
    setNewAddress({ label: 'Home' });
  }, [user.id]);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab, user.id]);

  // Real-time notification polling
  useEffect(() => {
    // Initial load of notifications
    loadNotifications();

    // Poll for new notifications every 30 seconds
    const pollInterval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [user.id]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.street || !newAddress.city || !newAddress.zip) return;

    const address: Address = {
      id: Date.now().toString(),
      label: newAddress.label || 'Home',
      name: newAddress.name || user.name,
      street: newAddress.street!,
      city: newAddress.city!,
      zip: newAddress.zip!,
      phone: newAddress.phone || ''
    };

    const updatedAddresses = [...user.addresses, address];

    await api.updateUserAddresses(user.id, updatedAddresses);

    const updatedUser = {
      ...user,
      addresses: updatedAddresses
    };

    onUpdateUser(updatedUser);
    setShowAddressForm(false);
    setNewAddress({ label: 'Home' });
  };

  const handleDeleteAddress = async (id: string) => {
    const updatedAddresses = user.addresses.filter(a => a.id !== id);
    await api.updateUserAddresses(user.id, updatedAddresses);

    const updatedUser = {
      ...user,
      addresses: updatedAddresses
    };
    onUpdateUser(updatedUser);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-orange-600 bg-orange-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleReorder = (order: Order) => {
    if (onReorder && order.items.length > 0) {
      onReorder(order.items);
      toast.success(`${order.items.length} item${order.items.length > 1 ? 's' : ''} added to cart!`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="flex flex-col md:flex-row gap-4 sm:gap-8">

        {/* Sidebar - horizontal tabs on mobile, vertical on desktop */}
        <div className="w-full md:w-64 space-y-2">
          {/* User info card - compact on mobile */}
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 flex md:flex-col md:text-center items-center gap-3 md:gap-0">
            <div className="h-12 w-12 sm:h-20 sm:w-20 bg-green-100 rounded-full flex items-center justify-center md:mx-auto md:mb-4 flex-shrink-0">
              <UserIcon className="h-6 w-6 sm:h-10 sm:w-10 text-green-600" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 truncate text-sm sm:text-base">{user.name}</h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{user.email}</p>
            </div>
          </div>

          {/* Navigation tabs - horizontal scroll on mobile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex md:flex-col overflow-x-auto">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start ${activeTab === 'profile' ? 'bg-green-50 text-green-700 md:border-l-4 border-b-2 md:border-b-0 border-green-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Profile & Addresses</span>
                <span className="sm:hidden">Profile</span>
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start ${activeTab === 'orders' ? 'bg-green-50 text-green-700 md:border-l-4 border-b-2 md:border-b-0 border-green-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Orders</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('notifications');
                  loadNotifications(true);
                }}
                className={`flex items-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start relative ${activeTab === 'notifications' ? 'bg-green-50 text-green-700 md:border-l-4 border-b-2 md:border-b-0 border-green-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Alerts</span>
                {unreadCount > 0 && (
                  <span className="ml-1 sm:ml-auto bg-red-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500" />
                    Saved Addresses
                  </h3>
                  <button
                    onClick={() => setShowAddressForm(!showAddressForm)}
                    className="text-xs sm:text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Add New
                  </button>
                </div>

                {showAddressForm && (
                  <form onSubmit={handleAddAddress} className="mb-6 sm:mb-8 bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200 animate-fadeIn">
                    <h4 className="font-medium text-gray-800 mb-3 sm:mb-4 text-sm sm:text-base">Add New Address</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <input
                        type="text"
                        placeholder="Label (e.g. Home, Office)"
                        className="p-2 rounded border border-gray-300 text-sm"
                        value={newAddress.label}
                        onChange={e => setNewAddress({ ...newAddress, label: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Contact Name"
                        className="p-2 rounded border border-gray-300 text-sm"
                        value={newAddress.name || user.name}
                        onChange={e => setNewAddress({ ...newAddress, name: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Street Address"
                        required
                        className="sm:col-span-2 p-2 rounded border border-gray-300 text-sm"
                        value={newAddress.street || ''}
                        onChange={e => setNewAddress({ ...newAddress, street: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="City"
                        required
                        className="p-2 rounded border border-gray-300 text-sm"
                        value={newAddress.city || ''}
                        onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="ZIP Code"
                        required
                        className="p-2 rounded border border-gray-300 text-sm"
                        value={newAddress.zip || ''}
                        onChange={e => setNewAddress({ ...newAddress, zip: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Phone Number"
                        required
                        className="sm:col-span-2 p-2 rounded border border-gray-300 text-sm"
                        value={newAddress.phone || ''}
                        onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })}
                      />
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:space-x-2">
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded shadow-sm hover:bg-green-700 text-sm">Save Address</button>
                      <button type="button" onClick={() => setShowAddressForm(false)} className="text-gray-600 px-4 py-2 hover:bg-gray-200 rounded text-sm">Cancel</button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {user.addresses.length === 0 ? (
                    <p className="text-gray-500 col-span-2 text-center py-6 sm:py-8 text-sm">No addresses saved yet.</p>
                  ) : (
                    user.addresses.map(addr => (
                      <div key={addr.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-green-300 transition-colors relative group">
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-[10px] sm:text-xs font-bold text-green-700 bg-green-100 px-1.5 sm:px-2 py-0.5 rounded uppercase tracking-wide">{addr.label}</span>
                        </div>
                        <p className="font-semibold text-gray-800 text-sm sm:text-base">{addr.name}</p>
                        <p className="text-xs sm:text-sm text-gray-600">{addr.street}</p>
                        <p className="text-xs sm:text-sm text-gray-600">{addr.city}, {addr.zip}</p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">Phone: {addr.phone}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-100">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Order History</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <div className="p-8 sm:p-10 text-center text-gray-500">
                    <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm">No orders found.</p>
                  </div>
                ) : (
                  [...orders].reverse().map(order => (
                    <div key={order.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 sm:mb-4 gap-2">
                        <div>
                          <p className="font-bold text-gray-900 text-sm sm:text-base">Order #{order.id}</p>
                          <p className="text-xs sm:text-sm text-gray-500">{new Date(order.date).toLocaleDateString()} at {new Date(order.date).toLocaleTimeString()}</p>
                        </div>
                        <div className={`inline-flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold w-fit ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          <span className="uppercase">{order.status}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                        {order.items.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-xs sm:text-sm text-gray-600">
                            <span className="truncate mr-2">{item.quantity}x {item.name}</span>
                            <span className="flex-shrink-0">₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-gray-100 pt-2 sm:pt-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <span className="text-xs sm:text-sm text-gray-500">Paid via {order.paymentMethod === 'cod' ? 'Cash' : 'UPI'}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-base sm:text-lg font-bold text-gray-900">Total: ₹{order.total}</span>
                          {onReorder && order.status === 'completed' && (
                            <button
                              onClick={() => handleReorder(order)}
                              className="flex items-center space-x-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>Reorder</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Notifications</h3>
                <div className="text-xs sm:text-sm text-gray-500">{notifLoading ? 'Loading...' : `${notifications.length} items`}</div>
              </div>
              <div className="divide-y divide-gray-100">
                {notifications.length === 0 ? (
                  <div className="p-8 sm:p-10 text-center text-gray-500 text-sm">No notifications yet.</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-3 sm:p-4 ${n.read ? 'opacity-60' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs sm:text-sm text-gray-900">{n.message}</div>
                          <div className="text-[10px] sm:text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <button
                            onClick={async () => {
                              await api.markNotificationRead(String(n.id));
                              setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: 1 } : p));
                            }}
                            className="text-[10px] sm:text-xs text-green-600 mb-1 sm:mb-2"
                          >
                            Mark read
                          </button>
                          <button
                            onClick={async () => {
                              await api.deleteNotification(String(n.id));
                              setNotifications(prev => prev.filter(p => p.id !== n.id));
                            }}
                            className="text-[10px] sm:text-xs text-gray-400"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
