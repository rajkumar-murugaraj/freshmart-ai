import React, { useState } from 'react';
import { User, Address } from '../types';
import { User as UserIcon, MapPin, Package, Trash2, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';
import { authService } from '../services/authService';

interface UserProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'notifications'>('profile');
  const [notifications, setNotifications] = useState<Array<{id: string; message: string; read: number; created_at: string}>>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({ label: 'Home' });

  const handleAddAddress = (e: React.FormEvent) => {
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

    const updatedUser = {
      ...user,
      addresses: [...user.addresses, address]
    };

    authService.updateUser(updatedUser);
    onUpdateUser(updatedUser);
    setShowAddressForm(false);
    setNewAddress({ label: 'Home' });
  };

  const handleDeleteAddress = (id: string) => {
    const updatedUser = {
      ...user,
      addresses: user.addresses.filter(a => a.id !== id)
    };
    authService.updateUser(updatedUser);
    onUpdateUser(updatedUser);
  };

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-2">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="font-bold text-gray-900 truncate">{user.name}</h2>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center space-x-3 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'profile' ? 'bg-green-50 text-green-700 border-l-4 border-green-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <UserIcon className="h-5 w-5" />
              <span>Profile & Addresses</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center space-x-3 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'orders' ? 'bg-green-50 text-green-700 border-l-4 border-green-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Package className="h-5 w-5" />
              <span>Order History</span>
            </button>
            <button
              onClick={async () => {
                setActiveTab('profile');
                setNotifLoading(true);
                try {
                  const data = await (await import('../services/api')).api.getNotifications((user && user.id) ? String(user.id) : '', false);
                  setNotifications(data);
                } catch (e) {
                  console.error('Failed to fetch notifications', e);
                }
                setNotifLoading(false);
                // switch to notifications view by setting a temporary active state
                setActiveTab('notifications' as any);
              }}
              className={`w-full flex items-center space-x-3 px-6 py-4 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50`}
            >
              <MapPin className="h-5 w-5" />
              <span>Notifications</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-gray-500" />
                    Saved Addresses
                  </h3>
                  <button 
                    onClick={() => setShowAddressForm(!showAddressForm)}
                    className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add New
                  </button>
                </div>

                {showAddressForm && (
                  <form onSubmit={handleAddAddress} className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200 animate-fadeIn">
                    <h4 className="font-medium text-gray-800 mb-4">Add New Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Label (e.g. Home, Office)"
                        className="p-2 rounded border border-gray-300"
                        value={newAddress.label}
                        onChange={e => setNewAddress({...newAddress, label: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="Contact Name"
                        className="p-2 rounded border border-gray-300"
                        value={newAddress.name || user.name}
                        onChange={e => setNewAddress({...newAddress, name: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="Street Address"
                        required
                        className="md:col-span-2 p-2 rounded border border-gray-300"
                        value={newAddress.street || ''}
                        onChange={e => setNewAddress({...newAddress, street: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="City"
                        required
                        className="p-2 rounded border border-gray-300"
                        value={newAddress.city || ''}
                        onChange={e => setNewAddress({...newAddress, city: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="ZIP Code"
                        required
                        className="p-2 rounded border border-gray-300"
                        value={newAddress.zip || ''}
                        onChange={e => setNewAddress({...newAddress, zip: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="Phone Number"
                        required
                        className="md:col-span-2 p-2 rounded border border-gray-300"
                        value={newAddress.phone || ''}
                        onChange={e => setNewAddress({...newAddress, phone: e.target.value})}
                      />
                    </div>
                    <div className="mt-4 flex space-x-2">
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded shadow-sm hover:bg-green-700">Save Address</button>
                      <button type="button" onClick={() => setShowAddressForm(false)} className="text-gray-600 px-4 py-2 hover:bg-gray-200 rounded">Cancel</button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.addresses.length === 0 ? (
                    <p className="text-gray-500 col-span-2 text-center py-8">No addresses saved yet.</p>
                  ) : (
                    user.addresses.map(addr => (
                      <div key={addr.id} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors relative group">
                        <button 
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded uppercase tracking-wide">{addr.label}</span>
                        </div>
                        <p className="font-semibold text-gray-800">{addr.name}</p>
                        <p className="text-sm text-gray-600">{addr.street}</p>
                        <p className="text-sm text-gray-600">{addr.city}, {addr.zip}</p>
                        <p className="text-sm text-gray-600 mt-1">📞 {addr.phone}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">Order History</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {user.orders.length === 0 ? (
                  <div className="p-10 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p>No orders found.</p>
                  </div>
                ) : (
                  [...user.orders].reverse().map(order => (
                    <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-2">
                        <div>
                          <p className="font-bold text-gray-900">Order #{order.id.slice(-6)}</p>
                          <p className="text-sm text-gray-500">{new Date(order.date).toLocaleDateString()} at {new Date(order.date).toLocaleTimeString()}</p>
                        </div>
                        <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          <span className="uppercase">{order.status}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm text-gray-600">
                            <span>{item.quantity}x {item.name}</span>
                            <span>₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                        <span className="text-sm text-gray-500">Paid via {order.paymentMethod === 'cod' ? 'Cash' : 'UPI'}</span>
                        <span className="text-lg font-bold text-gray-900">Total: ₹{order.total}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Notifications</h3>
                  <div className="text-sm text-gray-500">{notifLoading ? 'Loading...' : `${notifications.length} items`}</div>
                </div>
                <div className="divide-y divide-gray-100">
                  {notifications.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">No notifications yet.</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-4 ${n.read ? 'opacity-60' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm text-gray-900">{n.message}</div>
                            <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                          </div>
                          <div className="flex flex-col items-end ml-3">
                            <button onClick={async () => { try { await (await import('../services/api')).api.markNotificationRead(String(n.id)); setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: 1 } : p)); } catch(e){console.error(e);} }} className="text-xs text-green-600 mb-2">Mark read</button>
                            <button onClick={async () => { try { await (await import('../services/api')).api.deleteNotification(String(n.id)); setNotifications(prev => prev.filter(p => p.id !== n.id)); } catch(e){console.error(e);} }} className="text-xs text-gray-400">Dismiss</button>
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