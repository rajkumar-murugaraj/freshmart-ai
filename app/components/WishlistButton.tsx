'use client';

import React from 'react';
import { Heart } from 'lucide-react';
import { Product } from '../types';
import { useWishlist } from '../context/WishlistContext';

interface WishlistButtonProps {
  product: Product;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({
  product,
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const inWishlist = isInWishlist(product.id);

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const buttonSizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5'
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`${buttonSizeClasses[size]} rounded-full transition-all duration-200 ${
        inWishlist
          ? 'bg-red-100 dark:bg-red-900/50 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/70'
          : 'bg-white/80 dark:bg-gray-800/80 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-700'
      } backdrop-blur-sm shadow-sm ${className}`}
      title={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
    >
      <Heart
        className={`${sizeClasses[size]} ${inWishlist ? 'fill-current' : ''}`}
      />
      {showLabel && (
        <span className="ml-1.5 text-sm font-medium">
          {inWishlist ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
};
