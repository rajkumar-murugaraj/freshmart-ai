import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethod, User, Address, Order } from '../types';
import { CreditCard, Truck, CheckCircle, ArrowLeft, MapPin, Plus } from 'lucide-react';
import { toast } from 'react-toastify';

interface CheckoutProps {
  cart: CartItem[];
  currentUser: User | null;
  onBack: () => void;
  onSuccess: (order: Order) => void;
}

export const Checkout: React.FC<CheckoutProps> = ({ cart, currentUser, onBack, onSuccess }) => {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const [step, setStep] = useState<'details' | 'payment'>('details');
  
  // Form State
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

  useEffect(() => {
    // If user has addresses, select the first one by default
    if (currentUser && currentUser.addresses.length > 0) {
      setSelectedAddressId(currentUser.addresses[0].id);
      setIsNewAddress(false);
    } else {
      setIsNewAddress(true);
    }
  }, [currentUser]);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewAddress && !selectedAddressId) return;
    setStep('payment');
  };

  const handlePlaceOrder = () => {
    // Construct final shipping address
    let shippingAddress: Address;

    if (isNewAddress) {
      shippingAddress = {
        id: Date.now().toString(), // temporary ID
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
      if (!saved) return;
      shippingAddress = saved;
    }

    const orderData = {
        user_id: currentUser ? currentUser.id : null,
        total,
        items: cart,
        paymentMethod,
        shippingAddress
    };

    onSuccess(orderData as any);

    // Show success notification
    toast.success('Order placed successfully! 🎉', {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "light",
    });

    // Adding console logs to track checkout process
    console.log('Checkout process started');
    // After successful checkout
    console.log('Checkout successful');

    // Function to show notification
    function showNotification(message: string) {
        alert(message);
    }

    // Call the notification function after successful checkout
    showNotification('Checkout successful!');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Shop
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
            <div className="flex space-x-2 mt-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${step === 'details' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'}`}>1. Shipping</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${step === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2. Payment</span>
            </div>
          </div>
          <p className="text-xl font-bold text-green-600">Total: ₹{total}</p>
        </div>

        <div className="p-8">
          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-6 animate-fadeIn">
              
              {/* Address Selection Section */}
              {currentUser && currentUser.addresses.length > 0 && (
                <div className="space-y-4 mb-8">
                  <h3 className="text-lg font-semibold text-gray-800">Select Delivery Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentUser.addresses.map(addr => (
                      <div 
                        key={addr.id}
                        onClick={() => { setSelectedAddressId(addr.id); setIsNewAddress(false); }}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative ${
                          !isNewAddress && selectedAddressId === addr.id
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-green-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <MapPin className={`h-4 w-4 ${!isNewAddress && selectedAddressId === addr.id ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className="font-bold text-sm uppercase">{addr.label}</span>
                        </div>
                        <p className="font-medium">{addr.name}</p>
                        <p className="text-sm text-gray-500">{addr.street}, {addr.city}</p>
                        <p className="text-sm text-gray-500">{addr.zip}</p>
                      </div>
                    ))}
                    
                    <div 
                      onClick={() => setIsNewAddress(true)}
                      className={`cursor-pointer p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-gray-500 hover:text-green-600 hover:border-green-300 min-h-[140px] ${isNewAddress ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                    >
                      <Plus className="h-6 w-6 mb-2" />
                      <span className="font-medium">Add New Address</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form for New Address (or guest) */}
              {(isNewAddress || !currentUser) && (
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                   <h3 className="text-lg font-semibold text-gray-800 mb-4">{currentUser ? 'New Address Details' : 'Shipping Details'}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                          value={addressForm.name}
                          onChange={e => setAddressForm({...addressForm, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                          value={addressForm.street}
                          onChange={e => setAddressForm({...addressForm, street: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                          value={addressForm.city}
                          onChange={e => setAddressForm({...addressForm, city: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                          value={addressForm.zip}
                          onChange={e => setAddressForm({...addressForm, zip: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                          value={addressForm.phone}
                          onChange={e => setAddressForm({...addressForm, phone: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                          value={addressForm.email}
                          onChange={e => setAddressForm({...addressForm, email: e.target.value})}
                        />
                    </div>
                    {currentUser && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address Label (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. Home, Office"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                              value={addressForm.label}
                              onChange={e => setAddressForm({...addressForm, label: e.target.value})}
                            />
                        </div>
                    )}
                   </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors mt-4 shadow-lg shadow-green-100"
              >
                Proceed to Payment
              </button>
            </form>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Payment Method</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => setPaymentMethod(PaymentMethod.UPI)}
                  className={`cursor-pointer p-6 rounded-xl border-2 transition-all flex flex-col items-center text-center space-y-3 ${
                    paymentMethod === PaymentMethod.UPI 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-green-200'
                  }`}
                >
                  <CreditCard className={`h-8 w-8 ${paymentMethod === PaymentMethod.UPI ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900">Pay via UPI</span>
                  <span className="text-xs text-gray-500">GPay, PhonePe, Paytm</span>
                </div>

                <div 
                  onClick={() => setPaymentMethod(PaymentMethod.COD)}
                  className={`cursor-pointer p-6 rounded-xl border-2 transition-all flex flex-col items-center text-center space-y-3 ${
                    paymentMethod === PaymentMethod.COD 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-green-200'
                  }`}
                >
                  <Truck className={`h-8 w-8 ${paymentMethod === PaymentMethod.COD ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900">Cash on Delivery</span>
                  <span className="text-xs text-gray-500">Pay when you receive</span>
                </div>
              </div>

              {paymentMethod === PaymentMethod.UPI && (
                <div className="bg-gray-100 p-6 rounded-lg flex flex-col items-center justify-center space-y-4">
                  <div className="w-48 h-48 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                    {/* Simulated QR Code */}
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=freshmart@upi&pn=FreshMart&am=${total}&tn=OrderPayment`} 
                      alt="UPI QR Code" 
                      className="w-full h-full"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800">Scan this QR Code</p>
                    <p className="text-xs text-gray-500">Generated for ₹{total} payment</p>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                    onClick={() => setStep('details')}
                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={handlePlaceOrder}
                    className="flex-[2] bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg"
                >
                    Confirm Order
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
    <div className="flex flex-col items-center justify-center py-12 animate-fadeIn">
      <div className="bg-green-100 p-6 rounded-full mb-6">
        <CheckCircle className="h-16 w-16 text-green-600" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Order Placed Successfully!</h2>
      <p className="text-gray-500 max-w-md text-center mb-8">
        Thank you for your purchase. We have received your order and will begin processing it right away.
      </p>
      <button 
        onClick={onHome}
        className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
      >
        Continue Shopping
      </button>
    </div>
  );
};
