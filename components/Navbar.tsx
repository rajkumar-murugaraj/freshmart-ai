import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { io as socketIOClient } from 'socket.io-client';
import { ShoppingCart, User, ShieldCheck, Menu, X, Search, LogOut, ArrowLeft } from 'lucide-react';
import { ViewState, User as UserType } from '../types';

interface NavbarProps {
  cartCount: number;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  setView: (view: ViewState) => void;
  toggleCart: () => void;
  toggleMenu: () => void;
  isMenuOpen: boolean;
  onSearch: (query: string) => void;
  currentUser: UserType | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  currentView: ViewState;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  isAdmin,
  setIsAdmin,
  setView,
  toggleCart,
  toggleMenu,
  isMenuOpen,
  onSearch,
  currentUser,
  onLoginClick,
  onLogoutClick,
  currentView
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [notifToast, setNotifToast] = useState<{ visible: boolean; message: string; id?: string }>({ visible: false, message: '' });
  const lastNotifIds = useRef(new Set<string>());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll server notifications for admin users and show a transient toast
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let mounted = true;

    const fetchNotifs = async () => {
      try {
        const rows = await api.getNotifications('0', true);
        if (!mounted) return;
        const mapped = (rows || []).map((r: any) => ({ id: String(r.id), message: r.message }));
        const newOnes = mapped.filter((m: any) => !lastNotifIds.current.has(m.id));
        if (newOnes.length > 0) {
          // show the most recent one
          const latest = newOnes[0];
          setNotifToast({ visible: true, message: latest.message, id: latest.id });
          setTimeout(() => setNotifToast(t => t.id === latest.id ? { visible: false, message: '' } : t), 5000);
        }
        lastNotifIds.current = new Set(mapped.map((m: any) => m.id));
      } catch (e) {
        console.error('Navbar notification poll failed', e);
      }
    };

    fetchNotifs();
    const id = setInterval(fetchNotifs, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, [currentUser]);

  // Socket listener for immediate admin notifications
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    const socket = socketIOClient();
    socket.on('notification', (n: any) => {
      try {
        if (n && Number(n.is_admin) === 1) {
          const id = String(n.id);
          if (!lastNotifIds.current.has(id)) {
            lastNotifIds.current.add(id);
            setNotifToast({ visible: true, message: n.message, id });
            setTimeout(() => setNotifToast(t => t.id === id ? { visible: false, message: '' } : t), 5000);
          }
        }
      } catch (e) {
        console.error('Socket notification handler error', e);
      }
    });

    return () => { socket.disconnect(); };
  }, [currentUser]);

  // Live Search Handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onSearch(val);
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearch('');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          <div className="flex items-center space-x-4">
             {/* Back Button (Only if not in Shop) */}
             {currentView !== 'shop' && (
               <button onClick={() => setView('shop')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                 <ArrowLeft className="h-5 w-5" />
               </button>
             )}
             
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => setView('shop')}>
              <span className="text-2xl font-bold text-green-600">FreshMart<span className="text-gray-800">AI</span></span>
            </div>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="w-full relative">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-10 pr-10 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              {searchQuery && (
                <button 
                  onClick={clearSearch}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Admin Dashboard Link - Only for Admin */}
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setView('admin')}
                className={`flex items-center space-x-1 text-sm font-medium ${currentView === 'admin' ? 'text-green-600' : 'text-gray-600 hover:text-green-600'}`}
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {currentView !== 'admin' && (
              <button onClick={toggleCart} className="relative p-2 text-gray-600 hover:text-green-600 transition-colors">
                <ShoppingCart className="h-6 w-6" />
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {currentUser ? (
              <div className="relative" ref={profileMenuRef}>
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-green-600 focus:outline-none"
                >
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold border border-green-200">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{currentUser.name}</span>
                </button>
                
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 border border-gray-100 z-50 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                        <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
                        <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                        <p className="text-xs text-gray-500 capitalize mt-1">Role: {currentUser.role}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setView('profile');
                        setShowProfileMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="inline h-4 w-4 mr-2" />
                      My Profile & Orders
                    </button>
                    <button 
                      onClick={() => {
                        onLogoutClick();
                        setShowProfileMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="inline h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={onLoginClick}
                className="text-sm font-medium text-white bg-gray-900 px-4 py-2 rounded-lg hover:bg-black transition-colors"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={toggleMenu}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 focus:outline-none"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 pt-2 pb-4 space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              {searchQuery && (
                  <button onClick={clearSearch} className="absolute right-3 top-2.5">
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
              )}
            </div>
            
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => {
                  setView('admin');
                  toggleMenu();
                }}
                className="flex items-center w-full space-x-2 text-gray-700 font-medium p-2 rounded hover:bg-gray-50"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Admin Dashboard</span>
              </button>
            )}
            
            <div className="border-t border-gray-100 my-2"></div>
            {currentUser ? (
              <>
                <div className="flex items-center space-x-3 px-2 py-2">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                        {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-medium">{currentUser.name}</p>
                        <p className="text-xs text-gray-500">{currentUser.email}</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setView('profile'); toggleMenu(); }}
                    className="flex items-center w-full space-x-2 text-gray-700 p-2"
                >
                    <User className="h-5 w-5" />
                    <span>My Profile</span>
                </button>
                <button 
                    onClick={() => { onLogoutClick(); toggleMenu(); }}
                    className="flex items-center w-full space-x-2 text-red-600 p-2"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                </button>
              </>
            ) : (
               <button 
                onClick={() => { onLoginClick(); toggleMenu(); }}
                className="flex items-center w-full space-x-2 text-green-600 font-medium p-2"
               >
                   <User className="h-5 w-5" />
                   <span>Sign In / Register</span>
               </button>
            )}
          </div>
        </div>
      )}
      {/* Admin notification toast (transient) */}
      {notifToast.visible && (
        <div className="fixed right-6 bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 z-50">
          <div className="text-sm text-gray-900">{notifToast.message}</div>
        </div>
      )}
    </nav>
  );
};