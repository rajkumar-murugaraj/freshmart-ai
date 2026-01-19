'use client';

import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User as UserIcon, Phone, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

type AuthMode = 'login' | 'register';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

// Validation patterns
const validationPatterns = {
  name: /^[a-zA-Z\s]{2,50}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*\d).{6,}$/,
  phone: /^[6-9]\d{9}$/,
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setAuthMode('login');
      setFormData({ name: '', email: '', password: '', phone: '' });
      setError('');
      setFieldErrors({});
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateField = (field: keyof typeof formData, value: string): string | undefined => {
    if (!value.trim()) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
    }

    switch (field) {
      case 'name':
        if (!validationPatterns.name.test(value)) {
          return 'Name must be 2-50 characters with only letters';
        }
        break;
      case 'email':
        if (!validationPatterns.email.test(value)) {
          return 'Please enter a valid email address';
        }
        break;
      case 'password':
        if (authMode === 'register' && !validationPatterns.password.test(value)) {
          return 'Password must be 6+ characters with at least one number';
        }
        break;
      case 'phone':
        if (!validationPatterns.phone.test(value)) {
          return 'Please enter a valid 10-digit mobile number';
        }
        break;
    }
    return undefined;
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: undefined });
    }
  };

  const handleFieldBlur = (field: keyof typeof formData) => {
    if (authMode === 'register' || (field === 'email' || field === 'password')) {
      const error = validateField(field, formData[field]);
      setFieldErrors({ ...fieldErrors, [field]: error });
    }
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    errors.email = validateField('email', formData.email);

    if (authMode === 'login') {
      if (!formData.password.trim()) {
        errors.password = 'Password is required';
      }
    } else {
      errors.password = validateField('password', formData.password);
      errors.name = validateField('name', formData.name);
      errors.phone = validateField('phone', formData.phone);
    }

    const filteredErrors: FieldErrors = {};
    Object.keys(errors).forEach(key => {
      const k = key as keyof FieldErrors;
      if (errors[k]) filteredErrors[k] = errors[k];
    });

    setFieldErrors(filteredErrors);
    return Object.keys(filteredErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      let user;

      if (authMode === 'login') {
        // Login without specifying role - backend will auto-detect if admin or user
        user = await api.login(formData.email, formData.password);
      } else {
        user = await api.register(formData.name, formData.email, formData.password, formData.phone);
      }

      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
    setFormData({ name: '', email: '', password: '', phone: '' });
    setError('');
    setFieldErrors({});
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <X className="h-6 w-6" />
        </button>

        <div className="p-8 overflow-y-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
            </h2>
            <p className="text-gray-500 mt-2 text-sm">
              {authMode === 'login'
                ? 'Sign in to continue shopping'
                : 'Join FreshMart to start shopping'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Name - only for registration */}
            {authMode === 'register' && (
              <div>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none ${fieldErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'}`}
                    value={formData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleFieldBlur('name')}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-500 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {fieldErrors.name}
                  </p>
                )}
              </div>
            )}

            {/* Phone - only for registration */}
            {authMode === 'register' && (
              <div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone Number (10 digits)"
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none ${fieldErrors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'}`}
                    value={formData.phone}
                    onChange={e => handleFieldChange('phone', e.target.value)}
                    onBlur={() => handleFieldBlur('phone')}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="mt-1 text-xs text-red-500 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="Email Address"
                  autoComplete="new-password"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none ${fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'}`}
                  value={formData.email}
                  onChange={e => handleFieldChange('email', e.target.value)}
                  onBlur={() => handleFieldBlur('email')}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-500 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  placeholder={authMode === 'register' ? 'Password (min 6 chars, 1 number)' : 'Password'}
                  autoComplete="new-password"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none ${fieldErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'}`}
                  value={formData.password}
                  onChange={e => handleFieldChange('password', e.target.value)}
                  onBlur={() => handleFieldBlur('password')}
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-500 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center space-x-2 disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>{authMode === 'register' ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch mode link */}
          <div className="mt-6 text-center">
            <button
              onClick={switchMode}
              className="text-sm text-green-600 font-medium hover:text-green-700 hover:underline"
            >
              {authMode === 'login' ? "New user? Create an account" : "Already have an account? Sign In"}
            </button>
          </div>

          {/* Info box */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
              <p className="font-medium mb-1">Demo Credentials:</p>
              <p>Admin: <span className="font-mono">admin@freshmart.com</span> / <span className="font-mono">admin123</span></p>
              <p>Sales: <span className="font-mono">sales@freshmart.com</span> / <span className="font-mono">sales123</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
