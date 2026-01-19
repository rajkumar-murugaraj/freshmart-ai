'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Shop } from './components/Shop';
import { AdminPanel } from './components/AdminPanel';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { Checkout, OrderSuccess } from './components/Checkout';
import { AIAssistant } from './components/AIAssistant';
import { AuthModal } from './components/AuthModal';
import { UserProfile } from './components/UserProfile';
import { SalesPOS } from './components/SalesPOS';
import { Product, CartItem, ViewState, User } from './types';
import { api } from './lib/api';
import { toast } from 'react-toastify';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<ViewState>('shop');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Load Products
  useEffect(() => {
    fetchProducts();
  }, []);

  // Check localStorage for session
  useEffect(() => {
    const savedUser = localStorage.getItem('freshmart_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('freshmart_user');
      }
    } else {
      // No saved user - show auth modal
      setIsAuthModalOpen(true);
    }
  }, []);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('freshmart_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        localStorage.removeItem('freshmart_cart');
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('freshmart_cart', JSON.stringify(cart));
  }, [cart]);

  const fetchProducts = async () => {
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Failed to fetch products.");
    }
  };

  const addToCart = (product: Product) => {
    // Require login to add to cart
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + change) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('freshmart_cart');
  };

  const handleAddProduct = async (product: Product) => {
    const newProd = await api.addProduct(product);
    setProducts(prev => [newProd, ...prev]);
  };

  const handleUpdateProduct = async (product: Product) => {
    await api.updateProduct(product);
    setProducts(prev => prev.map(p => p.id === product.id ? product : p));
  };

  const handleDeleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('freshmart_user', JSON.stringify(user));
    setIsAuthModalOpen(false);

    if (user.role === 'admin') {
      setView('admin');
    } else if (user.role === 'sales') {
      setView('sales');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('freshmart_user');
    setCurrentUser(null);
    setView('shop');
    setIsAuthModalOpen(true); // Show login modal after logout
  };

  const handleOrderSuccess = async (orderData: any) => {
    try {
      await api.placeOrder(orderData);
      clearCart();
      setView('success');
      toast.success('Order placed successfully!');
    } catch (error) {
      toast.error('Failed to place order. Please try again.');
    }
  };

  const handleAskAI = () => {
    setIsCartOpen(false);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('freshmart_user', JSON.stringify(updatedUser));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        isAdmin={currentUser?.role === 'admin'}
        setView={setView}
        currentView={view}
        toggleCart={() => setIsCartOpen(true)}
        toggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        isMenuOpen={isMenuOpen}
        onSearch={setSearchQuery}
        currentUser={currentUser}
        onLoginClick={() => setIsAuthModalOpen(true)}
        onLogoutClick={handleLogout}
        onWishlistClick={() => setIsWishlistOpen(true)}
      />

      <main className="flex-grow">
        {/* Show login screen when not logged in */}
        {!currentUser && view === 'shop' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-lg border border-gray-100 text-center max-w-md w-full">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Welcome to FreshMart</h2>
              <p className="text-gray-500 mb-6 text-sm sm:text-base">Sign in to browse products, add items to cart, and place orders.</p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full bg-green-600 text-white py-2.5 sm:py-3 px-6 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 text-sm sm:text-base"
              >
                Sign In to Continue
              </button>
              <p className="text-xs text-gray-400 mt-4">Don&apos;t have an account? You can create one during sign-in.</p>
            </div>
          </div>
        )}

        {/* Show shop only when logged in */}
        {currentUser && view === 'shop' && (
          <Shop
            products={products}
            onAddToCart={addToCart}
            searchQuery={searchQuery}
          />
        )}

        {view === 'admin' && currentUser?.role === 'admin' ? (
          <AdminPanel
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            currentUser={currentUser}
          />
        ) : view === 'admin' ? (
          <div className="text-center py-20 text-red-600">Access Denied. Admins Only.</div>
        ) : null}

        {view === 'sales' && currentUser?.role === 'sales' ? (
          <SalesPOS
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        ) : view === 'sales' ? (
          <div className="text-center py-20 text-red-600">Access Denied. Sales Staff Only.</div>
        ) : null}

        {view === 'profile' && currentUser && (
          <UserProfile
            user={currentUser}
            onUpdateUser={handleUpdateUser}
            onReorder={(items) => {
              // Add items to cart
              items.forEach(item => {
                setCart(prev => {
                  const existing = prev.find(p => p.id === item.id);
                  if (existing) {
                    return prev.map(p =>
                      p.id === item.id ? { ...p, quantity: p.quantity + item.quantity } : p
                    );
                  }
                  return [...prev, item];
                });
              });
              setIsCartOpen(true);
            }}
          />
        )}

        {view === 'checkout' && (
          <Checkout
            cart={cart}
            currentUser={currentUser}
            onBack={() => setView('shop')}
            onSuccess={handleOrderSuccess}
            onLoginClick={() => setIsAuthModalOpen(true)}
          />
        )}

        {view === 'success' && (
          <OrderSuccess onHome={() => setView('shop')} />
        )}
      </main>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => {
          setIsCartOpen(false);
          setView('checkout');
        }}
        onAskAI={handleAskAI}
      />

      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        onAddToCart={addToCart}
      />

      {view === 'shop' && currentUser && currentUser.role !== 'admin' && (
        <AIAssistant cart={cart} />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          // Only allow closing if user is logged in
          if (currentUser) {
            setIsAuthModalOpen(false);
          }
        }}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
