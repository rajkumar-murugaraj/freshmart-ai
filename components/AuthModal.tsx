import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Phone, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

type AuthMode = 'user_login' | 'user_register' | 'admin_login';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('user_login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      let user;
      
      if (authMode === 'admin_login') {
        // Explicit Admin Login
        user = await api.login(formData.email, formData.password, 'admin');
      } else if (authMode === 'user_login') {
        // Standard User Login
        user = await api.login(formData.email, formData.password, 'user');
      } else {
        // User Registration
        user = await api.register(formData.name, formData.email, formData.password, formData.phone);
      }
      
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = (mode: AuthMode) => {
      setAuthMode(mode);
      setError('');
      setFormData({ name: '', email: '', password: '', phone: '' });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <X className="h-6 w-6" />
        </button>

        {/* Header Tabs */}
        <div className="flex border-b border-gray-100">
            <button 
                className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 transition-colors ${authMode.startsWith('user') ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => resetForm('user_login')}
            >
                <UserIcon className="h-4 w-4" />
                <span>User Portal</span>
            </button>
            <button 
                className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 transition-colors ${authMode === 'admin_login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => resetForm('admin_login')}
            >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Portal</span>
            </button>
        </div>

        <div className="p-8 overflow-y-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {authMode === 'admin_login' ? 'Admin Access' : (authMode === 'user_login' ? 'Welcome Back' : 'Join FreshMart')}
            </h2>
            <p className="text-gray-500 mt-2 text-sm">
              {authMode === 'admin_login' 
                ? 'Manage products, orders, and sales.' 
                : (authMode === 'user_login' ? 'Sign in to access your orders.' : 'Create an account to start shopping.')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'user_register' && (
              <>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </>
            )}
            
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="email"
                placeholder="Email Address"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                placeholder="Password"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                    {error}
                </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full text-white py-3 rounded-lg font-bold transition-colors shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 ${authMode === 'admin_login' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'}`}
            >
              <span>
                  {authMode === 'user_register' ? 'Create Account' : 'Sign In'}
              </span>
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Footer / Switcher */}
          {authMode !== 'admin_login' && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => { 
                      setAuthMode(authMode === 'user_login' ? 'user_register' : 'user_login'); 
                      setError(''); 
                  }}
                  className="text-sm text-green-600 font-medium hover:text-green-700 hover:underline"
                >
                  {authMode === 'user_login' ? "New user? Create an account" : "Have an account? Sign In"}
                </button>
              </div>
          )}

          {/* Admin Hint */}
          {authMode === 'admin_login' && (
             <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 border border-blue-200">
                  <div className="flex items-center mb-1 font-semibold">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    <span>Demo Admin Credentials</span>
                  </div>
                  <p>Email: <span className="font-mono">admin@freshmart.com</span></p>
                  <p>Pass: <span className="font-mono">admin123</span></p>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};