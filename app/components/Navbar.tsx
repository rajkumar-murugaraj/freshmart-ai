'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ShoppingCart, User, ShieldCheck, Menu, X, Search, LogOut, ArrowLeft, Receipt, Sun, Moon, Heart } from 'lucide-react';
import { ViewState, User as UserType } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useWishlist } from '../context/WishlistContext';

interface NavbarProps {
  cartCount: number;
  isAdmin: boolean;
  setView: (view: ViewState) => void;
  toggleCart: () => void;
  toggleMenu: () => void;
  isMenuOpen: boolean;
  onSearch: (query: string) => void;
  currentUser: UserType | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  currentView: ViewState;
  onWishlistClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  isAdmin,
  setView,
  toggleCart,
  toggleMenu,
  isMenuOpen,
  onSearch,
  currentUser,
  onLoginClick,
  onLogoutClick,
  currentView,
  onWishlistClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { toggleTheme, isDark } = useTheme();
  const { wishlist } = useWishlist();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <nav className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          <div className="flex items-center space-x-4">
            {currentView !== 'shop' && (
              <button onClick={() => setView('shop')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}

            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => setView('shop')}>
              <span className="text-2xl font-bold text-green-600">FreshMart<span className="text-gray-800 dark:text-white">AI</span></span>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="w-full relative">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-10 pr-10 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setView('admin')}
                className={`flex items-center space-x-1 text-sm font-medium ${currentView === 'admin' ? 'text-green-600' : 'text-gray-600 dark:text-gray-300 hover:text-green-600'}`}
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {currentUser?.role === 'sales' && (
              <button
                onClick={() => setView('sales')}
                className={`flex items-center space-x-1 text-sm font-medium ${currentView === 'sales' ? 'text-green-600' : 'text-gray-600 dark:text-gray-300 hover:text-green-600'}`}
              >
                <Receipt className="h-5 w-5" />
                <span>POS System</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {currentView !== 'admin' && currentView !== 'sales' && (
              <>
                {/* Wishlist Button */}
                <button
                  onClick={onWishlistClick}
                  className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors"
                  title="My Wishlist"
                >
                  <Heart className={`h-5 w-5 ${wishlist.length > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                  {wishlist.length > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
                      {wishlist.length}
                    </span>
                  )}
                </button>

                {/* Cart Button */}
                <button onClick={toggleCart} className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-green-600 transition-colors">
                  <ShoppingCart className="h-6 w-6" />
                  {cartCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
                      {cartCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {currentUser ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-green-600 focus:outline-none"
                >
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-700 dark:text-green-300 font-bold border border-green-200 dark:border-green-700">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{currentUser.name}</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 border border-gray-100 dark:border-gray-700 z-50 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{currentUser.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-1">Role: {currentUser.role}</p>
                    </div>
                    <button
                      onClick={() => {
                        setView('profile');
                        setShowProfileMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <User className="inline h-4 w-4 mr-2" />
                      My Profile & Orders
                    </button>
                    <button
                      onClick={() => {
                        onLogoutClick();
                        setShowProfileMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                className="text-sm font-medium text-white bg-gray-900 dark:bg-green-600 px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-green-700 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>

          <div className="flex items-center md:hidden space-x-2">
            {/* Mobile Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleMenu}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <div className="px-4 pt-2 pb-4 space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                className="flex items-center w-full space-x-2 text-gray-700 dark:text-gray-300 font-medium p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {currentUser?.role === 'sales' && (
              <button
                onClick={() => {
                  setView('sales');
                  toggleMenu();
                }}
                className="flex items-center w-full space-x-2 text-gray-700 dark:text-gray-300 font-medium p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Receipt className="h-5 w-5" />
                <span>POS System</span>
              </button>
            )}

            <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>
            {currentUser ? (
              <>
                <div className="flex items-center space-x-3 px-2 py-2">
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-700 dark:text-green-300 font-bold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setView('profile'); toggleMenu(); }}
                  className="flex items-center w-full space-x-2 text-gray-700 dark:text-gray-300 p-2"
                >
                  <User className="h-5 w-5" />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => { onLogoutClick(); toggleMenu(); }}
                  className="flex items-center w-full space-x-2 text-red-600 dark:text-red-400 p-2"
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
    </nav>
  );
};
