'use client';

import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethod, User, Address } from '../types';
import { CreditCard, Truck, CheckCircle, ArrowLeft, MapPin, Plus, AlertCircle, LogIn, Loader2, Shield, Smartphone } from 'lucide-react';
import { DeliverySlots, DeliverySlot } from './DeliverySlots';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface CheckoutProps {
  cart: CartItem[];
  currentUser: User | null;
  onBack: () => void;
  onSuccess: (order: any) => void;
  onLoginClick: () => void;
}

// Validation patterns
const validationPatterns = {
  name: /^[a-zA-Z\s]{2,50}$/,
  phone: /^[6-9]\d{9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  zip: /^\d{6}$/,
  street: /^.{5,100}$/,
  city: /^[a-zA-Z\s]{2,50}$/,
};

const validationMessages = {
  name: 'Name must be 2-50 characters and contain only letters',
  phone: 'Please enter a valid 10-digit mobile number',
  email: 'Please enter a valid email address',
  zip: 'Please enter a valid 6-digit PIN code',
  street: 'Street address must be 5-100 characters',
  city: 'City must be 2-50 characters',
};

export const Checkout: React.FC<CheckoutProps> = ({ cart, currentUser, onBack, onSuccess, onLoginClick }) => {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const [step, setStep] = useState<'details' | 'delivery' | 'payment'>('details');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isNewAddress, setIsNewAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<Partial<Address>>({
    label: 'Home',
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    street: '',
    city: '',
    zip: '',
    phone: currentUser?.phone || ''
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.COD);
  const [selectedDeliverySlot, setSelectedDeliverySlot] = useState<DeliverySlot | null>(null);

  // Razorpay state
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Calculate total with delivery fee
  const deliveryFee = selectedDeliverySlot?.isExpress ? selectedDeliverySlot.price : 0;
  const total = subtotal + deliveryFee;

  // Reset form when user changes
  useEffect(() => {
    if (currentUser) {
      // Reset address form with new user data
      setAddressForm({
        label: 'Home',
        name: currentUser.name || '',
        email: currentUser.email || '',
        street: '',
        city: '',
        zip: '',
        phone: currentUser.phone || ''
      });

      if (currentUser.addresses.length > 0) {
        setSelectedAddressId(currentUser.addresses[0].id);
        setIsNewAddress(false);
      } else {
        setSelectedAddressId('');
        setIsNewAddress(true);
      }
    } else {
      // Clear form when no user
      setAddressForm({
        label: 'Home',
        name: '',
        email: '',
        street: '',
        city: '',
        zip: '',
        phone: ''
      });
      setSelectedAddressId('');
      setIsNewAddress(true);
    }
    // Reset other state
    setStep('details');
    setErrors({});
    setPaymentMethod(PaymentMethod.COD);
  }, [currentUser?.id]);

  // Validate a single field
  const validateField = (field: string, value: string): string => {
    const pattern = validationPatterns[field as keyof typeof validationPatterns];
    if (!pattern) return '';
    if (!value || !pattern.test(value)) {
      return validationMessages[field as keyof typeof validationMessages] || 'Invalid value';
    }
    return '';
  };

  // Validate all fields
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (isNewAddress || !currentUser) {
      const fieldsToValidate = ['name', 'phone', 'email', 'zip', 'street', 'city'];
      fieldsToValidate.forEach(field => {
        const value = addressForm[field as keyof typeof addressForm] as string || '';
        const error = validateField(field, value);
        if (error) newErrors[field] = error;
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle field change with validation
  const handleFieldChange = (field: string, value: string) => {
    setAddressForm({ ...addressForm, [field]: value });

    // Clear error when user starts typing
    if (errors[field]) {
      const error = validateField(field, value);
      setErrors({ ...errors, [field]: error });
    }
  };

  // Handle field blur for validation
  const handleFieldBlur = (field: string, value: string) => {
    const error = validateField(field, value);
    setErrors({ ...errors, [field]: error });
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!isNewAddress && !selectedAddressId) return;
    setStep('delivery');
  };

  const handleDeliverySubmit = () => {
    if (!selectedDeliverySlot) return;
    setStep('payment');
  };

  // Initiate Razorpay payment
  const initiateRazorpayPayment = async () => {
    if (!currentUser || !razorpayLoaded) return;

    setIsPaymentLoading(true);
    setPaymentError(null);

    let shippingAddress: Address;
    if (isNewAddress) {
      shippingAddress = {
        id: Date.now().toString(),
        label: addressForm.label || 'Home',
        name: addressForm.name!,
        email: addressForm.email!,
        street: addressForm.street!,
        city: addressForm.city!,
        zip: addressForm.zip!,
        phone: addressForm.phone!
      };
    } else {
      const saved = currentUser?.addresses.find(a => a.id === selectedAddressId);
      if (!saved) {
        setIsPaymentLoading(false);
        return;
      }
      shippingAddress = saved;
    }

    try {
      // Create Razorpay order
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: total,
          currency: 'INR',
          receipt: `order_${Date.now()}`,
          notes: {
            userId: currentUser.id,
            customerName: shippingAddress.name,
            customerEmail: shippingAddress.email
          }
        })
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'FreshMart',
        description: `Order Payment - ${cart.length} items`,
        order_id: orderData.order.id,
        prefill: {
          name: shippingAddress.name,
          email: shippingAddress.email,
          contact: shippingAddress.phone
        },
        theme: {
          color: '#16a34a'
        },
        handler: async function (response: any) {
          // Verify payment
          try {
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              // Payment verified, create order
              const orderPayload = {
                user_id: currentUser.id,
                total,
                subtotal,
                deliveryFee,
                items: cart,
                paymentMethod: PaymentMethod.UPI,
                shippingAddress,
                deliverySlot: selectedDeliverySlot ? {
                  date: selectedDeliverySlot.displayDate,
                  time: selectedDeliverySlot.timeSlot,
                  isExpress: selectedDeliverySlot.isExpress
                } : null,
                paymentId: response.razorpay_payment_id,
                paymentOrderId: response.razorpay_order_id
              };

              await onSuccess(orderPayload);
            } else {
              setPaymentError('Payment verification failed. Please contact support.');
            }
          } catch (error) {
            setPaymentError('Payment verification failed. Please contact support.');
          }
          setIsPaymentLoading(false);
        },
        modal: {
          ondismiss: function () {
            setIsPaymentLoading(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'Payment failed. Please try again.');
      setIsPaymentLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!currentUser) {
      onLoginClick();
      return;
    }

    setIsSubmitting(true);

    let shippingAddress: Address;

    if (isNewAddress) {
      shippingAddress = {
        id: Date.now().toString(),
        label: addressForm.label || 'Home',
        name: addressForm.name!,
        email: addressForm.email!,
        street: addressForm.street!,
        city: addressForm.city!,
        zip: addressForm.zip!,
        phone: addressForm.phone!
      };
    } else {
      const saved = currentUser?.addresses.find(a => a.id === selectedAddressId);
      if (!saved) {
        setIsSubmitting(false);
        return;
      }
      shippingAddress = saved;
    }

    const orderData = {
      user_id: currentUser.id,
      total,
      subtotal,
      deliveryFee,
      items: cart,
      paymentMethod,
      shippingAddress,
      deliverySlot: selectedDeliverySlot ? {
        date: selectedDeliverySlot.displayDate,
        time: selectedDeliverySlot.timeSlot,
        isExpress: selectedDeliverySlot.isExpress
      } : null
    };

    try {
      await onSuccess(orderData);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show login required message if not signed in
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <button onClick={onBack} className="flex items-center text-gray-500 hover:text-gray-900 mb-4 sm:mb-6 text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Shop
        </button>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8 text-center">
            <div className="bg-orange-100 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <LogIn className="h-8 w-8 sm:h-10 sm:w-10 text-orange-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Sign In Required</h2>
            <p className="text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto text-sm sm:text-base">
              Please sign in to your account to proceed with checkout. This helps us track your order and send you updates.
            </p>
            <button
              onClick={onLoginClick}
              className="bg-green-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 text-sm sm:text-base"
            >
              Sign In to Continue
            </button>
            <p className="text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4">
              Don&apos;t have an account? You can create one during sign-in.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <button onClick={onBack} className="flex items-center text-gray-500 hover:text-gray-900 mb-4 sm:mb-6 text-sm">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Shop
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-700 px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100 dark:border-gray-600 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Checkout</h2>
            <div className="flex space-x-2 mt-2">
              <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${step === 'details' ? 'bg-green-600 text-white' : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'}`}>1. Shipping</span>
              <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${step === 'delivery' ? 'bg-green-600 text-white' : step === 'payment' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>2. Delivery</span>
              <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${step === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>3. Payment</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg sm:text-xl font-bold text-green-600">₹{total}</p>
            {deliveryFee > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">includes ₹{deliveryFee} express fee</p>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-4 sm:space-y-6 animate-fadeIn">
              {currentUser && currentUser.addresses.length > 0 && (
                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Select Delivery Address</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {currentUser.addresses.map(addr => (
                      <div
                        key={addr.id}
                        onClick={() => { setSelectedAddressId(addr.id); setIsNewAddress(false); setErrors({}); }}
                        className={`cursor-pointer p-3 sm:p-4 rounded-xl border-2 transition-all relative ${
                          !isNewAddress && selectedAddressId === addr.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <MapPin className={`h-3 w-3 sm:h-4 sm:w-4 ${!isNewAddress && selectedAddressId === addr.id ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className="font-bold text-xs sm:text-sm uppercase">{addr.label}</span>
                        </div>
                        <p className="font-medium text-sm sm:text-base">{addr.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{addr.street}, {addr.city}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{addr.zip}</p>
                        <p className="text-xs sm:text-sm text-gray-500">Phone: {addr.phone}</p>
                      </div>
                    ))}

                    <div
                      onClick={() => setIsNewAddress(true)}
                      className={`cursor-pointer p-3 sm:p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-gray-500 hover:text-green-600 hover:border-green-300 min-h-[120px] sm:min-h-[140px] ${isNewAddress ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                    >
                      <Plus className="h-5 w-5 sm:h-6 sm:w-6 mb-2" />
                      <span className="font-medium text-sm">Add New Address</span>
                    </div>
                  </div>
                </div>
              )}

              {(isNewAddress || currentUser.addresses.length === 0) && (
                <div className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Shipping Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                        value={addressForm.name}
                        onChange={e => handleFieldChange('name', e.target.value)}
                        onBlur={e => handleFieldBlur('name', e.target.value)}
                      />
                      {errors.name && (
                        <p className="text-red-500 text-[10px] sm:text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />{errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                      <input
                        type="text"
                        required
                        className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm ${errors.street ? 'border-red-500' : 'border-gray-300'}`}
                        value={addressForm.street}
                        onChange={e => handleFieldChange('street', e.target.value)}
                        onBlur={e => handleFieldBlur('street', e.target.value)}
                      />
                      {errors.street && (
                        <p className="text-red-500 text-[10px] sm:text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />{errors.street}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City *</label>
                      <input
                        type="text"
                        required
                        className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm ${errors.city ? 'border-red-500' : 'border-gray-300'}`}
                        value={addressForm.city}
                        onChange={e => handleFieldChange('city', e.target.value)}
                        onBlur={e => handleFieldBlur('city', e.target.value)}
                      />
                      {errors.city && (
                        <p className="text-red-500 text-[10px] sm:text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />{errors.city}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">PIN Code *</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm ${errors.zip ? 'border-red-500' : 'border-gray-300'}`}
                        value={addressForm.zip}
                        onChange={e => handleFieldChange('zip', e.target.value.replace(/\D/g, ''))}
                        onBlur={e => handleFieldBlur('zip', e.target.value)}
                        placeholder="6-digit PIN code"
                      />
                      {errors.zip && (
                        <p className="text-red-500 text-[10px] sm:text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />{errors.zip}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                        value={addressForm.phone}
                        onChange={e => handleFieldChange('phone', e.target.value.replace(/\D/g, ''))}
                        onBlur={e => handleFieldBlur('phone', e.target.value)}
                        placeholder="10-digit mobile number"
                      />
                      {errors.phone && (
                        <p className="text-red-500 text-[10px] sm:text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />{errors.phone}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                        value={addressForm.email}
                        onChange={e => handleFieldChange('email', e.target.value)}
                        onBlur={e => handleFieldBlur('email', e.target.value)}
                      />
                      {errors.email && (
                        <p className="text-red-500 text-[10px] sm:text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />{errors.email}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Address Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Home, Office"
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                        value={addressForm.label}
                        onChange={e => setAddressForm({ ...addressForm, label: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2.5 sm:py-3 rounded-lg font-bold hover:bg-green-700 transition-colors mt-4 shadow-lg shadow-green-100 dark:shadow-none text-sm sm:text-base"
              >
                Choose Delivery Slot
              </button>
            </form>
          ) : step === 'delivery' ? (
            <div className="space-y-6 sm:space-y-8 animate-fadeIn">
              <DeliverySlots
                selectedSlot={selectedDeliverySlot}
                onSelectSlot={setSelectedDeliverySlot}
              />

              <div className="flex gap-3 sm:space-x-4">
                <button
                  onClick={() => setStep('details')}
                  className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2.5 sm:py-3 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
                >
                  Back
                </button>
                <button
                  onClick={handleDeliverySubmit}
                  disabled={!selectedDeliverySlot}
                  className="flex-[2] bg-green-600 text-white py-2.5 sm:py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg dark:shadow-none disabled:opacity-50 text-sm sm:text-base"
                >
                  Proceed to Payment
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8 animate-fadeIn">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white border-b dark:border-gray-600 pb-2">Payment Method</h3>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div
                  onClick={() => setPaymentMethod(PaymentMethod.UPI)}
                  className={`cursor-pointer p-4 sm:p-6 rounded-xl border-2 transition-all flex flex-col items-center text-center space-y-2 sm:space-y-3 ${
                    paymentMethod === PaymentMethod.UPI
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-green-200 dark:hover:border-green-600'
                  }`}
                >
                  <CreditCard className={`h-6 w-6 sm:h-8 sm:w-8 ${paymentMethod === PaymentMethod.UPI ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Pay via UPI</span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">GPay, PhonePe, Paytm</span>
                </div>

                <div
                  onClick={() => setPaymentMethod(PaymentMethod.COD)}
                  className={`cursor-pointer p-4 sm:p-6 rounded-xl border-2 transition-all flex flex-col items-center text-center space-y-2 sm:space-y-3 ${
                    paymentMethod === PaymentMethod.COD
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-green-200 dark:hover:border-green-600'
                  }`}
                >
                  <Truck className={`h-6 w-6 sm:h-8 sm:w-8 ${paymentMethod === PaymentMethod.COD ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Cash on Delivery</span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Pay when you receive</span>
                </div>
              </div>

              {/* Delivery Summary */}
              {selectedDeliverySlot && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    {selectedDeliverySlot.isExpress ? '⚡ Express Delivery' : '📦 Scheduled Delivery'}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {selectedDeliverySlot.displayDate} • {selectedDeliverySlot.timeSlot}
                  </p>
                </div>
              )}

              {paymentMethod === PaymentMethod.UPI && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-800 p-4 sm:p-6 rounded-xl border border-green-100 dark:border-gray-600">
                  <div className="flex items-center justify-center space-x-2 mb-4">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Secure Payment via Razorpay</span>
                  </div>

                  {paymentError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {paymentError}
                      </p>
                    </div>
                  )}

                  <div className="text-center space-y-4">
                    <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{total.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Amount</p>
                    </div>

                    <button
                      onClick={initiateRazorpayPayment}
                      disabled={isPaymentLoading || !razorpayLoaded}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {isPaymentLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-5 w-5" />
                          <span>Pay Now</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>UPI</span>
                      <span>•</span>
                      <span>Cards</span>
                      <span>•</span>
                      <span>Net Banking</span>
                      <span>•</span>
                      <span>Wallets</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 sm:space-x-4">
                <button
                  onClick={() => setStep('delivery')}
                  disabled={isSubmitting}
                  className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2.5 sm:py-3 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  Back
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting}
                  className="flex-[2] bg-green-600 text-white py-2.5 sm:py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg dark:shadow-none disabled:opacity-50 text-sm sm:text-base"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface OrderSuccessProps {
  onHome: () => void;
}

export const OrderSuccess: React.FC<OrderSuccessProps> = ({ onHome }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 animate-fadeIn">
      <div className="bg-green-100 p-4 sm:p-6 rounded-full mb-4 sm:mb-6">
        <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-600" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 text-center">Order Placed Successfully!</h2>
      <p className="text-gray-500 max-w-md text-center mb-3 sm:mb-4 text-sm sm:text-base">
        Thank you for your purchase. We have received your order and will begin processing it right away.
      </p>
      <p className="text-green-600 text-xs sm:text-sm mb-6 sm:mb-8 text-center">
        You will receive confirmation via email and SMS shortly.
      </p>
      <button
        onClick={onHome}
        className="bg-green-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 text-sm sm:text-base"
      >
        Continue Shopping
      </button>
    </div>
  );
};
