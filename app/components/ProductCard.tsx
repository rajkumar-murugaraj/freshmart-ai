'use client';

import React from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { Product } from '../types';
import { WishlistButton } from './WishlistButton';

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  onAddToCart?: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onQuickView?: (product: Product) => void;
  onProductClick?: (product: Product) => void;
  showWishlist?: boolean;
  variantCount?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isAdmin,
  onAddToCart,
  onEdit,
  onDelete,
  onQuickView,
  onProductClick,
  showWishlist = true,
  variantCount
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full ${onProductClick ? 'cursor-pointer' : ''}`}
      onClick={() => onProductClick?.(product)}
    >
      <div className="relative h-32 sm:h-48 w-full bg-gray-100 dark:bg-gray-700 overflow-hidden group">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
        />
        {product.category && (
          <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-green-700 dark:text-green-400 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
            {product.category}
          </span>
        )}
        {/* Variant badge - admin shows count, shop shows type:value */}
        {isAdmin && variantCount && variantCount > 1 ? (
          <span className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 bg-purple-600/90 backdrop-blur-sm text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
            {variantCount} variants
          </span>
        ) : !isAdmin && product.variant_group && product.variant_type ? (
          <span className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 bg-purple-600/90 backdrop-blur-sm text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
            {product.variant_type}: {product.variant_value}
          </span>
        ) : null}
        {/* Wishlist & Quick View Buttons */}
        {!isAdmin && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {showWishlist && <WishlistButton product={product} size="sm" />}
            {onQuickView && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickView(product); }}
                className="p-1.5 sm:p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors"
                title="Quick View"
              >
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-300" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-2.5 sm:p-4 flex flex-col flex-grow">
        <h3 className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white line-clamp-1">{product.name}</h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 line-clamp-2 flex-grow">{product.description}</p>

        <div className="mt-2 sm:mt-4 flex items-center justify-between">
          <div>
            <span className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">₹{product.price}</span>
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 ml-0.5 sm:ml-1">/{product.unit}</span>
          </div>
          {(product as any).stock !== undefined && (
            <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded ${
              (product as any).stock === 0
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : (product as any).stock <= ((product as any).min_stock || 10)
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            }`}>
              {(product as any).stock === 0 ? 'Out of stock' : `${(product as any).stock} left`}
            </span>
          )}
        </div>

        <div className="mt-2 sm:mt-4">
          {isAdmin ? (
            <div className="flex space-x-1.5 sm:space-x-2">
              <button
                onClick={() => onEdit?.(product)}
                className="flex-1 flex items-center justify-center space-x-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 py-1.5 sm:py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-xs sm:text-sm font-medium"
              >
                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => onDelete?.(product.id)}
                className="flex-1 flex items-center justify-center space-x-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 py-1.5 sm:py-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-xs sm:text-sm font-medium"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart?.(product); }}
              disabled={(product as any).stock === 0}
              className={`w-full flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-2.5 rounded-lg transition-colors font-medium text-xs sm:text-base ${
                (product as any).stock === 0
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 active:scale-95 transform'
              }`}
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{(product as any).stock === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
