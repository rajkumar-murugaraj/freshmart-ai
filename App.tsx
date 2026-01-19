import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Shop } from './components/Shop';
import { AdminPanel } from './components/AdminPanel';
import { CartDrawer } from './components/CartDrawer';
import { Checkout, OrderSuccess } from './components/Checkout';
import { AIAssistant } from './components/AIAssistant';
import { AuthModal } from './components/AuthModal';
import { UserProfile } from './components/UserProfile';
import { Product, CartItem, ViewState, User, Order } from './types';
import { api } from './services/api';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  // isAdmin logic replaced by currentUser.role
  const [view, setView] = useState<ViewState>('shop');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auth State
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
        setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchProducts = async () => {
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (error) {
          console.error("Failed to fetch products. Ensure backend is running.");
      }
  };

  const addToCart = (product: Product) => {
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

  const clearCart = () => setCart([]);

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
    
    // Redirect Admin immediately
    if (user.role === 'admin') {
        setView('admin');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('freshmart_user');
    setCurrentUser(null);
    setView('shop');
  };

  const handleOrderSuccess = async (orderData: Order) => {
    await api.placeOrder(orderData);
    
    // If user is logged in, refresh their local order history (simplified)
    if (currentUser) {
       // In a real app, we'd just refetch the order list when visiting profile
    }
    clearCart();
    setView('success');
  };

  const handleAskAI = () => {
    setIsCartOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar 
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        isAdmin={currentUser?.role === 'admin'}
        setIsAdmin={() => {}} // No longer used toggler
        setView={setView}
        currentView={view}
        toggleCart={() => setIsCartOpen(true)}
        toggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        isMenuOpen={isMenuOpen}
        onSearch={setSearchQuery}
        currentUser={currentUser}
        onLoginClick={() => setIsAuthModalOpen(true)}
        onLogoutClick={handleLogout}
      />

      <main className="flex-grow">
        {view === 'shop' && (
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
          />
        ) : view === 'admin' ? (
             <div className="text-center py-20 text-red-600">Access Denied. Admins Only.</div>
        ) : null}

        {view === 'profile' && currentUser && (
          <UserProfile 
            user={currentUser} 
            onUpdateUser={setCurrentUser} 
          />
        )}

        {view === 'checkout' && (
          <Checkout 
            cart={cart} 
            currentUser={currentUser}
            onBack={() => setView('shop')}
            onSuccess={handleOrderSuccess}
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

      {/* Only show AI Assistant in Shop mode for Users */}
      {view === 'shop' && currentUser?.role !== 'admin' && (
        <AIAssistant cart={cart} />
      )}

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      
    </div>
  );
};

export default App;