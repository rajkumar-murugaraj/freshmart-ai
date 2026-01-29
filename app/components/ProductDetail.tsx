'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Plus, Minus, ShoppingCart, Share2, Package, Tag, Check } from 'lucide-react';
import { Product } from '../types';
import { WishlistButton } from './WishlistButton';
import { ProductCarousel } from './ProductCarousel';
import ProductReviews from './ProductReviews';

interface ProductDetailProps {
  product: Product;
  allProducts: Product[];
  onAddToCart: (product: Product) => void;
  onBack: () => void;
  onProductClick: (product: Product) => void;
  currentUser?: { id: string; name: string; role: string } | null;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  allProducts,
  onAddToCart,
  onBack,
  onProductClick,
  currentUser
}) => {
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  // Reset state when product changes (e.g., variant navigation)
  useEffect(() => {
    setQuantity(1);
    setAddedToCart(false);
  }, [product.id]);

  const stock = product.stock;
  const minStock = product.min_stock || 10;
  const isOutOfStock = stock === 0;
  const isLowStock = stock !== undefined && stock > 0 && stock <= minStock;
  const maxQuantity = stock !== undefined ? stock : 99;

  // Get variant siblings (same variant_group, including current product)
  const variants = useMemo(() => {
    if (!product.variant_group) return [];
    return allProducts
      .filter(p => p.variant_group === product.variant_group)
      .sort((a, b) => a.price - b.price);
  }, [allProducts, product.variant_group]);

  const hasVariants = variants.length > 1;

  // Related products: same category, exclude current product and its variant siblings
  const relatedProducts = useMemo(() => {
    const variantIds = new Set(variants.map(v => v.id));

    // First: same category products (excluding self and variants)
    const sameCategory = allProducts
      .filter(p => p.category === product.category && p.id !== product.id && !variantIds.has(p.id))
      .slice(0, 8);

    // If fewer than 4, fill from other categories
    if (sameCategory.length < 4) {
      const otherCategory = allProducts
        .filter(p => p.category !== product.category && !variantIds.has(p.id))
        .slice(0, 8 - sameCategory.length);
      return [...sameCategory, ...otherCategory];
    }

    return sameCategory;
  }, [allProducts, product.category, product.id, variants]);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product);
    }
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
    setQuantity(1);
  };

  const handleShare = async () => {
    const shareText = `Check out ${product.name} on FreshMart - ₹${product.price}/${product.unit}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: shareText,
          url: window.location.href
        });
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
    }
  };

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors mb-4"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm font-medium">Back to Shop</span>
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center space-x-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6 overflow-x-auto">
        <button onClick={onBack} className="hover:text-green-600 dark:hover:text-green-400 transition-colors whitespace-nowrap">
          Home
        </button>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        <button onClick={onBack} className="hover:text-green-600 dark:hover:text-green-400 transition-colors whitespace-nowrap">
          {product.category}
        </button>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-gray-900 dark:text-white font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        {/* Left: Product Image */}
        <div className="w-full md:w-1/2">
          <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-2xl overflow-hidden group sticky top-24">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
            />
            {/* Category Badge */}
            <span className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-green-700 dark:text-green-400 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-lg">
              {product.category}
            </span>
            {/* Out of Stock Overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-lg">
                  Out of Stock
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Product Info */}
        <div className="w-full md:w-1/2 flex flex-col">
          {/* Product Name */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
            {product.name}
          </h1>

          {/* Price */}
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold text-green-600">
              ₹{product.price}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-lg">
              /{product.unit}
            </span>
          </div>

          {/* Variant Selector */}
          {hasVariants && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {product.variant_type || 'Variant'}:
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {variants.map(variant => {
                  const isSelected = variant.id === product.id;
                  const isVarOutOfStock = variant.stock === 0;

                  return (
                    <button
                      key={variant.id}
                      onClick={() => {
                        if (!isSelected && !isVarOutOfStock) {
                          onProductClick(variant);
                        }
                      }}
                      disabled={isVarOutOfStock}
                      className={`relative flex flex-col items-center min-w-[5rem] px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-green-600 bg-green-50 dark:bg-green-900/20 shadow-sm'
                          : isVarOutOfStock
                            ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-green-400 dark:hover:border-green-500 hover:shadow-sm cursor-pointer'
                      }`}
                    >
                      {/* Selected check mark */}
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}

                      <span className={`text-sm font-bold ${
                        isSelected
                          ? 'text-green-700 dark:text-green-400'
                          : isVarOutOfStock
                            ? 'text-gray-400 dark:text-gray-500 line-through'
                            : 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {variant.variant_value}
                      </span>

                      <span className={`text-xs mt-0.5 ${
                        isSelected
                          ? 'text-green-600 dark:text-green-500 font-semibold'
                          : isVarOutOfStock
                            ? 'text-gray-400 dark:text-gray-500'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        ₹{variant.price}
                      </span>

                      {isVarOutOfStock && (
                        <span className="text-[10px] text-red-500 dark:text-red-400 mt-0.5 font-medium">
                          Out of stock
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock Status */}
          {stock !== undefined && (
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              <span className={`text-sm font-medium ${
                isOutOfStock
                  ? 'text-red-600 dark:text-red-400'
                  : isLowStock
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
              }`}>
                {isOutOfStock
                  ? 'Out of Stock'
                  : isLowStock
                    ? `Only ${stock} left - Order soon!`
                    : 'In Stock'}
              </span>
            </div>
          )}

          {/* Description */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              About this product
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
              {product.description}
            </p>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-gray-200 dark:border-gray-700" />

          {/* Product Highlights */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Package className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Unit</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{product.unit}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Tag className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Category</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{product.category}</p>
              </div>
            </div>
          </div>

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity:</span>
              <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
                <span className="px-5 py-2.5 text-gray-900 dark:text-white font-semibold min-w-[3.5rem] text-center bg-gray-50 dark:bg-gray-700/50">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                  className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  disabled={quantity >= maxQuantity}
                >
                  <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          )}

          {/* Total Price */}
          {!isOutOfStock && quantity > 1 && (
            <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Total ({quantity} items):</span>
                <span className="text-xl font-bold text-green-600">
                  ₹{(product.price * quantity).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-bold text-white text-base transition-all ${
                isOutOfStock
                  ? 'bg-gray-400 cursor-not-allowed'
                  : addedToCart
                    ? 'bg-green-700 shadow-lg'
                    : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 dark:shadow-green-900/30 hover:shadow-xl active:scale-[0.98]'
              }`}
            >
              {addedToCart ? (
                <>
                  <Check className="h-5 w-5" />
                  <span>Added to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
                </>
              )}
            </button>

            <WishlistButton product={product} size="md" />

            <button
              onClick={handleShare}
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              title="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Reviews */}
      <ProductReviews productId={product.id} currentUser={currentUser || null} />

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-12 sm:mt-16">
          <ProductCarousel
            products={relatedProducts}
            title="You Might Also Like"
            subtitle={`More products for you`}
            type="featured"
            onAddToCart={onAddToCart}
            onProductClick={onProductClick}
          />
        </div>
      )}
    </div>
  );
};
