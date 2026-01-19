'use client';

import React from 'react';
import { X, Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Product } from '../types';
import { useWishlist } from '../context/WishlistContext';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  onAddToCart
}) => {
  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();

  const handleAddToCart = (product: Product) => {
    onAddToCart(product);
    removeFromWishlist(product.id);
  };

  const handleAddAllToCart = () => {
    wishlist.forEach(product => {
      onAddToCart(product);
    });
    clearWishlist();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Heart className="h-5 w-5 text-red-500 fill-current" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              My Wishlist ({wishlist.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {wishlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                <Heart className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Your wishlist is empty
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Save items you like by clicking the heart icon on products
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {wishlist.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.category}
                    </p>
                    <p className="text-sm font-bold text-green-600 mt-1">
                      ₹{product.price}/{product.unit}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Add to Cart"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {wishlist.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              onClick={handleAddAllToCart}
              className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              <span>Add All to Cart</span>
            </button>
            <button
              onClick={clearWishlist}
              className="w-full mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear Wishlist
            </button>
          </div>
        )}
      </div>
    </>
  );
};
