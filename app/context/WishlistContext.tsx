'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Product } from '../types';
import { api } from '../lib/api';
import { toast } from 'react-toastify';

interface WishlistContextType {
  wishlist: Product[];
  priceDropCount: number;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
  loadWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [priceDropCount, setPriceDropCount] = useState<number>(0);

  const getUserId = (): string | null => {
    try {
      const saved = localStorage.getItem('freshmart_user');
      if (saved) {
        const user = JSON.parse(saved);
        return user?.id || null;
      }
    } catch {}
    return null;
  };

  // Load wishlist from backend API when userId is available, otherwise from localStorage
  const loadWishlist = useCallback(async () => {
    const userId = getUserId();
    if (userId) {
      try {
        const data = await api.getWishlist(userId);
        const items = data.items || [];
        const products: Product[] = items
          .filter((item: any) => item.product)
          .map((item: any) => item.product);
        const drops = items.filter((item: any) => item.price_dropped).length;

        setWishlist(products);
        setPriceDropCount(drops);
        // Cache to localStorage
        localStorage.setItem('freshmart_wishlist', JSON.stringify(products));
      } catch (e) {
        // Fall back to localStorage cache on API failure
        const saved = localStorage.getItem('freshmart_wishlist');
        if (saved) {
          try {
            setWishlist(JSON.parse(saved));
          } catch {
            localStorage.removeItem('freshmart_wishlist');
          }
        }
      }
    } else {
      // Not logged in — use localStorage only
      const saved = localStorage.getItem('freshmart_wishlist');
      if (saved) {
        try {
          setWishlist(JSON.parse(saved));
        } catch {
          localStorage.removeItem('freshmart_wishlist');
        }
      }
      setPriceDropCount(0);
    }
  }, []);

  // Load wishlist on mount and when userId changes
  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  // Save wishlist to localStorage whenever it changes (acts as cache)
  useEffect(() => {
    localStorage.setItem('freshmart_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const addToWishlist = (product: Product) => {
    setWishlist(prev => {
      if (prev.some(p => p.id === product.id)) {
        return prev;
      }
      toast.success(`${product.name} added to wishlist!`);
      return [...prev, product];
    });

    // Sync with backend if logged in
    const uid = getUserId();
    if (uid) {
      api.addToWishlistApi(uid, product.id).catch(() => {
        // Revert on failure
        setWishlist(prev => prev.filter(p => p.id !== product.id));
        toast.error('Failed to sync wishlist. Please try again.');
      });
    }
  };

  const removeFromWishlist = (productId: string) => {
    const product = wishlist.find(p => p.id === productId);

    setWishlist(prev => {
      const found = prev.find(p => p.id === productId);
      if (found) {
        toast.info(`${found.name} removed from wishlist`);
      }
      return prev.filter(p => p.id !== productId);
    });

    // Sync with backend if logged in
    const uid = getUserId();
    if (uid) {
      api.removeFromWishlistApi(uid, productId).catch(() => {
        // Revert on failure
        if (product) {
          setWishlist(prev => [...prev, product]);
        }
        toast.error('Failed to sync wishlist. Please try again.');
      });
    }
  };

  const isInWishlist = (productId: string) => {
    return wishlist.some(p => p.id === productId);
  };

  const clearWishlist = () => {
    const previousWishlist = [...wishlist];
    setWishlist([]);
    setPriceDropCount(0);
    localStorage.removeItem('freshmart_wishlist');

    // Remove each item from backend if logged in
    const uid = getUserId();
    if (uid) {
      Promise.all(
        previousWishlist.map(p => api.removeFromWishlistApi(uid, p.id).catch(() => {}))
      ).catch(() => {
        // If bulk removal fails, we still keep local state cleared
      });
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlist, priceDropCount, addToWishlist, removeFromWishlist, isInWishlist, clearWishlist, loadWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
