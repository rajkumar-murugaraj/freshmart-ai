'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  ShoppingBag,
  X,
  CheckCircle,
  Printer,
  ChevronUp
} from 'lucide-react';
import { api } from '../lib/api';
import { Product, User } from '../types';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  stock: number;
}

interface SalesPOSProps {
  currentUser: User;
  onLogout: () => void;
}

export const SalesPOS: React.FC<SalesPOSProps> = ({ currentUser, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
    // Focus search on mount (desktop only)
    if (window.innerWidth >= 768) {
      searchInputRef.current?.focus();
    }
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (e) {
      console.error('Failed to fetch products', e);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const availableStock = (product as any).stock || 999;

    if (currentQty >= availableStock) {
      alert('Cannot add more. Stock limit reached.');
      return;
    }

    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        unit: product.unit,
        stock: availableStock
      }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, Math.min(item.stock, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = 0; // Can add tax calculation if needed
  const total = subtotal + tax;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    setProcessing(true);
    try {
      const saleData = await api.createSale(
        cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        paymentMethod,
        undefined // No customer ID for walk-in
      );

      setLastSale({
        ...saleData.sale,
        items: cart,
        paymentMethod,
        cashier: currentUser.name
      });
      setShowReceipt(true);
      setCart([]);
      setShowMobileCart(false);
      fetchProducts(); // Refresh stock
    } catch (e: any) {
      alert(e.message || 'Failed to process sale');
    }
    setProcessing(false);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showProductDropdown && filteredProducts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedDropdownIndex(prev =>
          prev < Math.min(filteredProducts.length - 1, 9) ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedDropdownIndex(prev =>
          prev > 0 ? prev - 1 : Math.min(filteredProducts.length - 1, 9)
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedProduct = filteredProducts[selectedDropdownIndex];
        if (selectedProduct && (selectedProduct as any).stock > 0) {
          addToCart(selectedProduct);
          setSearchQuery('');
          setShowProductDropdown(false);
          setSelectedDropdownIndex(0);
        }
      } else if (e.key === 'Escape') {
        setShowProductDropdown(false);
        setSelectedDropdownIndex(0);
      }
    } else if (e.key === 'Enter' && searchQuery.trim() && filteredProducts.length > 0) {
      // Show dropdown if there are matching products
      if (filteredProducts.length === 1 && (filteredProducts[0] as any).stock > 0) {
        addToCart(filteredProducts[0]);
        setSearchQuery('');
      } else if (filteredProducts.length > 1) {
        setShowProductDropdown(true);
        setSelectedDropdownIndex(0);
      }
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSelectedDropdownIndex(0);
    if (e.target.value.trim()) {
      setShowProductDropdown(true);
    } else {
      setShowProductDropdown(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    if ((product as any).stock > 0) {
      addToCart(product);
      setSearchQuery('');
      setShowProductDropdown(false);
      setSelectedDropdownIndex(0);
      searchInputRef.current?.focus();
    }
  };

  // Cart Panel Component (shared between desktop and mobile)
  const CartPanel = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`flex flex-col ${isMobile ? 'h-full' : ''}`}>
      {/* Cart Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
            <Receipt className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600" />
            Current Order
          </h2>
          <div className="flex items-center space-x-2">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs sm:text-sm text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            )}
            {isMobile && (
              <button
                onClick={() => setShowMobileCart(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {cart.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-400">
            <ShoppingBag className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm sm:text-base">No items in cart</p>
            <p className="text-xs sm:text-sm">Search and add products</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{item.name}</p>
                  <p className="text-xs sm:text-sm text-gray-500">₹{item.price} × {item.quantity}</p>
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2 ml-2 sm:ml-3">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                  <span className="w-6 sm:w-8 text-center font-medium text-sm sm:text-base">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    disabled={item.quantity >= item.stock}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Footer */}
      <div className="border-t border-gray-200 p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Totals */}
        <div className="space-y-1 sm:space-y-2">
          <div className="flex justify-between text-xs sm:text-sm text-gray-600">
            <span>Subtotal ({cartItemCount} items)</span>
            <span>₹{subtotal}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between text-xs sm:text-sm text-gray-600">
              <span>Tax</span>
              <span>₹{tax}</span>
            </div>
          )}
          <div className="flex justify-between text-lg sm:text-xl font-bold text-gray-900 pt-2 border-t">
            <span>Total</span>
            <span className="text-green-600">₹{total}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Payment Method</p>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border flex items-center justify-center transition-colors ${
                paymentMethod === 'cash' ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Banknote className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Cash
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border flex items-center justify-center transition-colors ${
                paymentMethod === 'card' ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Card
            </button>
            <button
              onClick={() => setPaymentMethod('upi')}
              className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border flex items-center justify-center transition-colors ${
                paymentMethod === 'upi' ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Smartphone className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              UPI
            </button>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || processing}
          className="w-full bg-green-600 text-white py-3 sm:py-4 rounded-lg font-bold text-sm sm:text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {processing ? (
            'Processing...'
          ) : (
            <>
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Complete Sale - ₹{total}
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="bg-green-600 text-white p-1.5 sm:p-2 rounded-lg">
              <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900">FreshMart POS</h1>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Point of Sale System</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
              <p className="text-xs text-gray-500">Cashier</p>
            </div>
            <button
              onClick={onLogout}
              className="text-xs sm:text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Products Panel */}
        <div className="flex-1 flex flex-col p-2 sm:p-4 overflow-hidden">
          {/* Search */}
          <div className="relative mb-3 sm:mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 z-10" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products... (Press Enter to select)"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
              onFocus={() => searchQuery.trim() && setShowProductDropdown(true)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm sm:text-lg"
            />

            {/* Product Selection Dropdown */}
            {showProductDropdown && searchQuery.trim() && filteredProducts.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50"
              >
                {filteredProducts.slice(0, 10).map((product, index) => {
                  const stock = (product as any).stock || 0;
                  const isOutOfStock = stock === 0;
                  const isSelected = index === selectedDropdownIndex;
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      disabled={isOutOfStock}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                        isSelected ? 'bg-green-50 border-l-2 border-green-500' : ''
                      } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.category}</p>
                        </div>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="font-bold text-green-600 text-sm">₹{product.price}</p>
                        <p className={`text-xs ${isOutOfStock ? 'text-red-500' : 'text-gray-400'}`}>
                          {isOutOfStock ? 'Out of stock' : `Stock: ${stock}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {filteredProducts.length > 10 && (
                  <div className="px-3 py-2 text-center text-xs text-gray-500 bg-gray-50">
                    +{filteredProducts.length - 10} more results
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {loading ? (
              <div className="text-center py-12 text-gray-500 text-sm">Loading products...</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {filteredProducts.map(product => {
                  const stock = (product as any).stock || 0;
                  const isOutOfStock = stock === 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      disabled={isOutOfStock}
                      className={`bg-white p-2 sm:p-3 rounded-lg border text-left transition-all ${
                        isOutOfStock
                          ? 'border-gray-200 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-green-500 hover:shadow-md active:scale-95'
                      }`}
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg mb-1.5 sm:mb-2 overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{product.name}</p>
                      <div className="flex justify-between items-center mt-0.5 sm:mt-1">
                        <span className="text-green-600 font-bold text-xs sm:text-sm">₹{product.price}</span>
                        <span className={`text-[10px] sm:text-xs ${isOutOfStock ? 'text-red-500' : 'text-gray-400'}`}>
                          {isOutOfStock ? 'Out' : stock}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Cart Panel */}
        <div className="hidden md:flex w-80 lg:w-96 bg-white border-l border-gray-200 flex-col">
          <CartPanel />
        </div>

        {/* Mobile Cart Button */}
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-bold shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center">
              <div className="bg-white/20 rounded-lg p-2 mr-3">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm">{cartItemCount} items</p>
                <p className="text-xs opacity-80">Tap to view cart</p>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-lg font-bold mr-2">₹{total}</span>
              <ChevronUp className="h-5 w-5" />
            </div>
          </button>
        </div>

        {/* Mobile Cart Drawer */}
        {showMobileCart && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileCart(false)}
            />
            <div className="mt-auto bg-white rounded-t-2xl max-h-[85vh] flex flex-col relative animate-slideUp">
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto my-2" />
              <CartPanel isMobile />
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:bg-white print:p-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden print:shadow-none print:rounded-none">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center print:hidden">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Sale Complete</h2>
              <button onClick={() => setShowReceipt(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4" id="receipt">
              <div className="text-center pb-3 sm:pb-4 border-b border-dashed border-gray-300">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">FreshMart</h3>
                <p className="text-xs sm:text-sm text-gray-500">Tax Invoice</p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Receipt #{lastSale.receiptNo}</p>
              </div>

              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                {lastSale.items.map((item: CartItem, index: number) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-gray-700">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-medium">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 sm:pt-4 border-t border-dashed border-gray-300 space-y-1.5 sm:space-y-2">
                <div className="flex justify-between text-base sm:text-lg font-bold">
                  <span>Total</span>
                  <span className="text-green-600">₹{lastSale.total}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm text-gray-500">
                  <span>Payment</span>
                  <span className="capitalize">{lastSale.paymentMethod}</span>
                </div>
              </div>

              <div className="pt-3 sm:pt-4 border-t border-gray-200 text-center text-[10px] sm:text-xs text-gray-500">
                <p>Cashier: {lastSale.cashier}</p>
                <p>{new Date(lastSale.createdAt).toLocaleString()}</p>
                <p className="mt-2">Thank you for shopping with us!</p>
              </div>
            </div>

            <div className="p-3 sm:p-4 border-t border-gray-100 flex space-x-2 sm:space-x-3 print:hidden">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 bg-gray-100 text-gray-700 py-2 sm:py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center text-sm"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 bg-green-600 text-white py-2 sm:py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt, #receipt * {
            visibility: visible;
          }
          #receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 10mm;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
