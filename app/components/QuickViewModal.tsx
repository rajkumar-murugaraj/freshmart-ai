'use client';

import React, { useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart, Heart, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { WishlistButton } from './WishlistButton';

interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false
}) => {
  const [quantity, setQuantity] = React.useState(1);

  // Reset quantity when product changes
  useEffect(() => {
    setQuantity(1);
  }, [product?.id]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, hasNext, hasPrev, onNext, onPrev]);

  if (!isOpen || !product) return null;

  const isOutOfStock = (product as any).stock === 0;

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product);
    }
    onClose();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description,
          url: window.location.href
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Navigation Arrows */}
        {hasPrev && onPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
            title="Previous product"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />
          </button>
        )}

        {hasNext && onNext && (
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
            title="Next product"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />
          </button>
        )}

        {/* Modal Content */}
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10 shadow-md"
          >
            <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>

          <div className="flex flex-col md:flex-row">
            {/* Product Image */}
            <div className="relative w-full md:w-1/2 h-64 sm:h-80 md:h-auto bg-gray-100 dark:bg-gray-700">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {/* Category Badge */}
              <span className="absolute top-3 left-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-1 rounded">
                {product.category}
              </span>
              {/* Stock Badge */}
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="w-full md:w-1/2 p-5 sm:p-6 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {product.name}
                </h2>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <WishlistButton product={product} size="md" />
                  <button
                    onClick={handleShare}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                    title="Share"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-green-600">
                  ₹{product.price}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  /{product.unit}
                </span>
              </div>

              {/* Description */}
              <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
                {product.description}
              </p>

              {/* Stock Info */}
              {(product as any).stock !== undefined && !isOutOfStock && (
                <div className="mt-4 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${(product as any).stock > 10 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {(product as any).stock > 10 ? 'In Stock' : `Only ${(product as any).stock} left`}
                  </span>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mt-6 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity:</span>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-l-lg"
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <span className="px-4 py-2 text-gray-900 dark:text-white font-medium min-w-[3rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-r-lg"
                    disabled={isOutOfStock || ((product as any).stock && quantity >= (product as any).stock)}
                  >
                    <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Total:</span>
                  <span className="text-xl font-bold text-green-600">
                    ₹{(product.price * quantity).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`mt-6 w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-bold text-white transition-all ${
                  isOutOfStock
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 dark:shadow-green-900/30 hover:shadow-xl'
                }`}
              >
                <ShoppingCart className="h-5 w-5" />
                <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
              </button>

              {/* Keyboard hint */}
              <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center hidden sm:block">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">←</kbd> <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">→</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> to close
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
